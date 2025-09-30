'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';

// 擴展 Window 介面以包含 Leaflet
declare global {
  interface Window {
    L: typeof import('leaflet');
  }
}

interface CustomTileLayerProps {
  opacity?: number;
  zIndex?: number;
}

interface TileMetadata {
  version: string;
  generated_at: string;
  grid_size: {
    width: number;
    height: number;
  };
  tile_size: number;
  tile_count: number;
  bounds: {
    north_west: { lat: number; lon: number };
    north_east: { lat: number; lon: number };
    south_west: { lat: number; lon: number };
    south_east: { lat: number; lon: number };
  };
  states: {
    unknown: number;
    clear: number;
    muddy: number;
  };
  colors: {
    unknown: [number, number, number, number];
    clear: [number, number, number, number];
    muddy: [number, number, number, number];
  };
  description: string;
}

export default function CustomTileLayer({ opacity = 0.7, zIndex = 1000 }: CustomTileLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);
  const metadataRef = useRef<TileMetadata | null>(null);
  const [metadataLoaded, setMetadataLoaded] = useState(false);

  // 載入圖磚元資料
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        console.log('開始載入圖磚元資料...');
        const response = await fetch('/tiles/metadata.json');
        if (response.ok) {
          const metadata = await response.json();
          metadataRef.current = metadata;
          setMetadataLoaded(true);
          console.log('自訂圖磚元資料載入成功:', metadata);
        } else {
          console.warn('無法載入圖磚元資料，可能尚未生成圖磚');
          setMetadataLoaded(false);
        }
      } catch (error) {
        console.warn('載入圖磚元資料失敗:', error);
        setMetadataLoaded(false);
      }
    };

    loadMetadata();
  }, []);

  // 建立自訂圖磚圖層
  useEffect(() => {
    if (!map || !metadataLoaded || !metadataRef.current) {
      console.log('地圖或元資料尚未準備好:', {
        map: !!map,
        metadataLoaded,
        metadata: !!metadataRef.current,
      });
      return;
    }

    const metadata = metadataRef.current;
    console.log('開始建立自訂圖磚圖層...');

    // 檢查 Leaflet 是否可用
    if (typeof window === 'undefined' || !window.L) {
      console.error('Leaflet 尚未載入完成');
      return;
    }

    // 建立圖層群組
    const layerGroup = new window.L.LayerGroup();

    // 計算圖磚數量
    const tilesX = Math.ceil(metadata.grid_size.width / metadata.tile_size);
    const tilesY = Math.ceil(metadata.grid_size.height / metadata.tile_size);

    console.log(`載入 ${tilesX} x ${tilesY} 個自訂圖磚`);

    // 計算地理邊界（用於驗證）
    const bounds = window.L.latLngBounds([
      [metadata.bounds.south_west.lat, metadata.bounds.south_west.lon],
      [metadata.bounds.north_east.lat, metadata.bounds.north_east.lon],
    ]);

    console.log('圖磚地理邊界:', bounds.toBBoxString());

    // 為每個圖磚建立 ImageOverlay
    for (let tileY = 0; tileY < tilesY; tileY++) {
      for (let tileX = 0; tileX < tilesX; tileX++) {
        // 計算這個圖磚的地理邊界
        const tileBounds = calculateTileBounds(tileX, tileY, tilesX, tilesY, metadata.bounds);

        // 圖磚檔案 URL
        const tileUrl = `/tiles/tile_${tileX}_${tileY}.png`;

        // 建立 ImageOverlay
        const imageOverlay = new window.L.ImageOverlay(tileUrl, tileBounds, {
          opacity: opacity,
          interactive: false,
          alt: `淤泥狀態圖磚 ${tileX}-${tileY}`,
        });

        // 加入錯誤處理
        imageOverlay.on('error', () => {
          console.warn(`圖磚載入失敗: tile_${tileX}_${tileY}.png`);
        });

        imageOverlay.on('load', () => {
          console.log(`圖磚載入成功: tile_${tileX}_${tileY}.png`);
        });

        // 加入到圖層群組
        layerGroup.addLayer(imageOverlay);
      }
    }

    // 設定 z-index
    layerGroup.setZIndex?.(zIndex);

    // 加入到地圖
    layerGroup.addTo(map);
    layerRef.current = layerGroup;

    console.log('自訂圖磚圖層已載入到地圖');

    // 清理函數
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, metadataLoaded, zIndex, opacity]); // 加入 opacity 作為依賴

  // 處理透明度變化
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.eachLayer((layer: L.Layer & { setOpacity?: (opacity: number) => void }) => {
        if (layer.setOpacity) {
          layer.setOpacity(opacity);
        }
      });
    }
  }, [opacity]);

  return null;
}

/**
 * 計算單個圖磚的地理邊界
 */
function calculateTileBounds(
  tileX: number,
  tileY: number,
  totalTilesX: number,
  totalTilesY: number,
  bounds: TileMetadata['bounds']
): [[number, number], [number, number]] {
  const { north_west, north_east, south_west } = bounds;

  // 計算總的經緯度範圍
  const totalLatRange = north_west.lat - south_west.lat;
  const totalLonRange = north_east.lon - north_west.lon;

  // 計算單個圖磚的經緯度大小
  const tileLatSize = totalLatRange / totalTilesY;
  const tileLonSize = totalLonRange / totalTilesX;

  // 計算這個圖磚的邊界
  const north = north_west.lat - tileY * tileLatSize;
  const south = north_west.lat - (tileY + 1) * tileLatSize;
  const west = north_west.lon + tileX * tileLonSize;
  const east = north_west.lon + (tileX + 1) * tileLonSize;

  return [
    [south, west],
    [north, east],
  ];
}
