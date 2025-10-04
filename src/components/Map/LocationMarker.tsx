'use client';

import { useEffect, useState } from 'react';
import { Marker, Circle, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import { Location } from '@/types/map';

interface LocationMarkerProps {
  position: Location;
  accuracy?: number;
  showAccuracyCircle?: boolean;
}

// 使用者位置圖示快取
let userLocationIcon: L.Icon | null = null;

export default function LocationMarker({
  position,
  accuracy = 10,
  showAccuracyCircle = true,
}: LocationMarkerProps) {
  const map = useMap();
  const [isVisible, setIsVisible] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // 建立使用者位置的自訂圖示
    if (typeof window !== 'undefined' && !userLocationIcon) {
      const svgIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/><circle cx="12" cy="12" r="3" fill="#ffffff"/></svg>`;
      const iconDataUrl =
        typeof window !== 'undefined' && typeof btoa !== 'undefined'
          ? 'data:image/svg+xml;base64,' + btoa(svgIcon)
          : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgIcon);

      userLocationIcon = new L.Icon({
        iconUrl: iconDataUrl,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, 0],
      });
    }
  }, []);

  useEffect(() => {
    if (!isClient || !map) return;

    // 檢查位置是否在地圖視野內
    const bounds = map.getBounds();
    const isInView = bounds.contains([position.lat, position.lon]);
    setIsVisible(isInView);
  }, [position, map, isClient]);

  // 等待客戶端渲染和圖示載入
  if (!isClient || !isVisible || !userLocationIcon) return null;

  return (
    <>
      {/* 精度圈 */}
      {showAccuracyCircle && (
        <Circle
          center={[position.lat, position.lon]}
          radius={accuracy}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 2,
          }}
        />
      )}

      {/* 位置標記 */}
      <Marker position={[position.lat, position.lon]} icon={userLocationIcon} />
    </>
  );
}
