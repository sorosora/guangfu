import { Location } from '@/types/map';
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

  if (distance <= 0) return 1.0;
  if (distance >= MAX_GPS_DISTANCE) return 0.0;

  // 線性衰減
  return 1.0 - distance / MAX_GPS_DISTANCE;
}

/**
 * 計算兩點間距離（公尺）
 * 使用 Haversine 公式
 */
export function calculateDistance(point1: Location, point2: Location): number {
  const R = 6371000; // 地球半徑（公尺）
  const lat1Rad = (point1.lat * Math.PI) / 180;
  const lat2Rad = (point2.lat * Math.PI) / 180;
  const deltaLatRad = ((point2.lat - point1.lat) * Math.PI) / 180;
  const deltaLonRad = ((point2.lon - point1.lon) * Math.PI) / 180;

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * 計算時間密度抑制因子 F_spam
 * @param recentReportsCount 近期回報數量
 * @returns 0-1 之間的權重值
 */
export function calculateSpamSuppressionFactor(recentReportsCount: number): number {
  if (recentReportsCount <= 0) return 1.0;

  // 簡單的反比例函數：1 / (1 + count)
  return 1.0 / (1.0 + recentReportsCount);
}

/**
 * 計算基礎權重
 * @param reportLocation 回報位置
 * @param targetLocation 目標位置（通常相同）
 * @param recentReportsCount 近期回報數量
 * @returns 基礎權重值
 */
export function calculateBaseWeight(
  reportLocation: Location,
  targetLocation: Location,
  recentReportsCount: number
): number {
  const distance = calculateDistance(reportLocation, targetLocation);
  const gpsProximityFactor = calculateGpsProximityFactor(distance);
  const spamSuppressionFactor = calculateSpamSuppressionFactor(recentReportsCount);

  return gpsProximityFactor * spamSuppressionFactor;
}

/**
 * 獲取近期回報數量（用於垃圾訊息防護）
 * @param location GPS 位置
 * @returns 近期回報數量
 */
export async function getRecentReportsCount(location: Location): Promise<number> {
  const { SPAM_CHECK_RADIUS, SPAM_CHECK_WINDOW } = TRUST_ALGORITHM_CONFIG;

  try {
    const cutoffTime = new Date(Date.now() - SPAM_CHECK_WINDOW * 1000);
    const reports = await getRecentReports(
      location.lat,
      location.lon,
      SPAM_CHECK_RADIUS,
      cutoffTime
    );
    return reports.length;
  } catch (error) {
    console.error('獲取近期回報數量失敗:', error);
    return 0; // 發生錯誤時返回 0，不進行垃圾訊息抑制
  }
}
