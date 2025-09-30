import { Location, GridCoordinates } from '@/types/map';
import { GridData } from './redis';
import { getRecentReports } from './supabase';

// 信任演算法設定常數
export const TRUST_ALGORITHM_CONFIG = {
  // GPS 鄰近度設定
  MAX_GPS_DISTANCE: 50, // 公尺

  // 時間衰減設定
  TIME_DECAY_CONSTANT: 0.000001, // k 值，控制時間衰減速度

  // 範圍效應設定
  SPLASH_FACTOR: 0.3, // 鄰近點影響因子 (30%)

  // 非對稱更新設定
  CLEAR_REWARD_MULTIPLIER: 5, // 清除回報的獎勵倍數
  MUD_PENALTY_FACTOR: 0.1, // 有淤泥時對清除分數的懲罰 (保留10%)

  // 垃圾訊息防護設定
  SPAM_CHECK_RADIUS: 2, // 公尺
  SPAM_CHECK_WINDOW: 60, // 秒
} as const;

/**
 * 計算 GPS 鄰近度因子 F_gps
 * @param distance 距離（公尺）
 * @returns 0-1 之間的權重值
 */
export function calculateGpsProximityFactor(distance: number): number {
  const { MAX_GPS_DISTANCE } = TRUST_ALGORITHM_CONFIG;

  if (distance >= MAX_GPS_DISTANCE) {
    return 0;
  }

  // F_gps = (1 - 距離 / 最大允許範圍)^2
  const ratio = distance / MAX_GPS_DISTANCE;
  return Math.pow(1 - ratio, 2);
}

/**
 * 計算時間密度抑制因子 F_spam
 * @param recentReportsCount 近期相近位置的回報數量
 * @returns 0-1 之間的權重值
 */
export function calculateSpamSuppressionFactor(recentReportsCount: number): number {
  // F_spam = 1 / (1 + 60秒內附近2公尺的回報數)
  return 1 / (1 + recentReportsCount);
}

/**
 * 計算時間衰減
 * @param score 原始分數
 * @param timeDeltaSeconds 時間差（秒）
 * @returns 衰減後的分數
 */
export function applyTimeDecay(score: number, timeDeltaSeconds: number): number {
  const { TIME_DECAY_CONSTANT } = TRUST_ALGORITHM_CONFIG;

  // Score = Score * exp(-k * Δt)
  return score * Math.exp(-TIME_DECAY_CONSTANT * timeDeltaSeconds);
}

/**
 * 計算基礎權重
 * @param location 回報位置
 * @param gridCenter 網格中心位置
 * @param recentReportsCount 近期相近位置的回報數量
 * @returns 基礎權重 W
 */
export function calculateBaseWeight(
  location: Location,
  gridCenter: Location,
  recentReportsCount: number = 0
): number {
  // 計算距離（簡化計算，使用平面距離近似）
  const latDiff = (location.lat - gridCenter.lat) * 111000; // 1度緯度約111km
  const lonDiff =
    (location.lon - gridCenter.lon) * 111000 * Math.cos((location.lat * Math.PI) / 180);
  const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);

  const fGps = calculateGpsProximityFactor(distance);
  const fSpam = calculateSpamSuppressionFactor(recentReportsCount);

  return fGps * fSpam;
}

/**
 * 執行非對稱更新邏輯
 * @param currentData 當前網格資料
 * @param reportedState 回報狀態 (0=已清除, 1=有淤泥)
 * @param weight 更新權重
 * @param currentTimestamp 當前時間戳
 * @returns 更新後的網格資料
 */
export function applyAsymmetricUpdate(
  currentData: GridData,
  reportedState: 0 | 1,
  weight: number,
  currentTimestamp: number
): GridData {
  const { CLEAR_REWARD_MULTIPLIER, MUD_PENALTY_FACTOR } = TRUST_ALGORITHM_CONFIG;

  let newScore0 = currentData.score0;
  let newScore1 = currentData.score1;
  let newLastUpdate0 = currentData.lastUpdate0;
  let newLastUpdate1 = currentData.lastUpdate1;

  if (reportedState === 1) {
    // 回報「有淤泥」

    // 對 Score_1 進行時間衰減
    if (newLastUpdate1 > 0) {
      const timeDelta = (currentTimestamp - newLastUpdate1) / 1000; // 轉換為秒
      newScore1 = applyTimeDecay(newScore1, timeDelta);
    }

    // 增加 Score_1
    newScore1 += weight;
    newLastUpdate1 = currentTimestamp;

    // Score_0 保持不變
  } else {
    // 回報「已清除」

    // 大幅增加 Score_0 (5倍獎勵係數)
    newScore0 += weight * CLEAR_REWARD_MULTIPLIER;
    newLastUpdate0 = currentTimestamp;

    // 懲罰性清空 Score_1 (分數銳減90%)
    newScore1 *= MUD_PENALTY_FACTOR;

    // Score_0 永不進行時間衰減
  }

  // 計算最終狀態
  const finalState: 0 | 1 = newScore0 > newScore1 ? 0 : 1;

  return {
    score0: newScore0,
    score1: newScore1,
    lastUpdate0: newLastUpdate0,
    lastUpdate1: newLastUpdate1,
    finalState,
  };
}

/**
 * 查詢近期相似位置的回報數量（用於垃圾訊息檢測）
 * @param location 查詢位置
 * @returns Promise<回報數量>
 */
export async function getRecentReportsCount(location: Location): Promise<number> {
  const { SPAM_CHECK_RADIUS, SPAM_CHECK_WINDOW } = TRUST_ALGORITHM_CONFIG;

  try {
    const sinceTimestamp = new Date(Date.now() - SPAM_CHECK_WINDOW * 1000);
    const recentReports = await getRecentReports(
      location.lat,
      location.lon,
      SPAM_CHECK_RADIUS,
      sinceTimestamp
    );

    return recentReports.length;
  } catch (error) {
    console.warn('無法查詢近期回報，使用預設值 0:', error);
    return 0;
  }
}

/**
 * 執行範圍效應更新
 * @param centerGrid 中心網格座標
 * @param neighborGrids 鄰近網格座標陣列
 * @param currentGridData 當前所有相關網格的資料
 * @param reportedState 回報狀態
 * @param baseWeight 基礎權重
 * @param currentTimestamp 當前時間戳
 * @returns 所有更新後的網格資料
 */
export function executeAreaOfEffectUpdate(
  centerGrid: GridCoordinates,
  neighborGrids: GridCoordinates[],
  currentGridData: Map<string, GridData>,
  reportedState: 0 | 1,
  baseWeight: number,
  currentTimestamp: number
): Map<string, GridData> {
  const { SPLASH_FACTOR } = TRUST_ALGORITHM_CONFIG;
  const updatedData = new Map<string, GridData>();

  // 更新中心點 (100% 權重)
  const centerGridId = `${centerGrid.x}_${centerGrid.y}`;
  const centerData = currentGridData.get(centerGridId) || {
    score0: 0,
    score1: 0,
    lastUpdate0: 0,
    lastUpdate1: 0,
    finalState: 1 as 0 | 1,
  };

  const updatedCenterData = applyAsymmetricUpdate(
    centerData,
    reportedState,
    baseWeight,
    currentTimestamp
  );
  updatedData.set(centerGridId, updatedCenterData);

  // 更新鄰近點 (30% 權重)
  const neighborWeight = baseWeight * SPLASH_FACTOR;

  for (const neighborGrid of neighborGrids) {
    const neighborGridId = `${neighborGrid.x}_${neighborGrid.y}`;

    // 跳過中心點（已經更新過）
    if (neighborGridId === centerGridId) {
      continue;
    }

    const neighborData = currentGridData.get(neighborGridId) || {
      score0: 0,
      score1: 0,
      lastUpdate0: 0,
      lastUpdate1: 0,
      finalState: 1 as 0 | 1,
    };

    const updatedNeighborData = applyAsymmetricUpdate(
      neighborData,
      reportedState,
      neighborWeight,
      currentTimestamp
    );
    updatedData.set(neighborGridId, updatedNeighborData);
  }

  return updatedData;
}
