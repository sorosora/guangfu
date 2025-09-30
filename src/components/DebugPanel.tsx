'use client';

import { useEffect, useState } from 'react';
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
import { AreaMode, AVAILABLE_AREAS } from '@/config/areas';

interface DebugPanelProps {
  currentArea: AreaMode;
  onAreaChange: (area: AreaMode) => void;
  className?: string;
}

export default function DebugPanel({ currentArea, onAreaChange, className }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useAtom(debugPanelOpenAtom);
  const [gpsInfo, setGpsInfo] = useAtom(gpsInfoAtom);
  const [envInfo, setEnvInfo] = useAtom(environmentInfoAtom);
  const [networkInfo, setNetworkInfo] = useAtom(networkInfoAtom);
  const [perfInfo, setPerfInfo] = useAtom(performanceInfoAtom);
  const [logs] = useAtom(debugLogsAtom);
  const [, addLog] = useAtom(addDebugLogAtom);
  const [, clearLogs] = useAtom(clearDebugLogsAtom);
  // 移除強制切換功能，改用傳入的 currentArea 和 onAreaChange

  const [activeTab, setActiveTab] = useState<
    'env' | 'gps' | 'network' | 'perf' | 'logs' | 'control'
  >('env');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

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

  // 地區切換處理
  const handleAreaSwitch = (area: AreaMode) => {
    onAreaChange(area);
    addLog({
      level: 'info',
      message: `切換到 ${AVAILABLE_AREAS[area].displayName}`,
    });
  };

  if (!isOpen) {
    return (
      <div className={cn('fixed bottom-4 right-4 z-[2000]', className)}>
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
        'fixed bottom-4 inset-x-4 z-[2000] max-h-[80vh] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden',
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
          { key: 'env', label: '環境', icon: '🌐' },
          { key: 'gps', label: 'GPS', icon: '📍' },
          { key: 'network', label: '網路', icon: '📶' },
          { key: 'perf', label: '效能', icon: '⚡' },
          { key: 'logs', label: '日誌', icon: '📝' },
          { key: 'control', label: '控制', icon: '🎛️' },
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
            <div className="flex flex-col items-center space-y-1">
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* 內容區域 */}
      <div className="p-3 max-h-96 overflow-y-auto">
        {/* 環境資訊 */}
        {activeTab === 'env' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
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

            <div>
              <span className="font-medium text-gray-600">測試區域配置:</span>
              <div
                className={cn(
                  'mt-1 px-2 py-1 rounded text-white text-center text-xs',
                  envInfo.hasTestAreaConfig ? 'bg-green-500' : 'bg-red-500'
                )}
              >
                {envInfo.hasTestAreaConfig ? '完整' : '不完整'}
              </div>
            </div>

            <div>
              <span className="font-medium text-gray-600">環境變數:</span>
              <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                {Object.entries(envInfo.testAreaEnvVars).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="text-gray-500">
                      {key.replace('NEXT_PUBLIC_TEST_AREA_', '')}:
                    </span>
                    <span className={cn('ml-1', value ? 'text-green-600' : 'text-red-500')}>
                      {value || '未設定'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GPS 資訊 */}
        {activeTab === 'gps' && (
          <div className="space-y-3">
            <div>
              <span className="font-medium text-gray-600">權限狀態:</span>
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

            {gpsInfo.location && (
              <div className="grid grid-cols-2 gap-2 text-xs">
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
            )}

            {gpsInfo.accuracy && (
              <div>
                <span className="font-medium text-gray-600">精度:</span>
                <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  ±{gpsInfo.accuracy.toFixed(1)}m
                </div>
              </div>
            )}

            {gpsInfo.error && (
              <div>
                <span className="font-medium text-gray-600">錯誤:</span>
                <div className="mt-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                  {gpsInfo.error}
                </div>
              </div>
            )}

            {gpsInfo.timestamp && (
              <div className="text-xs text-gray-500">
                最後更新: {formatTimestamp(gpsInfo.timestamp)}
              </div>
            )}
          </div>
        )}

        {/* 網路狀態 */}
        {activeTab === 'network' && (
          <div className="space-y-3">
            <div>
              <span className="font-medium text-gray-600">連線狀態:</span>
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
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-gray-600">連線類型:</span>
                  <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-xs">
                    {networkInfo.connection.effectiveType || '未知'}
                  </div>
                </div>

                {networkInfo.connection.downlink && (
                  <div>
                    <span className="font-medium text-gray-600">下載速度:</span>
                    <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-xs">
                      {networkInfo.connection.downlink} Mbps
                    </div>
                  </div>
                )}

                {networkInfo.connection.rtt !== undefined && (
                  <div>
                    <span className="font-medium text-gray-600">延遲:</span>
                    <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-xs">
                      {networkInfo.connection.rtt}ms
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-gray-500">
              最後檢查: {formatTimestamp(networkInfo.timestamp)}
            </div>
          </div>
        )}

        {/* 效能資訊 */}
        {activeTab === 'perf' && (
          <div className="space-y-3">
            {perfInfo.timing.domContentLoaded && (
              <div>
                <span className="font-medium text-gray-600">DOM 載入:</span>
                <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  {perfInfo.timing.domContentLoaded}ms
                </div>
              </div>
            )}

            {perfInfo.timing.loadComplete && (
              <div>
                <span className="font-medium text-gray-600">載入完成:</span>
                <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  {perfInfo.timing.loadComplete}ms
                </div>
              </div>
            )}

            {perfInfo.timing.firstContentfulPaint && (
              <div>
                <span className="font-medium text-gray-600">首次繪製:</span>
                <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  {perfInfo.timing.firstContentfulPaint.toFixed(2)}ms
                </div>
              </div>
            )}

            {perfInfo.memoryUsage && (
              <div>
                <span className="font-medium text-gray-600">記憶體使用:</span>
                <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  {formatBytes(perfInfo.memoryUsage.usedJSHeapSize)} /{' '}
                  {formatBytes(perfInfo.memoryUsage.totalJSHeapSize)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 日誌 */}
        {activeTab === 'logs' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-600">除錯日誌</span>
              <Button onClick={clearLogs} variant="ghost" size="sm" className="text-xs">
                清除
              </Button>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
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
        )}

        {/* 控制面板 */}
        {activeTab === 'control' && (
          <div className="space-y-3">
            <div>
              <span className="font-medium text-gray-600">地區切換:</span>
              <div className="mt-2 space-y-2">
                <div className="text-xs text-gray-500">
                  當前地區: {AVAILABLE_AREAS[currentArea].displayName}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleAreaSwitch('test')}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium transition-colors flex-1',
                      currentArea === 'test'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    測試區
                  </button>
                  <button
                    onClick={() => handleAreaSwitch('guangfu')}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium transition-colors flex-1',
                      currentArea === 'guangfu'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    光復
                  </button>
                </div>
              </div>
            </div>

            <div>
              <span className="font-medium text-gray-600">診斷工具:</span>
              <div className="mt-2 space-y-2">
                <Button
                  onClick={exportDiagnostics}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                >
                  📋 匯出診斷報告
                </Button>

                <Button onClick={refreshAll} variant="outline" size="sm" className="w-full text-xs">
                  🔄 刷新所有資訊
                </Button>
              </div>
            </div>

            <div>
              <span className="font-medium text-gray-600">自動刷新:</span>
              <div className="mt-2">
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
          </div>
        )}
      </div>
    </div>
  );
}
