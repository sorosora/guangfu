'use client';

import { useEffect, useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import { FeatureCollection } from 'geojson';
import * as L from 'leaflet';

interface ManualAnnotationLayerProps {
  visible: boolean;
  opacity?: number;
}

export default function ManualAnnotationLayer({
  visible,
  opacity = 0.6,
}: ManualAnnotationLayerProps) {
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 載入 GeoJSON 資料
  useEffect(() => {
    const loadGeoJsonData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('開始載入手動標註 GeoJSON 資料...');
        const response = await fetch('/data/manual-annotations.geojson');

        if (!response.ok) {
          throw new Error(`無法載入資料: ${response.status}`);
        }

        const data = await response.json();
        setGeoJsonData(data);
        console.log('手動標註資料載入成功:', data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '未知錯誤';
        setError(errorMessage);
        console.warn('手動標註資料載入失敗:', errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (visible) {
      loadGeoJsonData();
    }
  }, [visible]);

  // 如果不可見，不渲染
  if (!visible || !geoJsonData) {
    return null;
  }

  // 載入中或錯誤狀態
  if (loading) {
    console.log('手動標註圖層載入中...');
    return null;
  }

  if (error) {
    console.warn('手動標註圖層載入失敗:', error);
    return null;
  }

  // GeoJSON 樣式設定
  const geoJsonStyle = {
    color: '#ff6b35', // 橘紅色邊框
    weight: 2, // 邊框寬度
    opacity: 1, // 邊框透明度
    fillColor: '#ff6b35', // 填充顏色
    fillOpacity: opacity, // 填充透明度
  };

  // 事件處理
  const onEachFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
    layer.on({
      click: () => {
        const properties = feature.properties || {};

        // 顯示簡單的資訊（可以後續改為 toast 或 modal）
        console.log('點擊調查區域:', properties);

        // 未來可以在這裡加入更詳細的資訊顯示
        if (properties.description) {
          console.log('區域描述:', properties.description);
        }
      },
    });

    layer.on({
      mousedown: () => {
        if ('setStyle' in layer && typeof layer.setStyle === 'function') {
          layer.setStyle({
            weight: 3,
            fillOpacity: Math.min(opacity + 0.2, 0.8),
          });
        }
      },
      mouseup: () => {
        if ('setStyle' in layer && typeof layer.setStyle === 'function') {
          layer.setStyle(geoJsonStyle);
        }
      },
    });
  };

  return <GeoJSON data={geoJsonData} style={geoJsonStyle} onEachFeature={onEachFeature} />;
}
