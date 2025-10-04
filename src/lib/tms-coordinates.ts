/**
 * 標準 TMS (Tile Matrix Set) 座標轉換模組
 *
 * 完全符合 OGC Two Dimensional Tile Matrix Set 標準
 * 使用 Web Mercator 投影 (EPSG:3857) 和標準 z/x/y 座標系統
 */

// Location type imported inline to avoid unused import warning

// TMS 技術規格常數
export const TMS_CONFIG = {
  // Web Mercator 投影常數
  EARTH_RADIUS: 6378137, // WGS84 地球半徑 (公尺)
  EARTH_CIRCUMFERENCE: 2 * Math.PI * 6378137, // 地球周長
  ORIGIN_SHIFT: Math.PI * 6378137, // Web Mercator 原點偏移

  // 圖磚規格
  TILE_SIZE: 256, // 標準 TMS 圖磚大小 (像素)

  // 支援的縮放層級
  MIN_ZOOM: 14, // 區域概覽
  MAX_ZOOM: 19, // 高精度 (~0.6m/pixel)
  PRIMARY_ZOOM: 19, // 主要使用的縮放層級

  // 座標精度
  DECIMAL_PRECISION: 4, // lat/lng 小數點位數 (~11m 精度)
} as const;

/**
 * 圖磚座標接口
 */
export interface TileCoordinate {
  x: number;
  y: number;
  z: number; // 縮放層級
}

/**
 * 地理邊界接口 (簡化為矩形)
 */
export interface RectangleBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * GPS 座標轉換為 Web Mercator 像素座標
 *
 * @param lat 緯度 (WGS84)
 * @param lon 經度 (WGS84)
 * @param zoom 縮放層級
 * @returns Web Mercator 像素座標
 */
export function latLonToPixel(lat: number, lon: number, zoom: number): { x: number; y: number } {
  // Web Mercator 投影公式
  const tileCount = Math.pow(2, zoom);

  // 經度轉換 (線性)
  const pixelX = ((lon + 180) / 360) * tileCount * TMS_CONFIG.TILE_SIZE;

  // 緯度轉換 (Mercator 投影)
  const latRad = (lat * Math.PI) / 180;
  const pixelY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    tileCount *
    TMS_CONFIG.TILE_SIZE;

  return { x: pixelX, y: pixelY };
}

/**
 * Web Mercator 像素座標轉換為圖磚座標
 *
 * @param pixelX 像素 X 座標
 * @param pixelY 像素 Y 座標
 * @returns 圖磚座標 (不含縮放層級)
 */
export function pixelToTile(pixelX: number, pixelY: number): { x: number; y: number } {
  return {
    x: Math.floor(pixelX / TMS_CONFIG.TILE_SIZE),
    y: Math.floor(pixelY / TMS_CONFIG.TILE_SIZE),
  };
}

/**
 * GPS 座標直接轉換為標準圖磚座標
 *
 * @param lat 緯度
 * @param lon 經度
 * @param zoom 縮放層級
 * @returns 標準 TMS 圖磚座標
 */
export function gpsToTileCoords(lat: number, lon: number, zoom: number): TileCoordinate {
  // 先轉換為像素座標
  const pixel = latLonToPixel(lat, lon, zoom);

  // 再轉換為圖磚座標
  const tile = pixelToTile(pixel.x, pixel.y);

  return {
    x: tile.x,
    y: tile.y,
    z: zoom,
  };
}

/**
 * 圖磚座標轉換為 GPS 邊界
 *
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 * @param zoom 縮放層級
 * @returns GPS 邊界範圍
 */
export function tileToBounds(tileX: number, tileY: number, zoom: number): RectangleBounds {
  const tileCount = Math.pow(2, zoom);

  // 計算圖磚的經度範圍
  const minLng = (tileX / tileCount) * 360 - 180;
  const maxLng = ((tileX + 1) / tileCount) * 360 - 180;

  // 計算圖磚的緯度範圍 (逆 Mercator 投影)
  const north = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / tileCount)));
  const south = Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 1)) / tileCount)));

  const maxLat = (north * 180) / Math.PI;
  const minLat = (south * 180) / Math.PI;

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
  };
}

/**
 * 計算兩個地理點之間的距離 (Haversine 公式)
 *
 * @param lat1 第一點緯度
 * @param lon1 第一點經度
 * @param lat2 第二點緯度
 * @param lon2 第二點經度
 * @returns 距離 (公尺)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = TMS_CONFIG.EARTH_RADIUS; // 地球半徑
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 計算 GPS 點影響的圖磚座標（地理半徑範圍）
 *
 * @param lat 中心點緯度
 * @param lon 中心點經度
 * @param zoom 縮放層級
 * @param radiusMeters 影響半徑 (公尺)
 * @returns 受影響的圖磚座標陣列
 */
export function getAffectedTiles(
  lat: number,
  lon: number,
  zoom: number,
  radiusMeters: number
): TileCoordinate[] {
  const affectedTiles: TileCoordinate[] = [];
  const centerTile = gpsToTileCoords(lat, lon, zoom);

  // 特殊情況：零半徑只返回中心圖磚
  if (radiusMeters === 0) {
    return [centerTile];
  }

  // 估算需要檢查的圖磚範圍
  // 在 zoom 19，一個圖磚約 153m × 153m (因緯度而異)
  const metersPerTile = TMS_CONFIG.EARTH_CIRCUMFERENCE / Math.pow(2, zoom);
  const tileRadius = Math.ceil(radiusMeters / metersPerTile) + 1; // 加1確保覆蓋完整

  // 檢查中心圖磚周圍的所有圖磚
  for (let dx = -tileRadius; dx <= tileRadius; dx++) {
    for (let dy = -tileRadius; dy <= tileRadius; dy++) {
      const tileX = centerTile.x + dx;
      const tileY = centerTile.y + dy;

      // 檢查圖磚是否在有效範圍內
      if (tileX >= 0 && tileY >= 0 && tileX < Math.pow(2, zoom) && tileY < Math.pow(2, zoom)) {
        // 計算圖磚中心點
        const tileBounds = tileToBounds(tileX, tileY, zoom);
        const tileCenterLat = (tileBounds.minLat + tileBounds.maxLat) / 2;
        const tileCenterLon = (tileBounds.minLng + tileBounds.maxLng) / 2;

        // 檢查圖磚中心是否在影響半徑內
        const distance = calculateDistance(lat, lon, tileCenterLat, tileCenterLon);

        if (distance <= radiusMeters) {
          affectedTiles.push({
            x: tileX,
            y: tileY,
            z: zoom,
          });
        }
      }
    }
  }

  return affectedTiles;
}

/**
 * 驗證圖磚座標是否在區域範圍內
 *
 * @param tileX 圖磚 X 座標
 * @param tileY 圖磚 Y 座標
 * @param zoom 縮放層級
 * @param bounds 區域邊界
 * @returns 是否在範圍內
 */
export function isValidTileInArea(
  tileX: number,
  tileY: number,
  zoom: number,
  bounds: RectangleBounds
): boolean {
  const tileBounds = tileToBounds(tileX, tileY, zoom);

  // 檢查圖磚是否與區域邊界有交集
  return !(
    tileBounds.maxLat < bounds.minLat ||
    tileBounds.minLat > bounds.maxLat ||
    tileBounds.maxLng < bounds.minLng ||
    tileBounds.minLng > bounds.maxLng
  );
}

/**
 * 計算兩個圖磚座標之間的距離 (圖磚單位)
 *
 * @param tile1 第一個圖磚座標
 * @param tile2 第二個圖磚座標
 * @returns 距離 (圖磚單位)
 */
export function tileDistance(tile1: TileCoordinate, tile2: TileCoordinate): number {
  if (tile1.z !== tile2.z) {
    throw new Error('無法計算不同縮放層級圖磚之間的距離');
  }

  const dx = tile1.x - tile2.x;
  const dy = tile1.y - tile2.y;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 驗證縮放層級是否支援
 *
 * @param zoom 縮放層級
 * @returns 是否支援
 */
export function isValidZoom(zoom: number): boolean {
  return Number.isInteger(zoom) && zoom >= TMS_CONFIG.MIN_ZOOM && zoom <= TMS_CONFIG.MAX_ZOOM;
}

/**
 * 取得建議的縮放層級
 *
 * @param bounds 區域邊界
 * @returns 建議的縮放層級
 */
export function getRecommendedZoom(bounds: RectangleBounds): number {
  // 計算區域的經緯度跨度
  const latSpan = bounds.maxLat - bounds.minLat;
  const lonSpan = bounds.maxLng - bounds.minLng;

  // 估算適合的縮放層級
  // 目標：整個區域在合理的圖磚數量內顯示
  const maxSpan = Math.max(latSpan, lonSpan);

  if (maxSpan > 1.0) return 14; // 大區域
  if (maxSpan > 0.1) return 16; // 中等區域
  if (maxSpan > 0.01) return 18; // 小區域
  return 19; // 高精度區域
}
