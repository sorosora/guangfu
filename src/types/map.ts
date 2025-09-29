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
}
