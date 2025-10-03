export interface Location {
  lat: number;
  lon: number;
}

// 保留 GridCoordinates 用於向後相容 (將逐步移除)
export interface GridCoordinates {
  x: number;
  y: number;
}

// 新的座標類型定義
export interface FormattedCoords {
  lat: string; // 4 decimal 格式如 "23.6715"
  lon: string; // 4 decimal 格式如 "121.4355"
}

export interface TileCoordinate {
  x: number;
  y: number;
  z: number; // 縮放層級
}

export interface RectangleBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// 舊版回報資料接口 (保留向後相容)
export interface ReportData {
  lat: number;
  lon: number;
  state: 0 | 1; // 0: 已清除, 1: 有淤泥
  areaConfig?: LegacyAreaConfig; // 使用舊版區域配置
}

// 新版回報資料接口
export interface GeoReportData {
  lat: number;
  lon: number;
  state: 0 | 1; // 0: 已清除, 1: 有淤泥
  areaConfig?: SimplifiedAreaConfig; // 使用簡化區域配置
}

// 舊版區域配置 (逐步棄用)
export interface LegacyAreaConfig {
  name: string;
  displayName: string;
  bounds: {
    northWest: Location;
    northEast: Location;
    southWest: Location;
    southEast: Location;
  };
  center: Location;
  description: string;
  physicalSize: { width: number; height: number };
  gridSize: { width: number; height: number };
  gridPrecision: number;
}

// 新版簡化區域配置
export interface SimplifiedAreaConfig {
  name: string; // Redis 命名空間隔離用
  displayName: string;
  bounds: RectangleBounds; // 簡化為矩形邊界
  center: Location; // 4 decimal 精度中心點
  supportedZooms: number[]; // [14, 15, 16, 17, 18, 19]
  primaryZoom: number; // 19 (~0.6m/pixel)
  effectRadiusMeters: number; // 範圍效應半徑（取代 3x3 網格）
  description?: string; // 可選描述
}

export interface LayerVisibility {
  tiles: boolean; // 即時回報圖磚
  manual: boolean; // 預估區域
  kmz: boolean; // KMZ 圖層 (Google My Maps)
}

// 範圍效應配置
export interface GeoRangeConfig {
  radiusMeters: number; // 影響半徑 (公尺)
  maxCoords: number; // 最大座標點數量限制
  precision: number; // 座標精度 (小數位數)
}

// Redis 資料結構
export interface GeoData {
  score0: number; // 已清除信譽分數
  score1: number; // 有淤泥信譽分數
  lastUpdate0: number; // 已清除最後更新時間戳
  lastUpdate1: number; // 有淤泥最後更新時間戳
  finalState: 0 | 1; // 最終判斷狀態
}

// 圖磚元資料
export interface TileMeta {
  version: string; // 圖磚版本號（時間戳）
  lastUpdate: number; // 最後更新時間戳
  coordsChecksum: string; // 圖磚內所有座標的校驗和
  affectedCoords: string[]; // 影響此圖磚的座標 key 列表
  size: number; // 圖磚檔案大小（bytes）
}
