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

type AppState = 'ready' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('ready');
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [lockCenter, setLockCenter] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const isWithinBoundsRef = useRef<boolean | null>(null);
  const mapRef = useRef<MapRef>(null);
  const currentAreaConfigRef = useRef(getDefaultAreaConfig());

  const [currentAreaConfig] = useAtom(currentAreaConfigAtom);
  const [currentAreaDisplayName] = useAtom(currentAreaDisplayNameAtom);

  const [isClient, setIsClient] = useState(false);
  const [canZoomIn, setCanZoomIn] = useState(true);
  const [canZoomOut, setCanZoomOut] = useState(true);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    tiles: true,
    manual: true,
    kmz: false,
  });

  useEffect(() => {
    setIsClient(true);
    setShowDebugPanel(shouldShowDebugPanel());
  }, []);

  useEffect(() => {
    currentAreaConfigRef.current = currentAreaConfig;
  }, [currentAreaConfig]);

  const initLocationTracking = useCallback(async () => {
    try {
      setAppState('requesting');

      const location = await getCurrentPosition();
      setUserLocation(location);
      setAppState('granted');

      const canReport = canReportAtLocation(location.lat, location.lon, currentAreaConfig);
      isWithinBoundsRef.current = canReport;

      const id = watchPosition(
        async (newLocation) => {
          setUserLocation(newLocation);

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
    }
  }, [currentAreaConfig]);

  useEffect(() => {
    if (!isClient) return;

    const tryAutoLocation = async () => {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });

          if (permission.state === 'granted') {
            initLocationTracking();
          }
        } catch (error) {
          console.log('無法檢查地理位置權限:', error);
        }
      }
    };

    tryAutoLocation();
  }, [isClient, initLocationTracking, currentAreaConfig]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

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

  const handleReport = useCallback(
    async (state: 0 | 1) => {
      if (!userLocation) {
        toast.error('無法取得位置資訊');
        return;
      }

      try {
        if (!canReportAtLocation(userLocation.lat, userLocation.lon, currentAreaConfig)) {
          toast.error(`您不在${currentAreaConfig.displayName}範圍內，無法進行回報`);
          return;
        }

        const reportData: ReportData = {
          lat: userLocation.lat,
          lon: userLocation.lon,
          state,
        };

        const response = await submitReportWithRetry(reportData, 2, currentAreaConfig.name);

        if (response.success) {
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

  const toggleLockCenter = useCallback(() => {
    setLockCenter(!lockCenter);
  }, [lockCenter]);

  useEffect(() => {
    if (lockCenter && (!userLocation || isWithinBoundsRef.current === false)) {
      setLockCenter(false);
    }
  }, [lockCenter, userLocation]);

  const handleMapClick = useCallback((location: Location) => {
    console.log('地圖點擊位置:', location);
  }, []);

  const handleZoomChange = useCallback(
    (zoom: number, canZoomInNew: boolean, canZoomOutNew: boolean) => {
      setCanZoomIn(canZoomInNew);
      setCanZoomOut(canZoomOutNew);
    },
    []
  );

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  const handleLayerToggle = useCallback((layerKey: keyof LayerVisibility, enabled: boolean) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [layerKey]: enabled,
    }));
  }, []);

  const requestLocationPermission = useCallback(() => {
    initLocationTracking();
  }, [initLocationTracking]);

  const handleAreaChange = useCallback(() => {
    if (userLocation) {
      const canReport = canReportAtLocation(userLocation.lat, userLocation.lon, currentAreaConfig);
      isWithinBoundsRef.current = canReport;
    }
  }, [userLocation, currentAreaConfig]);

  useEffect(() => {
    currentAreaConfigRef.current = currentAreaConfig;
    handleAreaChange();
  }, [currentAreaConfig, handleAreaChange]);

  const renderContent = () => {
    return (
      <div className="relative w-full h-dvh overflow-hidden">
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

        <ProjectInfoButton />

        <div className="sticky bottom-0 right-0 px-2 pb-[max(8px,env(safe-area-inset-bottom))] z-[1010] flex flex-col gap-2 pointer-events-none left-full md:max-w-96">
          {appState !== 'requesting' && (
            <div className="ml-auto flex flex-col gap-2 pointer-events-auto">
              <ZoomButtons
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                canZoomIn={canZoomIn}
                canZoomOut={canZoomOut}
              />

              <CenterLockButton
                isLocked={lockCenter}
                onToggle={toggleLockCenter}
                disabled={!userLocation || isWithinBoundsRef.current === false}
                className="relative"
              />
            </div>
          )}
          <div className="pointer-events-auto ml-auto space-y-2">
            <LayerControlPanel layers={layerVisibility} onLayerToggle={handleLayerToggle} />
          </div>

          <div className="relative pointer-events-auto">
            <div className="bg-white/100 backdrop-blur-xs border border-gray-300 rounded-xl absolute inset-0" />
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

        {showDebugPanel && <DebugPanel />}
      </div>
    );
  };

  return (
    <main className="relative w-full min-h-svh overflow-hidden">
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
