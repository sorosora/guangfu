'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import { useAtom } from 'jotai';
import { currentAreaConfigAtom } from '@/stores/area-store';

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

interface VersionInfo {
  version: string;
  generated_at: string;
  grid_size: {
    width: number;
    height: number;
  };
  tile_size: number;
  bounds: {
    north_west: { lat: number; lon: number };
    north_east: { lat: number; lon: number };
    south_west: { lat: number; lon: number };
    south_east: { lat: number; lon: number };
  };
}

interface OGCVersionInfo {
  version: string;
  timestamp: string;
  iso_datetime: string;
  url: string;
  metadata_url: string;
}

interface OGCVersionsCollection {
  type: string;
  title: string;
  versions: OGCVersionInfo[];
  update_policy: string;
}

interface OGCTilesetMetadata {
  dataType: string;
  crs: string;
  title: string;
  description: string;
  keywords: string[];
  bounds: [number, number, number, number];
  pixel_scale: number;
  ogc_compliance: string;
}

export default function CustomTileLayer({ opacity = 0.7, zIndex = 1000 }: CustomTileLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [tilesBaseUrl, setTilesBaseUrl] = useState<string>('');
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [ogcMetadata, setOgcMetadata] = useState<OGCTilesetMetadata | null>(null);
  const [useOGCFormat, setUseOGCFormat] = useState<boolean>(false);

  // 獲取當前區域配置
  const [currentAreaConfig] = useAtom(currentAreaConfigAtom);

  // 初始化圖磚基礎 URL
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_TILES_BASE_URL;
    if (baseUrl) {
      setTilesBaseUrl(baseUrl);
      console.log('圖磚基礎 URL:', baseUrl);
    } else {
      console.warn('未設定 NEXT_PUBLIC_TILES_BASE_URL 環境變數');
    }
  }, []);

  // 檢查並載入 OGC TMS metadata（包含區域命名空間）
  useEffect(() => {
    if (!tilesBaseUrl || !currentAreaConfig) return;

    const loadOGCMetadata = async () => {
      try {
        console.log(`檢查 ${currentAreaConfig.name} 區域的 OGC TMS metadata...`);
        const response = await fetch(
          `${tilesBaseUrl}/${currentAreaConfig.name}/tilesetmetadata.json?t=${Date.now()}`
        );

        if (response.ok) {
          const metadata = await response.json();
          setOgcMetadata(metadata);
          setUseOGCFormat(true);
          console.log(`${currentAreaConfig.name} 區域：發現 OGC TMS 格式，啟用標準相容模式`);
          return true;
        }
      } catch {
        console.warn(`${currentAreaConfig.name} 區域：未找到 OGC TMS metadata，無法使用圖磚`);
      }

      setUseOGCFormat(false);
      return false;
    };

    loadOGCMetadata();
  }, [tilesBaseUrl, currentAreaConfig]);

  // 載入版本資訊並檢查更新（包含區域命名空間）
  useEffect(() => {
    if (!tilesBaseUrl || !currentAreaConfig) return;

    const checkVersion = async () => {
      try {
        const areaName = currentAreaConfig.name;

        if (useOGCFormat) {
          // 使用 OGC TMS 格式
          console.log(`檢查 ${areaName} 區域的 OGC TMS 版本...`);
          const response = await fetch(
            `${tilesBaseUrl}/${areaName}/versions/versions.json?t=${Date.now()}`
          );

          if (response.ok) {
            const versionsData: OGCVersionsCollection = await response.json();

            if (versionsData.versions && versionsData.versions.length > 0) {
              // 取得最新版本（陣列已按時間戳降序排列，最新在前）
              const latestVersion = versionsData.versions[0];

              if (latestVersion.version !== currentVersion) {
                console.log(
                  `${areaName} 區域 OGC TMS 版本更新: ${currentVersion} -> ${latestVersion.version}`
                );
                setCurrentVersion(latestVersion.version);

                // 載入版本特定的 metadata
                try {
                  const metadataResponse = await fetch(
                    `${tilesBaseUrl}/${areaName}/${latestVersion.version}/metadata.json?t=${Date.now()}`
                  );
                  if (metadataResponse.ok) {
                    const versionMetadata = await metadataResponse.json();
                    setVersionInfo(versionMetadata);
                  }
                } catch (metadataError) {
                  console.warn(`${areaName} 區域載入版本 metadata 失敗:`, metadataError);
                }
              }
            }
          } else {
            console.warn(`${areaName} 區域無法載入 OGC 版本資訊`);
          }
        } else {
          console.warn(`${areaName} 區域：OGC TMS metadata 不存在，無法載入圖磚`);
        }
      } catch (error) {
        console.warn(`${currentAreaConfig.name} 區域載入版本資訊失敗:`, error);
      }
    };

    // 立即檢查一次
    checkVersion();

    // 每 30 秒檢查一次更新
    const interval = setInterval(checkVersion, 30000);

    return () => clearInterval(interval);
  }, [tilesBaseUrl, currentAreaConfig, currentVersion, useOGCFormat]);

  // 建立版本化圖磚圖層
  useEffect(() => {
    if (!map || !currentVersion || !tilesBaseUrl || !currentAreaConfig) {
      console.log('地圖或版本資訊尚未準備好:', {
        map: !!map,
        currentVersion,
        tilesBaseUrl,
        currentAreaConfig: !!currentAreaConfig,
        useOGCFormat,
        hasVersionInfo: !!versionInfo,
        hasOGCMetadata: !!ogcMetadata,
      });
      return;
    }

    // 確保 OGC TMS metadata 已載入
    if (!useOGCFormat || !ogcMetadata) {
      console.log('等待 OGC TMS metadata 載入完成...');
      return;
    }

    console.log(`開始建立 OGC TMS 圖磚圖層...`, currentVersion);

    // 檢查 Leaflet 是否可用
    if (typeof window === 'undefined' || !window.L) {
      console.error('Leaflet 尚未載入完成');
      return;
    }

    // 移除舊圖層
    if (layerRef.current) {
      console.log('layerRef.current', layerRef.current);
      map.removeLayer(layerRef.current);
    }

    // 計算地理邊界（OGC TMS 格式）
    const [minLon, minLat, maxLon, maxLat] = ogcMetadata.bounds;
    const bounds: [[number, number], [number, number]] = [
      [minLat, minLon],
      [maxLat, maxLon],
    ];

    // 建立標準 OGC TMS 圖磚圖層 URL 模板
    const areaName = currentAreaConfig.name;
    const tileUrlTemplate = `${tilesBaseUrl}/${areaName}/{z}/{x}/{y}.png?t=${Date.now()}`;

    // 建立 TileLayer 配置 - 標準 TMS 優化
    const tileLayerOptions: L.TileLayerOptions = {
      opacity: opacity,
      zIndex: zIndex,
      bounds: window.L.latLngBounds(bounds),
      minZoom: 14, // 圖層顯示的最小縮放層級
      maxZoom: 19, // 圖層顯示的最大縮放層級
      minNativeZoom: 14, // 我們圖磚的最小原生縮放層級
      maxNativeZoom: 14, // 我們圖磚的最大原生縮放層級
      tileSize: 256,
      // 標準 TMS 座標系統設定
      tms: false, // 使用標準 TMS (非 OSM TMS)
      // 零星圖磚支援 - 404 錯誤不顯示替代圖磚
      errorTileUrl: '',
    };

    // 建立 TileLayer
    const tileLayer = new window.L.TileLayer(tileUrlTemplate, tileLayerOptions);
    console.log('tileLayer', tileLayer);

    // 零星圖磚錯誤處理 - 靜默處理 404 錯誤
    tileLayer.on('tileerror', (e: L.TileErrorEvent) => {
      // 對於零星圖磚，404 錯誤是正常的（表示該位置沒有資料）
      const error = e.error as Error & { status?: number };
      if (error && error.status === 404) {
        console.debug('零星圖磚：該位置無資料', e.coords);
      } else {
        console.warn('圖磚載入失敗:', e.coords, e.error);
      }
    });

    tileLayer.on('tileload', (e: L.TileEvent) => {
      console.debug('圖磚載入成功:', e.coords);
    });

    // 加入到地圖
    tileLayer.addTo(map);
    layerRef.current = tileLayer;

    console.log(`OGC TMS 圖磚圖層已載入: ${ogcMetadata.title}`);
    console.log(`標準相容性: ${ogcMetadata.ogc_compliance}`);

    // 清理函數
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [
    map,
    currentVersion,
    tilesBaseUrl,
    currentAreaConfig,
    versionInfo,
    ogcMetadata,
    useOGCFormat,
    zIndex,
    opacity,
  ]);

  // 處理透明度變化
  useEffect(() => {
    if (layerRef.current && layerRef.current.setOpacity) {
      layerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

  return null;
}
