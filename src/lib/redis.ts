import { Redis } from '@upstash/redis';

// 浮點數精度處理工具函數
function roundFloat(value: number, decimals: number = 10): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// 環境變數檢查
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl) {
  throw new Error('Missing env.UPSTASH_REDIS_REST_URL');
}

if (!redisToken) {
  throw new Error('Missing env.UPSTASH_REDIS_REST_TOKEN');
}

// Redis 客戶端實例
export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

// Redis 金鑰生成器
export const RedisKeys = {
  // 區域化網格資料：grid:{areaName}:{gridId}
  gridData: (areaName: string, gridId: string) => `grid:${areaName}:${gridId}`,

  // 變更追蹤（增量更新使用）- 也需要區域化
  changedGrids: (areaName: string) => `changed_grids:${areaName}`,

  // 新增：標準座標系統追蹤
  geoData: (areaName: string, coordKey: string) => `geo:${areaName}:${coordKey}`,
  changedCoords: (areaName: string) => `changed_coords:${areaName}`,
  changedTiles: (areaName: string, zoom: number) => `changed_tiles:${areaName}:${zoom}`,

  tileVersion: (areaName: string) => `tile_version:${areaName}`,
  lastTileGeneration: (areaName: string) => `last_tile_gen:${areaName}`,

  // 圖磚快取（Phase 1 優化）- 也需要區域化
  tileCache: (areaName: string, tileX: number, tileY: number) =>
    `tile_cache:${areaName}:${tileX}_${tileY}`,
  tileMeta: (areaName: string, tileX: number, tileY: number) =>
    `tile_meta:${areaName}:${tileX}_${tileY}`,
};

// 網格資料結構 (舊系統)
export interface GridData {
  score0: number; // 已清除信譽分數
  score1: number; // 有淤泥信譽分數
  lastUpdate0: number; // 已清除最後更新時間戳
  lastUpdate1: number; // 有淤泥最後更新時間戳
  finalState: 0 | 1; // 最終判斷狀態
}

// 地理座標資料結構 (新標準系統)
export interface GeoCoordData {
  Score_0: number; // 已清除信譽分數
  Score_1: number; // 有淤泥信譽分數
  last_update_0: number; // 已清除最後更新時間戳
  last_update_1: number; // 有淤泥最後更新時間戳
  finalState: 0 | 1; // 最終判斷狀態
}

// 圖磚快取結構
export interface TileMeta {
  version: string; // 圖磚版本號（時間戳）
  lastUpdate: number; // 最後更新時間戳
  gridChecksum: string; // 圖磚內所有網格的校驗和
  affectedGrids: string[]; // 影響此圖磚的網格 ID 列表
  size: number; // 圖磚檔案大小（bytes）
}

export interface TileCache {
  pngData: string; // Base64 編碼的 PNG 圖片資料
  contentType: string; // MIME 類型
  compressed: boolean; // 是否壓縮
}

// 批次讀取網格資料
export async function getGridData(
  areaName: string,
  gridIds: string[]
): Promise<Map<string, GridData>> {
  if (gridIds.length === 0) {
    return new Map();
  }

  // 使用 pipeline 批次讀取 hash
  const pipeline = redis.pipeline();

  for (const gridId of gridIds) {
    pipeline.hmget(
      RedisKeys.gridData(areaName, gridId),
      'score0',
      'score1',
      'lastUpdate0',
      'lastUpdate1',
      'finalState'
    );
  }

  const results = await pipeline.exec();

  // 解析結果
  const gridDataMap = new Map<string, GridData>();

  for (let i = 0; i < gridIds.length; i++) {
    const gridId = gridIds[i];
    const result = results[i] as
      | [string | null, string | null, string | null, string | null, string | null]
      | null;

    // 如果結果為 null 或空陣列，使用預設值
    if (!result || !Array.isArray(result)) {
      gridDataMap.set(gridId, {
        score0: 0,
        score1: 0,
        lastUpdate0: 0,
        lastUpdate1: 0,
        finalState: 1, // 預設為有淤泥（已有回報資料的網格）
      });
      continue;
    }

    const score0 = parseFloat(result[0] || '0') || 0;
    const score1 = parseFloat(result[1] || '0') || 0;
    const lastUpdate0 = parseFloat(result[2] || '0') || 0;
    const lastUpdate1 = parseFloat(result[3] || '0') || 0;
    const finalState: 0 | 1 = result[4] ? (parseInt(result[4]) as 0 | 1) : score0 > score1 ? 0 : 1;

    gridDataMap.set(gridId, {
      score0,
      score1,
      lastUpdate0,
      lastUpdate1,
      finalState,
    });
  }

  return gridDataMap;
}

// 批次寫入網格資料
export async function setGridData(
  areaName: string,
  updates: Map<string, Partial<GridData>>
): Promise<void> {
  if (updates.size === 0) {
    return;
  }

  // 使用 pipeline 進行批次 hash 更新
  const pipeline = redis.pipeline();

  for (const [gridId, data] of Array.from(updates.entries())) {
    // 準備要更新的 hash 欄位
    const hashData: Record<string, string | number> = {};

    if (data.score0 !== undefined) hashData.score0 = data.score0;
    if (data.score1 !== undefined) hashData.score1 = data.score1;
    if (data.lastUpdate0 !== undefined) hashData.lastUpdate0 = data.lastUpdate0;
    if (data.lastUpdate1 !== undefined) hashData.lastUpdate1 = data.lastUpdate1;
    if (data.finalState !== undefined) hashData.finalState = data.finalState;

    // 只有當有資料要更新時才執行
    if (Object.keys(hashData).length > 0) {
      pipeline.hmset(RedisKeys.gridData(areaName, gridId), hashData);
    }
  }

  await pipeline.exec();
}

// 讀取單個網格資料
export async function getSingleGridData(areaName: string, gridId: string): Promise<GridData> {
  const gridDataMap = await getGridData(areaName, [gridId]);
  return (
    gridDataMap.get(gridId) || {
      score0: 0,
      score1: 0,
      lastUpdate0: 0,
      lastUpdate1: 0,
      finalState: 1, // 預設為有淤泥（已有回報資料的網格）
    }
  );
}

// 更新單個網格資料
export async function setSingleGridData(
  areaName: string,
  gridId: string,
  data: Partial<GridData>
): Promise<void> {
  const updates = new Map<string, Partial<GridData>>();
  updates.set(gridId, data);
  await setGridData(areaName, updates);
}

// 變更追蹤相關函數

/**
 * 標記網格為已變更（用於增量更新）
 * @param areaName 區域名稱
 * @param gridIds 變更的網格 ID 陣列
 */
export async function markGridsAsChanged(areaName: string, gridIds: string[]): Promise<void> {
  if (gridIds.length === 0) return;

  const pipeline = redis.pipeline();

  for (const gridId of gridIds) {
    pipeline.sadd(RedisKeys.changedGrids(areaName), gridId);
  }

  // 設定 TTL 避免長期累積（1小時）
  pipeline.expire(RedisKeys.changedGrids(areaName), 3600);

  await pipeline.exec();
}

/**
 * 獲取有變更的網格 ID 列表
 * @param areaName 區域名稱
 * @returns 變更的網格 ID 陣列
 */
export async function getChangedGrids(areaName: string): Promise<string[]> {
  const gridIds = await redis.smembers(RedisKeys.changedGrids(areaName));
  return gridIds || [];
}

/**
 * 清除變更標記
 * @param areaName 區域名稱
 */
export async function clearChangedGrids(areaName: string): Promise<void> {
  await redis.del(RedisKeys.changedGrids(areaName));
}

// =================== 新增標準座標系統追蹤函數 ===================

/**
 * 標記座標為已變更（標準座標系統）
 * @param areaName 區域名稱
 * @param coordKeys 變更的座標 key 陣列
 */
export async function markCoordsAsChanged(areaName: string, coordKeys: string[]): Promise<void> {
  if (coordKeys.length === 0) return;

  const pipeline = redis.pipeline();

  for (const coordKey of coordKeys) {
    pipeline.sadd(RedisKeys.changedCoords(areaName), coordKey);
  }

  // 設定 TTL 避免長期累積（1小時）
  pipeline.expire(RedisKeys.changedCoords(areaName), 3600);

  await pipeline.exec();
}

/**
 * 標記圖磚為已變更（標準 TMS 系統）
 * @param areaName 區域名稱
 * @param tileCoords 變更的圖磚座標陣列
 */
export async function markTilesAsChanged(
  areaName: string,
  tileCoords: Array<{ x: number; y: number; z: number }>
): Promise<void> {
  if (tileCoords.length === 0) return;

  const pipeline = redis.pipeline();

  for (const tile of tileCoords) {
    const tileKey = `${tile.x}_${tile.y}`;
    pipeline.sadd(RedisKeys.changedTiles(areaName, tile.z), tileKey);
  }

  // 為每個縮放層級設定 TTL（1小時）
  const uniqueZooms = [...new Set(tileCoords.map((t) => t.z))];
  for (const zoom of uniqueZooms) {
    pipeline.expire(RedisKeys.changedTiles(areaName, zoom), 3600);
  }

  await pipeline.exec();
}

/**
 * 獲取有變更的座標列表
 * @param areaName 區域名稱
 * @returns 變更的座標 key 陣列
 */
export async function getChangedCoords(areaName: string): Promise<string[]> {
  const coordKeys = await redis.smembers(RedisKeys.changedCoords(areaName));
  return coordKeys || [];
}

/**
 * 獲取有變更的圖磚列表
 * @param areaName 區域名稱
 * @param zoom 縮放層級
 * @returns 變更的圖磚 key 陣列
 */
export async function getChangedTiles(areaName: string, zoom: number): Promise<string[]> {
  const tileKeys = await redis.smembers(RedisKeys.changedTiles(areaName, zoom));
  return tileKeys || [];
}

/**
 * 清除座標變更標記
 * @param areaName 區域名稱
 */
export async function clearChangedCoords(areaName: string): Promise<void> {
  await redis.del(RedisKeys.changedCoords(areaName));
}

/**
 * 清除圖磚變更標記
 * @param areaName 區域名稱
 * @param zoom 縮放層級
 */
export async function clearChangedTiles(areaName: string, zoom: number): Promise<void> {
  await redis.del(RedisKeys.changedTiles(areaName, zoom));
}

/**
 * 讀取地理座標資料
 * @param areaName 區域名稱
 * @param coordKey 座標 key (格式: "lat_lon")
 * @returns 地理座標資料或預設值
 */
export async function getGeoCoordData(areaName: string, coordKey: string): Promise<GeoCoordData> {
  const redisKey = RedisKeys.geoData(areaName, coordKey);

  try {
    const result = await redis.hmget(
      redisKey,
      'Score_0',
      'Score_1',
      'last_update_0',
      'last_update_1',
      'finalState'
    );

    if (!result || !Array.isArray(result) || result.every((val) => val === null)) {
      // 返回預設值
      return {
        Score_0: 0,
        Score_1: 0,
        last_update_0: 0,
        last_update_1: 0,
        finalState: 1, // 預設為有淤泥
      };
    }

    const Score_0 = parseFloat((result[0] as string) || '0') || 0;
    const Score_1 = parseFloat((result[1] as string) || '0') || 0;
    const last_update_0 = parseFloat((result[2] as string) || '0') || 0;
    const last_update_1 = parseFloat((result[3] as string) || '0') || 0;
    const finalState: 0 | 1 = result[4]
      ? (parseInt(result[4] as string) as 0 | 1)
      : Score_0 > Score_1
        ? 0
        : 1;

    return {
      Score_0,
      Score_1,
      last_update_0,
      last_update_1,
      finalState,
    };
  } catch (error) {
    console.error(`讀取地理座標資料失敗 (${areaName}:${coordKey}):`, error);
    // 發生錯誤時返回預設值
    return {
      Score_0: 0,
      Score_1: 0,
      last_update_0: 0,
      last_update_1: 0,
      finalState: 1,
    };
  }
}

/**
 * 更新地理座標資料 (基於信任演算法)
 * @param areaName 區域名稱
 * @param affectedCoords 受影響的座標點
 * @param state 狀態 (0: 已清除, 1: 有淤泥)
 * @param baseWeight 基礎權重
 * @param timestamp 時間戳
 */
export async function updateGeoCoordData(
  areaName: string,
  affectedCoords: Array<{ lat: string; lon: string }>,
  state: 0 | 1,
  baseWeight: number,
  timestamp: number
): Promise<void> {
  if (affectedCoords.length === 0) return;

  const pipeline = redis.pipeline();
  const coordsToReduceScore1: Array<{
    coordKey: string;
    redisKey: string;
    currentData: GeoCoordData;
  }> = [];

  for (const coord of affectedCoords) {
    const coordKey = `${coord.lat}_${coord.lon}`;
    const redisKey = RedisKeys.geoData(areaName, coordKey);

    // 1. 讀取現有資料
    const currentData = await getGeoCoordData(areaName, coordKey);

    // 2. 根據非對稱信任演算法更新資料
    let newData: GeoCoordData;

    if (state === 1) {
      // 回報淤泥：Score_1 增加，Score_0 不變
      newData = {
        Score_0: currentData.Score_0, // 保持不變
        Score_1: currentData.Score_1 + baseWeight, // 增加權重
        last_update_0: currentData.last_update_0, // 保持不變
        last_update_1: timestamp, // 更新時間戳
        finalState: 1, // 暫時設為有淤泥，稍後重新計算
      };
    } else {
      // 回報清除：Score_0 增加5倍
      newData = {
        Score_0: currentData.Score_0 + baseWeight * 5, // 增加5倍權重
        Score_1: currentData.Score_1, // 暫時保持不變，稍後處理90%減少
        last_update_0: timestamp, // 更新時間戳
        last_update_1: currentData.last_update_1, // 保持不變
        finalState: 0, // 暫時設為已清除，稍後重新計算
      };

      // 標記需要減少 Score_1 的座標
      coordsToReduceScore1.push({ coordKey, redisKey, currentData: newData });
    }

    // 3. 重新計算 finalState
    newData.finalState = newData.Score_0 > newData.Score_1 ? 0 : 1;

    // 4. 批次更新到 Redis
    pipeline.hset(redisKey, {
      Score_0: newData.Score_0.toString(),
      Score_1: newData.Score_1.toString(),
      last_update_0: newData.last_update_0.toString(),
      last_update_1: newData.last_update_1.toString(),
      finalState: newData.finalState.toString(),
    });

    // 5. 設定座標資料 TTL (24小時)
    pipeline.expire(redisKey, 86400);
  }

  await pipeline.exec();

  // 6. 處理 Score_1 的減少 (90% 減少)
  if (state === 0 && coordsToReduceScore1.length > 0) {
    const score1Pipeline = redis.pipeline();
    let hasOperations = false;

    for (const { redisKey, currentData } of coordsToReduceScore1) {
      if (currentData.Score_1 > 0) {
        const newScore1 = roundFloat(currentData.Score_1 * 0.1); // 保留 10%，處理浮點數精度
        const newFinalState = currentData.Score_0 > newScore1 ? 0 : 1;

        score1Pipeline.hset(redisKey, {
          Score_1: newScore1.toString(),
          finalState: newFinalState.toString(),
        });
        hasOperations = true;
      }
    }

    // 只有當有操作時才執行 pipeline
    if (hasOperations) {
      await score1Pipeline.exec();
    }
  }
}

/**
 * 設定圖磚版本號
 * @param areaName 區域名稱
 * @param version 版本號
 */
export async function setTileVersion(areaName: string, version: string): Promise<void> {
  await redis.set(RedisKeys.tileVersion(areaName), version);
}

/**
 * 獲取當前圖磚版本號
 * @param areaName 區域名稱
 * @returns 版本號
 */
export async function getTileVersion(areaName: string): Promise<string | null> {
  return await redis.get(RedisKeys.tileVersion(areaName));
}

// ==================== 圖磚快取相關函數 ====================

/**
 * 計算網格校驗和
 * @param gridStates 網格狀態 Map
 * @returns 校驗和字串
 */
export function calculateGridChecksum(gridStates: Map<string, GridData>): string {
  // 將網格狀態排序後合併，計算簡單的雜湊
  const sortedEntries = Array.from(gridStates.entries()).sort();
  const dataString = sortedEntries
    .map(([id, data]) => `${id}:${data.finalState}:${data.lastUpdate0}:${data.lastUpdate1}`)
    .join('|');

  // 簡單的雜湊函數（生產環境可考慮使用更複雜的）
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 轉換為 32 位元整數
  }
  return hash.toString(36);
}

/**
 * 讀取圖磚元資料
 * @param areaName 區域名稱
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 * @returns 圖磚元資料或 null
 */
export async function getTileMeta(
  areaName: string,
  tileX: number,
  tileY: number
): Promise<TileMeta | null> {
  try {
    const result = await redis.hmget(
      RedisKeys.tileMeta(areaName, tileX, tileY),
      'version',
      'lastUpdate',
      'gridChecksum',
      'affectedGrids',
      'size'
    );

    if (!result || !Array.isArray(result) || result.every((val) => val === null)) {
      return null;
    }

    return {
      version: (result[0] as string) || '',
      lastUpdate: parseInt((result[1] as string) || '0'),
      gridChecksum: (result[2] as string) || '',
      affectedGrids: result[3] ? JSON.parse(result[3] as string) : [],
      size: parseInt((result[4] as string) || '0'),
    };
  } catch (error) {
    console.error(`讀取圖磚元資料失敗 (${areaName}:${tileX}, ${tileY}):`, error);
    return null;
  }
}

/**
 * 讀取圖磚快取資料
 * @param areaName 區域名稱
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 * @returns 圖磚快取資料或 null
 */
export async function getTileCache(
  areaName: string,
  tileX: number,
  tileY: number
): Promise<TileCache | null> {
  try {
    const result = await redis.hmget(
      RedisKeys.tileCache(areaName, tileX, tileY),
      'pngData',
      'contentType',
      'compressed'
    );

    if (!result || !Array.isArray(result) || result.every((val) => val === null)) {
      return null;
    }

    return {
      pngData: (result[0] as string) || '',
      contentType: (result[1] as string) || 'image/png',
      compressed: (result[2] as string) === 'true',
    };
  } catch (error) {
    console.error(`讀取圖磚快取失敗 (${areaName}:${tileX}, ${tileY}):`, error);
    return null;
  }
}

/**
 * 儲存圖磚到快取
 * @param areaName 區域名稱
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 * @param pngData Base64 編碼的 PNG 資料
 * @param gridStates 圖磚內的網格狀態
 * @param version 版本號
 */
export async function setTileCache(
  areaName: string,
  tileX: number,
  tileY: number,
  pngData: string,
  gridStates: Map<string, GridData>,
  version: string
): Promise<void> {
  const now = Date.now();
  const checksum = calculateGridChecksum(gridStates);
  const affectedGrids = Array.from(gridStates.keys());

  // 使用 pipeline 同時更新元資料和快取資料
  const pipeline = redis.pipeline();

  // 儲存元資料
  pipeline.hmset(RedisKeys.tileMeta(areaName, tileX, tileY), {
    version,
    lastUpdate: now,
    gridChecksum: checksum,
    affectedGrids: JSON.stringify(affectedGrids),
    size: pngData.length,
  });

  // 儲存快取資料
  pipeline.hmset(RedisKeys.tileCache(areaName, tileX, tileY), {
    pngData,
    contentType: 'image/png',
    compressed: false,
  });

  // 設定過期時間（7 天）
  pipeline.expire(RedisKeys.tileMeta(areaName, tileX, tileY), 7 * 24 * 3600);
  pipeline.expire(RedisKeys.tileCache(areaName, tileX, tileY), 7 * 24 * 3600);

  await pipeline.exec();
}

/**
 * 檢查圖磚是否需要重新生成
 * @param areaName 區域名稱
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 * @param currentGridStates 當前網格狀態
 * @returns 是否需要重新生成
 */
export async function isTileStale(
  areaName: string,
  tileX: number,
  tileY: number,
  currentGridStates: Map<string, GridData>
): Promise<boolean> {
  const tileMeta = await getTileMeta(areaName, tileX, tileY);

  if (!tileMeta) {
    // 沒有快取，需要生成
    return true;
  }

  // 計算當前網格狀態的校驗和
  const currentChecksum = calculateGridChecksum(currentGridStates);

  // 比較校驗和
  return tileMeta.gridChecksum !== currentChecksum;
}

/**
 * 刪除圖磚快取
 * @param areaName 區域名稱
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 */
export async function deleteTileCache(
  areaName: string,
  tileX: number,
  tileY: number
): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.del(RedisKeys.tileMeta(areaName, tileX, tileY));
  pipeline.del(RedisKeys.tileCache(areaName, tileX, tileY));
  await pipeline.exec();
}
