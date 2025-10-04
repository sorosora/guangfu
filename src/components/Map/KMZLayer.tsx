'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import * as L from 'leaflet';
import type { KMZLayer } from 'leaflet-kmz';

interface KMZLayerProps {
  url: string;
  visible?: boolean;
}

export default function KMZLayer({ url, visible = true }: KMZLayerProps) {
  const map = useMap();
  const kmzLayerRef = useRef<KMZLayer | null>(null);
  const [dependenciesLoaded, setDependenciesLoaded] = useState(false);

  // 動態載入 leaflet-kmz 插件
  useEffect(() => {
    const loadKmzPlugin = async () => {
      if (typeof window === 'undefined') return;

      try {
        // 確保 window.L 可用給 leaflet-kmz 插件
        if (!window.L) {
          (window as typeof window & { L: typeof L }).L = L;
        }

        // 載入 leaflet-kmz - 這個插件會自動註冊到 window.L
        await import('leaflet-kmz');

        // 等待一個 tick 確保插件完全載入
        await new Promise((resolve) => setTimeout(resolve, 0));

        // 檢查插件是否正確註冊到 window.L
        if (typeof (window.L as typeof L & { kmzLayer?: unknown }).kmzLayer === 'function') {
          console.log('leaflet-kmz 插件載入成功');
          setDependenciesLoaded(true);
        } else {
          console.error('leaflet-kmz 插件載入後未在 window.L 對象上找到 kmzLayer 方法');
          console.log('window.L 對象可用的方法:', Object.keys(window.L || {}));
          // 即使失敗也設為 true，避免無限重試
          setDependenciesLoaded(true);
        }
      } catch (error) {
        console.error('載入 KMZ 依賴失敗:', error);
        // 設為 true 避免無限重試
        setDependenciesLoaded(true);
      }
    };

    if (!dependenciesLoaded) {
      loadKmzPlugin();
    }
  }, [dependenciesLoaded]);

  // 載入 KMZ 檔案 - 只在相關依賴變化時重新載入
  useEffect(() => {
    const loadKMZ = async () => {
      if (!dependenciesLoaded || !url) return;

      try {
        // 清理舊的圖層
        if (kmzLayerRef.current) {
          map.removeLayer(kmzLayerRef.current as unknown as L.Layer);
          kmzLayerRef.current = null;
        }

        // 確保 URL 是字串格式
        const kmzUrl = String(url);

        // 檢查 leaflet-kmz 插件是否正確載入
        const leafletWithKmz = window.L as typeof L & {
          kmzLayer?: (options?: Record<string, unknown>) => KMZLayer;
        };
        if (typeof leafletWithKmz.kmzLayer !== 'function') {
          console.warn('leaflet-kmz 插件未正確載入，跳過 KMZ 圖層顯示');
          return;
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
