import { Location, GridCoordinates } from '@/types/map';
import { AreaConfig, getDefaultAreaConfig } from '@/config/areas';

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
