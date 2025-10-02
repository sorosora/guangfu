'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  debugPanelOpenAtom,
  gpsInfoAtom,
  environmentInfoAtom,
  networkInfoAtom,
  performanceInfoAtom,
  debugLogsAtom,
  addDebugLogAtom,
  clearDebugLogsAtom,
} from '@/stores/debug-store';
import {
  collectEnvironmentInfo,
  collectGPSInfo,
  collectNetworkInfo,
  collectPerformanceInfo,
  exportDiagnosticInfo,
  copyToClipboard,
  formatBytes,
  formatTimestamp,
} from '@/lib/debug-utils';
// AVAILABLE_AREAS removed as it's no longer used
import { getCurrentPosition } from '@/lib/geolocation';
import {
  switchToGuangfuAtom,
  switchToTestAreaAtom,
  currentAreaTypeAtom,
  isInTestAreaAtom,
} from '@/stores/area-store';

interface DebugPanelProps {
  className?: string;
}

interface TestAreaListItem {
  id: string;
  displayName: string;
  createdAt: number;
}

export default function DebugPanel({ className }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useAtom(debugPanelOpenAtom);
  const [gpsInfo, setGpsInfo] = useAtom(gpsInfoAtom);
  const [envInfo, setEnvInfo] = useAtom(environmentInfoAtom);
  const [networkInfo, setNetworkInfo] = useAtom(networkInfoAtom);
  const [perfInfo, setPerfInfo] = useAtom(performanceInfoAtom);
  const [logs] = useAtom(debugLogsAtom);
  const [, addLog] = useAtom(addDebugLogAtom);
  const [, clearLogs] = useAtom(clearDebugLogsAtom);

  // 使用 Jotai 管理區域狀態
  const [currentAreaType] = useAtom(currentAreaTypeAtom);
  const [, switchToGuangfu] = useAtom(switchToGuangfuAtom);
  const [, switchToTestArea] = useAtom(switchToTestAreaAtom);
  const [isInTestArea] = useAtom(isInTestAreaAtom);

  const [activeTab, setActiveTab] = useState<'system' | 'gps' | 'areas' | 'tools'>('system');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // 測試區域管理狀態
  const [testAreas, setTestAreas] = useState<TestAreaListItem[]>([]);
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [isLoadingTestAreas, setIsLoadingTestAreas] = useState(false);
  const [createAreaError, setCreateAreaError] = useState('');
  const [isValidAreaName, setIsValidAreaName] = useState(true);

  // 驗證區域名稱格式
  const validateAreaNameFormat = (name: string): string | null => {
    if (!name.trim()) {
      return '區域名稱為必填';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return '區域名稱只能包含英文字母、數字和底線';
    }
    if (name.length > 20) {
      return '區域名稱不能超過 20 個字元';
    }
    return null;
  };

  // 處理名稱輸入變更
  const handleAreaNameChange = (value: string) => {
    setNewAreaName(value);
    setCreateAreaError('');
    const error = validateAreaNameFormat(value);
    setIsValidAreaName(!error);
    if (error) {
      setCreateAreaError(error);
    }
  };

  // 標記 hydration 完成
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // 收集初始資訊 - 確保只在客戶端 hydration 完成後執行
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      // 延遲執行，確保所有 hydration 都完成
      const timer = setTimeout(() => {
        setEnvInfo(collectEnvironmentInfo());
        setNetworkInfo(collectNetworkInfo());
        setPerfInfo(collectPerformanceInfo());

        addLog({
          level: 'info',
          message: '除錯面板已啟動',
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isHydrated, setEnvInfo, setNetworkInfo, setPerfInfo, addLog]);

  // 自動刷新 GPS 資訊
  useEffect(() => {
    if (!autoRefresh || !isOpen || !isHydrated) return;

    const interval = setInterval(async () => {
      try {
        const newGpsInfo = await collectGPSInfo();
        setGpsInfo((current) => ({ ...current, ...newGpsInfo }));
      } catch (error) {
        addLog({
          level: 'error',
          message: 'GPS 資訊更新失敗',
          data: error,
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, isOpen, isHydrated, setGpsInfo, addLog]);

  // 自動刷新網路資訊
  useEffect(() => {
    if (!autoRefresh || !isOpen || !isHydrated) return;

    const interval = setInterval(() => {
      setNetworkInfo(collectNetworkInfo());
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, isOpen, isHydrated, setNetworkInfo]);

  // 手動刷新所有資訊
  const refreshAll = async () => {
    addLog({
      level: 'info',
      message: '手動刷新所有資訊',
    });

    setEnvInfo(collectEnvironmentInfo());
    setNetworkInfo(collectNetworkInfo());
    setPerfInfo(collectPerformanceInfo());

    try {
      const newGpsInfo = await collectGPSInfo();
      setGpsInfo((current) => ({ ...current, ...newGpsInfo }));
    } catch (error) {
      addLog({
        level: 'error',
        message: '手動刷新 GPS 資訊失敗',
        data: error,
      });
    }
  };

  // 匯出診斷資訊
  const exportDiagnostics = async () => {
    try {
      const report = exportDiagnosticInfo(envInfo, gpsInfo, networkInfo, perfInfo, logs);
      const success = await copyToClipboard(report);

      addLog({
        level: success ? 'info' : 'error',
        message: success ? '診斷報告已複製到剪貼板' : '複製診斷報告失敗',
      });
    } catch (error) {
      addLog({
        level: 'error',
        message: '匯出診斷報告失敗',
        data: error,
      });
    }
  };

  // 載入測試區域清單
  const loadTestAreas = useCallback(async () => {
    setIsLoadingTestAreas(true);
    try {
      const response = await fetch('/api/test-areas?list=true');
      const data = await response.json();

      if (data.success) {
        setTestAreas(data.data.areas);
        addLog({
          level: 'info',
          message: `載入 ${data.data.areas.length} 個測試區域`,
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      addLog({
        level: 'error',
        message: '載入測試區域失敗',
        data: error,
      });
    } finally {
      setIsLoadingTestAreas(false);
    }
  }, [addLog]);

  // 建立測試區域（GPS）
  const createTestAreaFromGPS = async () => {
    // 清除之前的錯誤
    setCreateAreaError('');

    // 驗證名稱
    const nameError = validateAreaNameFormat(newAreaName);
    if (nameError) {
      setCreateAreaError(nameError);
      return;
    }

    setIsCreatingArea(true);
    try {
      addLog({
        level: 'info',
        message: '正在獲取 GPS 位置...',
      });

      const position = await getCurrentPosition();

      const response = await fetch('/api/test-areas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          center: {
            lat: position.lat,
            lon: position.lon,
          },
          customName: newAreaName,
          createdBy: 'gps',
        }),
      });

      const data = await response.json();

      if (data.success) {
        addLog({
          level: 'info',
          message: `測試區域建立成功: ${data.data.area.displayName}`,
        });
        setNewAreaName('');
        setCreateAreaError('');
        await loadTestAreas();
      } else {
        // 顯示 API 錯誤給使用者
        setCreateAreaError(data.message || '建立失敗');
        addLog({
          level: 'error',
          message: `測試區域建立失敗: ${data.message}`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'GPS 測試區域建立失敗';
      setCreateAreaError(errorMessage);
      addLog({
        level: 'error',
        message: 'GPS 測試區域建立失敗',
        data: error,
      });
    } finally {
      setIsCreatingArea(false);
    }
  };

  // 刪除測試區域
  const deleteTestArea = async (areaId: string) => {
    try {
      const response = await fetch(`/api/test-areas/${areaId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        addLog({
          level: 'info',
          message: '測試區域刪除成功',
        });

        // 如果刪除的是當前選擇的區域，切換到光復鄉
        if (currentAreaType === areaId) {
          switchToGuangfu();
        }

        await loadTestAreas();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      addLog({
        level: 'error',
        message: '刪除測試區域失敗',
        data: error,
      });
    }
  };

  // 地區切換處理已完全由 Jotai 管理，不再需要向後相容邏輯

  // 載入測試區域清單（當面板開啟時）
  useEffect(() => {
    if (isOpen && isHydrated && activeTab === 'areas') {
      loadTestAreas();

      // currentAreaType 現在由 Jotai 自動管理，不需要手動設定
    }
  }, [isOpen, isHydrated, activeTab, loadTestAreas]);

  if (!isOpen) {
    return (
      <div className={cn('fixed top-4 left-4 z-[2000]', className)}>
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="sm"
          className="bg-white shadow-lg hover:bg-gray-50 border-gray-300"
          aria-label="開啟除錯面板"
        >
          <span className="text-lg">🐛</span>
          <span className="ml-1 text-sm font-medium">除錯</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fixed top-4 inset-x-4 z-[2000] max-h-[80vh] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden',
        className
      )}
    >
      {/* 標題列 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🐛</span>
          <span className="text-sm font-medium text-gray-700">除錯面板</span>
        </div>
        <div className="flex items-center space-x-1">
          <Button onClick={refreshAll} variant="ghost" size="sm" className="text-xs">
            🔄
          </Button>
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant="ghost"
            size="sm"
            className={cn('text-xs', autoRefresh ? 'text-green-600' : 'text-gray-400')}
          >
            {autoRefresh ? '⏸️' : '▶️'}
          </Button>
          <Button onClick={() => setIsOpen(false)} variant="ghost" size="sm" className="text-xs">
            ✕
          </Button>
        </div>
      </div>

      {/* 分頁標籤 */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {[
          { key: 'system', label: '系統資訊', icon: '🔍' },
          { key: 'gps', label: '位置資訊', icon: '📍' },
          { key: 'areas', label: '區域管理', icon: '🗺️' },
          { key: 'tools', label: '除錯工具', icon: '🛠️' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={cn(
              'flex-1 px-2 py-2 text-xs font-medium transition-colors',
              activeTab === tab.key
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <div className="flex flex-col items-center space-y-0.5">
              <span className="text-sm">{tab.icon}</span>
              <span className="text-xs leading-tight">{tab.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* 內容區域 */}
      <div className="p-3 max-h-96 overflow-y-auto">
        {/* 系統資訊 */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            {/* 環境變數 */}
            <div>
              <span className="font-medium text-gray-600 text-sm">環境變數</span>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-medium text-gray-600">NODE_ENV:</span>
                  <div
                    className={cn(
                      'mt-1 px-2 py-1 rounded text-white text-center',
                      envInfo.nodeEnv === 'development'
                        ? 'bg-green-500'
                        : envInfo.nodeEnv === 'production'
                          ? 'bg-red-500'
                          : 'bg-gray-500'
                    )}
                  >
                    {envInfo.nodeEnv || 'undefined'}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">NEXT_PUBLIC_VERCEL_ENV:</span>
                  <div
                    className={cn(
                      'mt-1 px-2 py-1 rounded text-white text-center',
                      envInfo.vercelEnv === 'preview'
                        ? 'bg-yellow-500'
                        : envInfo.vercelEnv === 'production'
                          ? 'bg-red-500'
                          : envInfo.vercelEnv === 'development'
                            ? 'bg-green-500'
                            : 'bg-gray-500'
                    )}
                  >
                    {envInfo.vercelEnv || 'undefined'}
                  </div>
                </div>
              </div>
            </div>

            {/* 網路狀態 */}
            <div>
              <span className="font-medium text-gray-600 text-sm">網路狀態</span>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="font-medium text-gray-600 text-xs">連線狀態:</span>
                  <div
                    className={cn(
                      'mt-1 px-2 py-1 rounded text-white text-center text-xs',
                      networkInfo.online ? 'bg-green-500' : 'bg-red-500'
                    )}
                  >
                    {networkInfo.online ? '線上' : '離線'}
                  </div>
                </div>

                {networkInfo.connection && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="font-medium text-gray-600">連線類型:</span>
                      <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-center">
                        {networkInfo.connection.effectiveType || '未知'}
                      </div>
                    </div>

                    {networkInfo.connection.downlink && (
                      <div>
                        <span className="font-medium text-gray-600">下載速度:</span>
                        <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-center">
                          {networkInfo.connection.downlink} Mbps
                        </div>
                      </div>
                    )}

                    {networkInfo.connection.rtt !== undefined && (
                      <div>
                        <span className="font-medium text-gray-600">延遲:</span>
                        <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-center">
                          {networkInfo.connection.rtt}ms
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 效能指標 */}
            <div>
              <span className="font-medium text-gray-600 text-sm">效能指標</span>
              <div className="mt-2 space-y-2 text-xs">
                {perfInfo.timing.domContentLoaded && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-medium text-gray-600">DOM 載入:</span>
                      <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-center">
                        {perfInfo.timing.domContentLoaded}ms
                      </div>
                    </div>

                    {perfInfo.timing.loadComplete && (
                      <div>
                        <span className="font-medium text-gray-600">載入完成:</span>
                        <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-center">
                          {perfInfo.timing.loadComplete}ms
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {perfInfo.timing.firstContentfulPaint && (
                  <div>
                    <span className="font-medium text-gray-600">首次繪製:</span>
                    <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-center">
                      {perfInfo.timing.firstContentfulPaint.toFixed(2)}ms
                    </div>
                  </div>
                )}

                {perfInfo.memoryUsage && (
                  <div>
                    <span className="font-medium text-gray-600">記憶體使用:</span>
                    <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-center">
                      {formatBytes(perfInfo.memoryUsage.usedJSHeapSize)} /{' '}
                      {formatBytes(perfInfo.memoryUsage.totalJSHeapSize)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 位置資訊 */}
        {activeTab === 'gps' && (
          <div className="space-y-4">
            <div>
              <span className="font-medium text-gray-600 text-sm">GPS 權限狀態</span>
              <div className="mt-2">
                <span className="font-medium text-gray-600 text-xs">權限狀態:</span>
                <div
                  className={cn(
                    'mt-1 px-2 py-1 rounded text-white text-center text-xs',
                    gpsInfo.permissionState === 'granted'
                      ? 'bg-green-500'
                      : gpsInfo.permissionState === 'denied'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                  )}
                >
                  {gpsInfo.permissionState}
                </div>
              </div>
            </div>

            {gpsInfo.location && (
              <div>
                <span className="font-medium text-gray-600 text-sm">位置座標</span>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-medium text-gray-600">緯度:</span>
                    <div className="mt-1 px-2 py-1 bg-gray-100 rounded font-mono">
                      {gpsInfo.location.lat.toFixed(6)}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">經度:</span>
                    <div className="mt-1 px-2 py-1 bg-gray-100 rounded font-mono">
                      {gpsInfo.location.lon.toFixed(6)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(gpsInfo.accuracy || gpsInfo.speed !== null || gpsInfo.heading !== null) && (
              <div>
                <span className="font-medium text-gray-600 text-sm">定位詳情</span>
                <div className="mt-2 space-y-2 text-xs">
                  {gpsInfo.accuracy && (
                    <div>
                      <span className="font-medium text-gray-600">精度:</span>
                      <div className="mt-1 px-2 py-1 bg-gray-100 rounded">
                        ±{gpsInfo.accuracy.toFixed(1)}m
                      </div>
                    </div>
                  )}
                  {gpsInfo.speed !== null && (
                    <div>
                      <span className="font-medium text-gray-600">速度:</span>
                      <div className="mt-1 px-2 py-1 bg-gray-100 rounded">
                        {gpsInfo.speed.toFixed(1)}m/s
                      </div>
                    </div>
                  )}
                  {gpsInfo.heading !== null && (
                    <div>
                      <span className="font-medium text-gray-600">方向:</span>
                      <div className="mt-1 px-2 py-1 bg-gray-100 rounded">
                        {gpsInfo.heading.toFixed(0)}°
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {gpsInfo.error && (
              <div>
                <span className="font-medium text-gray-600 text-sm">錯誤資訊</span>
                <div className="mt-2 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                  {gpsInfo.error}
                </div>
              </div>
            )}

            {gpsInfo.timestamp && (
              <div className="text-xs text-gray-500 text-center">
                最後更新: {formatTimestamp(gpsInfo.timestamp)}
              </div>
            )}
          </div>
        )}

        {/* 區域管理 */}
        {activeTab === 'areas' && (
          <div className="space-y-4">
            {/* 當前區域 */}
            <div>
              <span className="font-medium text-gray-600 text-sm">當前區域</span>
              <div className="mt-2 space-y-2">
                <div className="text-xs text-gray-500 text-center py-1">
                  {isInTestArea ? '測試區域' : '花蓮光復鄉'}
                </div>
                <button
                  onClick={() => {
                    switchToGuangfu();
                    addLog({
                      level: 'info',
                      message: '切換到光復鄉',
                    });
                  }}
                  className={cn(
                    'w-full px-2 py-2 rounded text-xs font-medium transition-colors',
                    currentAreaType === 'guangfu'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  🏘️ 花蓮光復鄉
                </button>
              </div>
            </div>

            {/* 測試區域管理 */}
            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600 text-sm">測試區域</span>
                <Button
                  onClick={loadTestAreas}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  disabled={isLoadingTestAreas}
                >
                  {isLoadingTestAreas ? '⏳' : '🔄'}
                </Button>
              </div>

              {/* 測試區域選擇 */}
              <div className="mt-2 space-y-2">
                {testAreas.length > 0 ? (
                  <div className="space-y-1">
                    {testAreas.map((area) => (
                      <div key={area.id} className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            switchToTestArea(area.id);
                            addLog({
                              level: 'info',
                              message: `切換到測試區域: ${area.displayName}`,
                            });
                          }}
                          className={cn(
                            'flex-1 px-2 py-1 rounded text-xs text-left transition-colors',
                            currentAreaType === area.id
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          )}
                          title={`建立於: ${new Date(area.createdAt).toLocaleString('zh-TW')}`}
                        >
                          🗺️ {area.displayName}
                        </button>
                        <button
                          onClick={() => deleteTestArea(area.id)}
                          className="px-1 py-1 text-xs text-red-500 hover:bg-red-50 rounded"
                          title="刪除測試區域"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 text-center py-2">暫無測試區域</div>
                )}
              </div>

              {/* 建立新測試區域 */}
              <div className="mt-3 space-y-2">
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="區域名稱（必填，僅英數字和底線）"
                    value={newAreaName}
                    onChange={(e) => handleAreaNameChange(e.target.value)}
                    className={cn(
                      'w-full px-2 py-1 text-xs border rounded',
                      createAreaError
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-gray-300 focus:border-blue-500'
                    )}
                    maxLength={20}
                  />
                  {createAreaError && <div className="text-xs text-red-500">{createAreaError}</div>}
                </div>
                <Button
                  onClick={createTestAreaFromGPS}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  disabled={isCreatingArea || !newAreaName.trim() || !isValidAreaName}
                >
                  {isCreatingArea ? '⏳ 建立中...' : '📍 建立 GPS 測試區域'}
                </Button>
                <div className="text-xs text-gray-500">
                  建立一個以當前 GPS 位置為中心的 4km×3km 測試區域
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 除錯工具 */}
        {activeTab === 'tools' && (
          <div className="space-y-4">
            {/* 除錯日誌 */}
            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600 text-sm">除錯日誌</span>
                <Button onClick={clearLogs} variant="ghost" size="sm" className="text-xs">
                  清除
                </Button>
              </div>

              <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-4">暫無日誌</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="text-xs p-2 rounded bg-gray-50">
                      <div className="flex items-center space-x-2">
                        <span
                          className={cn(
                            'w-12 text-center font-medium',
                            log.level === 'error'
                              ? 'text-red-600'
                              : log.level === 'warn'
                                ? 'text-yellow-600'
                                : log.level === 'info'
                                  ? 'text-blue-600'
                                  : 'text-gray-600'
                          )}
                        >
                          {log.level.toUpperCase()}
                        </span>
                        <span className="text-gray-500">{formatTimestamp(log.timestamp)}</span>
                      </div>
                      <div className="mt-1 text-gray-700">{log.message}</div>
                      {log.data !== undefined && (
                        <div className="mt-1 p-1 bg-gray-200 rounded font-mono text-xs">
                          {typeof log.data === 'string'
                            ? log.data
                            : JSON.stringify(log.data, null, 2)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 系統操作 */}
            <div>
              <span className="font-medium text-gray-600 text-sm">系統操作</span>
              <div className="mt-2 space-y-2">
                <Button onClick={refreshAll} variant="outline" size="sm" className="w-full text-xs">
                  🔄 刷新所有資訊
                </Button>
                <Button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  variant={autoRefresh ? 'default' : 'outline'}
                  size="sm"
                  className="w-full text-xs"
                >
                  {autoRefresh ? '⏸️ 停止自動刷新' : '▶️ 開始自動刷新'}
                </Button>
              </div>
            </div>

            {/* 診斷工具 */}
            <div>
              <span className="font-medium text-gray-600 text-sm">診斷工具</span>
              <div className="mt-2 space-y-2">
                <Button
                  onClick={exportDiagnostics}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                >
                  📋 匯出診斷報告
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
