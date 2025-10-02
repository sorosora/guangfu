import { Location } from '@/types/map';

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

// 可用的區域配置（向後相容）
export const AVAILABLE_AREAS = {
  guangfu: GUANGFU_CONFIG,
  test: {
    ...GUANGFU_CONFIG,
    name: 'test',
    displayName: '測試地區',
  },
} as const;

export type AreaMode = keyof typeof AVAILABLE_AREAS;

// 獲取預設區域配置（總是返回光復鄉配置）
export function getDefaultAreaConfig(): AreaConfig {
  return GUANGFU_CONFIG;
}

// 獲取區域配置根據名稱
export function getAreaConfig(areaName: string): AreaConfig {
  switch (areaName) {
    case 'guangfu':
      return GUANGFU_CONFIG;
    case 'test':
      // 測試區域配置將由前端動態設定
      throw new Error('測試區域配置需要動態設定');
    default:
      return GUANGFU_CONFIG;
  }
}
