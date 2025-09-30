import { atom } from 'jotai';
import { Location } from '@/types/map';

// 除錯面板顯示狀態
export const debugPanelOpenAtom = atom(false);

// GPS 資訊狀態
export interface GPSInfo {
  location: Location | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number | null;
  error: string | null;
  permissionState: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export const gpsInfoAtom = atom<GPSInfo>({
  location: null,
  accuracy: null,
  speed: null,
  heading: null,
  timestamp: null,
  error: null,
  permissionState: 'unknown',
});

// 環境資訊狀態
export interface EnvironmentInfo {
  nodeEnv: string | undefined;
  vercelEnv: string | undefined;
  hasTestAreaConfig: boolean;
  testAreaEnvVars: Record<string, string | undefined>;
  userAgent: string;
  url: string;
  timestamp: number;
}

export const environmentInfoAtom = atom<EnvironmentInfo>({
  nodeEnv: undefined,
  vercelEnv: undefined,
  hasTestAreaConfig: false,
  testAreaEnvVars: {},
  userAgent: '',
  url: '',
  timestamp: 0, // 將在客戶端初始化時設定
});

// 移除強制地區切換模式，改用直接傳遞 props 的方式

// 除錯日誌
export interface DebugLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: unknown;
}

export const debugLogsAtom = atom<DebugLog[]>([]);

// 添加日誌的動作
export const addDebugLogAtom = atom(null, (get, set, log: Omit<DebugLog, 'id' | 'timestamp'>) => {
  // 只在客戶端執行時生成動態值
  if (typeof window === 'undefined') return;

  const logs = get(debugLogsAtom);
  const newLog: DebugLog = {
    ...log,
    id: Math.random().toString(36),
    timestamp: Date.now(),
  };

  // 只保留最新的 100 條日誌
  const updatedLogs = [newLog, ...logs].slice(0, 100);
  set(debugLogsAtom, updatedLogs);
});

// 清除日誌的動作
export const clearDebugLogsAtom = atom(null, (get, set) => {
  set(debugLogsAtom, []);
});

// 網路狀態
export interface NetworkInfo {
  online: boolean;
  connection: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  } | null;
  timestamp: number;
}

export const networkInfoAtom = atom<NetworkInfo>({
  online: true, // 預設為線上，將在客戶端更新
  connection: null,
  timestamp: 0, // 將在客戶端初始化時設定
});

// 效能指標
export interface PerformanceInfo {
  memoryUsage: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null;
  timing: {
    domContentLoaded?: number;
    loadComplete?: number;
    firstContentfulPaint?: number;
  };
  timestamp: number;
}

export const performanceInfoAtom = atom<PerformanceInfo>({
  memoryUsage: null,
  timing: {},
  timestamp: 0, // 將在客戶端初始化時設定
});
