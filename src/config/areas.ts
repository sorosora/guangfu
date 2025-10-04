import { Location } from '@/types/map';

/**
 * 簡化的矩形邊界定義（TMS 標準化階段五）
 */
export interface SimpleBounds {
  minLat: number; // 4 decimal precision
  maxLat: number; // 4 decimal precision
  minLng: number; // 4 decimal precision
  maxLng: number; // 4 decimal precision
}

/**
 * 標準化區域配置接口（階段五：移除網格系統依賴）
 * 新增雙邊界支援：回報邊界 vs 地圖可滑動邊界
 */
export interface AreaConfig {
  name: string; // Redis 命名空間隔離用
  displayName: string;
  bounds: SimpleBounds; // 回報邊界（精確的功能邊界）
  mapBounds?: SimpleBounds; // 地圖可滑動邊界（可選，改善滑動體驗）
  center: Location; // 4 decimal precision
  supportedZooms: number[]; // [14, 15, 16, 17, 18, 19]
  primaryZoom: number; // 19 (~0.6m/pixel)
  effectRadiusMeters: number; // 範圍效應半徑（取代 3x3 網格）
  allowUnlimitedReporting?: boolean; // 是否允許無限制回報（測試用）
  allowUnlimitedMap?: boolean; // 是否允許無限制地圖滑動（測試用）
  description?: string;
}

/**
 * 花蓮光復鄉標準配置（TMS 標準化完成）
 */
export const GUANGFU_CONFIG: AreaConfig = {
  name: 'guangfu',
  displayName: '花蓮光復鄉',
  bounds: {
    // 回報邊界：維持精確的光復鄉範圍
    minLat: 23.654, // 4 decimal precision
    maxLat: 23.6814, // 4 decimal precision
    minLng: 121.4176, // 4 decimal precision
    maxLng: 121.4566, // 4 decimal precision
  },
  mapBounds: {
    // 地圖可滑動邊界：擴大 2.5 倍改善滑動體驗
    minLat: 23.633, // 向南擴大
    maxLat: 23.702, // 向北擴大
    minLng: 121.388, // 向西擴大
    maxLng: 121.486, // 向東擴大
  },
  center: { lat: 23.6677, lon: 121.4371 }, // 4 decimal precision
  supportedZooms: [14, 15, 16, 17, 18, 19],
  primaryZoom: 19, // ~0.6m/pixel
  effectRadiusMeters: 25, // 25公尺半徑（標準 TMS 範圍效應）
  allowUnlimitedReporting: false, // 嚴格的回報邊界檢查
  allowUnlimitedMap: false, // 使用 mapBounds 限制地圖滑動
  description: '花蓮縣光復鄉颱風後清淤工作範圍',
};

/**
 * Preview 測試區域配置（完全開放的測試環境）
 */
export const PREVIEW_CONFIG: AreaConfig = {
  name: 'preview',
  displayName: 'Preview 測試區域',
  bounds: {
    // 台灣邊界
    minLat: 23.0,
    maxLat: 25.0,
    minLng: 120.0,
    maxLng: 122.0,
  },
  // mapBounds 未定義，配合 allowUnlimitedMap: true 實現無邊界
  center: { lat: 23.6677, lon: 121.4371 }, // 與光復鄉相同的中心點
  supportedZooms: [14, 15, 16, 17, 18, 19],
  primaryZoom: 19,
  effectRadiusMeters: 25,
  allowUnlimitedReporting: true, // 全球任意地點都能回報
  allowUnlimitedMap: true, // 地圖無邊界限制
  description: '開放測試區域，可在全球任意位置進行回報和地圖瀏覽',
};

/**
 * 標準邊界檢查（矩形邊界）
 */
export function isWithinBounds(lat: number, lon: number, bounds: SimpleBounds): boolean {
  return (
    lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLng && lon <= bounds.maxLng
  );
}

/**
 * 檢查是否可以在指定位置進行回報
 * 考慮區域配置的無限制回報設定
 */
export function canReportAtLocation(lat: number, lon: number, areaConfig: AreaConfig): boolean {
  // 如果允許無限制回報，則任何位置都可以回報
  if (areaConfig.allowUnlimitedReporting) {
    return true;
  }

  // 否則檢查是否在回報邊界內
  return isWithinBounds(lat, lon, areaConfig.bounds);
}

/**
 * 獲取地圖邊界（優先使用 mapBounds，否則使用 bounds）
 * 如果允許無限制地圖，則返回 null（無邊界）
 */
export function getMapBounds(areaConfig: AreaConfig): SimpleBounds | null {
  // 如果允許無限制地圖，則返回 null（無邊界）
  if (areaConfig.allowUnlimitedMap) {
    return null;
  }

  // 優先使用 mapBounds，否則使用 bounds
  return areaConfig.mapBounds || areaConfig.bounds;
}

/**
 * 獲取預設區域配置（光復鄉）
 */
export function getDefaultAreaConfig(): AreaConfig {
  return GUANGFU_CONFIG;
}

/**
 * 根據名稱獲取區域配置
 */
export function getAreaConfig(areaName: string): AreaConfig {
  switch (areaName) {
    case 'guangfu':
      return GUANGFU_CONFIG;
    case 'preview':
      return PREVIEW_CONFIG;
    default:
      console.warn(`未知區域名稱: ${areaName}，使用預設光復鄉配置`);
      return GUANGFU_CONFIG;
  }
}

/**
 * 獲取所有可用的區域名稱
 */
export function getAvailableAreaNames(): string[] {
  return ['guangfu', 'preview'];
}

/**
 * 驗證區域配置
 */
export function validateAreaConfig(config: AreaConfig): boolean {
  // 檢查必要欄位
  if (!config.name || !config.displayName || !config.bounds || !config.center) {
    return false;
  }

  // 檢查邊界邏輯
  if (
    config.bounds.minLat >= config.bounds.maxLat ||
    config.bounds.minLng >= config.bounds.maxLng
  ) {
    return false;
  }

  // 檢查中心點是否在邊界內
  if (!isWithinBounds(config.center.lat, config.center.lon, config.bounds)) {
    return false;
  }

  // 檢查縮放層級
  if (!Array.isArray(config.supportedZooms) || config.supportedZooms.length === 0) {
    return false;
  }

  // 檢查主要縮放層級
  if (!config.supportedZooms.includes(config.primaryZoom)) {
    return false;
  }

  // 檢查效應半徑
  if (config.effectRadiusMeters <= 0) {
    return false;
  }

  return true;
}

/**
 * 可用的區域配置映射
 */
export const AVAILABLE_AREAS = {
  guangfu: GUANGFU_CONFIG,
  preview: PREVIEW_CONFIG,
} as const;

export type AreaMode = keyof typeof AVAILABLE_AREAS;

// 導出類型
export type { Location } from '@/types/map';
