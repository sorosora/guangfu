'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { ReportButtons } from '@/components/ReportButtons';
import { CenterLockButton } from '@/components/ui/center-lock-button';
import { Loading } from '@/components/ui/loading';
import { PermissionModal } from '@/components/ui/permission-modal';
import { WelcomeButtons } from '@/components/ui/welcome-buttons';
import { getCurrentPosition, watchPosition, clearWatch } from '@/lib/geolocation';
import { isWithinBounds } from '@/lib/coordinates';
import { Location, ReportData, LayerVisibility } from '@/types/map';
import { getDefaultAreaConfig, AreaMode, AVAILABLE_AREAS } from '@/config/areas';
import { ZoomButtons } from '@/components/ui/zoom-buttons';
import { MapRef } from '@/components/Map/MapContainer';
import LayerControlPanel from '@/components/Map/LayerControlPanel';
import { shouldShowAreaSwitcher } from '@/lib/environment';

// 動態載入地圖以避免 SSR 問題
const DynamicMap = dynamic(
  () => import('@/components/Map/client').then((mod) => ({ default: mod.MapContainer })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <Loading size="lg" text="載入地圖中..." />
      </div>
    ),
  }
);

// 應用程式狀態類型
type AppState = 'ready' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export default function Home() {
  // 核心狀態
  const [appState, setAppState] = useState<AppState>('ready');
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [lockCenter, setLockCenter] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);

  // 引用狀態
  const watchIdRef = useRef<number | null>(null);
  const isWithinBoundsRef = useRef<boolean | null>(null);
  const mapRef = useRef<MapRef>(null);
  const currentAreaConfigRef = useRef(getDefaultAreaConfig());

  // 區域配置狀態
  const [currentAreaConfig, setCurrentAreaConfig] = useState(() => getDefaultAreaConfig());
  const [currentAreaMode, setCurrentAreaMode] = useState<AreaMode>(
    () => getDefaultAreaConfig().name as AreaMode
  );

  // UI 狀態
  const [isClient, setIsClient] = useState(false);
  const [canZoomIn, setCanZoomIn] = useState(true);
  const [canZoomOut, setCanZoomOut] = useState(true);

  // 圖層可見性狀態
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    tiles: true,
    manual: true,
    kmz: true,
  });

  // 檢查是否應該顯示區域切換 (僅在客戶端)
  const [showAreaSwitcher, setShowAreaSwitcher] = useState(false);

  // 客戶端初始化
  useEffect(() => {
    setIsClient(true);
    setShowAreaSwitcher(shouldShowAreaSwitcher());
  }, []);

  // 同步區域配置到 ref
  useEffect(() => {
    currentAreaConfigRef.current = currentAreaConfig;
  }, [currentAreaConfig]);

  // 初始化位置監控
  const initLocationTracking = useCallback(async () => {
    try {
      setAppState('requesting');
      toast.info('正在請求位置權限...');

      const location = await getCurrentPosition();
      setUserLocation(location);
      setAppState('granted');

      // 使用 ref 中的當前區域配置
      const areaConfig = currentAreaConfigRef.current;
      const withinBounds = isWithinBounds(location, areaConfig);
      isWithinBoundsRef.current = withinBounds;

      if (!withinBounds) {
        toast.warning(`您不在${areaConfig.displayName}範圍內，某些功能可能無法使用`);
      } else {
        toast.success('已取得您的位置');
      }

      // 開始監控位置變化
      const id = watchPosition(
        (newLocation) => {
          setUserLocation(newLocation);

          // 使用當前的區域配置
          const currentAreaConfig = currentAreaConfigRef.current;
          const newWithinBounds = isWithinBounds(newLocation, currentAreaConfig);

          // 只在邊界狀態改變時顯示 toast
          if (isWithinBoundsRef.current !== null && isWithinBoundsRef.current !== newWithinBounds) {
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
            setAppState('denied');
          } else {
            setAppState('unavailable');
          }
          toast.error(error.message);
        }
      );

      if (id !== null) {
        watchIdRef.current = id;
      }
    } catch (error) {
      console.error('位置錯誤詳情:', error);

      let errorCode = 0;
      if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'number') {
        errorCode = error.code;
      }

      if (errorCode === 1) {
        setAppState('denied');
      } else {
        setAppState('unavailable');
      }

      const errorMessage = error instanceof Error ? error.message : '位置服務不可用';
      toast.error(errorMessage);
    }
  }, []);

  // 自動 GPS 檢測
  useEffect(() => {
    if (!isClient) return;

    const tryAutoLocation = async () => {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        try {
          // 檢查權限狀態
          const permission = await navigator.permissions.query({ name: 'geolocation' });

          if (permission.state === 'granted') {
            // 已有權限，直接初始化位置追蹤
            initLocationTracking();
          }
          // 如果是 'denied' 或 'prompt'，保持在 'ready' 狀態等待使用者操作
        } catch (error) {
          // 權限 API 不支援或其他錯誤，保持在 'ready' 狀態
          console.log('無法檢查地理位置權限:', error);
        }
      }
    };

    tryAutoLocation();
  }, [isClient, initLocationTracking]);

  // 切換區域函數
  const switchArea = useCallback(
    (mode: AreaMode) => {
      const newConfig = AVAILABLE_AREAS[mode];
      setCurrentAreaConfig(newConfig);
      setCurrentAreaMode(mode);

      toast.info(`已切換到${newConfig.displayName}`);

      // 重新檢查位置邊界
      if (userLocation) {
        const withinBounds = isWithinBounds(userLocation, newConfig);
        isWithinBoundsRef.current = withinBounds;
      }

      // 確保 Modal 狀態不受區域切換影響
      // Modal 狀態由使用者操作控制，不因區域切換而重置
    },
    [userLocation]
  );

  // 清理位置監控
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Modal 處理函數
  const handleJoinClick = useCallback(() => {
    setIsPermissionModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsPermissionModalOpen(false);
  }, []);

  const handleRequestPermission = useCallback(() => {
    setIsPermissionModalOpen(false);
    initLocationTracking();
  }, [initLocationTracking]);

  // 處理回報
  const handleReport = useCallback(
    async (state: 0 | 1) => {
      if (!userLocation) {
        toast.error('無法取得位置資訊');
        return;
      }

      // 使用 ref 中的當前區域配置
      const areaConfig = currentAreaConfigRef.current;
      if (!isWithinBounds(userLocation, areaConfig)) {
        toast.error(`您不在${areaConfig.displayName}範圍內，無法進行回報`);
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
    },
    [userLocation]
  ); // 移除 currentAreaConfig 依賴

  // 切換鎖定中心模式
  const toggleLockCenter = useCallback(() => {
    setLockCenter(!lockCenter);
    toast.info(lockCenter ? '已關閉跟隨模式' : '已開啟跟隨模式');
  }, [lockCenter]);

  // 處理地圖點擊
  const handleMapClick = useCallback((location: Location) => {
    console.log('地圖點擊位置:', location);
  }, []);

  // 處理縮放狀態變化
  const handleZoomChange = useCallback(
    (zoom: number, canZoomInNew: boolean, canZoomOutNew: boolean) => {
      setCanZoomIn(canZoomInNew);
      setCanZoomOut(canZoomOutNew);
    },
    []
  );

  // 處理縮放按鈕點擊
  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  // 圖層控制處理函式
  const handleLayerToggle = useCallback((layerKey: keyof LayerVisibility, enabled: boolean) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [layerKey]: enabled,
    }));
  }, []);

  // 重新請求位置權限
  const requestLocationPermission = useCallback(() => {
    initLocationTracking();
  }, [initLocationTracking]);

  // 渲染不同狀態的內容
  const renderContent = () => {
    // 統一的地圖和 UI 佈局
    return (
      <div className="relative w-full h-screen overflow-hidden">
        {/* 地圖容器 - 在所有狀態下都顯示 */}
        <DynamicMap
          ref={mapRef}
          center={lockCenter && userLocation ? userLocation : currentAreaConfig.center}
          userLocation={userLocation || undefined}
          lockCenter={lockCenter}
          onMapClick={handleMapClick}
          areaConfig={currentAreaConfig}
          onZoomChange={handleZoomChange}
          layerVisibility={layerVisibility}
          className="w-full h-screen"
        />

        {/* 圖層控制面板 - 在所有狀態下都顯示 */}
        <LayerControlPanel
          layers={layerVisibility}
          onLayerToggle={handleLayerToggle}
          currentArea={currentAreaMode}
          onAreaChange={switchArea}
          areaDisplayName={currentAreaConfig.displayName}
          showAreaSwitcher={showAreaSwitcher}
        />

        {/* 右上角按鈕組 - 在所有狀態下都顯示 */}
        {appState !== 'requesting' && (
          <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2">
            {/* 跟隨按鈕 */}
            <CenterLockButton
              isLocked={lockCenter}
              onToggle={toggleLockCenter}
              className="relative"
            />

            {/* 縮放按鈕 */}
            <ZoomButtons
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              canZoomIn={canZoomIn}
              canZoomOut={canZoomOut}
            />
          </div>
        )}

        {/* Bottom Bar - 根據狀態顯示不同內容 */}
        {(appState === 'ready' || appState === 'denied' || appState === 'unavailable') && (
          <WelcomeButtons onJoin={handleJoinClick} areaName={currentAreaConfig.displayName} />
        )}

        {appState === 'granted' && userLocation && (
          <ReportButtons
            userLocation={userLocation}
            onReport={handleReport}
            disabled={!isWithinBounds(userLocation, currentAreaConfig)}
          />
        )}

        {/* 狀態提示 */}
        {appState === 'denied' && (
          <div className="fixed top-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-[1000]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">位置權限被拒絕</p>
                  <p className="text-xs">需要位置權限以提供精確回報</p>
                </div>
                <button
                  onClick={requestLocationPermission}
                  className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                >
                  重新授權
                </button>
              </div>
              <div className="text-xs space-y-1 border-t border-red-300 pt-2">
                <p className="font-medium">如何開啟位置權限：</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>點擊瀏覽器網址列旁的🔒圖示</li>
                  <li>將「位置」設定為「允許」</li>
                  <li>重新載入頁面</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {appState === 'requesting' && (
          <div className="fixed top-4 left-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded z-[1000]">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm">正在嘗試獲取位置...</p>
              </div>
              <div className="text-xs text-blue-600">
                <p>系統正在嘗試高精度定位，如果失敗會自動切換到網路定位</p>
              </div>
            </div>
          </div>
        )}

        {appState === 'unavailable' && (
          <div className="fixed top-4 left-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded z-[1000]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">無法取得位置資訊</p>
                  <p className="text-xs">位置服務暫時不可用</p>
                </div>
                <button
                  onClick={requestLocationPermission}
                  className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
                >
                  重試
                </button>
              </div>
              <div className="text-xs space-y-1 border-t border-yellow-300 pt-2">
                <p className="font-medium">可能的解決方案：</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>確認裝置已開啟定位服務</li>
                  <li>移至開放空間或靠近窗邊</li>
                  <li>檢查網路連接是否正常</li>
                  <li>重新載入頁面並再次嘗試</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="relative w-full h-screen overflow-hidden">
      {renderContent()}
      <PermissionModal
        isOpen={isPermissionModalOpen}
        onClose={handleModalClose}
        onRequestPermission={handleRequestPermission}
        areaName={currentAreaConfig.displayName}
      />
    </main>
  );
}
