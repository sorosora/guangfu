import { Redis } from '@upstash/redis';

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
  // 優化後：單一 hash per 網格
  gridData: (gridId: string) => `grid:${gridId}`,

  // 變更追蹤（增量更新使用）
  changedGrids: () => 'changed_grids',
  tileVersion: () => 'tile_version',
  lastTileGeneration: () => 'last_tile_gen',

  // 圖磚快取（Phase 1 優化）
  tileCache: (tileX: number, tileY: number) => `tile_cache:${tileX}_${tileY}`,
  tileMeta: (tileX: number, tileY: number) => `tile_meta:${tileX}_${tileY}`,
};

// 網格資料結構
export interface GridData {
  score0: number; // 已清除信譽分數
  score1: number; // 有淤泥信譽分數
  lastUpdate0: number; // 已清除最後更新時間戳
  lastUpdate1: number; // 有淤泥最後更新時間戳
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
export async function getGridData(gridIds: string[]): Promise<Map<string, GridData>> {
  if (gridIds.length === 0) {
    return new Map();
  }

  // 使用 pipeline 批次讀取 hash
  const pipeline = redis.pipeline();

  for (const gridId of gridIds) {
    pipeline.hmget(
      RedisKeys.gridData(gridId),
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
export async function setGridData(updates: Map<string, Partial<GridData>>): Promise<void> {
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
      pipeline.hmset(RedisKeys.gridData(gridId), hashData);
    }
  }

  await pipeline.exec();
}

// 讀取單個網格資料
export async function getSingleGridData(gridId: string): Promise<GridData> {
  const gridDataMap = await getGridData([gridId]);
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
export async function setSingleGridData(gridId: string, data: Partial<GridData>): Promise<void> {
  const updates = new Map<string, Partial<GridData>>();
  updates.set(gridId, data);
  await setGridData(updates);
}

// 變更追蹤相關函數

/**
 * 標記網格為已變更（用於增量更新）
 * @param gridIds 變更的網格 ID 陣列
 */
export async function markGridsAsChanged(gridIds: string[]): Promise<void> {
  if (gridIds.length === 0) return;

  const pipeline = redis.pipeline();

  for (const gridId of gridIds) {
    pipeline.sadd(RedisKeys.changedGrids(), gridId);
  }

  // 設定 TTL 避免長期累積（1小時）
  pipeline.expire(RedisKeys.changedGrids(), 3600);

  await pipeline.exec();
}

/**
 * 獲取有變更的網格 ID 列表
 * @returns 變更的網格 ID 陣列
 */
export async function getChangedGrids(): Promise<string[]> {
  const gridIds = await redis.smembers(RedisKeys.changedGrids());
  return gridIds || [];
}

/**
 * 清除變更標記
 */
export async function clearChangedGrids(): Promise<void> {
  await redis.del(RedisKeys.changedGrids());
}

/**
 * 設定圖磚版本號
 * @param version 版本號
 */
export async function setTileVersion(version: string): Promise<void> {
  await redis.set(RedisKeys.tileVersion(), version);
}

/**
 * 獲取當前圖磚版本號
 * @returns 版本號
 */
export async function getTileVersion(): Promise<string | null> {
  return await redis.get(RedisKeys.tileVersion());
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
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 * @returns 圖磚元資料或 null
 */
export async function getTileMeta(tileX: number, tileY: number): Promise<TileMeta | null> {
  try {
    const result = await redis.hmget(
      RedisKeys.tileMeta(tileX, tileY),
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
    console.error(`讀取圖磚元資料失敗 (${tileX}, ${tileY}):`, error);
    return null;
  }
}

/**
 * 讀取圖磚快取資料
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 * @returns 圖磚快取資料或 null
 */
export async function getTileCache(tileX: number, tileY: number): Promise<TileCache | null> {
  try {
    const result = await redis.hmget(
      RedisKeys.tileCache(tileX, tileY),
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
    console.error(`讀取圖磚快取失敗 (${tileX}, ${tileY}):`, error);
    return null;
  }
}

/**
 * 儲存圖磚到快取
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 * @param pngData Base64 編碼的 PNG 資料
 * @param gridStates 圖磚內的網格狀態
 * @param version 版本號
 */
export async function setTileCache(
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
  pipeline.hmset(RedisKeys.tileMeta(tileX, tileY), {
    version,
    lastUpdate: now,
    gridChecksum: checksum,
    affectedGrids: JSON.stringify(affectedGrids),
    size: pngData.length,
  });

  // 儲存快取資料
  pipeline.hmset(RedisKeys.tileCache(tileX, tileY), {
    pngData,
    contentType: 'image/png',
    compressed: false,
  });

  // 設定過期時間（7 天）
  pipeline.expire(RedisKeys.tileMeta(tileX, tileY), 7 * 24 * 3600);
  pipeline.expire(RedisKeys.tileCache(tileX, tileY), 7 * 24 * 3600);

  await pipeline.exec();
}

/**
 * 檢查圖磚是否需要重新生成
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 * @param currentGridStates 當前網格狀態
 * @returns 是否需要重新生成
 */
export async function isTileStale(
  tileX: number,
  tileY: number,
  currentGridStates: Map<string, GridData>
): Promise<boolean> {
  const tileMeta = await getTileMeta(tileX, tileY);

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
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 */
export async function deleteTileCache(tileX: number, tileY: number): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.del(RedisKeys.tileMeta(tileX, tileY));
  pipeline.del(RedisKeys.tileCache(tileX, tileY));
  await pipeline.exec();
}
