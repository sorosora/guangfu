'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import type { KMZLayer } from 'leaflet-kmz';

// 延遲載入 Leaflet 和 leaflet-kmz 以避免 SSR 問題
let L: typeof import('leaflet') | null = null;

interface KMZLayerProps {
  url: string;
  visible?: boolean;
}

export default function KMZLayer({ url, visible = true }: KMZLayerProps) {
  const map = useMap();
  const kmzLayerRef = useRef<KMZLayer | null>(null);
  const [dependenciesLoaded, setDependenciesLoaded] = useState(false);

  // 動態載入依賴
  useEffect(() => {
    const loadDependencies = async () => {
      if (typeof window === 'undefined') return;

      try {
        // 載入 Leaflet
        if (!L) {
          const leaflet = await import('leaflet');
          L = leaflet.default;
        }

        // 載入 leaflet-kmz
        if (!dependenciesLoaded) {
          await import('leaflet-kmz');
          // 確保插件正確註冊到 Leaflet
          if (L && typeof (L as unknown as { kmzLayer?: unknown }).kmzLayer !== 'function') {
            // 如果自動註冊失敗，手動執行
            console.warn('leaflet-kmz 未自動註冊，嘗試手動初始化');
          }
          setDependenciesLoaded(true);
        }
      } catch (error) {
        console.error('載入 KMZ 依賴失敗:', error);
      }
    };

    loadDependencies();
  }, []);

  // 載入 KMZ 檔案 - 只在相關依賴變化時重新載入
  useEffect(() => {
    const loadKMZ = async () => {
      if (!L || !dependenciesLoaded || !url) return;

      try {
        // 清理舊的圖層
        if (kmzLayerRef.current) {
          map.removeLayer(kmzLayerRef.current as unknown as L.Layer);
          kmzLayerRef.current = null;
        }

        // 確保 URL 是字串格式
        const kmzUrl = String(url);

        // 檢查 leaflet-kmz 插件是否正確載入
        const leafletWithKmz = L as unknown as {
          kmzLayer?: (options?: Record<string, unknown>) => KMZLayer;
        };
        if (typeof leafletWithKmz.kmzLayer !== 'function') {
          throw new Error('leaflet-kmz 插件未正確載入');
        }

        // 建立新的 KMZ 圖層
        kmzLayerRef.current = leafletWithKmz.kmzLayer().addTo(map);

        // 監聽載入事件
        kmzLayerRef.current.on('load', () => {
          console.log('KMZ 檔案載入完成:', kmzUrl);
        });

        kmzLayerRef.current.on('error', (e) => {
          console.error('KMZ 載入錯誤:', e);
        });

        kmzLayerRef.current.load(kmzUrl);
      } catch (error) {
        console.error('KMZ 圖層建立失敗:', error);
      }
    };
    loadKMZ();

    // 清理函數 - 只在依賴變化或元件卸載時執行
    return () => {
      if (kmzLayerRef.current) {
        try {
          map.removeLayer(kmzLayerRef.current as unknown as L.Layer);
        } catch (error) {
          console.warn('移除 KMZ 圖層時發生錯誤:', error);
        }
        kmzLayerRef.current = null;
      }
    };
  }, [url, map, dependenciesLoaded]);

  // 處理可見性變化
  useEffect(() => {
    if (!kmzLayerRef.current) return;

    if (visible) {
      if (!map.hasLayer(kmzLayerRef.current as unknown as L.Layer)) {
        map.addLayer(kmzLayerRef.current as unknown as L.Layer);
      }
    } else {
      if (map.hasLayer(kmzLayerRef.current as unknown as L.Layer)) {
        map.removeLayer(kmzLayerRef.current as unknown as L.Layer);
      }
    }
  }, [visible, map]);

  return null;
}
