import { NextRequest, NextResponse } from 'next/server';
import {
  validateReportRequest,
  createSuccessResponse,
  createErrorResponse,
  HttpStatus,
  ErrorMessages,
} from '@/lib/validation';

// 新的標準座標系統函數
import {
  gpsToFormattedCoords,
  isWithinStandardBounds,
  getGeoRangeEffect,
  getAffectedStandardTiles,
  generateCoordKey,
} from '@/lib/coordinates';

// TODO: PHASE_6_CLEANUP - 階段六移除舊版函數
import {
  gpsToGrid,
  getNeighborGrids,
  getGridId,
  isWithinBounds,
  gridToGps,
} from '@/lib/coordinates';

import { insertReport } from '@/lib/supabase';
// TODO: PHASE_7_CLEANUP - 階段七移除 grid-storage
import { gridStorage } from '@/lib/grid-storage';

import {
  calculateBaseWeight,
  executeAreaOfEffectUpdate,
  getRecentReportsCount,
} from '@/lib/trust-algorithm';

// Redis 函數 - 新標準座標系統
import { markCoordsAsChanged, markTilesAsChanged, updateGeoCoordData } from '@/lib/redis';

// TODO: PHASE_6_CLEANUP - 階段六移除舊版 Redis 函數
import { markGridsAsChanged } from '@/lib/redis';
import { getDefaultAreaConfig } from '@/config/areas';

/**
 * POST /api/report - 處理淤泥狀態回報
 *
 * 階段四：雙系統並行架構
 * - 新標準座標系統：基於 4 decimal lat/lng 和標準 TMS
 * - 舊網格系統：暫時保留，確保向後相容性
 *
 * TODO: PHASE_6_CLEANUP - 階段六移除舊網格系統邏輯
 * TODO: PHASE_7_CLEANUP - 階段七完全移除向後相容代碼
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

    // =================== 新標準座標系統處理 ===================

    // 3. 使用新的標準邊界檢查
    if (!isWithinStandardBounds(location, areaConfig)) {
      return NextResponse.json(createErrorResponse(`座標超出${areaConfig.displayName}範圍`), {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // 4. 標準座標系統處理
    const formattedCoords = gpsToFormattedCoords(location);
    const coordKey = generateCoordKey(location);

    // 5. 計算地理範圍效應影響的座標點 (25公尺半徑)
    const affectedGeoCoords = getGeoRangeEffect(location, 25);
    const affectedCoordKeys = affectedGeoCoords.map((coord) => `${coord.lat}_${coord.lon}`);

    // 6. 計算影響的標準圖磚座標
    const affectedTiles = getAffectedStandardTiles(location, 25, areaConfig, 19);

    console.log(
      `[新標準座標] 中心: ${coordKey}, 影響 ${affectedCoordKeys.length} 個座標點, ${affectedTiles.length} 個圖磚`
    );

    // 7. 計算基礎權重 (基於中心 GPS 位置)
    const recentReportsCount = await getRecentReportsCount(location);
    const baseWeight = calculateBaseWeight(location, location, recentReportsCount);
    const currentTimestamp = Date.now();

    // 8. 更新地理座標資料到 Redis (新的 geo: 格式)
    await updateGeoCoordData(
      areaConfig.name,
      affectedGeoCoords,
      state,
      baseWeight,
      currentTimestamp
    );

    // 9. 標記變更的座標和圖磚 (新標準追蹤)
    await markCoordsAsChanged(areaConfig.name, affectedCoordKeys);
    await markTilesAsChanged(areaConfig.name, affectedTiles);

    // =================== TODO: PHASE_6_CLEANUP - 向後相容：舊版網格系統處理 ===================

    // 為了保持系統穩定，同時執行舊版處理邏輯
    // 這整個區塊將在階段六移除
    const gridCoordinates = gpsToGrid(location, areaConfig);
    if (gridCoordinates) {
      console.log(`[舊網格系統] 網格座標: ${gridCoordinates.x}, ${gridCoordinates.y}`);

      // 舊版範圍效應處理 (3x3 網格)
      const neighborGrids = getNeighborGrids(gridCoordinates, areaConfig);
      const allGridIds = neighborGrids.map((grid) => getGridId(grid));

      // 讀取和更新舊版網格資料
      const currentGridData = await gridStorage.getGridWithNeighbors(
        areaConfig.name,
        gridCoordinates,
        areaConfig
      );

      const updatedGridData = executeAreaOfEffectUpdate(
        gridCoordinates,
        neighborGrids,
        currentGridData,
        state,
        baseWeight,
        currentTimestamp
      );

      await gridStorage.updateGrids(areaConfig.name, updatedGridData);
      await markGridsAsChanged(areaConfig.name, allGridIds);

      // Supabase 記錄 (使用舊格式保持相容性)
      insertReport(gridCoordinates.x, gridCoordinates.y, state, lat, lon).catch((error) => {
        console.error('Supabase 記錄失敗:', error);
      });

      console.log(`[舊網格系統] 更新 ${allGridIds.length} 個網格`);
    }

    // 10. 回應成功 (雙系統處理結果)
    const stateText = state === 1 ? '有淤泥' : '已清除';
    return NextResponse.json(
      createSuccessResponse(`回報成功：${stateText}`, {
        // === 新標準座標系統資訊 ===
        standard: {
          coordKey,
          formattedCoords,
          affectedCoords: affectedCoordKeys.length,
          affectedTiles: affectedTiles.length,
          system: 'TMS_4DECIMAL',
        },

        // === TODO: PHASE_6_CLEANUP - 舊版網格系統資訊 (向後相容) ===
        legacy: {
          gridCoordinates,
          affectedGrids: gridCoordinates ? getNeighborGrids(gridCoordinates, areaConfig).length : 0,
          system: 'CUSTOM_GRID',
        },

        // === 共用資訊 ===
        shared: {
          weight: baseWeight,
          timestamp: currentTimestamp,
          areaName: areaConfig.name,
          state: stateText,
        },
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
