'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Marker, Circle } from 'react-leaflet';
import * as L from 'leaflet';
import { Location, LayerVisibility } from '@/types/map';
import { AreaConfig, SimpleBounds, getMapBounds } from '@/config/areas';
import CustomTileLayer from './CustomTileLayer';
import ManualAnnotationLayer from './ManualAnnotationLayer';
import KMZLayer from './KMZLayer';
import CenterScaleControl from './CenterScaleControl';
import 'leaflet/dist/leaflet.css';

// 修復 Leaflet 預設圖示問題
delete (L.Icon.Default.prototype as typeof L.Icon.Default.prototype & { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// 工具函數：將 SimpleBounds 轉換為 Leaflet 邊界
function simpleBoundsToLeafletBounds(bounds: SimpleBounds) {
  return L.latLngBounds([
    [bounds.minLat, bounds.minLng], // 西南角
    [bounds.maxLat, bounds.maxLng], // 東北角
  ]);
}

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
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoom.enable();
    } else {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoom.enable();
    }
  }, [lockCenter, map]);

  return null;
}

// 地圖邊界控制元件（支援彈性邊界：回報邊界 vs 地圖可滑動邊界）
function MapBoundsController({ areaConfig }: { areaConfig: AreaConfig }) {
  const map = useMap();

  useEffect(() => {
    if (!L || !map) return;

    // 獲取地圖邊界（考慮無限制地圖和 mapBounds 設定）
    const mapBoundsConfig = getMapBounds(areaConfig);

    if (mapBoundsConfig === null) {
      // 如果允許無限制地圖，清除邊界限制
      map.setMaxBounds(undefined);
      console.log(`${areaConfig.displayName}: 地圖無邊界限制`);
    } else {
      // 使用配置的地圖邊界
      const bounds = simpleBoundsToLeafletBounds(mapBoundsConfig);
      if (!bounds) return;

      map.setMaxBounds(bounds);
      console.log(`${areaConfig.displayName}: 地圖邊界已設定`);
    }

    // 設定初始視圖到區域中心（不論是否有邊界限制）
    const centerBounds = simpleBoundsToLeafletBounds(areaConfig.bounds);
    if (centerBounds) {
      map.fitBounds(centerBounds, { padding: [20, 20] });
    }
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
  const [userLocationIcon, setUserLocationIcon] = useState<L.Icon | null>(null);

  useEffect(() => {
    // 建立使用者位置的自訂圖示
    if (typeof window !== 'undefined') {
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
  const leafletMapRef = useRef<L.Map | null>(null);
  const mapControlRef = useRef<MapRef | null>(null);

  // 將 ref 轉發到 mapControlRef
  useImperativeHandle(ref, () => ({
    zoomIn: () => mapControlRef.current?.zoomIn(),
    zoomOut: () => mapControlRef.current?.zoomOut(),
  }));

  // 使用動態中心點，如果沒有傳入則使用當前區域配置的中心點
  const mapCenter = center || areaConfig.center;

  // 計算初始地圖邊界（使用回報邊界作為預設視圖）
  const bounds = simpleBoundsToLeafletBounds(areaConfig.bounds);

  if (!bounds) {
    console.error('無法計算地圖邊界');
    return <div>地圖載入失敗</div>;
  }

  // 獲取實際的地圖邊界配置（可能是 null、mapBounds 或 bounds）
  const mapBoundsConfig = getMapBounds(areaConfig);

  return (
    <MapContainer
      center={[mapCenter.lat, mapCenter.lon]}
      zoom={17} // 調整為適當的標準縮放層級
      style={{ height: '100%', width: '100%' }}
      maxBounds={
        mapBoundsConfig ? simpleBoundsToLeafletBounds(mapBoundsConfig) || undefined : undefined
      }
      maxBoundsViscosity={mapBoundsConfig ? 1.0 : 0}
      minZoom={14} // 區域概覽
      maxZoom={19} // 最高精度 (~0.6m/pixel)
      zoomControl={false}
      className={className}
      attributionControl={false}
      ref={leafletMapRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://maps.nlsc.gov.tw/">國土測繪中心</a>'
        url="https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}"
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

      {/* 中心比例尺 */}
      <CenterScaleControl />
    </MapContainer>
  );
});

export default Map;
