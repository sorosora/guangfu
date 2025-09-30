'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { LayerVisibility } from '@/types/map';

interface LayerControlPanelProps {
  layers: LayerVisibility;
  onLayerToggle: (layerKey: keyof LayerVisibility, enabled: boolean) => void;
  areaDisplayName: string;
  className?: string;
}

export default function LayerControlPanel({
  layers,
  onLayerToggle,
  areaDisplayName,
  className,
}: LayerControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn('fixed top-4 left-4 z-[1010]', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-white shadow-lg hover:bg-gray-50 border-gray-300"
        aria-label="圖層控制"
      >
        <span className="text-lg">🗂️</span>
        <span className="ml-1 text-sm font-medium">圖層</span>
        <span className="ml-1 text-xs text-gray-500">({areaDisplayName})</span>
      </Button>

      {isExpanded && (
        <div className="mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[180px]">
          <div className="space-y-3">
            {/* 救災資訊 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm">⛑️</span>
                <span className="text-sm font-medium text-gray-700">救災資訊</span>
              </div>
              <button
                onClick={() => onLayerToggle('kmz', !layers.kmz)}
                className={cn(
                  'w-10 h-5 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                  layers.kmz ? 'bg-green-600' : 'bg-gray-300'
                )}
                aria-label={`${layers.kmz ? '隱藏' : '顯示'}救災資訊圖層`}
              >
                <div
                  className={cn(
                    'w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out',
                    layers.kmz ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {/* 即時回報圖磚 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm">📊</span>
                <span className="text-sm font-medium text-gray-700">即時回報</span>
              </div>
              <button
                onClick={() => onLayerToggle('tiles', !layers.tiles)}
                className={cn(
                  'w-10 h-5 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                  layers.tiles ? 'bg-blue-600' : 'bg-gray-300'
                )}
                aria-label={`${layers.tiles ? '隱藏' : '顯示'}即時回報圖層`}
              >
                <div
                  className={cn(
                    'w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out',
                    layers.tiles ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {/* 預估區域 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm">📋</span>
                <span className="text-sm font-medium text-gray-700">預估區域</span>
              </div>
              <button
                onClick={() => onLayerToggle('manual', !layers.manual)}
                className={cn(
                  'w-10 h-5 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                  layers.manual ? 'bg-orange-600' : 'bg-gray-300'
                )}
                aria-label={`${layers.manual ? '隱藏' : '顯示'}調查區域圖層`}
              >
                <div
                  className={cn(
                    'w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out',
                    layers.manual ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="w-full text-xs text-gray-500 hover:text-gray-700"
            >
              收合
            </Button>
          </div>
        </div>
      )}

      {/* 點擊外部關閉 */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
