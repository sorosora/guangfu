import { NextRequest, NextResponse } from 'next/server';
import {
  validateReportRequest,
  createSuccessResponse,
  createErrorResponse,
  HttpStatus,
  ErrorMessages,
} from '@/lib/validation';

// 標準座標系統函數
import {
  gpsToFormattedCoords,
  getGeoRangeEffect,
  getAffectedStandardTiles,
  generateCoordKey,
} from '@/lib/coordinates';

import { insertReport } from '@/lib/supabase';

import { calculateBaseWeight, getRecentReportsCount } from '@/lib/trust-algorithm';

// Redis 函數 - 標準座標系統
import { markCoordsAsChanged, markTilesAsChanged, updateGeoCoordData } from '@/lib/redis';
import { canReportAtLocation, getAreaConfig } from '@/config/areas';
import { getEnvironmentType } from '@/lib/environment';

/**
 * POST /api/report - 處理淤泥狀態回報
 *
 * 階段五：完全標準化 TMS 座標系統
 * - 使用標準 4 decimal lat/lng 和標準 TMS
 * - 移除舊網格系統，完全依賴新座標系統
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 解析和驗證請求資料
    const body = await request.json();
    const { lat, lon, state } = validateReportRequest(body);

    // 2. 獲取區域配置（生產環境強制鎖定光復鄉）
    const location = { lat, lon };
    const isProduction = getEnvironmentType() === 'production';
    const areaName = isProduction
      ? 'guangfu'
      : new URL(request.url).searchParams.get('area') || 'guangfu';
    const areaConfig = getAreaConfig(areaName);

    // 3. 使用新的回報邊界檢查（考慮無限制回報設定）
    if (!canReportAtLocation(location.lat, location.lon, areaConfig)) {
      return NextResponse.json(createErrorResponse(`座標超出${areaConfig.displayName}範圍`), {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // 4. 標準座標系統處理
    const formattedCoords = gpsToFormattedCoords(location);
    const coordKey = generateCoordKey(location);

    // 5. 計算地理範圍效應影響的座標點 (25公尺半徑)
    const affectedGeoCoords = getGeoRangeEffect(location, areaConfig.effectRadiusMeters);
    const affectedCoordKeys = affectedGeoCoords.map((coord) => `${coord.lat}_${coord.lon}`);

    // 6. 計算影響的標準圖磚座標
    const affectedTiles = getAffectedStandardTiles(
      location,
      areaConfig.effectRadiusMeters,
      areaConfig,
      areaConfig.primaryZoom
    );

    console.log(
      `[標準TMS座標] 中心: ${coordKey}, 影響 ${affectedCoordKeys.length} 個座標點, ${affectedTiles.length} 個圖磚`
    );

    // 7. 計算基礎權重 (基於中心 GPS 位置)
    const recentReportsCount = await getRecentReportsCount(location);
    const baseWeight = calculateBaseWeight(location, location, recentReportsCount);
    const currentTimestamp = Date.now();

    // 8. 更新地理座標資料到 Redis (geo: 格式)
    await updateGeoCoordData(
      areaConfig.name,
      affectedGeoCoords,
      state,
      baseWeight,
      currentTimestamp
    );

    // 9. 標記變更的座標和圖磚
    await markCoordsAsChanged(areaConfig.name, affectedCoordKeys);
    await markTilesAsChanged(areaConfig.name, affectedTiles);

    // 10. Supabase 記錄 (使用標準格式)
    insertReport(0, 0, state, lat, lon).catch((error) => {
      console.error('Supabase 記錄失敗:', error);
    });

    // 11. 回應成功
    const stateText = state === 1 ? '有淤泥' : '已清除';
    return NextResponse.json(
      createSuccessResponse(`回報成功：${stateText}`, {
        coordKey,
        formattedCoords,
        affectedCoords: affectedCoordKeys.length,
        affectedTiles: affectedTiles.length,
        weight: baseWeight,
        timestamp: currentTimestamp,
        areaName: areaConfig.name,
        state: stateText,
        system: 'TMS_STANDARDIZED',
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
