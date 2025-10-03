/**
 * 4 Decimal 精度地理座標工具模組單元測試
 *
 * 驗證地理座標格式化、範圍效應計算和邊界檢查的正確性
 */

import {
  formatCoords4Decimal,
  coordsToKey,
  keyToCoords,
  formattedToLocation,
  locationToFormatted,
  getAffectedGeoCoords,
  isWithinSimpleBounds,
  calculateBearing,
  pointAtDistanceAndBearing,
  validateFormattedCoords,
  normalizeFormattedCoords,
  calculateCoordDensity,
  getAdjacentCoords,
  DEFAULT_RANGE_CONFIG,
} from './geo-coordinates';

describe('4 Decimal 精度地理座標工具模組', () => {
  // 測試用的光復鄉座標
  const GUANGFU_CENTER = { lat: 23.66767, lon: 121.43705 };
  const GUANGFU_BOUNDS = {
    minLat: 23.65397,
    maxLat: 23.68137,
    minLng: 121.4176,
    maxLng: 121.45657,
  };

  describe('座標格式化', () => {
    test('4 decimal 精度格式化', () => {
      const formatted = formatCoords4Decimal(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon);

      expect(formatted.lat).toBe('23.6677');
      expect(formatted.lon).toBe('121.4370');
    });

    test('自定義精度格式化', () => {
      const formatted = formatCoords4Decimal(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, 2);

      expect(formatted.lat).toBe('23.67');
      expect(formatted.lon).toBe('121.44');
    });

    test('座標到 Redis key 轉換', () => {
      const key = coordsToKey(23.6677, 121.4371);
      expect(key).toBe('23.6677_121.4371');
    });

    test('字串座標到 Redis key 轉換', () => {
      const key = coordsToKey('23.6677', '121.4371');
      expect(key).toBe('23.6677_121.4371');
    });

    test('Redis key 到座標轉換', () => {
      const coords = keyToCoords('23.6677_121.4371');
      expect(coords.lat).toBe('23.6677');
      expect(coords.lon).toBe('121.4371');
    });

    test('無效 Redis key 應拋出錯誤', () => {
      expect(() => keyToCoords('invalid')).toThrow(); // 沒有下劃線
      expect(() => keyToCoords('23.6677')).toThrow(); // 沒有下劃線
      expect(() => keyToCoords('23.6677_121.4371_extra')).toThrow(); // 超過兩部分
    });
  });

  describe('座標類型轉換', () => {
    test('格式化座標轉數字座標', () => {
      const formatted = { lat: '23.6677', lon: '121.4371' };
      const location = formattedToLocation(formatted);

      expect(location.lat).toBe(23.6677);
      expect(location.lon).toBe(121.4371);
    });

    test('數字座標轉格式化座標', () => {
      const formatted = locationToFormatted(GUANGFU_CENTER);

      expect(formatted.lat).toBe('23.6677');
      expect(formatted.lon).toBe('121.4370');
    });

    test('雙向轉換一致性', () => {
      const original = GUANGFU_CENTER;
      const formatted = locationToFormatted(original);
      const converted = formattedToLocation(formatted);

      // 由於精度限制，允許小誤差
      expect(Math.abs(converted.lat - original.lat)).toBeLessThan(0.0001);
      expect(Math.abs(converted.lon - original.lon)).toBeLessThan(0.0001);
    });
  });

  describe('地理範圍效應計算', () => {
    test('計算受影響的座標點', () => {
      const affectedCoords = getAffectedGeoCoords(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, {
        ...DEFAULT_RANGE_CONFIG,
        radiusMeters: 25,
      });

      // 應該有多個受影響的座標點
      expect(affectedCoords.length).toBeGreaterThan(1);
      expect(affectedCoords.length).toBeLessThan(50); // 合理上限

      // 所有座標應該是有效的 4 decimal 格式
      affectedCoords.forEach((coord) => {
        expect(validateFormattedCoords(coord)).toBe(true);
      });
    });

    test('中心點應包含在受影響座標中', () => {
      const centerFormatted = formatCoords4Decimal(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon);
      const affectedCoords = getAffectedGeoCoords(
        GUANGFU_CENTER.lat,
        GUANGFU_CENTER.lon,
        DEFAULT_RANGE_CONFIG
      );

      const containsCenter = affectedCoords.some(
        (coord) => coord.lat === centerFormatted.lat && coord.lon === centerFormatted.lon
      );
      expect(containsCenter).toBe(true);
    });

    test('更大半徑應產生更多座標點', () => {
      const smallRadius = getAffectedGeoCoords(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, {
        ...DEFAULT_RANGE_CONFIG,
        radiusMeters: 10,
      });

      const largeRadius = getAffectedGeoCoords(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, {
        ...DEFAULT_RANGE_CONFIG,
        radiusMeters: 50,
      });

      expect(largeRadius.length).toBeGreaterThan(smallRadius.length);
    });

    test('座標點數量限制', () => {
      const affectedCoords = getAffectedGeoCoords(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, {
        ...DEFAULT_RANGE_CONFIG,
        radiusMeters: 100,
        maxCoords: 10,
      });

      expect(affectedCoords.length).toBeLessThanOrEqual(10);
    });
  });

  describe('簡化邊界檢查', () => {
    test('座標在邊界內', () => {
      const isWithin = isWithinSimpleBounds(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, GUANGFU_BOUNDS);

      expect(isWithin).toBe(true);
    });

    test('座標在邊界外', () => {
      // 台北 101 座標 (明顯不在光復鄉範圍內)
      const isWithin = isWithinSimpleBounds(25.034, 121.5645, GUANGFU_BOUNDS);

      expect(isWithin).toBe(false);
    });

    test('邊界上的座標', () => {
      // 測試邊界點
      expect(
        isWithinSimpleBounds(GUANGFU_BOUNDS.minLat, GUANGFU_BOUNDS.minLng, GUANGFU_BOUNDS)
      ).toBe(true);
      expect(
        isWithinSimpleBounds(GUANGFU_BOUNDS.maxLat, GUANGFU_BOUNDS.maxLng, GUANGFU_BOUNDS)
      ).toBe(true);
    });

    test('剛好超出邊界的座標', () => {
      const outsideLat = GUANGFU_BOUNDS.maxLat + 0.00001;
      const outsideLon = GUANGFU_BOUNDS.maxLng + 0.00001;

      expect(isWithinSimpleBounds(outsideLat, GUANGFU_BOUNDS.maxLng, GUANGFU_BOUNDS)).toBe(false);
      expect(isWithinSimpleBounds(GUANGFU_BOUNDS.maxLat, outsideLon, GUANGFU_BOUNDS)).toBe(false);
    });
  });

  describe('方位角和距離計算', () => {
    test('計算方位角', () => {
      // 從光復鄉中心向正北
      const bearing = calculateBearing(
        GUANGFU_CENTER.lat,
        GUANGFU_CENTER.lon,
        GUANGFU_CENTER.lat + 0.01,
        GUANGFU_CENTER.lon
      );

      expect(bearing).toBeCloseTo(0, 1); // 正北約 0 度
    });

    test('計算正東方位角', () => {
      const bearing = calculateBearing(
        GUANGFU_CENTER.lat,
        GUANGFU_CENTER.lon,
        GUANGFU_CENTER.lat,
        GUANGFU_CENTER.lon + 0.01
      );

      expect(bearing).toBeCloseTo(90, 1); // 正東約 90 度
    });

    test('根據距離和方位角計算目標點', () => {
      const distance = 1000; // 1公里
      const bearing = 90; // 正東

      const target = pointAtDistanceAndBearing(
        GUANGFU_CENTER.lat,
        GUANGFU_CENTER.lon,
        bearing,
        distance
      );

      // 目標點應該在原點的東邊
      expect(target.lon).toBeGreaterThan(GUANGFU_CENTER.lon);
      expect(Math.abs(target.lat - GUANGFU_CENTER.lat)).toBeLessThan(0.001); // 緯度變化不大
    });

    test('距離和方位角計算的一致性', () => {
      const distance = 500; // 500公尺
      const bearing = 45; // 東北方向

      const target = pointAtDistanceAndBearing(
        GUANGFU_CENTER.lat,
        GUANGFU_CENTER.lon,
        bearing,
        distance
      );

      // 計算回程方位角
      const returnBearing = calculateBearing(
        target.lat,
        target.lon,
        GUANGFU_CENTER.lat,
        GUANGFU_CENTER.lon
      );

      // 回程方位角應該與原方位角相差約 180 度
      const bearingDiff = Math.abs(returnBearing - bearing - 180);
      expect(bearingDiff < 5 || bearingDiff > 355).toBe(true); // 允許 5 度誤差
    });
  });

  describe('座標驗證', () => {
    test('有效座標格式', () => {
      const validCoords = { lat: '23.6677', lon: '121.4371' };
      expect(validateFormattedCoords(validCoords)).toBe(true);
    });

    test('無效座標格式', () => {
      expect(validateFormattedCoords({ lat: 'invalid', lon: '121.4371' })).toBe(false);
      expect(validateFormattedCoords({ lat: '23.6677', lon: 'invalid' })).toBe(false);
      expect(validateFormattedCoords({ lat: '91.0000', lon: '121.4371' })).toBe(false); // 緯度超範圍
      expect(validateFormattedCoords({ lat: '23.6677', lon: '181.0000' })).toBe(false); // 經度超範圍
    });

    test('精度過高的座標', () => {
      const highPrecision = { lat: '23.123456789', lon: '121.123456789' };
      expect(validateFormattedCoords(highPrecision)).toBe(false);
    });

    test('標準化座標格式', () => {
      const unnormalized = { lat: '23.67', lon: '121.44' };
      const normalized = normalizeFormattedCoords(unnormalized);

      expect(normalized.lat).toBe('23.6700');
      expect(normalized.lon).toBe('121.4400');
    });
  });

  describe('座標密度計算', () => {
    test('計算座標密度', () => {
      const coords = [
        { lat: '23.6677', lon: '121.4371' },
        { lat: '23.6678', lon: '121.4372' },
        { lat: '23.6679', lon: '121.4373' },
      ];

      const density = calculateCoordDensity(coords, 1.0); // 1 平方公里
      expect(density).toBe(3); // 3 點/km²
    });
  });

  describe('相鄰座標計算', () => {
    test('取得相鄰座標點 (包含中心)', () => {
      const adjacent = getAdjacentCoords(23.6677, 121.4371, true);

      expect(adjacent.length).toBe(9); // 3x3 = 9 個點

      // 中心點應該在其中
      const centerExists = adjacent.some(
        (coord) => coord.lat === '23.6677' && coord.lon === '121.4371'
      );
      expect(centerExists).toBe(true);
    });

    test('取得相鄰座標點 (不包含中心)', () => {
      const adjacent = getAdjacentCoords(23.6677, 121.4371, false);

      expect(adjacent.length).toBe(8); // 周圍 8 個點

      // 中心點不應該在其中
      const centerExists = adjacent.some(
        (coord) => coord.lat === '23.6677' && coord.lon === '121.4371'
      );
      expect(centerExists).toBe(false);
    });

    test('相鄰座標點的精度一致性', () => {
      const adjacent = getAdjacentCoords(23.6677, 121.4371);

      adjacent.forEach((coord) => {
        expect(coord.lat.split('.')[1]?.length).toBe(4);
        expect(coord.lon.split('.')[1]?.length).toBe(4);
      });
    });
  });

  describe('邊界情況處理', () => {
    test('處理極端座標', () => {
      // 北極
      const northPole = formatCoords4Decimal(90, 0);
      expect(validateFormattedCoords(northPole)).toBe(true);

      // 南極
      const southPole = formatCoords4Decimal(-90, 0);
      expect(validateFormattedCoords(southPole)).toBe(true);

      // 180 度經線
      const eastDateLine = formatCoords4Decimal(0, 180);
      expect(validateFormattedCoords(eastDateLine)).toBe(true);

      const westDateLine = formatCoords4Decimal(0, -180);
      expect(validateFormattedCoords(westDateLine)).toBe(true);
    });

    test('零距離範圍效應', () => {
      const coords = getAffectedGeoCoords(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon, {
        ...DEFAULT_RANGE_CONFIG,
        radiusMeters: 0,
      });

      expect(coords.length).toBe(1); // 只有中心點
      expect(coords[0].lat).toBe(formatCoords4Decimal(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon).lat);
      expect(coords[0].lon).toBe(formatCoords4Decimal(GUANGFU_CENTER.lat, GUANGFU_CENTER.lon).lon);
    });

    test('處理精度邊界', () => {
      // 測試 4 decimal 精度邊界的處理
      const coords = getAffectedGeoCoords(23.99995, 121.99995, {
        radiusMeters: 10,
        maxCoords: 10,
        precision: 4,
      });

      coords.forEach((coord) => {
        expect(validateFormattedCoords(coord)).toBe(true);
      });
    });
  });
});
