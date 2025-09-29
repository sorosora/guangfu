'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { ReportButtons } from '@/components/ReportButtons';
import { CenterLockButton } from '@/components/ui/center-lock-button';
import { Loading } from '@/components/ui/loading';
import { getCurrentPosition, watchPosition, clearWatch } from '@/lib/geolocation';
import { isWithinBounds } from '@/lib/coordinates';
import { Location, ReportData } from '@/types/map';
import { getDefaultAreaConfig, AreaMode, AVAILABLE_AREAS } from '@/config/areas';
import { ZoomButtons } from '@/components/ui/zoom-buttons';
import { MapRef } from '@/components/Map/MapContainer';

// 動態載入地圖以避免 SSR 問題
const DynamicMap = dynamic(
  () => import('@/components/Map').then((mod) => ({ default: mod.MapContainer })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <Loading size="lg" text="載入地圖中..." />
      </div>
    ),
  }
);

export default function Home() {
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [lockCenter, setLockCenter] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'requesting' | 'granted' | 'denied' | 'unavailable'
  >('requesting');
  const isWithinBoundsRef = useRef<boolean | null>(null);
  const [currentAreaConfig, setCurrentAreaConfig] = useState(() => getDefaultAreaConfig());
  const [currentAreaMode, setCurrentAreaMode] = useState<AreaMode>(
    () => getDefaultAreaConfig().name as AreaMode
  );
  const [isClient, setIsClient] = useState(false);
  const [canZoomIn, setCanZoomIn] = useState(true);
  const [canZoomOut, setCanZoomOut] = useState(true);
  const mapRef = useRef<MapRef>(null);

  // 客戶端初始化
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 切換區域函數
  const switchArea = (mode: AreaMode) => {
    const newConfig = AVAILABLE_AREAS[mode];
    setCurrentAreaConfig(newConfig);
    setCurrentAreaMode(mode);

    toast.info(`已切換到${newConfig.displayName}`);

    // 重新初始化位置檢查
    isWithinBoundsRef.current = null;
    if (userLocation) {
      const withinBounds = isWithinBounds(userLocation, newConfig);
      isWithinBoundsRef.current = withinBounds;
    }
  };

  // 初始化 GPS 定位
  useEffect(() => {
    const initLocation = async () => {
      setLocationStatus('requesting');
      toast.info('正在請求位置權限...');

      try {
        const location = await getCurrentPosition();
        setUserLocation(location);
        setLocationStatus('granted');

        const withinBounds = isWithinBounds(location, currentAreaConfig);
        isWithinBoundsRef.current = withinBounds;

        if (!withinBounds) {
          toast.warning(`您不在${currentAreaConfig.displayName}範圍內，某些功能可能無法使用`);
        } else {
          toast.success('已取得您的位置');
        }

        // 開始監控位置變化
        const id = watchPosition(
          (newLocation) => {
            setUserLocation(newLocation);

            const newWithinBounds = isWithinBounds(newLocation, currentAreaConfig);

            // 只在邊界狀態改變時顯示 toast
            if (
              isWithinBoundsRef.current !== null &&
              isWithinBoundsRef.current !== newWithinBounds
            ) {
              if (!newWithinBounds) {
                toast.warning(`您已離開${currentAreaConfig.displayName}範圍`);
              } else {
                toast.success(`歡迎回到${currentAreaConfig.displayName}範圍`);
              }
            }

            isWithinBoundsRef.current = newWithinBounds;
          },
          (error) => {
            if (error.code === 1) {
              setLocationStatus('denied');
            } else {
              setLocationStatus('unavailable');
            }
            toast.error(error.message);
          }
        );

        if (id !== null) {
          setWatchId(id);
        }
      } catch (error) {
        console.error('位置錯誤詳情:', error);

        let errorMessage = '未知錯誤';
        let errorCode = 0;

        if (error && typeof error === 'object') {
          if ('message' in error && typeof error.message === 'string') {
            errorMessage = error.message;
          }
          if ('code' in error && typeof error.code === 'number') {
            errorCode = error.code;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }


        if (errorCode === 1) {
          setLocationStatus('denied');
        } else if (errorCode === 2 || errorCode === 3) {
          setLocationStatus('unavailable');
        } else {
          setLocationStatus('unavailable');
        }

        toast.error(errorMessage);
      }
    };

    initLocation();

    // 清理函數
    return () => {
      if (watchId !== null) {
        clearWatch(watchId);
      }
    };
  }, [currentAreaConfig, watchId]);

  // 處理回報
  const handleReport = async (state: 0 | 1) => {
    if (!userLocation) {
      toast.error('無法取得位置資訊');
      return;
    }

    if (!isWithinBounds(userLocation, currentAreaConfig)) {
      toast.error(`您不在${currentAreaConfig.displayName}範圍內，無法進行回報`);
      return;
    }

    const reportData: ReportData = {
      lat: userLocation.lat,
      lon: userLocation.lon,
      state,
    };

    try {
      // 這裡之後會連接到 API
      console.log('回報資料:', reportData);

      // 模擬 API 呼叫
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success(state === 1 ? '已回報有淤泥' : '已回報清除完成');
    } catch (error) {
      toast.error('回報失敗，請重試');
      console.error('Report error:', error);
    }
  };

  // 切換鎖定中心模式
  const toggleLockCenter = () => {
    setLockCenter(!lockCenter);
    toast.info(lockCenter ? '已關閉跟隨模式' : '已開啟跟隨模式');
  };

  // 處理地圖點擊
  const handleMapClick = (location: Location) => {
    console.log('地圖點擊位置:', location);
  };

  // 處理縮放狀態變化
  const handleZoomChange = (zoom: number, canZoomInNew: boolean, canZoomOutNew: boolean) => {
    setCanZoomIn(canZoomInNew);
    setCanZoomOut(canZoomOutNew);
  };

  // 處理縮放按鈕點擊
  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  // 重新請求位置權限
  const requestLocationPermission = async () => {
    setLocationStatus('requesting');
    toast.info('正在重新請求位置權限...');

    try {
      const location = await getCurrentPosition();
      setUserLocation(location);
      setLocationStatus('granted');

      const withinBounds = isWithinBounds(location, currentAreaConfig);
      isWithinBoundsRef.current = withinBounds;

      if (!withinBounds) {
        toast.warning(`您不在${currentAreaConfig.displayName}範圍內，某些功能可能無法使用`);
      } else {
        toast.success('已取得您的位置');
      }
    } catch (error) {
      console.error('重新請求位置錯誤詳情:', error);

      let errorMessage = '未知錯誤';
      let errorCode = 0;

      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        }
        if ('code' in error && typeof error.code === 'number') {
          errorCode = error.code;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }


      if (errorCode === 1) {
        setLocationStatus('denied');
      } else if (errorCode === 2 || errorCode === 3) {
        setLocationStatus('unavailable');
      } else {
        setLocationStatus('unavailable');
      }

      toast.error(errorMessage);
    }
  };

  return (
    <main className="relative w-full h-screen overflow-hidden">
      {/* 地圖容器 */}
      <DynamicMap
        ref={mapRef}
        center={lockCenter && userLocation ? userLocation : currentAreaConfig.center}
        userLocation={userLocation || undefined}
        lockCenter={lockCenter}
        onMapClick={handleMapClick}
        areaConfig={currentAreaConfig}
        onZoomChange={handleZoomChange}
        className="w-full h-screen"
      />

      {/* 區域狀態指示器和切換 - 只在客戶端渲染 */}
      {isClient && (
        <div className="fixed top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3 border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="text-sm">
              <div className="font-medium text-gray-900">{currentAreaConfig.displayName}</div>
              <div className="text-xs text-gray-500">{currentAreaConfig.description}</div>
            </div>
            <div className="flex space-x-1">
              {Object.entries(AVAILABLE_AREAS).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => switchArea(key as AreaMode)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    currentAreaMode === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {config.name === 'test' ? '測試' : '生產'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 右上角按鈕組 */}
      <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2">
        {/* 跟隨按鈕 */}
        <CenterLockButton isLocked={lockCenter} onToggle={toggleLockCenter} className="relative" />

        {/* 縮放按鈕 */}
        <ZoomButtons
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
        />
      </div>

      {/* 回報按鈕 */}
      <ReportButtons
        userLocation={userLocation || undefined}
        onReport={handleReport}
        disabled={!userLocation || !isWithinBounds(userLocation, currentAreaConfig)}
      />

      {/* 位置狀態提示 */}
      {locationStatus === 'denied' && (
        <div className="fixed top-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-[1000]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">位置權限被拒絕</p>
              <p className="text-xs">請允許位置權限以使用完整功能</p>
            </div>
            <button
              onClick={requestLocationPermission}
              className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
            >
              重新授權
            </button>
          </div>
        </div>
      )}

      {locationStatus === 'requesting' && (
        <div className="fixed top-4 left-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded z-[1000]">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm">正在請求位置權限...</p>
          </div>
        </div>
      )}

      {locationStatus === 'unavailable' && (
        <div className="fixed top-4 left-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded z-[1000]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">無法取得位置</p>
              <p className="text-xs">請檢查裝置定位設定</p>
            </div>
            <button
              onClick={requestLocationPermission}
              className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
            >
              重試
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
