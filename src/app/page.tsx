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
import { Location, ReportData, LayerVisibility } from '@/types/map';
import { getDefaultAreaConfig, canReportAtLocation } from '@/config/areas';
import { useAtom } from 'jotai';
import { currentAreaConfigAtom, currentAreaDisplayNameAtom } from '@/stores/area-store';
import { submitReportWithRetry, ApiError } from '@/lib/api-client';
import { ZoomButtons } from '@/components/ui/zoom-buttons';
import { ProjectInfoButton } from '@/components/ui/project-info-button';
import { MapRef } from '@/components/Map/MapContainer';
import LayerControlPanel from '@/components/Map/LayerControlPanel';
import DebugPanel from '@/components/DebugPanel';
import { shouldShowDebugPanel } from '@/lib/environment';

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

  // 使用 Jotai 管理區域狀態
  const [currentAreaConfig] = useAtom(currentAreaConfigAtom);
  const [currentAreaDisplayName] = useAtom(currentAreaDisplayNameAtom);

  // 區域配置狀態已完全由 Jotai 管理

  // UI 狀態
  const [isClient, setIsClient] = useState(false);
  const [canZoomIn, setCanZoomIn] = useState(true);
  const [canZoomOut, setCanZoomOut] = useState(true);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // 圖層可見性狀態
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    tiles: true,
    manual: true,
    kmz: true,
  });

  // 客戶端初始化
  useEffect(() => {
    setIsClient(true);
    // 檢查是否應該顯示除錯面板
    setShowDebugPanel(shouldShowDebugPanel());
  }, []);

  // 同步區域配置到 ref
  useEffect(() => {
    currentAreaConfigRef.current = currentAreaConfig;
  }, [currentAreaConfig]);

  // 初始化位置監控
  const initLocationTracking = useCallback(async () => {
    try {
      setAppState('requesting');

      const location = await getCurrentPosition();
      setUserLocation(location);
      setAppState('granted');

      // 使用新的回報邊界檢查
      const canReport = canReportAtLocation(location.lat, location.lon, currentAreaConfig);
      isWithinBoundsRef.current = canReport;

      // 開始監控位置變化
      const id = watchPosition(
        async (newLocation) => {
          setUserLocation(newLocation);

          // 使用新的回報邊界檢查
          const newCanReport = canReportAtLocation(
            newLocation.lat,
            newLocation.lon,
            currentAreaConfig
          );

          isWithinBoundsRef.current = newCanReport;
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
  }, [currentAreaConfig]);

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
  }, [isClient, initLocationTracking, currentAreaConfig]);

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

      try {
        // 使用新的回報邊界檢查邏輯（考慮無限制回報設定）
        if (!canReportAtLocation(userLocation.lat, userLocation.lon, currentAreaConfig)) {
          toast.error(`您不在${currentAreaConfig.displayName}範圍內，無法進行回報`);
          return;
        }

        const reportData: ReportData = {
          lat: userLocation.lat,
          lon: userLocation.lon,
          state,
        };

        // 調用後端 API（傳入當前區域名稱）
        const response = await submitReportWithRetry(reportData, 2, currentAreaConfig.name);

        if (response.success) {
          // 可選：顯示額外的成功資訊
          if (response.data) {
            console.log('回報成功詳情:', response.data);
          }
        } else {
          toast.error(response.message || '回報失敗');
        }
      } catch (error) {
        console.error('回報錯誤:', error);

        if (error instanceof ApiError) {
          toast.error(error.getUserFriendlyMessage());
        } else {
          toast.error('回報失敗，請重試');
        }
      }
    },
    [userLocation, currentAreaConfig]
  );

  // 切換鎖定中心模式
  const toggleLockCenter = useCallback(() => {
    setLockCenter(!lockCenter);
  }, [lockCenter]);

  // 當 GPS 無效或超出邊界時，自動關閉跟隨模式
  useEffect(() => {
    if (lockCenter && (!userLocation || isWithinBoundsRef.current === false)) {
      setLockCenter(false);
    }
  }, [lockCenter, userLocation]);

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

  // 處理區域切換（現在 Jotai 自動管理狀態）
  const handleAreaChange = useCallback(() => {
    // 檢查使用者位置是否在新區域內
    if (userLocation) {
      const canReport = canReportAtLocation(userLocation.lat, userLocation.lon, currentAreaConfig);
      isWithinBoundsRef.current = canReport;
    }
  }, [userLocation, currentAreaConfig]);

  // 監聽區域配置變化，自動更新地圖和執行相關操作
  useEffect(() => {
    // 更新 ref 以供其他函數使用
    currentAreaConfigRef.current = currentAreaConfig;

    // 觸發區域變化處理（邊界檢查和提示）
    handleAreaChange();
  }, [currentAreaConfig, handleAreaChange]);

  // 區域切換邏輯已完全由 Jotai 管理，不再需要向後相容函數

  // 渲染不同狀態的內容
  const renderContent = () => {
    // 統一的地圖和 UI 佈局
    return (
      <div className="relative w-full h-screen overflow-hidden">
        {/* 地圖容器 - 在所有狀態下都顯示 */}
        <DynamicMap
          ref={mapRef}
          center={lockCenter && userLocation ? userLocation : undefined}
          userLocation={userLocation || undefined}
          lockCenter={lockCenter}
          onMapClick={handleMapClick}
          areaConfig={currentAreaConfig}
          onZoomChange={handleZoomChange}
          layerVisibility={layerVisibility}
          className="w-full h-screen"
        />

        {/* 專案資訊按鈕 - 左上角 */}
        <ProjectInfoButton />

        <div className="sticky bottom-0 right-0 px-2 pb-[max(8px,env(safe-area-inset-bottom))] z-[1010] flex flex-col gap-2 pointer-events-none left-full md:max-w-96">
          {/* 右上角按鈕組 - 在所有狀態下都顯示 */}
          {appState !== 'requesting' && (
            <div className="ml-auto flex flex-col gap-2 pointer-events-auto">
              {/* 縮放按鈕 */}
              <ZoomButtons
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                canZoomIn={canZoomIn}
                canZoomOut={canZoomOut}
              />

              {/* 跟隨按鈕 */}
              <CenterLockButton
                isLocked={lockCenter}
                onToggle={toggleLockCenter}
                disabled={!userLocation || isWithinBoundsRef.current === false}
                className="relative"
              />
            </div>
          )}
          <div className="pointer-events-auto ml-auto space-y-2">
            {/* 圖層控制面板 - 在所有狀態下都顯示 */}
            <LayerControlPanel layers={layerVisibility} onLayerToggle={handleLayerToggle} />
          </div>

          <div className="relative pointer-events-auto">
            <div className="bg-white/100 backdrop-blur-xs border border-gray-300 rounded-xl absolute inset-0" />
            {/* Bottom Bar - 根據狀態顯示不同內容 */}
            {(appState === 'ready' || appState === 'denied' || appState === 'unavailable') && (
              <WelcomeButtons onJoin={handleJoinClick} areaName={currentAreaDisplayName} />
            )}
            {appState === 'granted' && userLocation && (
              <ReportButtons
                userLocation={userLocation}
                onReport={handleReport}
                disabled={isWithinBoundsRef.current === false}
              />
            )}
          </div>
        </div>

        {/* 狀態提示 */}
        {appState === 'denied' && (
          <div className="fixed top-16 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-[1000]">
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
          <div className="fixed top-16 left-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded z-[1000]">
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
          <div className="fixed top-16 left-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded z-[1000]">
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

        {/* 除錯面板 - 只在非生產環境顯示 */}
        {showDebugPanel && <DebugPanel />}
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
