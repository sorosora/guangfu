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

const HIGH_ACCURACY_OPTIONS: GeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 30000,
};

const LOW_ACCURACY_OPTIONS: GeolocationOptions = {
  enableHighAccuracy: false,
  timeout: 30000,
  maximumAge: 300000, // 5 分鐘
};

/**
 * 請求 GPS 權限並獲取當前位置（帶降級策略）
 */
export function getCurrentPosition(): Promise<Location> {
  return new Promise(async (resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: -1,
        message: '瀏覽器不支援地理位置功能',
      });
      return;
    }

    // 策略 1: 嘗試高精度定位
    try {
      const location = await tryGetPosition(HIGH_ACCURACY_OPTIONS);
      resolve(location);
      return;
    } catch (error) {
      // 如果是權限拒絕，直接失敗
      if (error && typeof error === 'object' && 'code' in error && error.code === 1) {
        reject(error);
        return;
      }

      const errorMessage =
        error && typeof error === 'object' && 'message' in error ? error.message : '未知錯誤';
      console.log('高精度定位失敗，嘗試低精度定位:', errorMessage);
    }

    // 策略 2: 嘗試低精度定位
    try {
      const location = await tryGetPosition(LOW_ACCURACY_OPTIONS);
      resolve(location);
      return;
    } catch (error) {
      // 如果是權限拒絕，直接失敗
      if (error && typeof error === 'object' && 'code' in error && error.code === 1) {
        reject(error);
        return;
      }

      const errorMessage =
        error && typeof error === 'object' && 'message' in error ? error.message : '未知錯誤';
      console.log('低精度定位也失敗:', errorMessage);
      reject(error);
    }
  });
}

/**
 * 單次位置獲取嘗試
 */
function tryGetPosition(options: GeolocationOptions): Promise<Location> {
  return new Promise((resolve, reject) => {
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
            message = '無法獲取地理位置資訊，請檢查裝置定位設定';
            break;
          case 3: // TIMEOUT
            message = '獲取地理位置超時，請確保在開放空間或有良好網路連接';
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
  options: GeolocationOptions = LOW_ACCURACY_OPTIONS
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
          message = '無法持續監控地理位置，請檢查裝置定位設定';
          break;
        case 3: // TIMEOUT
          message = '監控地理位置超時，請確保在開放空間或有良好網路連接';
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
