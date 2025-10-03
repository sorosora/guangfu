import { Location, GridCoordinates, TileCoordinate, FormattedCoords } from '@/types/map';
import { AreaConfig, getDefaultAreaConfig } from '@/config/areas';

// 匯入新的標準 TMS 座標轉換函數
import {
  latLonToPixel,
  gpsToTileCoords,
  tileToBounds,
  calculateDistance,
  getAffectedTiles,
  isValidTileInArea,
} from './tms-coordinates';

// 匯入 4 decimal 精度地理座標工具
import {
  formatCoords4Decimal,
  coordsToKey,
  keyToCoords,
  getAffectedGeoCoords,
  isWithinSimpleBounds,
} from './geo-coordinates';

/**
 * 檢查座標是否在指定區域範圍內
 */
export function isWithinBounds(location: Location, areaConfig?: AreaConfig): boolean {
  const config = areaConfig || getDefaultAreaConfig();
  const { lat, lon } = location;
  const { northWest, southEast } = config.bounds;

  return (
    lat <= northWest.lat && lat >= southEast.lat && lon >= northWest.lon && lon <= southEast.lon
  );
}

/**
 * 將 GPS 座標轉換為網格座標
 */
export function gpsToGrid(location: Location, areaConfig?: AreaConfig): GridCoordinates | null {
  const config = areaConfig || getDefaultAreaConfig();

  if (!isWithinBounds(location, config)) {
    return null;
  }

  const { lat, lon } = location;
  const { northWest, southEast } = config.bounds;
  const { gridSize } = config;

  // 計算相對位置 (0-1)
  const latRatio = (northWest.lat - lat) / (northWest.lat - southEast.lat);
  const lonRatio = (lon - northWest.lon) / (southEast.lon - northWest.lon);

  // 轉換為網格座標
  const x = Math.floor(lonRatio * gridSize.width);
  const y = Math.floor(latRatio * gridSize.height);

  // 確保座標在有效範圍內
  return {
    x: Math.max(0, Math.min(x, gridSize.width - 1)),
    y: Math.max(0, Math.min(y, gridSize.height - 1)),
  };
}

/**
 * 將網格座標轉換為 GPS 座標
 */
export function gridToGps(grid: GridCoordinates, areaConfig?: AreaConfig): Location {
  const config = areaConfig || getDefaultAreaConfig();
  const { x, y } = grid;
  const { northWest, southEast } = config.bounds;
  const { gridSize } = config;

  const lonRatio = x / gridSize.width;
  const latRatio = y / gridSize.height;

  return {
    lat: northWest.lat - latRatio * (northWest.lat - southEast.lat),
    lon: northWest.lon + lonRatio * (southEast.lon - northWest.lon),
  };
}

/**
 * 計算網格的唯一 ID
 */
export function getGridId(grid: GridCoordinates): string {
  return `${grid.x}_${grid.y}`;
}

/**
 * 獲取範圍效應的鄰近網格（3x3）
 */
export function getNeighborGrids(
  grid: GridCoordinates,
  areaConfig?: AreaConfig
): GridCoordinates[] {
  const config = areaConfig || getDefaultAreaConfig();
  const neighbors: GridCoordinates[] = [];
  const { gridSize } = config;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const x = grid.x + dx;
      const y = grid.y + dy;

      if (x >= 0 && x < gridSize.width && y >= 0 && y < gridSize.height) {
        neighbors.push({ x, y });
      }
    }
  }

  return neighbors;
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

// =================== 新增標準 TMS 座標系統函數 ===================

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
 * 標準邊界檢查 (矩形)
 * @param location GPS 座標
 * @param areaConfig 區域配置 (可選)
 * @returns 是否在邊界內
 */
export function isWithinStandardBounds(location: Location, areaConfig?: AreaConfig): boolean {
  const config = areaConfig || getDefaultAreaConfig();
  const bounds = {
    minLat: config.bounds.southEast.lat,
    maxLat: config.bounds.northWest.lat,
    minLng: config.bounds.northWest.lon,
    maxLng: config.bounds.southEast.lon,
  };

  return isWithinSimpleBounds(location.lat, location.lon, bounds);
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
  const config = areaConfig || getDefaultAreaConfig();
  const bounds = {
    minLat: config.bounds.southEast.lat,
    maxLat: config.bounds.northWest.lat,
    minLng: config.bounds.northWest.lon,
    maxLng: config.bounds.southEast.lon,
  };

  return getAffectedTiles(center.lat, center.lon, zoom, radiusMeters);
}

/**
 * 生成座標的 Redis key
 * @param location GPS 座標
 * @returns Redis key 格式 "lat_lon"
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

// =================== 向後相容函數 (舊版網格系統) ===================

// 注意：isWithinBounds 函數已存在於檔案開頭，保持向後相容性
// 新程式碼請使用 isWithinStandardBounds 函數
