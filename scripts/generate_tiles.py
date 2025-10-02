#!/usr/bin/env python3
"""
OGC TMS 相容的智能增量圖磚生成系統 v3.0
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
from tms_metadata import TMSMetadataGenerator

# 載入環境變數（生產環境不需要 .env.local）
def load_env_file():
    """載入 .env.local 檔案（僅本地開發用）"""
    env_file = Path(__file__).parent.parent / '.env.local'
    if env_file.exists():
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    value = value.strip('"\'')
                    os.environ[key] = value
        print(f"已載入環境變數檔案: {env_file}")

# 只在本地開發時載入 .env.local
if os.path.exists(Path(__file__).parent.parent / '.env.local'):
    load_env_file()

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

# 配置
TILE_SIZE = 256
GRID_WIDTH = 800
GRID_HEIGHT = 600

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
            'north_west': {'lat': 23.68137, 'lon': 121.41771},
            'north_east': {'lat': 23.68108, 'lon': 121.45639},
            'south_west': {'lat': 23.65397, 'lon': 121.41760},
            'south_east': {'lat': 23.65396, 'lon': 121.45657},
        },
        'center': {'lat': 23.66767, 'lon': 121.43705},
        'gridSize': {'width': 800, 'height': 600},
        'gridPrecision': 5
    },
}


def get_redis_connection():
    """建立 Redis 連接"""
    try:
        redis_url = os.getenv('UPSTASH_REDIS_REST_URL')
        redis_token = os.getenv('UPSTASH_REDIS_REST_TOKEN')

        if not redis_url or not redis_token:
            print("⚠️ Redis 環境變數未設定，無法載入測試區域")
            return None

        # 使用 REST API 方式連接 Upstash Redis
        return {
            'url': redis_url,
            'token': redis_token
        }
    except Exception as e:
        print(f"⚠️ Redis 連接失敗: {e}")
        return None

def fetch_test_areas_from_redis():
    """從 Redis 獲取所有測試區域"""
    redis_config = get_redis_connection()
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

def get_enabled_areas():
    """獲取啟用的區域列表"""
    areas_env = os.getenv('TILE_GENERATION_AREAS', 'guangfu')
    enabled_areas = [area.strip() for area in areas_env.split(',')]

    print(f"🌍 環境變數指定的區域: {enabled_areas}")

    # 如果包含測試區域關鍵字，從 Redis 載入所有測試區域
    if any(area in ['test', 'all_test_areas'] or area.startswith('test_') for area in enabled_areas):
        print("🔍 偵測到測試區域需求，正在從 Redis 載入...")
        test_areas = fetch_test_areas_from_redis()

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
    def __init__(self, skip_r2=False):
        """初始化 OGC TMS 相容的智能圖磚生成器"""
        self._setup_redis()
        self.r2_enabled = True
        self.tms_generator = TMSMetadataGenerator()

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
            'bytes_uploaded': 0,
            'generation_mode': 'intelligent_incremental'
        }

    def _setup_redis(self):
        """設定 Redis 連線"""
        self.redis_url = os.getenv('UPSTASH_REDIS_REST_URL')
        self.redis_token = os.getenv('UPSTASH_REDIS_REST_TOKEN')

        if not self.redis_url or not self.redis_token:
            raise ValueError("缺少 Redis 環境變數: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN")

        self.redis_headers = {
            'Authorization': f'Bearer {self.redis_token}',
            'Content-Type': 'application/json'
        }
        print("✅ Redis REST API 設定完成")

    def _setup_r2(self):
        """設定 Cloudflare R2 連線 - 多重策略修復版"""
        access_key = os.getenv('CLOUDFLARE_R2_ACCESS_KEY_ID')
        secret_key = os.getenv('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
        self.bucket_name = os.getenv('CLOUDFLARE_R2_BUCKET_NAME')

        if not access_key or not secret_key or not self.bucket_name:
            raise ValueError("缺少 R2 環境變數: CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME")

        account_id = "d066b2cc1ddbd5e0b3c6e7772a35a93a"

        # 檢查環境變數中的替代端點
        env_endpoint = os.getenv('CLOUDFLARE_R2_ENDPOINTS')
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

    def get_changed_grids(self, area_name: str) -> List[str]:
        """獲取變更網格 - 極簡策略的核心"""
        try:
            result = self._redis_request('SMEMBERS', f'changed_grids:{area_name}')
            if result and 'result' in result:
                return result['result'] if result['result'] else []
            return []
        except Exception as e:
            print(f"❌ 讀取變更網格失敗 ({area_name}): {e}")
            return []

    def read_changed_grids_states(self, area_name: str, changed_grid_ids: List[str]) -> Dict[str, int]:
        """只讀取變更網格的狀態 - 極簡策略的關鍵"""
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

    def calculate_affected_tiles(self, changed_grid_ids: List[str]) -> Set[Tuple[int, int]]:
        """計算受影響的圖磚座標"""
        affected_tiles = set()
        for grid_id in changed_grid_ids:
            try:
                x, y = map(int, grid_id.split('_'))
                tile_x = x // TILE_SIZE
                tile_y = y // TILE_SIZE
                affected_tiles.add((tile_x, tile_y))
            except ValueError:
                continue
        return affected_tiles

    def generate_incremental_tile(self, tile_x: int, tile_y: int, changed_states: Dict[str, int],
                                 existing_tile_bytes: Optional[bytes] = None) -> bytes:
        """智能增量圖磚生成 - 合併現有狀態和變更"""
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

    def upload_tile_to_r2(self, tile_x: int, tile_y: int, png_bytes: bytes, version: str):
        """上傳圖磚到 R2"""
        if not self.r2_enabled:
            print(f"    🔧 略過上傳 (R2 未啟用): {version}/0/{tile_x}/{tile_y}.png")
            return

        try:
            key = f"{version}/0/{tile_x}/{tile_y}.png"

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

    def clear_changed_grids(self, area_name: str):
        """清除變更標記"""
        try:
            self._redis_request('DEL', f'changed_grids:{area_name}')
            print(f"🧹 變更標記已清除 ({area_name})")
        except Exception as e:
            print(f"❌ 清除變更標記失敗 ({area_name}): {e}")

    def generate_intelligent_tiles_for_area(self, area_config: dict):
        """為單一區域執行智能增量圖磚生成"""
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

                # 智能增量生成
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
        """執行 OGC TMS 相容的智能增量圖磚生成（多區域支援）"""
        print("🚀 === OGC TMS 智能增量圖磚生成 v3.1 (多區域支援) ===")
        print(f"⏰ 開始時間: {time.strftime('%Y-%m-%d %H:%M:%S')}")

        # 獲取啟用的區域列表
        enabled_areas = get_enabled_areas()
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
        generator = IntelligentTileGenerator()
        generator.generate_intelligent_tiles()

    except Exception as e:
        print(f"❌ 智能圖磚生成失敗: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
