import {
  EnvironmentInfo,
  GPSInfo,
  NetworkInfo,
  PerformanceInfo,
  DebugLog,
} from '@/stores/debug-store';
import { hasTestAreaConfiguration } from '@/lib/environment';

/**
 * 收集環境資訊
 */
export function collectEnvironmentInfo(): EnvironmentInfo {
  // 收集測試區域環境變數
  const testAreaEnvVars = {
    NEXT_PUBLIC_TEST_AREA_NORTHWEST_LAT: process.env.NEXT_PUBLIC_TEST_AREA_NORTHWEST_LAT,
    NEXT_PUBLIC_TEST_AREA_NORTHWEST_LON: process.env.NEXT_PUBLIC_TEST_AREA_NORTHWEST_LON,
    NEXT_PUBLIC_TEST_AREA_NORTHEAST_LAT: process.env.NEXT_PUBLIC_TEST_AREA_NORTHEAST_LAT,
    NEXT_PUBLIC_TEST_AREA_NORTHEAST_LON: process.env.NEXT_PUBLIC_TEST_AREA_NORTHEAST_LON,
    NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LAT: process.env.NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LAT,
    NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LON: process.env.NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LON,
    NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LAT: process.env.NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LAT,
    NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LON: process.env.NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LON,
    NEXT_PUBLIC_TEST_AREA_CENTER_LAT: process.env.NEXT_PUBLIC_TEST_AREA_CENTER_LAT,
    NEXT_PUBLIC_TEST_AREA_CENTER_LON: process.env.NEXT_PUBLIC_TEST_AREA_CENTER_LON,
  };

  return {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    hasTestAreaConfig: hasTestAreaConfiguration(),
    testAreaEnvVars,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
    url: typeof window !== 'undefined' ? window.location.href : '',
    timestamp: typeof window !== 'undefined' ? Date.now() : 0,
  };
}

/**
 * 收集 GPS 資訊
 */
export async function collectGPSInfo(): Promise<Partial<GPSInfo>> {
  const info: Partial<GPSInfo> = {
    timestamp: typeof window !== 'undefined' ? Date.now() : 0,
  };

  // 檢查是否在瀏覽器環境中
  if (typeof window === 'undefined') {
    info.error = '非瀏覽器環境';
    info.permissionState = 'unknown';
    return info;
  }

  // 檢查地理位置 API 支援
  if (!navigator.geolocation) {
    info.error = '瀏覽器不支援地理位置功能';
    info.permissionState = 'unknown';
    return info;
  }

  // 檢查權限狀態
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    info.permissionState = permission.state;
  } catch {
    info.permissionState = 'unknown';
  }

  // 嘗試獲取當前位置
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ...info,
          location: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          error: null,
        });
      },
      (error) => {
        let errorMessage = '獲取位置失敗';
        switch (error.code) {
          case 1:
            errorMessage = '使用者拒絕了地理位置權限';
            break;
          case 2:
            errorMessage = '無法獲取地理位置資訊';
            break;
          case 3:
            errorMessage = '獲取地理位置超時';
            break;
        }

        resolve({
          ...info,
          error: errorMessage,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * 收集網路狀態資訊
 */
export function collectNetworkInfo(): NetworkInfo {
  const info: NetworkInfo = {
    online: typeof window !== 'undefined' && navigator ? navigator.onLine : true,
    connection: null,
    timestamp: typeof window !== 'undefined' ? Date.now() : 0,
  };

  // 檢查網路連線資訊 (Chrome/Edge 支援)
  if (typeof window !== 'undefined' && 'connection' in navigator) {
    const connection = (
      navigator as unknown as {
        connection?: {
          effectiveType?: string;
          downlink?: number;
          rtt?: number;
        };
      }
    ).connection;
    if (connection) {
      info.connection = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
      };
    }
  }

  return info;
}

/**
 * 收集效能資訊
 */
export function collectPerformanceInfo(): PerformanceInfo {
  const info: PerformanceInfo = {
    memoryUsage: null,
    timing: {},
    timestamp: typeof window !== 'undefined' ? Date.now() : 0,
  };

  // 檢查是否在瀏覽器環境中
  if (typeof window === 'undefined' || typeof performance === 'undefined') {
    return info;
  }

  // 記憶體使用情況 (Chrome 支援)
  if ('memory' in performance) {
    info.memoryUsage =
      (
        performance as unknown as {
          memory?: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
          };
        }
      ).memory || null;
  }

  // 頁面載入時間
  if (performance.timing) {
    const timing = performance.timing;
    info.timing = {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart,
    };
  }

  // 首次內容繪製時間
  if ('getEntriesByType' in performance) {
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
    if (fcp) {
      info.timing.firstContentfulPaint = fcp.startTime;
    }
  }

  return info;
}

/**
 * 將診斷資訊匯出為文字格式
 */
export function exportDiagnosticInfo(
  envInfo: EnvironmentInfo,
  gpsInfo: GPSInfo,
  networkInfo: NetworkInfo,
  perfInfo: PerformanceInfo,
  logs: DebugLog[]
): string {
  const lines = [
    '=== 光復清淤地圖除錯報告 ===',
    `生成時間: ${new Date().toLocaleString('zh-TW')}`,
    '',
    '## 環境資訊',
    `NODE_ENV: ${envInfo.nodeEnv || 'undefined'}`,
    `NEXT_PUBLIC_VERCEL_ENV: ${envInfo.vercelEnv || 'undefined'}`,
    `測試區域配置: ${envInfo.hasTestAreaConfig ? '完整' : '不完整'}`,
    `用戶代理: ${envInfo.userAgent}`,
    `網址: ${envInfo.url}`,
    '',
    '## 測試區域環境變數',
  ];

  Object.entries(envInfo.testAreaEnvVars).forEach(([key, value]) => {
    lines.push(`${key}: ${value || 'undefined'}`);
  });

  lines.push(
    '',
    '## GPS 資訊',
    `權限狀態: ${gpsInfo.permissionState}`,
    `當前位置: ${gpsInfo.location ? `${gpsInfo.location.lat}, ${gpsInfo.location.lon}` : '無'}`,
    `精度: ${gpsInfo.accuracy ? `${gpsInfo.accuracy}m` : '無'}`,
    `速度: ${gpsInfo.speed ? `${gpsInfo.speed}m/s` : '無'}`,
    `方向: ${gpsInfo.heading ? `${gpsInfo.heading}°` : '無'}`,
    `錯誤: ${gpsInfo.error || '無'}`,
    '',
    '## 網路狀態',
    `連線狀態: ${networkInfo.online ? '線上' : '離線'}`,
    `連線類型: ${networkInfo.connection?.effectiveType || '未知'}`,
    `下載速度: ${networkInfo.connection?.downlink ? `${networkInfo.connection.downlink} Mbps` : '未知'}`,
    `延遲: ${networkInfo.connection?.rtt ? `${networkInfo.connection.rtt}ms` : '未知'}`,
    '',
    '## 效能資訊',
    `DOM 載入時間: ${perfInfo.timing.domContentLoaded ? `${perfInfo.timing.domContentLoaded}ms` : '未知'}`,
    `頁面載入完成: ${perfInfo.timing.loadComplete ? `${perfInfo.timing.loadComplete}ms` : '未知'}`,
    `首次內容繪製: ${perfInfo.timing.firstContentfulPaint ? `${perfInfo.timing.firstContentfulPaint}ms` : '未知'}`
  );

  if (perfInfo.memoryUsage) {
    lines.push(
      `記憶體使用: ${(perfInfo.memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB / ${(perfInfo.memoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`
    );
  }

  if (logs.length > 0) {
    lines.push(
      '',
      '## 除錯日誌',
      ...logs
        .slice(0, 50)
        .map(
          (log) =>
            `[${new Date(log.timestamp).toLocaleTimeString('zh-TW')}] ${log.level.toUpperCase()}: ${log.message}`
        )
    );
  }

  return lines.join('\n');
}

/**
 * 複製文字到剪貼板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 檢查是否在瀏覽器環境中
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 後備方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (error) {
    console.error('複製失敗:', error);
    return false;
  }
}

/**
 * 格式化檔案大小
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化時間戳
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-TW');
}
