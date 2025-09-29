import { Location } from '@/types/map';

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

const DEFAULT_OPTIONS: GeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
};

/**
 * 請求 GPS 權限並獲取當前位置
 */
export function getCurrentPosition(
  options: GeolocationOptions = DEFAULT_OPTIONS
): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('瀏覽器不支援地理位置功能'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        let message = '獲取位置失敗';
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            message = '使用者拒絕了地理位置權限';
            break;
          case 2: // POSITION_UNAVAILABLE
            message = '無法獲取地理位置資訊';
            break;
          case 3: // TIMEOUT
            message = '獲取地理位置超時';
            break;
          default:
            message = `獲取位置失敗 (錯誤代碼: ${error.code})`;
        }
        reject({ code: error.code, message });
      },
      options
    );
  });
}

/**
 * 持續監控位置變化
 */
export function watchPosition(
  onLocationUpdate: (location: Location) => void,
  onError: (error: GeolocationError) => void,
  options: GeolocationOptions = DEFAULT_OPTIONS
): number | null {
  if (!navigator.geolocation) {
    onError({ code: -1, message: '瀏覽器不支援地理位置功能' });
    return null;
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      onLocationUpdate({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      });
    },
    (error) => {
      let message = '監控位置失敗';
      switch (error.code) {
        case 1: // PERMISSION_DENIED
          message = '使用者拒絕了地理位置權限';
          break;
        case 2: // POSITION_UNAVAILABLE
          message = '無法獲取地理位置資訊';
          break;
        case 3: // TIMEOUT
          message = '獲取地理位置超時';
          break;
        default:
          message = `監控位置失敗 (錯誤代碼: ${error.code})`;
      }
      onError({ code: error.code, message });
    },
    options
  );
}

/**
 * 停止監控位置
 */
export function clearWatch(watchId: number): void {
  if (navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}
