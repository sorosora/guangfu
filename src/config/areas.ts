import { Location } from '@/types/map';

// 從環境變數讀取測試區域配置
function getTestAreaFromEnv(): Partial<AreaConfig> | null {
  const envVars = {
    northWestLat: process.env.NEXT_PUBLIC_TEST_AREA_NORTHWEST_LAT,
    northWestLon: process.env.NEXT_PUBLIC_TEST_AREA_NORTHWEST_LON,
    northEastLat: process.env.NEXT_PUBLIC_TEST_AREA_NORTHEAST_LAT,
    northEastLon: process.env.NEXT_PUBLIC_TEST_AREA_NORTHEAST_LON,
    southWestLat: process.env.NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LAT,
    southWestLon: process.env.NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LON,
    southEastLat: process.env.NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LAT,
    southEastLon: process.env.NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LON,
    centerLat: process.env.NEXT_PUBLIC_TEST_AREA_CENTER_LAT,
    centerLon: process.env.NEXT_PUBLIC_TEST_AREA_CENTER_LON,
    description: process.env.NEXT_PUBLIC_TEST_AREA_DESCRIPTION,
  };

  // 檢查是否所有必要的座標都存在
  const requiredCoords = [
    envVars.northWestLat,
    envVars.northWestLon,
    envVars.northEastLat,
    envVars.northEastLon,
    envVars.southWestLat,
    envVars.southWestLon,
    envVars.southEastLat,
    envVars.southEastLon,
    envVars.centerLat,
    envVars.centerLon,
  ];

  if (requiredCoords.some((coord) => !coord)) {
    return null; // 環境變數不完整
  }

  // 轉換為數字並驗證
  try {
    const bounds = {
      northWest: {
        lat: parseFloat(envVars.northWestLat!),
        lon: parseFloat(envVars.northWestLon!),
      },
      northEast: {
        lat: parseFloat(envVars.northEastLat!),
        lon: parseFloat(envVars.northEastLon!),
      },
      southWest: {
        lat: parseFloat(envVars.southWestLat!),
        lon: parseFloat(envVars.southWestLon!),
      },
      southEast: {
        lat: parseFloat(envVars.southEastLat!),
        lon: parseFloat(envVars.southEastLon!),
      },
    };

    const center = {
      lat: parseFloat(envVars.centerLat!),
      lon: parseFloat(envVars.centerLon!),
    };

    // 基本驗證：確保座標在合理範圍內
    const allCoords = [
      bounds.northWest,
      bounds.northEast,
      bounds.southWest,
      bounds.southEast,
      center,
    ];

    const isValidCoord = (coord: Location) =>
      coord.lat >= -90 && coord.lat <= 90 && coord.lon >= -180 && coord.lon <= 180;

    if (!allCoords.every(isValidCoord)) {
      console.warn('測試區域環境變數座標超出有效範圍，使用預設配置');
      return null;
    }

    return {
      bounds,
      center,
      description: envVars.description || '測試區域（來自環境變數）',
    };
  } catch (error) {
    console.warn('測試區域環境變數格式錯誤，使用預設配置:', error);
    return null;
  }
}

export interface MapBounds {
  northWest: Location;
  northEast: Location;
  southWest: Location;
  southEast: Location;
}

export interface AreaConfig {
  name: string;
  displayName: string;
  bounds: MapBounds;
  center: Location;
  description: string;
  physicalSize: { width: number; height: number }; // 公尺
  gridSize: { width: number; height: number }; // 網格數量
  gridPrecision: number; // 公尺
}

// 光復鄉配置（生產環境）
export const GUANGFU_CONFIG: AreaConfig = {
  name: 'guangfu',
  displayName: '花蓮光復鄉',
  bounds: {
    northWest: { lat: 23.68137, lon: 121.41771 },
    northEast: { lat: 23.68108, lon: 121.45639 },
    southWest: { lat: 23.65397, lon: 121.4176 },
    southEast: { lat: 23.65396, lon: 121.45657 },
  },
  center: { lat: 23.66767, lon: 121.43705 },
  description: '花蓮縣光復鄉颱風後清淤工作範圍',
  physicalSize: { width: 4000, height: 3000 }, // 4km x 3km
  gridSize: { width: 800, height: 600 },
  gridPrecision: 5,
};

// 建立測試區域配置（優先使用環境變數，否則使用預設值）
function createTestConfig(): AreaConfig {
  const envConfig = getTestAreaFromEnv();

  if (envConfig && envConfig.bounds && envConfig.center) {
    return {
      name: 'test',
      displayName: '測試區域',
      bounds: envConfig.bounds,
      center: envConfig.center,
      description: envConfig.description || '測試區域（來自環境變數）',
      physicalSize: { width: 4000, height: 3000 },
      gridSize: { width: 800, height: 600 },
      gridPrecision: 5,
    };
  }

  return GUANGFU_CONFIG;
}

// 測試區域配置（開發環境）
export const TEST_CONFIG: AreaConfig = createTestConfig();

// 可用的區域配置
export const AVAILABLE_AREAS = {
  guangfu: GUANGFU_CONFIG,
  test: TEST_CONFIG,
} as const;

export type AreaMode = keyof typeof AVAILABLE_AREAS;

// 獲取預設區域配置
export function getDefaultAreaConfig(): AreaConfig {
  // 從環境變數讀取
  const envArea = process.env.NEXT_PUBLIC_AREA_MODE as AreaMode;
  if (envArea && AVAILABLE_AREAS[envArea]) {
    return AVAILABLE_AREAS[envArea];
  }

  // 預設使用光復鄉（生產環境）
  return GUANGFU_CONFIG;
}
