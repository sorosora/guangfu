'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Shield, Activity, Layers } from 'lucide-react';

import { LayerVisibility } from '@/types/map';

interface LayerControlPanelProps {
  layers: LayerVisibility;
  onLayerToggle: (layerKey: keyof LayerVisibility, enabled: boolean) => void;
  className?: string;
}

export default function LayerControlPanel({
  layers,
  onLayerToggle,
  className,
}: LayerControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* 觸發按鈕 */}
      <div className={cn('', className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="bg-white shadow-lg hover:bg-gray-50 border-gray-300"
          aria-label="圖層控制"
        >
          <Layers className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">圖層</span>
        </Button>
      </div>

      {/* 背景遮罩 */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/20 z-[1000] cursor-pointer"
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />
      )}

      {/* 底部彈出面板 */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[1001] pointer-events-none',
          'transition-transform duration-300 ease-in-out',
          isExpanded ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 mx-2 mb-2 pointer-events-auto">
          {/* 標題 */}
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">圖層控制</h3>
          </div>

          {/* 圖層開關 */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* 救災資訊 */}
            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={() => onLayerToggle('kmz', !layers.kmz)}
                className={cn(
                  'w-12 h-12 rounded-xl border-2 transition-all duration-200 ease-in-out',
                  'focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
                  layers.kmz
                    ? 'bg-green-600 border-green-600 text-white shadow-lg'
                    : 'bg-white border-gray-300 text-gray-400 hover:border-green-300'
                )}
                aria-label={`${layers.kmz ? '隱藏' : '顯示'}救災資訊圖層`}
              >
                <Shield className="w-6 h-6 mx-auto" />
              </button>
              <span className="text-xs font-medium text-gray-700 text-center">救災資訊</span>
            </div>

            {/* 即時回報 */}
            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={() => onLayerToggle('tiles', !layers.tiles)}
                className={cn(
                  'w-12 h-12 rounded-xl border-2 transition-all duration-200 ease-in-out',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  layers.tiles
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                    : 'bg-white border-gray-300 text-gray-400 hover:border-blue-300'
                )}
                aria-label={`${layers.tiles ? '隱藏' : '顯示'}即時回報圖層`}
              >
                <Activity className="w-6 h-6 mx-auto" />
              </button>
              <span className="text-xs font-medium text-gray-700 text-center">即時回報</span>
            </div>

            {/* 預估區域 */}
            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={() => onLayerToggle('manual', !layers.manual)}
                className={cn(
                  'w-12 h-12 rounded-xl border-2 transition-all duration-200 ease-in-out',
                  'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2',
                  layers.manual
                    ? 'bg-orange-600 border-orange-600 text-white shadow-lg'
                    : 'bg-white border-gray-300 text-gray-400 hover:border-orange-300'
                )}
                aria-label={`${layers.manual ? '隱藏' : '顯示'}調查區域圖層`}
              >
                <Layers className="w-6 h-6 mx-auto" />
              </button>
              <span className="text-xs font-medium text-gray-700 text-center">預估區域</span>
            </div>
          </div>

          {/* Attribution 資訊 */}
          <div className="border-t border-gray-100 pt-3 mb-3">
            <div className="text-xs text-gray-400 text-center">
              <a
                href="https://leafletjs.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600"
              >
                Leaflet
              </a>
              <span> | </span>
              <span>
                ©
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600"
                >
                  OpenStreetMap
                </a>
              </span>
            </div>
          </div>

          {/* 關閉按鈕 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            關閉
          </Button>
        </div>
      </div>
    </>
  );
}
