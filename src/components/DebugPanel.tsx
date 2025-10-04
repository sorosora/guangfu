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
  currentAreaTypeAtom,
  currentAreaConfigAtom,
  currentAreaDisplayNameAtom,
  switchAreaAtom,
  supportedAreasAtom,
} from '@/stores/area-store';
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
import { getCurrentPosition } from '@/lib/geolocation';

interface DebugPanelProps {
  className?: string;
}

/**
 * 調試面板組件（階段五簡化版）
 */
export default function DebugPanel({ className }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useAtom(debugPanelOpenAtom);
  const [gpsInfo, setGpsInfo] = useAtom(gpsInfoAtom);
  const [envInfo, setEnvInfo] = useAtom(environmentInfoAtom);
  const [networkInfo, setNetworkInfo] = useAtom(networkInfoAtom);
  const [performanceInfo, setPerformanceInfo] = useAtom(performanceInfoAtom);
  const [debugLogs] = useAtom(debugLogsAtom);
  const [, addLog] = useAtom(addDebugLogAtom);
  const [, clearLogs] = useAtom(clearDebugLogsAtom);

  // 區域狀態管理
  const [currentAreaType] = useAtom(currentAreaTypeAtom);
  const [currentAreaConfig] = useAtom(currentAreaConfigAtom);
  const [currentAreaDisplayName] = useAtom(currentAreaDisplayNameAtom);
  const [supportedAreas] = useAtom(supportedAreasAtom);
  const [, switchArea] = useAtom(switchAreaAtom);

  // 狀態管理
  const [activeTab, setActiveTab] = useState<'info' | 'logs' | 'tools'>('info');
  const [isCollecting, setIsCollecting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // 收集所有系統資訊
  const collectAllInfo = useCallback(async () => {
    setIsCollecting(true);
    try {
      addLog({
        level: 'info',
        message: '開始收集系統資訊...',
      });

      // 並行收集所有資訊
      const [gps, env, network, performance] = await Promise.all([
        collectGPSInfo(),
        collectEnvironmentInfo(),
        collectNetworkInfo(),
        collectPerformanceInfo(),
      ]);

      setGpsInfo((prev) => ({ ...prev, ...gps }));
      setEnvInfo(env);
      setNetworkInfo(network);
      setPerformanceInfo(performance);

      addLog({
        level: 'info',
        message: '系統資訊收集完成',
      });
    } catch (error) {
      addLog({
        level: 'error',
        message: '收集系統資訊失敗',
        data: error,
      });
    } finally {
      setIsCollecting(false);
    }
  }, [addLog, setGpsInfo, setEnvInfo, setNetworkInfo, setPerformanceInfo]);

  // 測試 GPS 定位
  const testGPSLocation = async () => {
    try {
      addLog({
        level: 'info',
        message: '正在測試 GPS 定位...',
      });

      const position = await getCurrentPosition();

      addLog({
        level: 'info',
        message: `GPS 定位成功: ${position.lat.toFixed(6)}, ${position.lon.toFixed(6)}`,
        data: position,
      });
    } catch (error) {
      addLog({
        level: 'error',
        message: 'GPS 定位失敗',
        data: error,
      });
    }
  };

  // 匯出診斷報告
  const exportDiagnostics = async () => {
    try {
      const reportData = exportDiagnosticInfo(
        envInfo,
        gpsInfo,
        networkInfo,
        performanceInfo,
        debugLogs
      );

      await copyToClipboard(reportData);

      addLog({
        level: 'info',
        message: '診斷報告已複製到剪貼簿',
      });
    } catch (error) {
      addLog({
        level: 'error',
        message: '匯出診斷報告失敗',
        data: error,
      });
    }
  };

  // 區域切換處理
  const handleAreaSwitch = (areaId: string) => {
    try {
      addLog({
        level: 'info',
        message: `正在切換到 ${areaId} 區域...`,
      });

      switchArea(areaId as 'guangfu' | 'preview');

      addLog({
        level: 'info',
        message: `已成功切換到 ${areaId} 區域`,
        data: {
          fromArea: currentAreaType,
          toArea: areaId,
          config: currentAreaConfig,
        },
      });
    } catch (error) {
      addLog({
        level: 'error',
        message: `切換到 ${areaId} 區域失敗`,
        data: error,
      });
    }
  };

  // 自動刷新邏輯
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      collectAllInfo();
    }, 5000); // 每 5 秒刷新一次

    return () => clearInterval(interval);
  }, [autoRefresh, collectAllInfo]);

  // 初始化時收集一次資訊
  useEffect(() => {
    if (isOpen) {
      collectAllInfo();
    }
  }, [isOpen, collectAllInfo]);

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn(
          'z-[1010] fixed top-4 left-4 bg-white/90 backdrop-blur-sm',
          'border-gray-300 hover:bg-gray-50',
          className
        )}
        title="開啟調試面板"
      >
        🐛
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'z-[1010] fixed top-4 inset-x-4 max-h-[80vh]',
        'bg-white border border-gray-300 rounded-lg shadow-lg',
        'flex flex-col overflow-hidden',
        className
      )}
    >
      {/* 標題欄 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-800">調試面板（{currentAreaDisplayName}）</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              'px-2 py-1 text-xs',
              autoRefresh ? 'bg-green-100 text-green-700' : 'text-gray-600'
            )}
          >
            {autoRefresh ? '🔄 自動刷新' : '⏸️ 手動'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="px-2 py-1 text-gray-600 hover:text-gray-800"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* 分頁選項 */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'info', label: '系統資訊' },
          { key: 'logs', label: '調試日誌' },
          { key: 'tools', label: '工具' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'info' | 'logs' | 'tools')}
            className={cn(
              'flex-1 py-2 px-3 text-sm font-medium',
              'border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 分頁內容 */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-gray-800">系統資訊</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={collectAllInfo}
                disabled={isCollecting}
                className="text-xs"
              >
                {isCollecting ? '收集中...' : '刷新'}
              </Button>
            </div>

            {/* GPS 資訊 */}
            {gpsInfo && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-700">GPS 定位</h5>
                <div className="text-xs space-y-1 bg-gray-50 p-2 rounded">
                  <div>
                    權限狀態:{' '}
                    <span
                      className={
                        gpsInfo.permissionState === 'granted' ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {gpsInfo.permissionState}
                    </span>
                  </div>
                  {gpsInfo.location && (
                    <>
                      <div>緯度: {gpsInfo.location.lat.toFixed(6)}</div>
                      <div>經度: {gpsInfo.location.lon.toFixed(6)}</div>
                      {gpsInfo.accuracy && <div>精度: {gpsInfo.accuracy.toFixed(1)}m</div>}
                    </>
                  )}
                  {gpsInfo.error && <div className="text-red-600">錯誤: {gpsInfo.error}</div>}
                </div>
              </div>
            )}

            {/* 環境資訊 */}
            {envInfo && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-700">環境資訊</h5>
                <div className="text-xs space-y-1 bg-gray-50 p-2 rounded">
                  <div>瀏覽器: {envInfo.userAgent}</div>
                  <div>NODE_ENV: {envInfo.nodeEnv || 'undefined'}</div>
                  <div>VERCEL_ENV: {envInfo.vercelEnv || 'undefined'}</div>
                  <div>URL: {envInfo.url}</div>
                </div>
              </div>
            )}

            {/* 網路資訊 */}
            {networkInfo && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-700">網路資訊</h5>
                <div className="text-xs space-y-1 bg-gray-50 p-2 rounded">
                  <div>連線類型: {networkInfo.connection?.effectiveType || '未知'}</div>
                  <div>
                    線上狀態:{' '}
                    <span className={networkInfo.online ? 'text-green-600' : 'text-red-600'}>
                      {networkInfo.online ? '線上' : '離線'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 效能資訊 */}
            {performanceInfo && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-700">效能資訊</h5>
                <div className="text-xs space-y-1 bg-gray-50 p-2 rounded">
                  <div>載入完成: {performanceInfo.timing.loadComplete?.toFixed(0)}ms</div>
                  <div>DOM 完成: {performanceInfo.timing.domContentLoaded?.toFixed(0)}ms</div>
                  <div>
                    首次內容繪製: {performanceInfo.timing.firstContentfulPaint?.toFixed(0)}ms
                  </div>
                  {performanceInfo.memoryUsage && (
                    <div>
                      記憶體: {formatBytes(performanceInfo.memoryUsage.usedJSHeapSize)} /{' '}
                      {formatBytes(performanceInfo.memoryUsage.totalJSHeapSize)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-gray-800">調試日誌</h4>
              <Button variant="outline" size="sm" onClick={clearLogs} className="text-xs">
                清除日誌
              </Button>
            </div>

            <div className="space-y-1 max-h-64 overflow-auto">
              {debugLogs.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-4">暫無調試日誌</div>
              ) : (
                debugLogs.slice(-50).map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      'text-xs p-2 rounded border-l-2',
                      log.level === 'error' && 'bg-red-50 border-red-500 text-red-700',
                      log.level === 'warn' && 'bg-yellow-50 border-yellow-500 text-yellow-700',
                      log.level === 'info' && 'bg-blue-50 border-blue-500 text-blue-700'
                    )}
                  >
                    <div className="font-medium">
                      {formatTimestamp(log.timestamp)} - {log.message}
                    </div>
                    {log.data ? (
                      <pre className="mt-1 text-xs text-gray-600 overflow-auto">
                        {typeof log.data === 'string'
                          ? log.data
                          : JSON.stringify(log.data, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-800">調試工具</h4>

            {/* 區域切換控制 */}
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-gray-700">區域切換</h5>
              <div className="space-y-1">
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  當前區域：<span className="font-medium">{currentAreaDisplayName}</span>
                  <br />
                  回報限制：{currentAreaConfig.allowUnlimitedReporting ? '無限制' : '限制範圍內'}
                  <br />
                  地圖邊界：{currentAreaConfig.allowUnlimitedMap ? '無限制' : '有邊界'}
                </div>
                <div className="flex space-x-1">
                  {supportedAreas.map((area) => (
                    <Button
                      key={area.id}
                      variant={currentAreaType === area.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleAreaSwitch(area.id)}
                      className="flex-1 text-xs"
                      disabled={currentAreaType === area.id}
                    >
                      {area.id === 'guangfu' ? '光復鄉' : 'Preview'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-sm font-medium text-gray-700">位置測試</h5>
              <Button
                variant="outline"
                size="sm"
                onClick={testGPSLocation}
                className="w-full text-xs"
              >
                測試 GPS 定位
              </Button>
            </div>

            <div className="space-y-2">
              <h5 className="text-sm font-medium text-gray-700">資料匯出</h5>
              <Button
                variant="outline"
                size="sm"
                onClick={exportDiagnostics}
                className="w-full text-xs"
              >
                匯出診斷報告
              </Button>
            </div>

            <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
              <strong>雙區域模式:</strong>
              <br />• 光復鄉：生產環境，有邊界限制
              <br />• Preview：測試環境，無任何限制
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
