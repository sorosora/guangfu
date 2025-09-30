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
  // 信譽分數 - 已清除
  score0: (gridId: string) => `score_0:${gridId}`,
  // 信譽分數 - 有淤泥
  score1: (gridId: string) => `score_1:${gridId}`,
  // 最後更新時間 - 已清除
  lastUpdate0: (gridId: string) => `last_update_0:${gridId}`,
  // 最後更新時間 - 有淤泥
  lastUpdate1: (gridId: string) => `last_update_1:${gridId}`,
  // 最終狀態快取（可選，用於快速查詢）
  finalState: (gridId: string) => `state:${gridId}`,
};

// 網格資料結構
export interface GridData {
  score0: number; // 已清除信譽分數
  score1: number; // 有淤泥信譽分數
  lastUpdate0: number; // 已清除最後更新時間戳
  lastUpdate1: number; // 有淤泥最後更新時間戳
  finalState: 0 | 1; // 最終判斷狀態
}

// 批次讀取網格資料
export async function getGridData(gridIds: string[]): Promise<Map<string, GridData>> {
  if (gridIds.length === 0) {
    return new Map();
  }

  // 準備所有需要讀取的金鑰
  const keys: string[] = [];
  for (const gridId of gridIds) {
    keys.push(
      RedisKeys.score0(gridId),
      RedisKeys.score1(gridId),
      RedisKeys.lastUpdate0(gridId),
      RedisKeys.lastUpdate1(gridId)
    );
  }

  // 批次讀取
  const values = await redis.mget(...keys);

  // 解析結果
  const gridDataMap = new Map<string, GridData>();

  for (let i = 0; i < gridIds.length; i++) {
    const gridId = gridIds[i];
    const baseIndex = i * 4;

    const score0 = (values[baseIndex] as number) || 0;
    const score1 = (values[baseIndex + 1] as number) || 0;
    const lastUpdate0 = (values[baseIndex + 2] as number) || 0;
    const lastUpdate1 = (values[baseIndex + 3] as number) || 0;

    // 計算最終狀態（已清除信譽分數大於有淤泥信譽分數則為已清除）
    const finalState: 0 | 1 = score0 > score1 ? 0 : 1;

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

  // 使用 pipeline 進行批次操作
  const pipeline = redis.pipeline();

  for (const [gridId, data] of updates) {
    if (data.score0 !== undefined) {
      pipeline.set(RedisKeys.score0(gridId), data.score0);
    }
    if (data.score1 !== undefined) {
      pipeline.set(RedisKeys.score1(gridId), data.score1);
    }
    if (data.lastUpdate0 !== undefined) {
      pipeline.set(RedisKeys.lastUpdate0(gridId), data.lastUpdate0);
    }
    if (data.lastUpdate1 !== undefined) {
      pipeline.set(RedisKeys.lastUpdate1(gridId), data.lastUpdate1);
    }
    if (data.finalState !== undefined) {
      pipeline.set(RedisKeys.finalState(gridId), data.finalState);
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
      finalState: 1, // 預設為有淤泥
    }
  );
}

// 更新單個網格資料
export async function setSingleGridData(gridId: string, data: Partial<GridData>): Promise<void> {
  const updates = new Map<string, Partial<GridData>>();
  updates.set(gridId, data);
  await setGridData(updates);
}
