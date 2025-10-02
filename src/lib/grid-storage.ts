import { GridCoordinates } from '@/types/map';
import { GridData, getGridData, setGridData } from './redis';
import { getGridId, getNeighborGrids } from './coordinates';
import { AreaConfig } from '@/config/areas';

/**
 * 網格儲存服務 - 處理網格資料的高階操作
 */
export class GridStorageService {
  /**
   * 讀取單個網格及其鄰近網格的資料
   * @param areaName 區域名稱
   * @param centerGrid 中心網格座標
   * @param areaConfig 區域配置
   * @returns 網格資料對應表
   */
  async getGridWithNeighbors(
    areaName: string,
    centerGrid: GridCoordinates,
    areaConfig: AreaConfig
  ): Promise<Map<string, GridData>> {
    const allGrids = getNeighborGrids(centerGrid, areaConfig);
    const gridIds = allGrids.map((grid) => getGridId(grid));

    return await getGridData(areaName, gridIds);
  }

  /**
   * 批次更新網格資料
   * @param areaName 區域名稱
   * @param updates 要更新的網格資料對應表
   */
  async updateGrids(areaName: string, updates: Map<string, Partial<GridData>>): Promise<void> {
    await setGridData(areaName, updates);
  }

  /**
   * 獲取所有網格的最終狀態（用於圖磚生成）
   * @param areaName 區域名稱
   * @param areaConfig 區域配置
   * @returns 網格狀態對應表 (gridId -> finalState)
   */
  async getAllGridStates(areaName: string, areaConfig: AreaConfig): Promise<Map<string, 0 | 1>> {
    const { gridSize } = areaConfig;

    // 生成所有可能的網格 ID
    const allGridIds: string[] = [];
    for (let x = 0; x < gridSize.width; x++) {
      for (let y = 0; y < gridSize.height; y++) {
        allGridIds.push(getGridId({ x, y }));
      }
    }

    // 分批讀取（避免單次請求過大）
    const batchSize = 1000;
    const stateMap = new Map<string, 0 | 1>();

    for (let i = 0; i < allGridIds.length; i += batchSize) {
      const batchIds = allGridIds.slice(i, i + batchSize);
      const batchData = await getGridData(areaName, batchIds);

      for (const [gridId, data] of batchData) {
        stateMap.set(gridId, data.finalState);
      }
    }

    return stateMap;
  }

  /**
   * 獲取指定區域內的網格狀態統計
   * @param areaName 區域名稱
   * @param startGrid 起始網格座標
   * @param endGrid 結束網格座標
   * @returns 統計資料
   */
  async getAreaStatistics(
    areaName: string,
    startGrid: GridCoordinates,
    endGrid: GridCoordinates
  ): Promise<{
    totalGrids: number;
    clearedGrids: number;
    muddyGrids: number;
    clearanceRate: number;
  }> {
    const gridIds: string[] = [];

    for (let x = startGrid.x; x <= endGrid.x; x++) {
      for (let y = startGrid.y; y <= endGrid.y; y++) {
        gridIds.push(getGridId({ x, y }));
      }
    }

    const gridData = await getGridData(areaName, gridIds);

    let clearedCount = 0;
    let muddyCount = 0;

    for (const [, data] of gridData) {
      if (data.finalState === 0) {
        clearedCount++;
      } else {
        muddyCount++;
      }
    }

    const totalGrids = gridIds.length;
    const clearanceRate = totalGrids > 0 ? clearedCount / totalGrids : 0;

    return {
      totalGrids,
      clearedGrids: clearedCount,
      muddyGrids: muddyCount,
      clearanceRate,
    };
  }

  /**
   * 重置指定網格的資料（用於測試或維護）
   * @param areaName 區域名稱
   * @param gridIds 要重置的網格 ID 陣列
   */
  async resetGrids(areaName: string, gridIds: string[]): Promise<void> {
    const resetData = new Map<string, Partial<GridData>>();

    for (const gridId of gridIds) {
      resetData.set(gridId, {
        score0: 0,
        score1: 0,
        lastUpdate0: 0,
        lastUpdate1: 0,
        finalState: 1, // 預設為有淤泥
      });
    }

    await setGridData(areaName, resetData);
  }

  /**
   * 獲取熱點區域（回報活動最頻繁的區域）
   * @param areaName 區域名稱
   * @param areaConfig 區域配置
   * @param topN 返回前 N 個熱點
   * @returns 熱點網格陣列
   */
  async getHotspotGrids(
    areaName: string,
    areaConfig: AreaConfig,
    topN: number = 10
  ): Promise<
    Array<{
      gridId: string;
      grid: GridCoordinates;
      totalActivity: number;
      lastActivity: number;
    }>
  > {
    // 這個方法需要遍歷所有網格來找出活動最頻繁的區域
    // 在實際應用中，可能需要額外的索引或快取來優化效能

    const { gridSize } = areaConfig;

    const hotspots: Array<{
      gridId: string;
      grid: GridCoordinates;
      totalActivity: number;
      lastActivity: number;
    }> = [];

    // 分批掃描網格
    const batchSize = 500;

    for (let x = 0; x < gridSize.width; x += batchSize) {
      for (let y = 0; y < gridSize.height; y += batchSize) {
        const batchGridIds: string[] = [];
        const batchGrids: GridCoordinates[] = [];

        const maxX = Math.min(x + batchSize, gridSize.width);
        const maxY = Math.min(y + batchSize, gridSize.height);

        for (let bx = x; bx < maxX; bx++) {
          for (let by = y; by < maxY; by++) {
            const grid = { x: bx, y: by };
            batchGridIds.push(getGridId(grid));
            batchGrids.push(grid);
          }
        }

        const batchData = await getGridData(areaName, batchGridIds);

        for (let i = 0; i < batchGridIds.length; i++) {
          const gridId = batchGridIds[i];
          const grid = batchGrids[i];
          const data = batchData.get(gridId);

          if (data) {
            const totalActivity = data.score0 + data.score1;
            const lastActivity = Math.max(data.lastUpdate0, data.lastUpdate1);

            if (totalActivity > 0) {
              hotspots.push({
                gridId,
                grid,
                totalActivity,
                lastActivity,
              });
            }
          }
        }
      }
    }

    // 按活動度排序並返回前 N 個
    return hotspots.sort((a, b) => b.totalActivity - a.totalActivity).slice(0, topN);
  }
}

// 建立單例實例
export const gridStorage = new GridStorageService();
