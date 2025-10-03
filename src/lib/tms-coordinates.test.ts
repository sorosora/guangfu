/**
 * TMS 座標轉換模組單元測試
 *
 * 驗證 Web Mercator 投影和標準 TMS 座標轉換的正確性
 */

import {
  latLonToPixel,
  pixelToTile,
  gpsToTileCoords,
  tileToBounds,
  calculateDistance,
  getAffectedTiles,
  isValidTileInArea,
  tileDistance,
  isValidZoom,
  getRecommendedZoom,
  TMS_CONFIG,
} from './tms-coordinates';

describe('TMS 座標轉換模組', () => {
  // 測試用的光復鄉座標
  const GUANGFU_CENTER = { lat: 23.66767, lon: 121.43705 };
  const GUANGFU_BOUNDS = {
    minLat: 23.65397,
    maxLat: 23.68137,
    minLng: 121.4176,
    maxLng: 121.45657,
  };

  describe('基礎座標轉換', () => {
    test('GPS 座標轉換為 Web Mercator 像素座標', () => {
      const pixel = latLonToPixel(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, 19);

      // 驗證結果是數字且在合理範圍內
      expect(typeof pixel.x).toBe('number');
      expect(typeof pixel.y).toBe('number');
      expect(pixel.x).toBeGreaterThan(0);
      expect(pixel.y).toBeGreaterThan(0);
      expect(isFinite(pixel.x)).toBe(true);
      expect(isFinite(pixel.y)).toBe(true);
    });

    test('像素座標轉換為圖磚座標', () => {
      const tile = pixelToTile(1000000, 500000);

      expect(tile.x).toBe(Math.floor(1000000 / TMS_CONFIG.TILE_SIZE));
      expect(tile.y).toBe(Math.floor(500000 / TMS_CONFIG.TILE_SIZE));
    });

    test('GPS 座標直接轉換為圖磚座標', () => {
      const tile = gpsToTileCoords(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, 19);

      expect(typeof tile.x).toBe('number');
      expect(typeof tile.y).toBe('number');
      expect(tile.z).toBe(19);
      expect(Number.isInteger(tile.x)).toBe(true);
      expect(Number.isInteger(tile.y)).toBe(true);
    });

    test('圖磚座標轉換為 GPS 邊界', () => {
      const tile = gpsToTileCoords(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, 19);
      const bounds = tileToBounds(tile.x, tile.y, 19);

      // 驗證邊界包含原始座標
      expect(bounds.minLat).toBeLessThanOrEqual(GUANGFU_CENTER.lat);
      expect(bounds.maxLat).toBeGreaterThanOrEqual(GUANGFU_CENTER.lat);
      expect(bounds.minLng).toBeLessThanOrEqual(GUANGFU_CENTER.lon);
      expect(bounds.maxLng).toBeGreaterThanOrEqual(GUANGFU_CENTER.lon);
    });
  });

  describe('距離計算', () => {
    test('計算兩點之間的距離', () => {
      // 光復鄉中心到東北角的距離
      const distance = calculateDistance(
        GUANGFU_CENTER.lat,
        GUANGFU_CENTER.lon,
        GUANGFU_BOUNDS.maxLat,
        GUANGFU_BOUNDS.maxLng
      );

      // 光復鄉範圍約 4km × 3km，對角線應該約 5km
      expect(distance).toBeGreaterThan(2000); // 至少 2km
      expect(distance).toBeLessThan(8000); // 不超過 8km
    });

    test('相同點的距離應為 0', () => {
      const distance = calculateDistance(
        GUANGFU_CENTER.lat,
        GUANGFU_CENTER.lon,
        GUANGFU_CENTER.lat,
        GUANGFU_CENTER.lon
      );

      expect(distance).toBe(0);
    });
  });

  describe('範圍效應計算', () => {
    test('計算受影響的圖磚座標', () => {
      const affectedTiles = getAffectedTiles(
        GUANGFU_CENTER.lat,
        GUANGFU_CENTER.lon,
        19,
        25 // 25公尺半徑
      );

      // 應該有多個受影響的圖磚
      expect(affectedTiles.length).toBeGreaterThan(0);
      expect(affectedTiles.length).toBeLessThan(50); // 合理上限

      // 所有圖磚應該有相同的縮放層級
      affectedTiles.forEach((tile) => {
        expect(tile.z).toBe(19);
        expect(Number.isInteger(tile.x)).toBe(true);
        expect(Number.isInteger(tile.y)).toBe(true);
      });
    });

    test('更大半徑應產生更多受影響圖磚', () => {
      const smallRadius = getAffectedTiles(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, 19, 10);
      const largeRadius = getAffectedTiles(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, 19, 50);

      expect(largeRadius.length).toBeGreaterThan(smallRadius.length);
    });
  });

  describe('邊界檢查', () => {
    test('圖磚在區域範圍內', () => {
      const centerTile = gpsToTileCoords(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, 19);
      const isValid = isValidTileInArea(centerTile.x, centerTile.y, 19, GUANGFU_BOUNDS);

      expect(isValid).toBe(true);
    });

    test('遠離區域的圖磚應不在範圍內', () => {
      // 使用台北 101 的座標 (明顯不在光復鄉範圍內)
      const taipeiTile = gpsToTileCoords(25.034, 121.5645, 19);
      const isValid = isValidTileInArea(taipeiTile.x, taipeiTile.y, 19, GUANGFU_BOUNDS);

      expect(isValid).toBe(false);
    });
  });

  describe('圖磚距離計算', () => {
    test('計算圖磚之間的距離', () => {
      const tile1 = { x: 0, y: 0, z: 19 };
      const tile2 = { x: 3, y: 4, z: 19 };

      const distance = tileDistance(tile1, tile2);
      expect(distance).toBe(5); // 3-4-5 直角三角形
    });

    test('不同縮放層級應拋出錯誤', () => {
      const tile1 = { x: 0, y: 0, z: 18 };
      const tile2 = { x: 0, y: 0, z: 19 };

      expect(() => tileDistance(tile1, tile2)).toThrow();
    });
  });

  describe('縮放層級驗證', () => {
    test('有效縮放層級', () => {
      expect(isValidZoom(14)).toBe(true);
      expect(isValidZoom(19)).toBe(true);
      expect(isValidZoom(16)).toBe(true);
    });

    test('無效縮放層級', () => {
      expect(isValidZoom(13)).toBe(false);
      expect(isValidZoom(20)).toBe(false);
      expect(isValidZoom(1.5)).toBe(false);
      expect(isValidZoom(-1)).toBe(false);
    });

    test('建議縮放層級', () => {
      // 小區域應推薦高縮放層級
      const smallArea = {
        minLat: 23.665,
        maxLat: 23.67,
        minLng: 121.435,
        maxLng: 121.44,
      };
      expect(getRecommendedZoom(smallArea)).toBeGreaterThanOrEqual(18);

      // 大區域應推薦低縮放層級
      const largeArea = {
        minLat: 20.0,
        maxLat: 26.0,
        minLng: 118.0,
        maxLng: 124.0,
      };
      expect(getRecommendedZoom(largeArea)).toBeLessThanOrEqual(16);
    });
  });

  describe('座標轉換一致性', () => {
    test('GPS → 圖磚 → GPS 轉換一致性', () => {
      const originalLat = GUANGFU_CENTER.lat;
      const originalLon = GUANGFU_CENTER.lon;

      // GPS → 圖磚
      const tile = gpsToTileCoords(originalLat, originalLon, 19);

      // 圖磚 → GPS 邊界
      const bounds = tileToBounds(tile.x, tile.y, 19);

      // 驗證原始座標在圖磚邊界內
      expect(originalLat).toBeGreaterThanOrEqual(bounds.minLat);
      expect(originalLat).toBeLessThanOrEqual(bounds.maxLat);
      expect(originalLon).toBeGreaterThanOrEqual(bounds.minLng);
      expect(originalLon).toBeLessThanOrEqual(bounds.maxLng);
    });

    test('不同縮放層級的座標一致性', () => {
      const lat = GUANGFU_CENTER.lat;
      const lon = GUANGFU_CENTER.lon;

      const tile18 = gpsToTileCoords(lat, lon, 18);
      const tile19 = gpsToTileCoords(lat, lon, 19);

      // zoom 19 的圖磚座標應該是 zoom 18 的 2 倍關係
      expect(Math.floor(tile19.x / 2)).toBe(tile18.x);
      expect(Math.floor(tile19.y / 2)).toBe(tile18.y);
    });
  });

  describe('邊界情況處理', () => {
    test('處理極端緯度', () => {
      // 北極附近
      const northPole = latLonToPixel(85, 0, 10);
      expect(isFinite(northPole.x)).toBe(true);
      expect(isFinite(northPole.y)).toBe(true);

      // 南極附近
      const southPole = latLonToPixel(-85, 0, 10);
      expect(isFinite(southPole.x)).toBe(true);
      expect(isFinite(southPole.y)).toBe(true);
    });

    test('處理 180 度經線', () => {
      const eastDate = latLonToPixel(0, 180, 10);
      const westDate = latLonToPixel(0, -180, 10);

      expect(isFinite(eastDate.x)).toBe(true);
      expect(isFinite(westDate.x)).toBe(true);
    });

    test('零半徑範圍效應', () => {
      const tiles = getAffectedTiles(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, 19, 0);
      expect(tiles.length).toBe(1); // 只有中心圖磚
    });
  });
});
