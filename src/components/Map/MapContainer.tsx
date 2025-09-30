'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  Marker,
  Circle,
  ScaleControl,
} from 'react-leaflet';
import { Location, LayerVisibility } from '@/types/map';
import { AreaConfig } from '@/config/areas';
import CustomTileLayer from './CustomTileLayer';
import ManualAnnotationLayer from './ManualAnnotationLayer';
import KMZLayer from './KMZLayer';
import 'leaflet/dist/leaflet.css';

// 延遲載入 Leaflet 以避免 SSR 問題
let L: typeof import('leaflet') | null = null;

interface MapProps {
  center?: Location;
  userLocation?: Location;
  lockCenter?: boolean;
  onMapClick?: (location: Location) => void;
  areaConfig: AreaConfig;
  onZoomChange?: (zoom: number, canZoomIn: boolean, canZoomOut: boolean) => void;
  layerVisibility: LayerVisibility;
  className?: string;
}

export interface MapRef {
  zoomIn: () => void;
  zoomOut: () => void;
}

// 地圖控制元件
function MapController({
  center,
  lockCenter,
  userLocation,
}: {
  center?: Location;
  lockCenter?: boolean;
  userLocation?: Location;
}) {
  const map = useMap();

  useEffect(() => {
    if (center && lockCenter && userLocation) {
      // 只有在真實有 GPS 位置時才跟隨
      map.setView([center.lat, center.lon], map.getZoom(), {
        animate: true,
        duration: 0.5,
      });
    }
  }, [center, lockCenter, userLocation, map]);

  useEffect(() => {
    if (lockCenter) {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.touchZoom.disable();
    } else {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoom.enable();
    }
  }, [lockCenter, map]);

  return null;
}

// 地圖邊界控制元件
function MapBoundsController({ areaConfig }: { areaConfig: AreaConfig }) {
  const map = useMap();

  useEffect(() => {
    if (!L || !map) return;

    // 計算新的邊界
    const bounds = L.latLngBounds([
      [areaConfig.bounds.southWest.lat, areaConfig.bounds.southWest.lon],
      [areaConfig.bounds.northEast.lat, areaConfig.bounds.northEast.lon],
    ]);

    // 更新地圖邊界和視圖
    map.setMaxBounds(bounds);
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [areaConfig, map]);

  return null;
}

// 縮放控制元件
function ZoomController({
  onZoomChange,
  mapRef,
}: {
  onZoomChange?: (zoom: number, canZoomIn: boolean, canZoomOut: boolean) => void;
  mapRef: React.MutableRefObject<MapRef | null>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const updateZoomState = () => {
      const currentZoom = map.getZoom();
      const minZoom = map.getMinZoom();
      const maxZoom = map.getMaxZoom();

      const canZoomIn = currentZoom < maxZoom;
      const canZoomOut = currentZoom > minZoom;

      onZoomChange?.(currentZoom, canZoomIn, canZoomOut);
    };

    // 初始化狀態
    updateZoomState();

    // 監聽縮放事件
    map.on('zoomend', updateZoomState);

    // 暴露縮放函數給外部
    mapRef.current = {
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
    };

    return () => {
      map.off('zoomend', updateZoomState);
    };
  }, [map, onZoomChange, mapRef]);

  return null;
}

// 地圖事件處理元件
function MapEventHandler({ onMapClick }: { onMapClick?: (location: Location) => void }) {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lon: e.latlng.lng });
      }
    },
  });

  return null;
}

// 內部位置標記元件
function LocationMarkerInternal({
  position,
  accuracy = 10,
  showAccuracyCircle = true,
}: {
  position: Location;
  accuracy?: number;
  showAccuracyCircle?: boolean;
}) {
  const map = useMap();
  const [isVisible, setIsVisible] = useState(true);
  const [userLocationIcon, setUserLocationIcon] = useState<import('leaflet').Icon | null>(null);

  useEffect(() => {
    // 建立使用者位置的自訂圖示
    if (L && typeof window !== 'undefined') {
      const svgIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/><circle cx="12" cy="12" r="3" fill="#ffffff"/></svg>`;
      const iconDataUrl =
        typeof btoa !== 'undefined'
          ? 'data:image/svg+xml;base64,' + btoa(svgIcon)
          : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgIcon);

      const icon = new L.Icon({
        iconUrl: iconDataUrl,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, 0],
      });
      setUserLocationIcon(icon);
    }
  }, []);

  useEffect(() => {
    if (!map) return;

    // 檢查位置是否在地圖視野內
    const bounds = map.getBounds();
    const isInView = bounds.contains([position.lat, position.lon]);
    setIsVisible(isInView);
  }, [position, map]);

  if (!isVisible || !userLocationIcon) return null;

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

const Map = forwardRef<MapRef, MapProps>(function Map(
  {
    center,
    userLocation,
    lockCenter = false,
    onMapClick,
    areaConfig,
    onZoomChange,
    layerVisibility,
    className = 'w-full h-screen',
  },
  ref
) {
  const leafletMapRef = useRef<import('leaflet').Map | null>(null);
  const mapControlRef = useRef<MapRef | null>(null);

  // 將 ref 轉發到 mapControlRef
  useImperativeHandle(ref, () => ({
    zoomIn: () => mapControlRef.current?.zoomIn(),
    zoomOut: () => mapControlRef.current?.zoomOut(),
  }));

  // 使用動態中心點，如果沒有傳入則使用當前區域配置的中心點
  const mapCenter = center || areaConfig.center;

  // 動態載入 Leaflet
  useEffect(() => {
    // 動態載入 Leaflet
    const loadLeaflet = async () => {
      if (typeof window !== 'undefined' && !L) {
        try {
          const leaflet = await import('leaflet');
          L = leaflet.default;

          // 修復 Leaflet 預設圖示問題
          delete (
            L.Icon.Default.prototype as typeof L.Icon.Default.prototype & { _getIconUrl?: unknown }
          )._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl:
              'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl:
              'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          });
        } catch (error) {
          console.error('載入 Leaflet 失敗:', error);
          // 即使載入失敗，也設定 L 為空物件以避免無限載入
          L = {} as typeof import('leaflet');
        }
      }
    };

    loadLeaflet();
  }, []);

  if (!L || Object.keys(L).length === 0) {
    return (
      <div className={className}>
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-600">載入地圖庫中...</p>
            <p className="text-xs text-gray-500 mt-1">若持續載入請重新整理頁面</p>
          </div>
        </div>
      </div>
    );
  }

  // 計算地圖邊界（使用當前區域配置）
  const bounds = L.latLngBounds([
    [areaConfig.bounds.southWest.lat, areaConfig.bounds.southWest.lon],
    [areaConfig.bounds.northEast.lat, areaConfig.bounds.northEast.lon],
  ]);

  return (
    <MapContainer
      center={[mapCenter.lat, mapCenter.lon]}
      zoom={16}
      style={{ height: '100%', width: '100%' }}
      maxBounds={bounds}
      maxBoundsViscosity={1.0}
      minZoom={14}
      maxZoom={19}
      zoomControl={false}
      className={className}
      ref={leafletMapRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {/* 手動標註區域圖層 */}
      <ManualAnnotationLayer visible={layerVisibility.manual} opacity={0.1} />

      {/* 自訂淤泥狀態圖磚圖層 */}
      {layerVisibility.tiles && <CustomTileLayer opacity={0.7} zIndex={1001} />}

      {/* KMZ 圖層 (Google My Maps) */}
      {process.env.NEXT_PUBLIC_KMZ_BASE_URL && (
        <KMZLayer url={process.env.NEXT_PUBLIC_KMZ_BASE_URL} visible={layerVisibility.kmz} />
      )}

      {/* 地圖控制器 */}
      <MapController center={center} lockCenter={lockCenter} userLocation={userLocation} />

      {/* 地圖邊界控制器 */}
      <MapBoundsController areaConfig={areaConfig} />

      {/* 縮放控制器 */}
      <ZoomController onZoomChange={onZoomChange} mapRef={mapControlRef} />

      {/* 地圖事件處理 */}
      <MapEventHandler onMapClick={onMapClick} />

      {/* 使用者位置標記 */}
      {userLocation && (
        <LocationMarkerInternal position={userLocation} accuracy={10} showAccuracyCircle={true} />
      )}

      {/* 比例尺 */}
      <ScaleControl position="bottomleft" />
    </MapContainer>
  );
});

export default Map;
