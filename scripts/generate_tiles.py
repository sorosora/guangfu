#!/usr/bin/env python3
"""
精準經緯度圖磚生成系統 v4.0
- 每個像素對應一個地理座標點的真實狀態
- 增量更新：讀取現有圖磚 + 更新變動點
- 使用 PNG 壓縮和保存地理狀態資料
"""

import os
import sys
import json
import time
from typing import Dict, List, Tuple, Set, Optional
from io import BytesIO
from datetime import datetime

# 確保能正確導入本地模組
scripts_dir = os.path.dirname(os.path.abspath(__file__))
if scripts_dir not in sys.path:
    sys.path.insert(0, scripts_dir)

from utils.env_config import get_full_config
from utils.coordinate_utils import (
    lat_lon_to_tile_coords, calculate_affected_tiles_from_coords,
    coords_to_key, key_to_coords, lat_lon_to_tile_pixel,
    is_coord_in_tile, tile_to_lat_lon_bounds, TMSConfig
)
from tms_metadata import TMSMetadataGenerator

try:
    from PIL import Image
    import requests
    import boto3
    from botocore.config import Config
    import urllib3
except ImportError as e:
    print(f"錯誤：缺少必要的 Python 套件: {e}")
    print("請執行：pip install pillow requests boto3 urllib3")
    sys.exit(1)

# 配置
TILE_SIZE = TMSConfig.TILE_SIZE  # 256
PRIMARY_ZOOM = TMSConfig.PRIMARY_ZOOM  # 19

# 狀態定義
STATE_CLEAR = 0        # 已清除
STATE_MUDDY = 1        # 有淤泥
STATE_UNDEFINED = -1   # 未回報（透明）

# 調色盤 (RGBA)
COLOR_PALETTE = {
    STATE_CLEAR: (0, 255, 0, 150),      # 綠色，半透明
    STATE_MUDDY: (139, 69, 19, 200),    # 棕色，較不透明
    STATE_UNDEFINED: (0, 0, 0, 0),      # 完全透明
}

# 區域配置
AREA_CONFIGS = {
    'guangfu': {
        'name': 'guangfu',
        'displayName': '花蓮光復鄉',
        'bounds': {
            'minLat': 23.65396,  # 最南點
            'maxLat': 23.68137,  # 最北點
            'minLng': 121.41760, # 最西點
            'maxLng': 121.45657, # 最東點
        },
        'center': {'lat': 23.66767, 'lon': 121.43705},
    },
    'preview': {
        'name': 'preview',
        'displayName': 'Preview 測試區域',
        'bounds': {
            'minLat': 23.0000,   # 台灣測試區域最南點
            'maxLat': 25.0000,   # 台灣測試區域最北點
            'minLng': 120.0000,  # 台灣測試區域最西點
            'maxLng': 122.0000,  # 台灣測試區域最東點
        },
        'center': {'lat': 25.0875, 'lon': 121.4585},
    },
}


class PrecisionTileGenerator:
    """精準經緯度圖磚生成器"""

    def __init__(self, env_config, skip_r2=False):
        self.env_config = env_config
        self._setup_redis()
        self.r2_enabled = True

        # TMS 元數據生成器將在處理每個區域時動態初始化

        if not skip_r2:
            try:
                self._setup_r2()
            except Exception as e:
                print(f"⚠️ R2 設定失敗，將跳過上傳功能: {e}")
                self.r2_enabled = False
        else:
            print("🔧 開發模式：跳過 R2 設定")
            self.r2_enabled = False

        self.stats = {
            'start_time': time.time(),
            'redis_requests': 0,
            'tiles_processed': 0,
            'pixels_updated': 0,
            'bytes_uploaded': 0,
        }

    def _setup_redis(self):
        """設定 Redis 連線"""
        redis_config = self.env_config.get_redis_config()
        self.redis_url = redis_config['url']
        self.redis_token = redis_config['token']

        if not self.redis_url or not self.redis_token:
            raise ValueError("缺少 Redis 環境變數")

        self.redis_headers = {
            'Authorization': f'Bearer {self.redis_token}',
            'Content-Type': 'application/json'
        }
        print("✅ Redis REST API 設定完成")

    def _setup_r2(self):
        """設定 Cloudflare R2 連線"""
        r2_config = self.env_config.get_r2_config()
        access_key = r2_config['access_key_id']
        secret_key = r2_config['secret_access_key']
        self.bucket_name = r2_config['bucket_name']

        if not access_key or not secret_key or not self.bucket_name:
            raise ValueError("缺少 R2 環境變數")

        # 簡化的 R2 連線設定
        config = Config(
            region_name='auto',
            retries={'max_attempts': 2, 'mode': 'standard'},
        )

        self.r2_client = boto3.client(
            's3',
            endpoint_url=r2_config['endpoints'],
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=config
        )

        # 測試連線
        self.r2_client.head_bucket(Bucket=self.bucket_name)
        print("✅ R2 連線成功")

    def _redis_request(self, command: str, *args):
        """執行 Redis REST API 請求"""
        data = [command] + list(args)
        self.stats['redis_requests'] += 1

        try:
            response = requests.post(
                self.redis_url,
                headers=self.redis_headers,
                json=data,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"❌ Redis 請求失敗: {e}")
            return None

    def get_changed_coords(self, area_name: str) -> List[str]:
        """獲取變更座標列表"""
        try:
            result = self._redis_request('SMEMBERS', f'changed_coords:{area_name}')
            if result and 'result' in result:
                return result['result'] if result['result'] else []
            return []
        except Exception as e:
            print(f"❌ 讀取變更座標失敗 ({area_name}): {e}")
            return []

    def read_coord_states(self, area_name: str, coord_keys: List[str]) -> Dict[str, int]:
        """讀取座標狀態"""
        if not coord_keys:
            return {}

        print(f"🔍 讀取 {len(coord_keys)} 個座標狀態 ({area_name})")
        coord_states = {}

        for coord_key in coord_keys:
            try:
                # 從 Redis 讀取座標狀態
                result = self._redis_request('HMGET', f'geo:{area_name}:{coord_key}', 'Score_0', 'Score_1')

                if result and 'result' in result:
                    scores = result['result']
                    if scores and len(scores) >= 2:
                        score_0 = float(scores[0]) if scores[0] else 0.0
                        score_1 = float(scores[1]) if scores[1] else 0.0

                        # 根據信任演算法判斷狀態
                        if score_1 > score_0:
                            coord_states[coord_key] = STATE_MUDDY
                        else:
                            coord_states[coord_key] = STATE_CLEAR
                    else:
                        coord_states[coord_key] = STATE_CLEAR
                else:
                    coord_states[coord_key] = STATE_CLEAR

            except Exception as e:
                print(f"❌ 讀取座標狀態失敗 {coord_key}: {e}")
                coord_states[coord_key] = STATE_CLEAR

        return coord_states

    def download_existing_tile(self, area_name: str, tile_x: int, tile_y: int, zoom: int) -> Optional[bytes]:
        """下載現有圖磚"""
        if not self.r2_enabled:
            return None

        try:
            key = f"{area_name}/{zoom}/{tile_x}/{tile_y}.png"
            response = self.r2_client.get_object(Bucket=self.bucket_name, Key=key)
            print(f"    📥 下載現有圖磚: {key}")
            return response['Body'].read()

        except self.r2_client.exceptions.NoSuchKey:
            print(f"    ℹ️ 圖磚 {key} 不存在，將創建新圖磚")
            return None
        except Exception as e:
            print(f"    ❌ 下載圖磚失敗: {e}")
            return None

    def update_tile_with_coords(self, area_name: str, tile_x: int, tile_y: int, zoom: int,
                              coord_states: Dict[str, int], existing_tile_bytes: Optional[bytes] = None) -> bytes:
        """更新圖磚：載入現有 + 更新變動點"""

        # 獲取圖磚邊界用於調試
        tile_bounds = tile_to_lat_lon_bounds(tile_x, tile_y, zoom)
        print(f"    🔍 圖磚 {tile_x}/{tile_y} 邊界: lat({tile_bounds['minLat']:.6f}, {tile_bounds['maxLat']:.6f}), lng({tile_bounds['minLng']:.6f}, {tile_bounds['maxLng']:.6f})")

        # 建立圖片（從現有圖磚或空白開始）
        if existing_tile_bytes:
            try:
                img = Image.open(BytesIO(existing_tile_bytes)).convert('RGBA')
                print(f"    🔄 基於現有圖磚更新")
            except Exception as e:
                print(f"    ⚠️ 無法載入現有圖磚，創建新圖磚: {e}")
                img = Image.new('RGBA', (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))
        else:
            img = Image.new('RGBA', (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))
            print(f"    🆕 創建新圖磚")

        pixels = img.load()
        pixels_updated = 0
        debug_coords = []

        # 只更新變動的座標點
        for coord_key, state in coord_states.items():
            try:
                lat_str, lon_str = key_to_coords(coord_key)
                lat, lon = float(lat_str), float(lon_str)

                # 檢查座標是否在此圖磚範圍內
                if is_coord_in_tile(lat, lon, tile_x, tile_y, zoom):
                    # 計算精確的像素位置
                    pixel_x, pixel_y = lat_lon_to_tile_pixel(lat, lon, tile_x, tile_y, zoom)

                    # 設定像素顏色
                    color = COLOR_PALETTE.get(state, COLOR_PALETTE[STATE_UNDEFINED])
                    pixels[pixel_x, pixel_y] = color
                    pixels_updated += 1

                    # 收集調試資訊
                    debug_coords.append({
                        'coord': f"({lat}, {lon})",
                        'pixel': f"({pixel_x}, {pixel_y})",
                        'state': state
                    })

            except (ValueError, IndexError) as e:
                print(f"    ❌ 座標處理錯誤 {coord_key}: {e}")
                continue

        # 顯示詳細的座標映射資訊
        if debug_coords:
            print(f"    📊 座標映射詳情:")
            for i, coord_info in enumerate(debug_coords[:5]):  # 只顯示前5個
                print(f"      {i+1}. {coord_info['coord']} -> {coord_info['pixel']} (狀態: {coord_info['state']})")
            if len(debug_coords) > 5:
                print(f"      ... 還有 {len(debug_coords)-5} 個座標")

        # 轉換為 PNG
        png_buffer = BytesIO()
        img.save(png_buffer, format='PNG', optimize=True)
        png_bytes = png_buffer.getvalue()

        print(f"    ✏️ 更新了 {pixels_updated} 個像素，檔案大小 {len(png_bytes)} bytes")
        self.stats['pixels_updated'] += pixels_updated

        return png_bytes

    def upload_tile(self, area_name: str, tile_x: int, tile_y: int, zoom: int, png_bytes: bytes):
        """上傳圖磚到 R2"""
        if not self.r2_enabled:
            return

        try:
            key = f"{area_name}/{zoom}/{tile_x}/{tile_y}.png"

            self.r2_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=png_bytes,
                ContentType='image/png',
                CacheControl='public, max-age=3600'
            )

            self.stats['bytes_uploaded'] += len(png_bytes)
            print(f"    ✅ 上傳成功: {key}")

        except Exception as e:
            print(f"    ❌ 上傳失敗: {e}")
            raise

    def clear_changed_coords(self, area_name: str):
        """清除變更座標標記"""
        try:
            self._redis_request('DEL', f'changed_coords:{area_name}')
            print(f"🧹 變更座標標記已清除 ({area_name})")
        except Exception as e:
            print(f"❌ 清除變更座標標記失敗 ({area_name}): {e}")

    def upload_tms_metadata(self, area_name: str, area_config: dict, affected_tiles: List, coord_states: Dict[str, int]):
        """上傳 OGC TMS 相容的 metadata"""
        if not self.r2_enabled:
            print("🔧 略過 TMS metadata 上傳 (R2 未啟用)")
            return

        try:
            # 轉換區域邊界格式以配合 TMSMetadataGenerator
            area_bounds = {
                'north_west': {'lat': area_config['bounds']['maxLat'], 'lon': area_config['bounds']['minLng']},
                'north_east': {'lat': area_config['bounds']['maxLat'], 'lon': area_config['bounds']['maxLng']},
                'south_west': {'lat': area_config['bounds']['minLat'], 'lon': area_config['bounds']['minLng']},
                'south_east': {'lat': area_config['bounds']['minLat'], 'lon': area_config['bounds']['maxLng']},
            }

            # 為此區域建立專屬的 TMS metadata 生成器
            tms_generator = TMSMetadataGenerator(area_bounds=area_bounds, env_config=self.env_config)

            # 使用時間戳作為版本號（符合 TMS 元數據生成器的預期格式）
            version = str(int(time.time()))

            # 生成版本特定的 metadata
            affected_tiles_list = [{"x": tile[0], "y": tile[1], "z": tile[2]} for tile in affected_tiles]
            version_metadata = tms_generator.generate_version_metadata(
                version, self.stats, affected_tiles_list, coord_states, PRIMARY_ZOOM
            )

            # 上傳版本 metadata
            self.r2_client.put_object(
                Bucket=self.bucket_name,
                Key=f"{area_name}/{version}/metadata.json",
                Body=json.dumps(version_metadata, indent=2, ensure_ascii=False).encode('utf-8'),
                ContentType='application/json',
                CacheControl='public, max-age=3600'
            )

            # 生成並上傳邊界資訊
            existing_tiles = [f"{t[0]}/{t[1]}" for t in affected_tiles]
            bounds_metadata = tms_generator.generate_bounds_metadata(PRIMARY_ZOOM, existing_tiles)

            self.r2_client.put_object(
                Bucket=self.bucket_name,
                Key=f"{area_name}/{version}/bounds/{PRIMARY_ZOOM}.json",
                Body=json.dumps(bounds_metadata, indent=2, ensure_ascii=False).encode('utf-8'),
                ContentType='application/json',
                CacheControl='public, max-age=3600'
            )

            # 更新區域特定的 tilesetmetadata.json
            tilesetmetadata = tms_generator.generate_tilesetmetadata()
            # 更新 zoom 層級設定
            tilesetmetadata['minzoom'] = PRIMARY_ZOOM
            tilesetmetadata['maxzoom'] = PRIMARY_ZOOM

            self.r2_client.put_object(
                Bucket=self.bucket_name,
                Key=f"{area_name}/tilesetmetadata.json",
                Body=json.dumps(tilesetmetadata, indent=2, ensure_ascii=False).encode('utf-8'),
                ContentType='application/json',
                CacheControl='no-cache'
            )

            # 收集現有版本並生成 versions.json
            existing_versions = tms_generator.collect_existing_versions(
                self.r2_client, self.bucket_name, area_name
            )

            # 確保當前版本包含在列表中
            if version not in existing_versions:
                existing_versions.insert(0, version)
                existing_versions.sort(key=int, reverse=True)

            # 生成並上傳 OGC versions.json
            versions_metadata = tms_generator.generate_versions_metadata(existing_versions)

            self.r2_client.put_object(
                Bucket=self.bucket_name,
                Key=f"{area_name}/versions/versions.json",
                Body=json.dumps(versions_metadata, indent=2, ensure_ascii=False).encode('utf-8'),
                ContentType='application/json',
                CacheControl='no-cache'
            )

            print(f"📄 TMS metadata 上傳成功: {area_name}/{version}")
            print(f"📦 版本列表已更新: {len(existing_versions)} 個版本")

        except Exception as e:
            print(f"❌ 上傳 TMS metadata 失敗: {e}")
            raise

    def process_area(self, area_config: dict):
        """處理單一區域的圖磚生成"""
        area_name = area_config['name']
        print(f"\n🚀 === 處理區域: {area_config['displayName']} ({area_name}) ===")

        # 1. 獲取變更座標
        changed_coords = self.get_changed_coords(area_name)
        if not changed_coords:
            print(f"ℹ️ {area_name} 沒有座標變更，跳過圖磚生成")
            return {
                'success': True,
                'area_name': area_name,
                'coords_changed': 0,
                'tiles_processed': 0
            }

        print(f"📍 發現 {len(changed_coords)} 個變更座標")

        # 2. 計算受影響的圖磚
        coords_list = []
        for coord_key in changed_coords:
            try:
                lat_str, lon_str = key_to_coords(coord_key)
                coords_list.append((lat_str, lon_str))
            except ValueError:
                continue

        affected_tiles = calculate_affected_tiles_from_coords(
            coords_list, area_config['bounds'], PRIMARY_ZOOM
        )
        print(f"🎯 需要更新 {len(affected_tiles)} 個圖磚 (zoom={PRIMARY_ZOOM})")

        if not affected_tiles:
            print("ℹ️ 沒有圖磚需要更新")
            return {'success': False, 'reason': 'no_tiles_to_update'}

        # 3. 讀取座標狀態
        coord_states = self.read_coord_states(area_name, changed_coords)

        # 4. 處理每個受影響的圖磚
        tiles_processed = 0
        for tile_x, tile_y, tile_z in affected_tiles:
            try:
                print(f"🎨 處理圖磚: {tile_z}/{tile_x}/{tile_y}")

                # 下載現有圖磚（如果存在）
                existing_tile_bytes = self.download_existing_tile(area_name, tile_x, tile_y, tile_z)

                # 更新圖磚：載入現有 + 更新變動點
                png_bytes = self.update_tile_with_coords(
                    area_name, tile_x, tile_y, tile_z, coord_states, existing_tile_bytes
                )

                # 上傳更新後的圖磚
                if png_bytes:
                    self.upload_tile(area_name, tile_x, tile_y, tile_z, png_bytes)
                    tiles_processed += 1

            except Exception as e:
                print(f"❌ 處理圖磚失敗 {tile_z}/{tile_x}/{tile_y}: {e}")
                continue

        # 5. 上傳 TMS 元數據
        if tiles_processed > 0:
            self.upload_tms_metadata(area_name, area_config, list(affected_tiles), coord_states)

        # 6. 清除變更標記
        self.clear_changed_coords(area_name)

        self.stats['tiles_processed'] += tiles_processed

        return {
            'success': True,
            'area_name': area_name,
            'coords_changed': len(changed_coords),
            'tiles_processed': tiles_processed
        }

    def generate_tiles(self):
        """主要入口：生成所有啟用區域的圖磚"""
        print("🚀 === 精準經緯度圖磚生成 v4.0 ===")
        print(f"⏰ 開始時間: {time.strftime('%Y-%m-%d %H:%M:%S')}")

        # 獲取啟用的區域列表
        enabled_areas = self.env_config.get_tile_generation_areas()
        print(f"🌍 啟用區域: {enabled_areas}")

        results = []
        for area_name in enabled_areas:
            if area_name in AREA_CONFIGS:
                result = self.process_area(AREA_CONFIGS[area_name])
                if result:
                    results.append(result)
            else:
                print(f"⚠️ 未知區域: {area_name}，跳過")

        # 最終統計
        duration = time.time() - self.stats['start_time']
        print(f"\n🎉 === 圖磚生成完成 ===")
        print(f"⏱️ 總執行時間: {duration:.2f} 秒")
        print(f"📊 統計：")
        print(f"  - Redis 請求: {self.stats['redis_requests']}")
        print(f"  - 圖磚處理: {self.stats['tiles_processed']}")
        print(f"  - 像素更新: {self.stats['pixels_updated']}")
        print(f"  - 上傳大小: {self.stats['bytes_uploaded']:,} bytes")

        successful_areas = [r for r in results if r.get('success')]
        print(f"✅ 成功處理區域: {len(successful_areas)}")

        for result in successful_areas:
            print(f"  - {result['area_name']}: {result['coords_changed']} 座標變更, {result['tiles_processed']} 圖磚")


def main():
    """主程式"""
    try:
        # 初始化環境配置
        env_config = get_full_config()

        # 建立圖磚生成器
        generator = PrecisionTileGenerator(env_config)
        generator.generate_tiles()

    except Exception as e:
        print(f"❌ 圖磚生成失敗: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
