import { NextRequest, NextResponse } from 'next/server';
import {
  validateReportRequest,
  createSuccessResponse,
  createErrorResponse,
  HttpStatus,
  ErrorMessages,
} from '@/lib/validation';
import { gpsToGrid, getNeighborGrids, getGridId } from '@/lib/coordinates';
import { isWithinBounds } from '@/lib/coordinates';
import { insertReport } from '@/lib/supabase';
import { gridStorage } from '@/lib/grid-storage';
import {
  calculateBaseWeight,
  executeAreaOfEffectUpdate,
  getRecentReportsCount,
} from '@/lib/trust-algorithm';
import { markGridsAsChanged } from '@/lib/redis';
import { getDefaultAreaConfig } from '@/config/areas';
// test areas functions removed as they're not used in this route
import { gridToGps } from '@/lib/coordinates';

/**
 * POST /api/report - 處理淤泥狀態回報
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 解析和驗證請求資料
    const body = await request.json();
    const { lat, lon, state, areaConfig: clientAreaConfig } = validateReportRequest(body);

    // 2. 決定使用哪個區域配置
    const location = { lat, lon };
    let areaConfig;

    if (clientAreaConfig) {
      // 使用前端傳來的區域配置
      areaConfig = clientAreaConfig;
    } else {
      // 預設使用光復鄉配置
      areaConfig = getDefaultAreaConfig();
    }

    // 3. 檢查座標是否在當前選擇的區域範圍內
    if (!isWithinBounds(location, areaConfig)) {
      return NextResponse.json(createErrorResponse(`座標超出${areaConfig.displayName}範圍`), {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // 4. 轉換 GPS 座標為網格座標
    const gridCoordinates = gpsToGrid(location, areaConfig);
    if (!gridCoordinates) {
      return NextResponse.json(createErrorResponse('座標轉換失敗'), {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // 5. 獲取鄰近網格座標（3x3 範圍效應）
    const neighborGrids = getNeighborGrids(gridCoordinates, areaConfig);
    const allGridIds = neighborGrids.map((grid) => getGridId(grid));

    // 6. 計算基礎權重
    const gridCenter = gridToGps(gridCoordinates, areaConfig);
    const recentReportsCount = await getRecentReportsCount(location);
    const baseWeight = calculateBaseWeight(location, gridCenter, recentReportsCount);

    // 7. 讀取當前網格資料
    const currentGridData = await gridStorage.getGridWithNeighbors(
      areaConfig.name,
      gridCoordinates,
      areaConfig
    );

    // 8. 執行信任演算法和範圍效應更新
    const currentTimestamp = Date.now();
    const updatedGridData = executeAreaOfEffectUpdate(
      gridCoordinates,
      neighborGrids,
      currentGridData,
      state,
      baseWeight,
      currentTimestamp
    );

    // 9. 批次更新 Redis 資料
    await gridStorage.updateGrids(areaConfig.name, updatedGridData);

    // 10. 標記變更的網格（用於增量圖磚生成）
    await markGridsAsChanged(areaConfig.name, allGridIds);

    // 11. 非同步記錄到 Supabase（不阻塞回應）
    insertReport(gridCoordinates.x, gridCoordinates.y, state, lat, lon).catch((error) => {
      console.error('Supabase 記錄失敗:', error);
      // 這裡可以加入錯誤監控服務，如 Sentry
    });

    // 12. 回應成功
    const stateText = state === 1 ? '有淤泥' : '已清除';
    return NextResponse.json(
      createSuccessResponse(`回報成功：${stateText}`, {
        gridCoordinates,
        affectedGrids: allGridIds.length,
        weight: baseWeight,
        timestamp: currentTimestamp,
      }),
      { status: HttpStatus.OK }
    );
  } catch (error) {
    console.error('API 回報處理錯誤:', error);

    // 處理已知的錯誤類型
    if (error instanceof Error) {
      if (error.message.includes('輸入資料無效') || error.message.includes('請求資料格式錯誤')) {
        return NextResponse.json(createErrorResponse(error.message), {
          status: HttpStatus.BAD_REQUEST,
        });
      }

      if (error.message.includes('Redis') || error.message.includes('快取')) {
        return NextResponse.json(createErrorResponse(ErrorMessages.REDIS_ERROR), {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }

      if (error.message.includes('Supabase') || error.message.includes('資料庫')) {
        return NextResponse.json(createErrorResponse(ErrorMessages.DATABASE_ERROR), {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }
    }

    // 未知錯誤
    return NextResponse.json(createErrorResponse(ErrorMessages.INTERNAL_ERROR), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}

/**
 * 處理不支援的 HTTP 方法
 */
export async function GET() {
  return NextResponse.json(createErrorResponse(ErrorMessages.METHOD_NOT_ALLOWED), {
    status: HttpStatus.METHOD_NOT_ALLOWED,
  });
}

export async function PUT() {
  return NextResponse.json(createErrorResponse(ErrorMessages.METHOD_NOT_ALLOWED), {
    status: HttpStatus.METHOD_NOT_ALLOWED,
  });
}

export async function DELETE() {
  return NextResponse.json(createErrorResponse(ErrorMessages.METHOD_NOT_ALLOWED), {
    status: HttpStatus.METHOD_NOT_ALLOWED,
  });
}
