#!/usr/bin/env python3
"""
OGC TMS 相容的智慧增量圖磚生成系統 v3.0
採用零星圖磚策略和 R2 內部複製優化
符合開放地理空間聯盟 (OGC) 標準
專為 GitHub Actions 2000分鐘預算設計
"""

import os
import sys
import json
import time
import base64
import ssl
from typing import Dict, List, Tuple, Set, Optional
from pathlib import Path
from io import BytesIO
from datetime import datetime

# 引入 TMS metadata 生成器
# 引入環境變數管理模組和座標轉換工具
import sys
# 確保能在 GitHub Actions 和本地環境中正確導入
scripts_dir = os.path.dirname(os.path.abspath(__file__))
if scripts_dir not in sys.path:
    sys.path.insert(0, scripts_dir)

from tms_metadata import TMSMetadataGenerator
from utils.env_config import get_full_config
from utils.coordinate_utils import (
    lat_lon_to_tile_coords, calculate_affected_tiles_from_coords,
    coords_to_key, key_to_coords, is_within_simple_bounds,
    get_geo_radius_coords, format_coords_4decimal, TMSConfig
)

try:
    import numpy as np
    from PIL import Image
    import requests
    import boto3
    from botocore.config import Config
    import urllib3
    import redis
    import json
except ImportError as e:
    print(f"錯誤：缺少必要的 Python 套件: {e}")
    print("請執行：pip install pillow numpy requests boto3 urllib3 redis")
    sys.exit(1)

# 配置 - 使用標準 TMS 配置
TILE_SIZE = TMSConfig.TILE_SIZE  # 256
PRIMARY_ZOOM = TMSConfig.PRIMARY_ZOOM  # 19

# 舊版網格配置 (保留向後相容，逐步移除)
GRID_WIDTH = 800  # 將移除
GRID_HEIGHT = 600  # 將移除

# 狀態定義
STATE_CLEAR = 0        # 已清除
STATE_MUDDY = 1        # 有淤泥
STATE_UNDEFINED = -1   # 未回報（透明）

# 調色盤 (RGBA)
COLOR_PALETTE = {
    STATE_CLEAR: (0, 255, 0, 120),      # 綠色，較透明
    STATE_MUDDY: (139, 69, 19, 180),    # 棕色，較不透明
    STATE_UNDEFINED: (0, 0, 0, 0),      # 完全透明
}

# 區域配置
AREA_CONFIGS = {
    'guangfu': {
        'name': 'guangfu',
        'displayName': '花蓮光復鄉',
        'bounds': {
            # 標準邊界格式（用於圖磚生成）
            'minLat': 23.65396,  # 最南點
            'maxLat': 23.68137,  # 最北點
            'minLng': 121.41760, # 最西點
            'maxLng': 121.45657, # 最東點
            # 保留原始四角格式（供參考）
            'north_west': {'lat': 23.68137, 'lon': 121.41771},
            'north_east': {'lat': 23.68108, 'lon': 121.45639},
            'south_west': {'lat': 23.65397, 'lon': 121.41760},
            'south_east': {'lat': 23.65396, 'lon': 121.45657},
        },
        'center': {'lat': 23.66767, 'lon': 121.43705},
        'gridSize': {'width': 800, 'height': 600},
        'gridPrecision': 5
    },
    'preview': {
        'name': 'preview',
        'displayName': 'Preview 測試區域',
        'bounds': {
            # 標準邊界格式（根據實際座標資料調整）
            'minLat': 25.0860,   # 台北測試區域最南點
            'maxLat': 25.0890,   # 台北測試區域最北點
            'minLng': 121.4570,  # 台北測試區域最西點
            'maxLng': 121.4600,  # 台北測試區域最東點
            # 保留原始四角格式（供參考）
            'north_west': {'lat': 25.0890, 'lon': 121.4570},
            'north_east': {'lat': 25.0890, 'lon': 121.4600},
            'south_west': {'lat': 25.0860, 'lon': 121.4570},
            'south_east': {'lat': 25.0860, 'lon': 121.4600},
        },
        'center': {'lat': 25.0875, 'lon': 121.4585},
        'gridSize': {'width': 800, 'height': 600},
        'gridPrecision': 5
    },
}


def get_redis_connection(env_config):
    """建立 Redis 連接"""
    try:
        redis_config = env_config.get_redis_config()
        
        if not redis_config['url'] or not redis_config['token']:
            print("⚠️ Redis 環境變數未設定，無法載入測試區域")
            return None

        # 使用 REST API 方式連接 Upstash Redis
        return redis_config
    except Exception as e:
        print(f"⚠️ Redis 連接失敗: {e}")
        return None

def fetch_test_areas_from_redis(env_config):
    """從 Redis 獲取所有測試區域"""
    redis_config = get_redis_connection(env_config)
    if not redis_config:
        return {}

    try:
        # 使用 HTTP 請求來訪問 Upstash Redis REST API
        headers = {
            'Authorization': f'Bearer {redis_config["token"]}',
            'Content-Type': 'application/json'
        }

        # 獲取測試區域清單
        list_response = requests.post(
            f'{redis_config["url"]}/smembers/test_areas:list',
            headers=headers,
            timeout=10
        )

        if list_response.status_code != 200:
            print(f"⚠️ 無法獲取測試區域清單: {list_response.status_code}")
            return {}

        area_ids = list_response.json().get('result', [])
        print(f"📋 找到 {len(area_ids)} 個測試區域")

        test_areas = {}

        for area_id in area_ids:
            print(f"🔍 嘗試載入測試區域: {area_id}")
            try:
                # 獲取測試區域詳細資料
                area_response = requests.post(
                    f'{redis_config["url"]}/get/test_areas:{area_id}',
                    headers=headers,
                    timeout=10
                )

                print(f"    HTTP 狀態: {area_response.status_code}")
                if area_response.status_code != 200:
                    print(f"    錯誤回應: {area_response.text}")
                if area_response.status_code == 200:
                    area_data_str = area_response.json().get('result', '')
                    print(f"    🔍 區域 {area_id} 原始資料: {area_data_str}")
                    if area_data_str:
                        # 解碼 Base64 然後解析 JSON
                        decoded_str = base64.b64decode(area_data_str).decode('utf-8')
                        area_data = json.loads(decoded_str)
                        print(f"    🔍 區域 {area_id} 解析後資料: {area_data}")
                        bounds = area_data.get('bounds', {})
                        center = area_data.get('center', {})

                        test_areas[area_id] = {
                            'name': area_id,
                            'displayName': area_data.get('displayName', f'測試區域 {area_id}'),
                            'bounds': {
                                'north_west': bounds.get('northWest', {}),
                                'north_east': bounds.get('northEast', {}),
                                'south_west': bounds.get('southWest', {}),
                                'south_east': bounds.get('southEast', {}),
                            },
                            'center': center,
                            'gridSize': {'width': 800, 'height': 600},
                            'gridPrecision': 5
                        }
                        print(f"✅ 載入測試區域: {area_data.get('displayName')}")

            except Exception as e:
                print(f"⚠️ 載入測試區域 {area_id} 失敗: {e}")
                import traceback
                traceback.print_exc()
                continue

        return test_areas

    except Exception as e:
        print(f"⚠️ 從 Redis 獲取測試區域失敗: {e}")
        return {}

def get_enabled_areas(env_config):
    """獲取啟用的區域列表"""
    enabled_areas = env_config.get_tile_generation_areas()
    
    print(f"🌍 環境變數指定的區域: {enabled_areas}")

    # 如果包含測試區域關鍵字，從 Redis 載入所有測試區域
    if any(area in ['test', 'all_test_areas'] or area.startswith('test_') for area in enabled_areas):
        print("🔍 偵測到測試區域需求，正在從 Redis 載入...")
        test_areas = fetch_test_areas_from_redis(env_config)

        # 移除佔位符
        enabled_areas = [area for area in enabled_areas if area not in ['test', 'all_test_areas']]

        # 添加所有測試區域到配置
        for area_id, area_config in test_areas.items():
            AREA_CONFIGS[area_id] = area_config
            enabled_areas.append(area_id)
            print(f"🔧 載入測試區域配置: {area_id} -> {area_config.get('displayName', 'Unknown')}")

    # 驗證區域配置
    valid_areas = []
    for area_name in enabled_areas:
        if area_name not in AREA_CONFIGS:
            print(f"⚠️ 未知區域: {area_name}，跳過")
            continue

        area_config = AREA_CONFIGS[area_name].copy()


        valid_areas.append(area_config)

    if not valid_areas:
        print("⚠️ 沒有有效的區域配置，使用預設光復鄉配置")
        return [AREA_CONFIGS['guangfu']]

    print(f"✅ 最終啟用的區域: {[area['name'] for area in valid_areas]}")
    return valid_areas

class IntelligentTileGenerator:
    def __init__(self, env_config, skip_r2=False):
        """初始化 OGC TMS 相容的智慧圖磚生成器"""
        self.env_config = env_config
        self._setup_redis()
        self.r2_enabled = True
        self.tms_generator = TMSMetadataGenerator(env_config=self.env_config)

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
            'tiles_copied': 0,
            'tiles_downloaded': 0,
            'tiles_uploaded': 0,
            'upload_errors': 0,
            'bytes_uploaded': 0,
            'generation_mode': 'intelligent_incremental'
        }

    def _setup_redis(self):
        """設定 Redis 連線"""
        redis_config = self.env_config.get_redis_config()
        self.redis_url = redis_config['url']
        self.redis_token = redis_config['token']

        if not self.redis_url or not self.redis_token:
            raise ValueError("缺少 Redis 環境變數: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN")

        self.redis_headers = {
            'Authorization': f'Bearer {self.redis_token}',
            'Content-Type': 'application/json'
        }
        print("✅ Redis REST API 設定完成")

    def _setup_r2(self):
        """設定 Cloudflare R2 連線 - 多重策略修復版"""
        r2_config = self.env_config.get_r2_config()
        access_key = r2_config['access_key_id']
        secret_key = r2_config['secret_access_key']
        self.bucket_name = r2_config['bucket_name']

        if not access_key or not secret_key or not self.bucket_name:
            raise ValueError("缺少 R2 環境變數: CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME")

        account_id = "d066b2cc1ddbd5e0b3c6e7772a35a93a"

        # 檢查環境變數中的替代端點
        env_endpoint = r2_config['endpoints']
        print(f"🔍 環境變數端點: {env_endpoint}")

        # 多重端點和配置策略
        connection_strategies = [
            {
                "name": "環境變數端點 (標準)",
                "endpoint": env_endpoint if env_endpoint else f"https://{account_id}.r2.cloudflarestorage.com",
                "region": "auto",
                "verify": True,
                "ssl_fix": False
            },
            {
                "name": "環境變數端點 (禁用SSL)",
                "endpoint": env_endpoint if env_endpoint else f"https://{account_id}.r2.cloudflarestorage.com",
                "region": "auto",
                "verify": False,
                "ssl_fix": False
            },
            {
                "name": "官方標準配置",
                "endpoint": f"https://{account_id}.r2.cloudflarestorage.com",
                "region": "auto",
                "verify": True,
                "ssl_fix": False
            },
            {
                "name": "指定區域配置 (東亞)",
                "endpoint": f"https://{account_id}.r2.cloudflarestorage.com",
                "region": "apac",
                "verify": True,
                "ssl_fix": False
            },
            {
                "name": "指定區域配置 (西北美)",
                "endpoint": f"https://{account_id}.r2.cloudflarestorage.com",
                "region": "wnam",
                "verify": True,
                "ssl_fix": False
            },
            {
                "name": "儲存桶子網域",
                "endpoint": f"https://{self.bucket_name}.{account_id}.r2.cloudflarestorage.com",
                "region": "auto",
                "verify": True,
                "ssl_fix": False
            },
            {
                "name": "簡化端點",
                "endpoint": "https://r2.cloudflarestorage.com",
                "region": "auto",
                "verify": True,
                "ssl_fix": False
            },
            {
                "name": "SSL 上下文修復",
                "endpoint": f"https://{account_id}.r2.cloudflarestorage.com",
                "region": "auto",
                "verify": True,
                "ssl_fix": True
            },
            {
                "name": "最後嘗試 (禁用SSL)",
                "endpoint": f"https://{account_id}.r2.cloudflarestorage.com",
                "region": "auto",
                "verify": False,
                "ssl_fix": False
            }
        ]

        for strategy in connection_strategies:
            try:
                print(f"🔗 嘗試策略: {strategy['name']}")
                print(f"   端點: {strategy['endpoint']}")
                print(f"   區域: {strategy['region']}, SSL驗證: {strategy['verify']}")

                # SSL 修復 - 處理 certifi 2025.04.26 問題
                if strategy['ssl_fix']:
                    import ssl
                    # 全局 SSL 上下文修復 (基於研究結果)
                    try:
                        original_create_context = ssl._create_default_https_context
                        ssl._create_default_https_context = ssl._create_unverified_context
                        print("   🔧 套用全局 SSL 上下文修復")
                    except AttributeError:
                        # 建立自訂 SSL 上下文
                        ssl_context = ssl.create_default_context()
                        ssl_context.check_hostname = False
                        ssl_context.verify_mode = ssl.CERT_NONE
                        print("   🔧 套用自訂 SSL 上下文修復")

                # 配置 boto3
                config = Config(
                    signature_version='v4',
                    region_name=strategy['region'],
                    retries={'max_attempts': 2, 'mode': 'standard'},
                    max_pool_connections=5,
                    connect_timeout=10,
                    read_timeout=10
                )

                # 創建客戶端參數
                client_params = {
                    'service_name': 's3',
                    'endpoint_url': strategy['endpoint'],
                    'aws_access_key_id': access_key,
                    'aws_secret_access_key': secret_key,
                    'config': config
                }

                if not strategy['verify']:
                    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
                    self.r2_client = boto3.client(
                        's3',
                        endpoint_url=strategy['endpoint'],
                        aws_access_key_id=access_key,
                        aws_secret_access_key=secret_key,
                        config=config,
                        verify=False
                    )
                else:
                    self.r2_client = boto3.client(
                        's3',
                        endpoint_url=strategy['endpoint'],
                        aws_access_key_id=access_key,
                        aws_secret_access_key=secret_key,
                        config=config
                    )

                # 測試連線
                print("   🧪 測試連線...")
                response = self.r2_client.head_bucket(Bucket=self.bucket_name)
                print(f"✅ R2 連線成功！使用策略: {strategy['name']}")
                print(f"   儲存桶狀態: {response.get('ResponseMetadata', {}).get('HTTPStatusCode', 'N/A')}")
                return

            except Exception as e:
                error_msg = str(e)
                print(f"❌ 策略失敗: {strategy['name']}")
                print(f"   錯誤: {error_msg[:150]}...")

                # 記錄特定錯誤類型
                if "SSL" in error_msg or "HANDSHAKE" in error_msg:
                    print("   🔍 檢測到 SSL 相關錯誤")
                elif "CERTIFICATE" in error_msg:
                    print("   🔍 檢測到憑證相關錯誤")
                elif "403" in error_msg or "Forbidden" in error_msg:
                    print("   🔍 檢測到權限相關錯誤")

                continue

        # 所有策略都失敗
        raise Exception(f"❌ 所有 R2 連線策略都失敗，無法連接到 {account_id}.r2.cloudflarestorage.com")

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
        """獲取變更座標 - 基於 4 decimal lat/lng 座標"""
        try:
            result = self._redis_request('SMEMBERS', f'changed_coords:{area_name}')
            if result and 'result' in result:
                return result['result'] if result['result'] else []
            return []
        except Exception as e:
            print(f"❌ 讀取變更座標失敗 ({area_name}): {e}")
            return []
    
    def get_changed_grids(self, area_name: str) -> List[str]:
        """獲取變更網格 - 向後相容版本，將逐步移除"""
        print("⚠️ 警告：使用舊版網格格式，建議遷移到新的座標格式")
        return self.get_changed_coords(area_name)

    def read_changed_coords_states(self, area_name: str, changed_coord_keys: List[str]) -> Dict[str, int]:
        """讀取變更座標的狀態 - 基於 4 decimal lat/lng 座標"""
        if not changed_coord_keys:
            return {}

        print(f"🔍 讀取 {len(changed_coord_keys)} 個變更座標狀態 ({area_name})")
        coord_states = {}
        
        # 除錯：顯示前幾個座標 key
        if changed_coord_keys:
            print(f"🔍 前 3 個座標 key: {changed_coord_keys[:3]}")

        for coord_key in changed_coord_keys:
            try:
                # 從 Redis 讀取座標狀態，使用 geo: 前綴
                states_result = self._redis_request('HMGET', f'geo:{area_name}:{coord_key}', 'Score_0', 'Score_1')
                
                if states_result and 'result' in states_result:
                    scores = states_result['result']
                    if scores and len(scores) >= 2:
                        score_0 = float(scores[0]) if scores[0] else 0.0
                        score_1 = float(scores[1]) if scores[1] else 0.0
                        
                        # 根據信任演算法判斷狀態
                        if score_1 > score_0:
                            coord_states[coord_key] = STATE_MUDDY
                        else:
                            coord_states[coord_key] = STATE_CLEAR
                    else:
                        coord_states[coord_key] = STATE_CLEAR  # 預設為已清除
                else:
                    coord_states[coord_key] = STATE_CLEAR
                    
            except Exception as e:
                print(f"❌ 讀取座標狀態失敗 {coord_key}: {e}")
                coord_states[coord_key] = STATE_CLEAR

        return coord_states
    
    def read_changed_grids_states(self, area_name: str, changed_grid_ids: List[str]) -> Dict[str, int]:
        """讀取變更網格狀態 - 向後相容版本，將逐步移除"""
        print("⚠️ 警告：使用舊版網格狀態讀取，建議遷移到新的座標格式")
        return self.read_changed_coords_states(area_name, changed_grid_ids)
        
        # 原始程式碼保留供參考
        if not changed_grid_ids:
            return {}

        print(f"🔍 只讀取 {len(changed_grid_ids)} 個變更網格 ({area_name})")
        grid_states = {}

        for grid_id in changed_grid_ids:
            try:
                result = self._redis_request('HGET', f'grid:{area_name}:{grid_id}', 'finalState')
                if result and 'result' in result and result['result'] is not None:
                    grid_states[grid_id] = int(result['result'])
                else:
                    grid_states[grid_id] = STATE_UNDEFINED

            except Exception as e:
                print(f"⚠️ 讀取 {grid_id} 失敗: {e}")
                grid_states[grid_id] = STATE_UNDEFINED

        # 統計
        clear_count = sum(1 for s in grid_states.values() if s == STATE_CLEAR)
        muddy_count = sum(1 for s in grid_states.values() if s == STATE_MUDDY)
        undefined_count = len(grid_states) - clear_count - muddy_count

        print(f"📊 變更狀態: {clear_count} 已清除, {muddy_count} 有淤泥, {undefined_count} 未定義")
        return grid_states

    def get_existing_tiles(self, previous_version: Optional[str] = None) -> List[str]:
        """獲取現有圖磚列表 - 零星圖磚策略的基礎"""
        if not self.r2_enabled or not previous_version:
            return []

        try:
            print(f"🔍 查詢版本 {previous_version} 的現有圖磚...")

            # 列出指定版本的所有圖磚
            paginator = self.r2_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=self.bucket_name,
                Prefix=f"{previous_version}/0/",
                Delimiter=""
            )

            existing_tiles = []
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        # 解析圖磚座標: version/0/x/y.png
                        key_parts = obj['Key'].split('/')
                        if len(key_parts) == 4 and key_parts[3].endswith('.png'):
                            tile_x, tile_y = key_parts[2], key_parts[3][:-4]
                            existing_tiles.append(f"{tile_x}/{tile_y}")

            print(f"✅ 發現 {len(existing_tiles)} 個現有圖磚")
            return existing_tiles

        except Exception as e:
            print(f"❌ 查詢現有圖磚失敗: {e}")
            return []

    def copy_unchanged_tiles(self, existing_tiles: List[str], affected_tiles: Set[Tuple[int, int]],
                           old_version: str, new_version: str) -> int:
        """使用 R2 內部複製功能複製未變更的圖磚"""
        if not self.r2_enabled:
            return 0

        affected_tile_strings = {f"{x}/{y}" for x, y in affected_tiles}
        unchanged_tiles = [tile for tile in existing_tiles if tile not in affected_tile_strings]

        if not unchanged_tiles:
            print("ℹ️ 沒有未變更的圖磚需要複製")
            return 0

        print(f"📋 複製 {len(unchanged_tiles)} 個未變更圖磚...")
        copied_count = 0

        for tile in unchanged_tiles:
            try:
                old_key = f"{old_version}/0/{tile}.png"
                new_key = f"{new_version}/0/{tile}.png"

                # R2 內部複製 - 無需下載
                self.r2_client.copy_object(
                    CopySource={'Bucket': self.bucket_name, 'Key': old_key},
                    Bucket=self.bucket_name,
                    Key=new_key,
                    MetadataDirective='COPY'
                )

                copied_count += 1
                self.stats['tiles_copied'] += 1

                if copied_count % 10 == 0:
                    print(f"    📁 已複製 {copied_count}/{len(unchanged_tiles)} 個圖磚...")

            except Exception as e:
                print(f"❌ 複製圖磚 {tile} 失敗: {e}")
                continue

        print(f"✅ 成功複製 {copied_count} 個未變更圖磚")
        return copied_count

    def download_existing_tile(self, tile_x: int, tile_y: int, version: str) -> Optional[bytes]:
        """下載現有圖磚用於增量更新"""
        if not self.r2_enabled:
            return None

        try:
            key = f"{version}/0/{tile_x}/{tile_y}.png"
            response = self.r2_client.get_object(Bucket=self.bucket_name, Key=key)

            self.stats['tiles_downloaded'] += 1
            print(f"    📥 下載現有圖磚: {tile_x}/{tile_y}")

            return response['Body'].read()

        except self.r2_client.exceptions.NoSuchKey:
            print(f"    ℹ️ 圖磚 {tile_x}/{tile_y} 不存在，將創建新圖磚")
            return None
        except Exception as e:
            print(f"    ❌ 下載圖磚 {tile_x}/{tile_y} 失敗: {e}")
            return None

    def parse_existing_tile_pixels(self, png_bytes: bytes) -> Dict[Tuple[int, int], int]:
        """解析現有圖磚的像素狀態"""
        try:
            from PIL import Image
            img = Image.open(BytesIO(png_bytes))
            img = img.convert('RGBA')

            pixels = img.load()
            pixel_states = {}

            # 反向解析像素顏色到狀態
            color_to_state = {
                (0, 255, 0, 120): STATE_CLEAR,      # 綠色 - 已清除
                (139, 69, 19, 180): STATE_MUDDY,    # 棕色 - 有淤泥
                (0, 0, 0, 0): STATE_UNDEFINED       # 透明 - 未定義
            }

            for local_x in range(img.width):
                for local_y in range(img.height):
                    pixel = pixels[local_x, local_y]

                    # 找到最接近的狀態顏色
                    if pixel in color_to_state:
                        state = color_to_state[pixel]
                        if state != STATE_UNDEFINED:  # 只記錄非透明像素
                            pixel_states[(local_x, local_y)] = state

            return pixel_states

        except Exception as e:
            print(f"    ⚠️ 解析現有圖磚像素失敗: {e}")
            return {}

    def calculate_affected_tiles_standard(self, changed_coord_keys: List[str], 
                                         area_config: dict, zoom: int = None) -> Set[Tuple[int, int, int]]:
        """計算受影響的標準圖磚座標 - 基於 4 decimal lat/lng 座標"""
        if zoom is None:
            zoom = PRIMARY_ZOOM
            
        # 轉換座標格式
        changed_coords = []
        for coord_key in changed_coord_keys:
            try:
                lat_str, lon_str = key_to_coords(coord_key)
                changed_coords.append((lat_str, lon_str))
            except ValueError:
                print(f"警告：無法解析座標 key: {coord_key}")
                continue
        
        # 使用新的標準函數計算影響的圖磚
        area_bounds = {
            'minLat': area_config['bounds']['minLat'],
            'maxLat': area_config['bounds']['maxLat'],
            'minLng': area_config['bounds']['minLng'],
            'maxLng': area_config['bounds']['maxLng']
        }
        
        affected_tiles = calculate_affected_tiles_from_coords(changed_coords, area_bounds, zoom)
        print(f"🎯 標準座標系統計算出 {len(affected_tiles)} 個受影響圖磚 (zoom={zoom})")
        
        return affected_tiles

    def generate_standard_tile_content(self, tile_x: int, tile_y: int, tile_z: int, 
                                     area_config: dict, coord_states: Dict[str, int]) -> bytes:
        """為標準座標生成圖磚內容"""
        try:
            from utils.coordinate_utils import tile_to_lat_lon_bounds
            
            # 獲取圖磚的地理邊界
            bounds = tile_to_lat_lon_bounds(tile_x, tile_y, tile_z)
            
            # 建立空白圖磚
            img = Image.new('RGBA', (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))
            pixels = img.load()
            
            pixel_count = 0
            
            # 遍歷圖磚內的座標點
            for coord_key, state in coord_states.items():
                try:
                    lat_str, lon_str = key_to_coords(coord_key)
                    lat, lon = float(lat_str), float(lon_str)
                    
                    # 檢查座標是否在此圖磚範圍內
                    if (bounds['minLat'] <= lat <= bounds['maxLat'] and
                        bounds['minLng'] <= lon <= bounds['maxLng']):
                        
                        # 計算像素位置
                        x_ratio = (lon - bounds['minLng']) / (bounds['maxLng'] - bounds['minLng'])
                        y_ratio = (lat - bounds['minLat']) / (bounds['maxLat'] - bounds['minLat'])
                        
                        pixel_x = int(x_ratio * (TILE_SIZE - 1))
                        pixel_y = TILE_SIZE - 1 - int(y_ratio * (TILE_SIZE - 1))  # 翻轉 Y 軸
                        
                        # 確保像素在範圍內
                        if 0 <= pixel_x < TILE_SIZE and 0 <= pixel_y < TILE_SIZE:
                            # 根據狀態設定顏色
                            color = COLOR_PALETTE.get(state, COLOR_PALETTE[STATE_UNDEFINED])
                            if color[3] > 0:  # 只有非透明色彩才畫出
                                pixels[pixel_x, pixel_y] = color
                                pixel_count += 1
                            
                except (ValueError, IndexError):
                    continue
            
            # 如果沒有像素，返回空圖磚
            if pixel_count == 0:
                print(f"    ℹ️ 圖磚 {tile_z}/{tile_x}/{tile_y} 沒有資料")
                print(f"    🔍 除錯: 座標狀態數量={len(coord_states)}, 圖磚邊界={bounds}")
                if coord_states:
                    sample_coords = list(coord_states.items())[:2]
                    for coord_key, state in sample_coords:
                        try:
                            lat_str, lon_str = key_to_coords(coord_key)
                            lat, lon = float(lat_str), float(lon_str)
                            in_bounds = (bounds['minLat'] <= lat <= bounds['maxLat'] and bounds['minLng'] <= lon <= bounds['maxLng'])
                            print(f"    🔍 座標 {coord_key} -> ({lat}, {lon}), 在邊界內: {in_bounds}, 狀態: {state}")
                        except:
                            print(f"    🔍 座標 {coord_key} 解析失敗")
                return b''
            
            # 轉換為 PNG
            png_buffer = BytesIO()
            img.save(png_buffer, format='PNG', optimize=True)
            png_bytes = png_buffer.getvalue()
            
            print(f"    ✏️ 生成標準圖磚 {tile_z}/{tile_x}/{tile_y}: {pixel_count} 像素, {len(png_bytes)} bytes")
            return png_bytes
            
        except Exception as e:
            print(f"    ❌ 生成標準圖磚內容失敗 {tile_z}/{tile_x}/{tile_y}: {e}")
            return b''
    
    def calculate_affected_tiles(self, changed_grid_ids: List[str]) -> Set[Tuple[int, int]]:
        """計算受影響的圖磚座標 - 向後相容版本，將逐步移除"""
        print("⚠️ 警告：使用舊版圖磚計算，建議遷移到標準座標系統")
        
        affected_tiles = set()
        for grid_id in changed_grid_ids:
            try:
                x, y = map(int, grid_id.split('_'))
                tile_x = x // TILE_SIZE  # 這是錯誤的轉換方法
                tile_y = y // TILE_SIZE  # 這是錯誤的轉換方法
                affected_tiles.add((tile_x, tile_y))
            except ValueError:
                continue
        return affected_tiles

    def generate_incremental_tile(self, tile_x: int, tile_y: int, changed_states: Dict[str, int],
                                 existing_tile_bytes: Optional[bytes] = None) -> bytes:
        """智慧增量圖磚生成 - 合併現有狀態和變更"""
        start_x = tile_x * TILE_SIZE
        start_y = tile_y * TILE_SIZE

        # 解析現有圖磚像素狀態
        existing_pixels = {}
        if existing_tile_bytes:
            existing_pixels = self.parse_existing_tile_pixels(existing_tile_bytes)
            print(f"    🔍 發現 {len(existing_pixels)} 個現有像素")

        # 建立全透明圖片
        img = Image.new('RGBA', (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))
        pixels = img.load()

        # 首先繪製現有像素
        existing_count = 0
        for (local_x, local_y), state in existing_pixels.items():
            color = COLOR_PALETTE.get(state, (0, 0, 0, 0))
            pixels[local_x, local_y] = color
            existing_count += 1

        # 然後繪製變更的網格（會覆蓋現有像素）
        changed_count = 0
        for grid_id, state in changed_states.items():
            try:
                grid_x, grid_y = map(int, grid_id.split('_'))

                # 檢查是否在當前圖磚範圍內
                if (start_x <= grid_x < start_x + TILE_SIZE and
                    start_y <= grid_y < start_y + TILE_SIZE):

                    local_x = grid_x - start_x
                    local_y = grid_y - start_y

                    color = COLOR_PALETTE.get(state, (0, 0, 0, 0))
                    pixels[local_x, local_y] = color
                    changed_count += 1

            except ValueError:
                continue

        # 轉換為 PNG bytes
        buffer = BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        png_bytes = buffer.getvalue()

        total_pixels = existing_count + changed_count
        print(f"    ✏️ 合併: {existing_count} 現有 + {changed_count} 變更 = {total_pixels} 像素, 檔案 {len(png_bytes)} bytes")
        return png_bytes

    def upload_tile_to_r2_standard(self, tile_x: int, tile_y: int, tile_z: int, 
                                   png_bytes: bytes, version: str = None):
        """上傳圖磚到 R2 - 標準 TMS 路徑格式"""
        if not self.r2_enabled:
            print(f"    🔧 略過上傳 (R2 未啟用): {tile_z}/{tile_x}/{tile_y}.png")
            return

        try:
            # 使用標準 TMS 路徑: {z}/{x}/{y}.png
            key = f"{tile_z}/{tile_x}/{tile_y}.png"

            self.r2_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=png_bytes,
                ContentType='image/png',
                CacheControl='public, max-age=3600'
            )

            self.stats['tiles_uploaded'] += 1
            print(f"    ✅ 已上傳標準圖磚: {tile_z}/{tile_x}/{tile_y}.png ({len(png_bytes)} bytes)")

        except Exception as e:
            print(f"    ❌ 上傳標準圖磚失敗 {tile_z}/{tile_x}/{tile_y}: {e}")
            if 'stats' in self.__dict__:
                self.stats['upload_errors'] += 1

    def upload_tile_to_r2(self, tile_x: int, tile_y: int, png_bytes: bytes, version: str):
        """上傳圖磚到 R2 - 向後相容版本，將逐步移除"""
        print("⚠️ 警告：使用舊版圖磚上傳路徑，建議遷移到標準 TMS 格式")
        
        if not self.r2_enabled:
            print(f"    🔧 略過上傳 (R2 未啟用): {version}/0/{tile_x}/{tile_y}.png")
            return

        try:
            key = f"{version}/0/{tile_x}/{tile_y}.png"  # 舊格式

            self.r2_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=png_bytes,
                ContentType='image/png',
                CacheControl='public, max-age=3600'
            )

            self.stats['bytes_uploaded'] += len(png_bytes)
            print(f"    ☁️ 上傳成功: {key}")

        except Exception as e:
            print(f"    ❌ 上傳失敗: {e}")
            raise

    def get_latest_version(self, area_name: str) -> Optional[str]:
        """獲取最新版本號"""
        if not self.r2_enabled:
            return None

        try:
            # 從 Redis 獲取最新版本
            result = self._redis_request('GET', f'tile_version:{area_name}')
            if result and 'result' in result and result['result']:
                return result['result']

            # 如果 Redis 中沒有，則查詢 R2
            paginator = self.r2_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=self.bucket_name,
                Prefix="",
                Delimiter="/"
            )

            versions = []
            for page in pages:
                if 'CommonPrefixes' in page:
                    for prefix in page['CommonPrefixes']:
                        version_dir = prefix['Prefix'].rstrip('/')
                        if version_dir.isdigit():
                            versions.append(version_dir)

            if versions:
                latest = max(versions)
                print(f"🔍 從 R2 發現最新版本: {latest}")
                return latest

            return None

        except Exception as e:
            print(f"❌ 獲取最新版本失敗: {e}")
            return None

    def upload_tms_metadata(self, version: str, affected_tiles: List, grid_coverage: Dict):
        """上傳 OGC TMS 相容的 metadata"""
        if not self.r2_enabled:
            print("🔧 略過 TMS metadata 上傳 (R2 未啟用)")
            return

        try:
            # 生成版本特定的 metadata
            version_metadata = self.tms_generator.generate_version_metadata(
                version, self.stats, affected_tiles, grid_coverage
            )

            # 上傳版本 metadata
            self.r2_client.put_object(
                Bucket=self.bucket_name,
                Key=f"{version}/metadata.json",
                Body=json.dumps(version_metadata, indent=2, ensure_ascii=False).encode('utf-8'),
                ContentType='application/json',
                CacheControl='public, max-age=3600'
            )

            # 生成並上傳邊界資訊
            existing_tiles = [f"{t['x']}/{t['y']}" for t in affected_tiles]
            bounds_metadata = self.tms_generator.generate_bounds_metadata(0, existing_tiles)

            self.r2_client.put_object(
                Bucket=self.bucket_name,
                Key=f"{version}/bounds/0.json",
                Body=json.dumps(bounds_metadata, indent=2, ensure_ascii=False).encode('utf-8'),
                ContentType='application/json',
                CacheControl='public, max-age=3600'
            )

            # 更新頂層 tilesetmetadata.json
            tilesetmetadata = self.tms_generator.generate_tilesetmetadata()
            self.r2_client.put_object(
                Bucket=self.bucket_name,
                Key='tilesetmetadata.json',
                Body=json.dumps(tilesetmetadata, indent=2, ensure_ascii=False).encode('utf-8'),
                ContentType='application/json',
                CacheControl='no-cache'
            )

            # 更新版本列表
            self.update_versions_list(version)

            # 更新 Redis 中的版本號
            self._redis_request('SET', 'tile_version', version)

            print(f"📄 TMS metadata 上傳成功: {version}")

        except Exception as e:
            print(f"❌ 上傳 TMS metadata 失敗: {e}")
            raise

    def update_versions_list(self, new_version: str):
        """更新版本列表"""
        try:
            # 獲取現有版本列表
            existing_versions = []
            try:
                response = self.r2_client.get_object(Bucket=self.bucket_name, Key='versions/versions.json')
                versions_data = json.loads(response['Body'].read().decode('utf-8'))
                existing_versions = [v['version'] for v in versions_data.get('versions', [])]
            except self.r2_client.exceptions.NoSuchKey:
                pass

            # 添加新版本
            if new_version not in existing_versions:
                existing_versions.append(new_version)

            # 生成更新的版本 metadata
            versions_metadata = self.tms_generator.generate_versions_metadata(existing_versions)

            # 上傳版本列表
            self.r2_client.put_object(
                Bucket=self.bucket_name,
                Key='versions/versions.json',
                Body=json.dumps(versions_metadata, indent=2, ensure_ascii=False).encode('utf-8'),
                ContentType='application/json',
                CacheControl='no-cache'
            )

            print(f"📋 版本列表已更新，包含 {len(existing_versions)} 個版本")

        except Exception as e:
            print(f"❌ 更新版本列表失敗: {e}")

    def clear_changed_coords(self, area_name: str):
        """清除變更座標標記"""
        try:
            self._redis_request('DEL', f'changed_coords:{area_name}')
            print(f"🧹 變更座標標記已清除 ({area_name})")
        except Exception as e:
            print(f"❌ 清除變更座標標記失敗 ({area_name}): {e}")
    
    def clear_changed_grids(self, area_name: str):
        """清除變更標記 - 向後相容版本"""
        self.clear_changed_coords(area_name)

    def generate_standard_tiles_for_area(self, area_config: dict):
        """為單一區域執行標準 TMS 圖磚生成"""
        area_name = area_config['name']
        print(f"\n🚀 === 處理區域 (標準 TMS): {area_config['displayName']} ({area_name}) ===")

        # 1. 獲取變更座標
        changed_coords = self.get_changed_coords(area_name)
        if not changed_coords:
            print(f"ℹ️ {area_name} 沒有座標變更，跳過圖磚生成")
            return {
                'success': True,
                'area_name': area_name,
                'version': 'no-changes',
                'tiles_processed': 0,
                'coords_changed': 0,
                'zoom_level': PRIMARY_ZOOM
            }

        print(f"📍 發現 {len(changed_coords)} 個變更座標")

        # 2. 計算受影響的標準圖磚 (使用 zoom 19)
        affected_tiles = self.calculate_affected_tiles_standard(changed_coords, area_config, PRIMARY_ZOOM)
        print(f"🎯 需要更新 {len(affected_tiles)} 個標準圖磚 (zoom={PRIMARY_ZOOM})")

        if not affected_tiles:
            print("ℹ️ 沒有圖磚需要更新")
            return {'success': False, 'reason': 'no_tiles_to_update'}

        # 3. 讀取變更座標狀態
        changed_states = self.read_changed_coords_states(area_name, changed_coords)
        print(f"🔍 已讀取 {len(changed_states)} 個座標狀態")

        # 4. 生成標準圖磚
        version = datetime.now().strftime('%Y%m%d%H%M%S')
        tiles_processed = 0
        
        for tile_x, tile_y, tile_z in affected_tiles:
            try:
                print(f"🎨 生成標準圖磚: {tile_z}/{tile_x}/{tile_y}")
                
                # 為標準圖磚座標生成內容
                png_bytes = self.generate_standard_tile_content(tile_x, tile_y, tile_z, 
                                                              area_config, changed_states)
                
                if png_bytes:
                    # 上傳到標準 TMS 路徑
                    self.upload_tile_to_r2_standard(tile_x, tile_y, tile_z, png_bytes)
                    tiles_processed += 1
                
            except Exception as e:
                print(f"❌ 生成標準圖磚失敗 {tile_z}/{tile_x}/{tile_y}: {e}")
                continue

        # 5. 清除變更標記
        self.clear_changed_coords(area_name)
        
        result = {
            'success': True,
            'area_name': area_name,
            'version': version,
            'tiles_processed': tiles_processed,
            'coords_changed': len(changed_coords),
            'zoom_level': PRIMARY_ZOOM
        }
        
        print(f"✅ 標準圖磚生成完成: {tiles_processed} 個圖磚")
        return result

    def generate_intelligent_tiles_for_area(self, area_config: dict):
        """為單一區域執行智慧增量圖磚生成 - 向後相容版本"""
        # 優先使用新的標準 TMS 生成
        return self.generate_standard_tiles_for_area(area_config)
        
        # 保留舊版程式碼供參考
        area_name = area_config['name']
        print(f"\n🚀 === 處理區域: {area_config['displayName']} ({area_name}) ===")

        # 1. 獲取變更網格
        changed_grids = self.get_changed_grids(area_name)
        if not changed_grids:
            print(f"ℹ️ {area_name} 沒有網格變更，跳過圖磚生成")
            return

        print(f"📍 發現 {len(changed_grids)} 個變更網格")

        # 2. 獲取最新版本
        previous_version = self.get_latest_version(area_name)
        if previous_version:
            print(f"🔄 基於版本 {previous_version} 進行增量更新")
        else:
            print("🆕 首次生成，建立初始版本")

        # 3. 計算受影響圖磚
        affected_tiles = self.calculate_affected_tiles(changed_grids)
        print(f"🎯 需要更新 {len(affected_tiles)} 個圖磚")

        if not affected_tiles:
            print("ℹ️ 沒有圖磚需要更新")
            return {'success': False, 'reason': 'no_tiles_to_update'}

        # 4. 獲取現有圖磚列表
        existing_tiles = self.get_existing_tiles(previous_version) if previous_version else []

        # 5. 只讀取變更網格狀態
        changed_states = self.read_changed_grids_states(area_name, changed_grids)

        # 6. 生成新版本號
        new_version = str(int(time.time()))
        print(f"🆕 新版本號: {new_version}")

        # 7. 複製未變更的圖磚 (R2 內部複製)
        copied_count = 0
        if previous_version and existing_tiles:
            copied_count = self.copy_unchanged_tiles(existing_tiles, affected_tiles, previous_version, new_version)

        # 8. 處理每個受影響的圖磚
        success_count = 0

        for i, (tile_x, tile_y) in enumerate(affected_tiles):
            try:
                print(f"\n[{i+1}/{len(affected_tiles)}] 處理圖磚 ({tile_x}, {tile_y})")

                # 下載現有圖磚 (如果存在)
                existing_tile_bytes = None
                if previous_version:
                    existing_tile_bytes = self.download_existing_tile(tile_x, tile_y, previous_version)

                # 智慧增量生成
                png_bytes = self.generate_incremental_tile(tile_x, tile_y, changed_states, existing_tile_bytes)

                # 上傳到新版本
                self.upload_tile_to_r2(tile_x, tile_y, png_bytes, new_version)

                success_count += 1
                self.stats['tiles_processed'] += 1

            except Exception as e:
                print(f"❌ 處理圖磚 ({tile_x}, {tile_y}) 失敗: {e}")
                continue

        if success_count == 0:
            print("❌ 沒有圖磚成功處理")
            return {'success': False, 'reason': 'no_tiles_processed'}

        # 9. 上傳 OGC TMS metadata
        affected_tiles_list = [{"x": x, "y": y} for x, y in affected_tiles]
        self.upload_tms_metadata(new_version, affected_tiles_list, changed_states)

        # 10. 更新 Redis 中的版本號
        try:
            self._redis_request('SET', f'tile_version:{area_name}', new_version)
        except Exception as e:
            print(f"⚠️ 更新 Redis 版本號失敗: {e}")

        # 11. 清除變更標記
        self.clear_changed_grids(area_name)

        return {
            'success': True,
            'area_name': area_name,
            'version': new_version,
            'tiles_processed': success_count,
            'tiles_copied': copied_count,
            'affected_tiles': len(affected_tiles)
        }

    def generate_intelligent_tiles(self):
        """執行 OGC TMS 相容的智慧增量圖磚生成（多區域支援）"""
        print("🚀 === OGC TMS 智慧增量圖磚生成 v3.1 (多區域支援) ===")
        print(f"⏰ 開始時間: {time.strftime('%Y-%m-%d %H:%M:%S')}")

        # 獲取啟用的區域列表
        enabled_areas = get_enabled_areas(self.env_config)
        print(f"📍 將處理 {len(enabled_areas)} 個區域")

        overall_start_time = time.time()
        results = []

        for area_config in enabled_areas:
            area_start_time = time.time()
            result = self.generate_intelligent_tiles_for_area(area_config)
            area_duration = time.time() - area_start_time

            if result:
                result['duration'] = area_duration
                results.append(result)

        # 最終統計
        overall_duration = time.time() - overall_start_time

        print(f"\n🎉 === 多區域圖磚生成完成 ===")
        print(f"⏱️ 總執行時間: {overall_duration:.2f} 秒")
        print(f"⚡ Redis 請求總數: {self.stats['redis_requests']}")
        print(f"📦 上傳總量: {self.stats['bytes_uploaded']:,} bytes")
        print(f"💰 月度預估: {8640 * overall_duration / 60:.1f} 分鐘")

        # 成功區域統計
        successful_areas = [r for r in results if r.get('success')]
        failed_areas = len(enabled_areas) - len(successful_areas)

        print(f"✅ 成功處理區域: {len(successful_areas)}")
        print(f"❌ 失敗區域: {failed_areas}")

        for result in successful_areas:
            print(f"  - {result['area_name']}: {result['tiles_processed']} 圖磚, 版本 {result['version']}")

        # 驗證預算符合性
        monthly_minutes = 8640 * overall_duration / 60
        if monthly_minutes <= 2000:
            print(f"✅ 預算符合 GitHub Actions 限制 ({monthly_minutes:.1f}/2000 分鐘)")
        else:
            print(f"⚠️ 預算可能超標 ({monthly_minutes:.1f}/2000 分鐘)")

def main():
    """主程式"""
    try:
        # 初始化環境配置
        env_config = get_full_config()
        
        # 建立圖磚生成器
        generator = IntelligentTileGenerator(env_config)
        generator.generate_intelligent_tiles()

    except Exception as e:
        print(f"❌ 智慧圖磚生成失敗: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
