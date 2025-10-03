/**
 * 4 Decimal 精度地理座標工具模組
 *
 * 專為 Web 應用設計的地理座標處理工具
 * 使用 4 decimal 精度 (~11m 精度) 作為標準格式
 */

import { Location } from '@/types/map';
import { calculateDistance, TMS_CONFIG } from './tms-coordinates';

/**
 * 4 Decimal 格式化座標
 */
export interface FormattedCoords {
  lat: string; // 格式如 "23.6715"
  lon: string; // 格式如 "121.4355"
}

/**
 * 地理座標範圍效應配置
 */
export interface GeoRangeConfig {
  radiusMeters: number; // 影響半徑 (公尺)
  maxCoords: number; // 最大座標點數量限制
  precision: number; // 座標精度 (小數位數)
}

/**
 * 預設範圍效應配置
 */
export const DEFAULT_RANGE_CONFIG: GeoRangeConfig = {
  radiusMeters: 25, // 25公尺半徑 (大約相當於原 3x3 網格的 15m 半徑)
  maxCoords: 49, // 最多 7x7 = 49 個座標點
  precision: TMS_CONFIG.DECIMAL_PRECISION,
};

/**
 * 4 Decimal 精度座標格式化
 *
 * @param lat 緯度
 * @param lon 經度
 * @param precision 小數精度 (預設 4)
 * @returns 格式化的座標
 */
export function formatCoords4Decimal(
  lat: number,
  lon: number,
  precision: number = TMS_CONFIG.DECIMAL_PRECISION
): FormattedCoords {
  return {
    lat: lat.toFixed(precision),
    lon: lon.toFixed(precision),
  };
}

/**
 * 格式化座標轉換為 Redis key
 *
 * @param lat 緯度 (可以是數字或字串)
 * @param lon 經度 (可以是數字或字串)
 * @returns Redis key 格式字串
 */
export function coordsToKey(lat: number | string, lon: number | string): string {
  const latStr = typeof lat === 'string' ? lat : lat.toFixed(TMS_CONFIG.DECIMAL_PRECISION);
  const lonStr = typeof lon === 'string' ? lon : lon.toFixed(TMS_CONFIG.DECIMAL_PRECISION);
  return `${latStr}_${lonStr}`;
}

/**
 * Redis key 轉換為座標
 *
 * @param key Redis key 格式字串 (如 "23.6715_121.4355")
 * @returns 解析的座標
 */
export function keyToCoords(key: string): FormattedCoords {
  const parts = key.split('_');
  if (parts.length !== 2) {
    throw new Error(`無效的座標 key 格式: ${key}`);
  }

  return {
    lat: parts[0],
    lon: parts[1],
  };
}

/**
 * 格式化座標轉換為數字座標
 *
 * @param coords 格式化座標
 * @returns 數字座標
 */
export function formattedToLocation(coords: FormattedCoords): Location {
  return {
    lat: parseFloat(coords.lat),
    lon: parseFloat(coords.lon),
  };
}

/**
 * 數字座標轉換為格式化座標
 *
 * @param location 數字座標
 * @returns 格式化座標
 */
export function locationToFormatted(location: Location): FormattedCoords {
  return formatCoords4Decimal(location.lat, location.lon);
}

/**
 * 計算地理半徑範圍內的所有 4 decimal 座標點
 *
 * @param centerLat 中心點緯度
 * @param centerLon 中心點經度
 * @param config 範圍效應配置
 * @returns 影響範圍內的座標點陣列
 */
export function getAffectedGeoCoords(
  centerLat: number,
  centerLon: number,
  config: GeoRangeConfig = DEFAULT_RANGE_CONFIG
): FormattedCoords[] {
  // 特殊情況：零半徑只返回中心點
  if (config.radiusMeters === 0) {
    return [formatCoords4Decimal(centerLat, centerLon, config.precision)];
  }

  const affectedCoords: FormattedCoords[] = [];

  // 計算 4 decimal 精度下的度數增量
  const precisionIncrement = Math.pow(10, -config.precision);

  // 估算搜尋範圍
  // 緯度：1度 ≈ 111km，所以需要的度數範圍
  const latDegreesRadius = config.radiusMeters / 111000;
  // 經度：在不同緯度下變化，這裡使用中心點緯度計算
  const lonDegreesRadius = config.radiusMeters / (111000 * Math.cos((centerLat * Math.PI) / 180));

  // 計算搜尋邊界 (擴大到精度網格邊界)
  const minLat =
    Math.floor((centerLat - latDegreesRadius) / precisionIncrement) * precisionIncrement;
  const maxLat =
    Math.ceil((centerLat + latDegreesRadius) / precisionIncrement) * precisionIncrement;
  const minLon =
    Math.floor((centerLon - lonDegreesRadius) / precisionIncrement) * precisionIncrement;
  const maxLon =
    Math.ceil((centerLon + lonDegreesRadius) / precisionIncrement) * precisionIncrement;

  // 遍歷所有可能的 4 decimal 精度座標點
  for (let lat = minLat; lat <= maxLat; lat += precisionIncrement) {
    for (let lon = minLon; lon <= maxLon; lon += precisionIncrement) {
      // 檢查是否在半徑範圍內
      const distance = calculateDistance(centerLat, centerLon, lat, lon);

      if (distance <= config.radiusMeters) {
        affectedCoords.push(formatCoords4Decimal(lat, lon, config.precision));
      }

      // 安全限制：避免生成過多座標點
      if (affectedCoords.length >= config.maxCoords) {
        console.warn(`範圍效應座標點數量達到上限 ${config.maxCoords}，停止生成`);
        break;
      }
    }

    if (affectedCoords.length >= config.maxCoords) break;
  }

  return affectedCoords;
}

/**
 * 簡化的矩形邊界檢查
 *
 * @param lat 緯度
 * @param lon 經度
 * @param bounds 矩形邊界
 * @returns 是否在邊界內
 */
export function isWithinSimpleBounds(
  lat: number,
  lon: number,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): boolean {
  return (
    lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLng && lon <= bounds.maxLng
  );
}

/**
 * 計算兩個座標點之間的精確方位角
 *
 * @param lat1 起始點緯度
 * @param lon1 起始點經度
 * @param lat2 目標點緯度
 * @param lon2 目標點經度
 * @returns 方位角 (度數，0-360)
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * 根據距離和方位角計算目標點座標
 *
 * @param lat 起始點緯度
 * @param lon 起始點經度
 * @param bearing 方位角 (度數)
 * @param distance 距離 (公尺)
 * @returns 目標點座標
 */
export function pointAtDistanceAndBearing(
  lat: number,
  lon: number,
  bearing: number,
  distance: number
): Location {
  const R = TMS_CONFIG.EARTH_RADIUS;
  const bearingRad = (bearing * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;

  const targetLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(distance / R) +
      Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad)
  );

  const targetLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad),
      Math.cos(distance / R) - Math.sin(latRad) * Math.sin(targetLatRad)
    );

  return {
    lat: (targetLatRad * 180) / Math.PI,
    lon: (targetLonRad * 180) / Math.PI,
  };
}

/**
 * 驗證座標格式是否正確
 *
 * @param coords 格式化座標
 * @returns 是否有效
 */
export function validateFormattedCoords(coords: FormattedCoords): boolean {
  const lat = parseFloat(coords.lat);
  const lon = parseFloat(coords.lon);

  // 檢查是否為有效數字
  if (isNaN(lat) || isNaN(lon)) return false;

  // 檢查緯度範圍
  if (lat < -90 || lat > 90) return false;

  // 檢查經度範圍
  if (lon < -180 || lon > 180) return false;

  // 檢查精度格式
  const latDecimalPlaces = (coords.lat.split('.')[1] || '').length;
  const lonDecimalPlaces = (coords.lon.split('.')[1] || '').length;

  if (
    latDecimalPlaces > TMS_CONFIG.DECIMAL_PRECISION ||
    lonDecimalPlaces > TMS_CONFIG.DECIMAL_PRECISION
  ) {
    return false;
  }

  return true;
}

/**
 * 標準化座標格式 (確保精度一致)
 *
 * @param coords 原始格式化座標
 * @returns 標準化的座標
 */
export function normalizeFormattedCoords(coords: FormattedCoords): FormattedCoords {
  const lat = parseFloat(coords.lat);
  const lon = parseFloat(coords.lon);

  return formatCoords4Decimal(lat, lon);
}

/**
 * 計算座標點的密度 (每平方公里的點數)
 *
 * @param coords 座標點陣列
 * @param areaKm2 區域面積 (平方公里)
 * @returns 密度 (點/km²)
 */
export function calculateCoordDensity(coords: FormattedCoords[], areaKm2: number): number {
  return coords.length / areaKm2;
}

/**
 * 取得 4 decimal 精度下的相鄰座標點
 *
 * @param lat 中心點緯度
 * @param lon 中心點經度
 * @param includeCenter 是否包含中心點
 * @returns 相鄰座標點陣列 (最多 8 個，如果包含中心點則 9 個)
 */
export function getAdjacentCoords(
  lat: number,
  lon: number,
  includeCenter: boolean = true
): FormattedCoords[] {
  const coords: FormattedCoords[] = [];
  const increment = Math.pow(10, -TMS_CONFIG.DECIMAL_PRECISION);

  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      if (!includeCenter && dLat === 0 && dLon === 0) continue;

      const newLat = lat + dLat * increment;
      const newLon = lon + dLon * increment;

      coords.push(formatCoords4Decimal(newLat, newLon));
    }
  }

  return coords;
}
