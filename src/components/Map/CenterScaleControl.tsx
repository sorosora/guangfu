'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import { cn } from '@/lib/utils';

export default function CenterScaleControl() {
  const map = useMap();
  const [isVisible, setIsVisible] = useState(false);
  const [scaleText, setScaleText] = useState('');
  const [scaleWidth, setScaleWidth] = useState(100);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInteracted = useRef(false);
  const isZooming = useRef(false);
  const isMoving = useRef(false);
  const isInitializing = useRef(true);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateScale = useCallback(() => {
    const bounds = map.getBounds();
    const centerLat = bounds.getCenter().lat;

    // 計算比例尺（基於地圖中心點）
    const distance = map.distance([centerLat, bounds.getWest()], [centerLat, bounds.getEast()]);

    const mapWidth = map.getSize().x;
    const meterPerPixel = distance / mapWidth;

    // 計算適當的比例尺長度和文字
    const scales = [
      { meters: 1000, text: '1 km' },
      { meters: 500, text: '500 m' },
      { meters: 200, text: '200 m' },
      { meters: 100, text: '100 m' },
      { meters: 50, text: '50 m' },
      { meters: 20, text: '20 m' },
      { meters: 10, text: '10 m' },
      { meters: 5, text: '5 m' },
      { meters: 2, text: '2 m' },
      { meters: 1, text: '1 m' },
    ];

    const targetPixels = 100; // 目標像素長度
    let bestScale = scales[scales.length - 1];

    for (const scale of scales) {
      const pixels = scale.meters / meterPerPixel;
      if (pixels <= targetPixels && pixels >= 40) {
        bestScale = scale;
        break;
      }
    }

    const finalWidth = bestScale.meters / meterPerPixel;
    setScaleText(bestScale.text);
    setScaleWidth(Math.round(finalWidth));
  }, [map]);

  const showScale = useCallback(() => {
    // 如果正在初始化或還沒有使用者互動，則不顯示
    if (isInitializing.current || !hasInteracted.current) return;

    setIsVisible(true);
    updateScale();

    // 清除之前的計時器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [updateScale]);

  const hideScale = useCallback(() => {
    // 只有在不是縮放或移動狀態時才開始倒計時隱藏
    if (isZooming.current || isMoving.current) return;

    // 清除之前的計時器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 1 秒後隱藏
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 1000);
  }, []);

  useEffect(() => {
    if (!map) return;

    // 設置初始化延遲 - 2秒後才開始響應使用者縮放
    initTimeoutRef.current = setTimeout(() => {
      isInitializing.current = false;
    }, 2000);

    // 縮放事件處理
    const handleZoomStart = () => {
      // 只有在非初始化狀態下才標記為使用者互動
      if (!isInitializing.current) {
        hasInteracted.current = true;
        isZooming.current = true;
        showScale();
      }
    };

    const handleZoom = () => {
      if (isVisible && !isInitializing.current) {
        updateScale();
      }
    };

    const handleZoomEnd = () => {
      if (!isInitializing.current) {
        isZooming.current = false;
        hideScale();
      }
    };

    // 移動事件處理
    const handleMoveStart = () => {
      if (!isInitializing.current) {
        isMoving.current = true;
        // 如果正在顯示比例尺，取消隱藏計時器
        if (isVisible && timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    const handleMoveEnd = () => {
      if (!isInitializing.current) {
        isMoving.current = false;
        // 只有在顯示比例尺時才嘗試隱藏
        if (isVisible) {
          hideScale();
        }
      }
    };

    // 註冊事件監聽器
    map.on('zoomstart', handleZoomStart);
    map.on('zoom', handleZoom);
    map.on('zoomend', handleZoomEnd);
    map.on('movestart', handleMoveStart);
    map.on('moveend', handleMoveEnd);

    return () => {
      // 移除事件監聽器
      map.off('zoomstart', handleZoomStart);
      map.off('zoom', handleZoom);
      map.off('zoomend', handleZoomEnd);
      map.off('movestart', handleMoveStart);
      map.off('moveend', handleMoveEnd);

      // 清理計時器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [map, isVisible, showScale, updateScale, hideScale]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed top-4 left-1/2 transform -translate-x-1/2',
        ' z-[1000] pointer-events-none',
        'transition-opacity duration-300'
      )}
    >
      <div className="flex flex-col items-center space-y-1">
        <div className="flex gap-y-2 flex-col bg-white/10 backdrop-blur-xs border border-gray-300 rounded-lg shadow-lg px-3 py-2">
          <div className="text-xs text-gray-700 font-medium text-center">{scaleText}</div>
          <div
            className="border-b-2 border-l-2 border-r-2 border-black h-2"
            style={{ width: `${scaleWidth}px` }}
          />
        </div>
      </div>
    </div>
  );
}
