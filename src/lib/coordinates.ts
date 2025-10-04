import { Location, TileCoordinate, FormattedCoords } from '@/types/map';
import { AreaConfig, getDefaultAreaConfig } from '@/config/areas';

// 匯入標準 TMS 座標轉換函數
import { gpsToTileCoords, getAffectedTiles } from './tms-coordinates';

// 匯入 4 decimal 精度地理座標工具
import {
  formatCoords4Decimal,
  coordsToKey,
  keyToCoords,
  getAffectedGeoCoords,
} from './geo-coordinates';

/**
 * GPS 座標轉換為標準圖磚座標
 * @param location GPS 座標
 * @param zoom 縮放層級 (預設 19)
 * @returns 標準圖磚座標
 */
export function gpsToStandardTileCoords(location: Location, zoom: number = 19): TileCoordinate {
  return gpsToTileCoords(location.lat, location.lon, zoom);
}

/**
 * GPS 座標轉換為 4 decimal 精度格式
 * @param location GPS 座標
 * @returns 格式化座標
 */
export function gpsToFormattedCoords(location: Location): FormattedCoords {
  return formatCoords4Decimal(location.lat, location.lon);
}

/**
 * 格式化座標轉換為 GPS 座標
 * @param coords 格式化座標
 * @returns GPS 座標
 */
export function formattedCoordsToGps(coords: FormattedCoords): Location {
  return {
    lat: parseFloat(coords.lat),
    lon: parseFloat(coords.lon),
  };
}

/**
 * 計算地理範圍效應影響的座標點
 * @param center 中心 GPS 座標
 * @param radiusMeters 影響半徑 (公尺)
 * @returns 受影響的格式化座標列表
 */
export function getGeoRangeEffect(center: Location, radiusMeters: number = 25): FormattedCoords[] {
  return getAffectedGeoCoords(center.lat, center.lon, {
    radiusMeters,
    maxCoords: 50,
    precision: 4,
  });
}

/**
 * 計算受影響的標準圖磚
 * @param center 中心 GPS 座標
 * @param radiusMeters 影響半徑 (公尺)
 * @param areaConfig 區域配置 (可選)
 * @param zoom 縮放層級 (預設 19)
 * @returns 受影響的圖磚列表
 */
export function getAffectedStandardTiles(
  center: Location,
  radiusMeters: number = 25,
  areaConfig?: AreaConfig,
  zoom: number = 19
): TileCoordinate[] {
  return getAffectedTiles(center.lat, center.lon, zoom, radiusMeters);
}

/**
 * 生成座標的 Redis key
 * @param location GPS 座標
 * @returns Redis key 格式 \"lat_lon\"
 */
export function generateCoordKey(location: Location): string {
  return coordsToKey(location.lat, location.lon);
}

/**
 * 解析 Redis key 為座標
 * @param key Redis key 格式
 * @returns 格式化座標
 */
export function parseCoordKey(key: string): FormattedCoords {
  return keyToCoords(key);
}

/**
 * 獲取當前區域的中心點
 */
export function getCurrentAreaCenter(): Location {
  const config = getDefaultAreaConfig();
  return config.center;
}

/**
 * 獲取當前區域的邊界
 */
export function getCurrentAreaBounds() {
  const config = getDefaultAreaConfig();
  return config.bounds;
}
