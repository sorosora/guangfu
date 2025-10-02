export interface Location {
  lat: number;
  lon: number;
}

export interface GridCoordinates {
  x: number;
  y: number;
}

export interface ReportData {
  lat: number;
  lon: number;
  state: 0 | 1; // 0: 已清除, 1: 有淤泥
  areaConfig?: {
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
  }; // 區域配置
}

export interface LayerVisibility {
  tiles: boolean; // 即時回報圖磚
  manual: boolean; // 預估區域
  kmz: boolean; // KMZ 圖層 (Google My Maps)
}
