#!/usr/bin/env python3
"""
圖磚生成 POC 腳本
生成模擬淤泥狀態圖磚用於測試視覺效果
"""

import os
import sys
import json
import math
import random
from typing import Dict, List, Tuple
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageDraw
except ImportError as e:
    print(f"錯誤：缺少必要的 Python 套件: {e}")
    print("請執行：pip install pillow numpy")
    sys.exit(1)

# 圖磚配置
TILE_SIZE = 256
GRID_WIDTH = 800
GRID_HEIGHT = 600

# 狀態定義
STATE_UNKNOWN = 0    # 未知狀態
STATE_CLEAR = 1      # 已清除
STATE_MUDDY = 2      # 有淤泥

# 調色盤配置 (RGBA)
COLOR_PALETTE = {
    STATE_UNKNOWN: (128, 128, 128, 50),   # 淺灰色，半透明
    STATE_CLEAR: (0, 255, 0, 120),        # 綠色，較透明
    STATE_MUDDY: (139, 69, 19, 180),      # 棕色，較不透明
}

# 光復鄉地理邊界 (WGS84)
GUANGFU_BOUNDS = {
    'north_west': {'lat': 23.68137, 'lon': 121.41771},
    'north_east': {'lat': 23.68108, 'lon': 121.45639},
    'south_west': {'lat': 23.65397, 'lon': 121.41760},
    'south_east': {'lat': 23.65396, 'lon': 121.45657},
}

def generate_mock_data() -> np.ndarray:
    """
    生成模擬淤泥狀態資料
    建立一些有趣的測試模式
    """
    print("生成模擬狀態資料...")
    
    # 初始化為未知狀態
    grid = np.full((GRID_HEIGHT, GRID_WIDTH), STATE_UNKNOWN, dtype=np.uint8)
    
    # 模式 1: 在中心區域建立一些已清除的區域
    center_x, center_y = GRID_WIDTH // 2, GRID_HEIGHT // 2
    
    # 中心清除區域（圓形）
    for y in range(GRID_HEIGHT):
        for x in range(GRID_WIDTH):
            # 距離中心的距離
            dist_to_center = math.sqrt((x - center_x)**2 + (y - center_y)**2)
            
            if dist_to_center < 50:
                grid[y, x] = STATE_CLEAR
            elif dist_to_center < 80:
                # 中間區域隨機分佈
                grid[y, x] = random.choice([STATE_CLEAR, STATE_MUDDY])
    
    # 模式 2: 左上角建立淤泥密集區域
    for y in range(0, GRID_HEIGHT // 4):
        for x in range(0, GRID_WIDTH // 4):
            if random.random() < 0.7:  # 70% 機率有淤泥
                grid[y, x] = STATE_MUDDY
    
    # 模式 3: 右下角建立清除區域
    for y in range(GRID_HEIGHT * 3 // 4, GRID_HEIGHT):
        for x in range(GRID_WIDTH * 3 // 4, GRID_WIDTH):
            if random.random() < 0.8:  # 80% 機率已清除
                grid[y, x] = STATE_CLEAR
    
    # 模式 4: 建立一些線性清除路徑（模擬道路清理）
    for i in range(5):
        start_x = random.randint(0, GRID_WIDTH - 1)
        start_y = random.randint(0, GRID_HEIGHT - 1)
        end_x = random.randint(0, GRID_WIDTH - 1)
        end_y = random.randint(0, GRID_HEIGHT - 1)
        
        # 在起點和終點之間畫線
        steps = max(abs(end_x - start_x), abs(end_y - start_y))
        if steps > 0:
            for step in range(steps):
                x = int(start_x + (end_x - start_x) * step / steps)
                y = int(start_y + (end_y - start_y) * step / steps)
                
                # 線條寬度 3 pixel
                for dx in range(-1, 2):
                    for dy in range(-1, 2):
                        if 0 <= x + dx < GRID_WIDTH and 0 <= y + dy < GRID_HEIGHT:
                            grid[y + dy, x + dx] = STATE_CLEAR
    
    # 統計
    total_pixels = GRID_WIDTH * GRID_HEIGHT
    unknown_count = np.sum(grid == STATE_UNKNOWN)
    clear_count = np.sum(grid == STATE_CLEAR)
    muddy_count = np.sum(grid == STATE_MUDDY)
    
    print(f"狀態統計:")
    print(f"  未知: {unknown_count:,} ({unknown_count/total_pixels*100:.1f}%)")
    print(f"  已清除: {clear_count:,} ({clear_count/total_pixels*100:.1f}%)")
    print(f"  有淤泥: {muddy_count:,} ({muddy_count/total_pixels*100:.1f}%)")
    
    return grid

def create_tile_image(grid_section: np.ndarray) -> Image.Image:
    """
    將網格區段轉換為圖磚圖片
    """
    height, width = grid_section.shape
    
    # 建立 RGBA 圖片
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    pixels = img.load()
    
    for y in range(height):
        for x in range(width):
            state = grid_section[y, x]
            color = COLOR_PALETTE.get(state, COLOR_PALETTE[STATE_UNKNOWN])
            pixels[x, y] = color
    
    # 縮放到圖磚大小
    if width != TILE_SIZE or height != TILE_SIZE:
        img = img.resize((TILE_SIZE, TILE_SIZE), Image.NEAREST)
    
    return img

def generate_tiles(grid: np.ndarray, output_dir: Path) -> int:
    """
    將狀態陣列切割成圖磚
    """
    print("開始生成圖磚...")
    
    # 計算需要多少個圖磚
    tiles_x = math.ceil(GRID_WIDTH / TILE_SIZE)
    tiles_y = math.ceil(GRID_HEIGHT / TILE_SIZE)
    
    print(f"將生成 {tiles_x} x {tiles_y} = {tiles_x * tiles_y} 個圖磚")
    
    tile_count = 0
    
    for tile_y in range(tiles_y):
        for tile_x in range(tiles_x):
            # 計算這個圖磚在網格中的位置
            start_x = tile_x * TILE_SIZE
            start_y = tile_y * TILE_SIZE
            end_x = min(start_x + TILE_SIZE, GRID_WIDTH)
            end_y = min(start_y + TILE_SIZE, GRID_HEIGHT)
            
            # 提取這個區域的網格資料
            grid_section = grid[start_y:end_y, start_x:end_x]
            
            # 如果區域小於圖磚大小，需要補齊
            if grid_section.shape[0] < TILE_SIZE or grid_section.shape[1] < TILE_SIZE:
                padded_section = np.full((TILE_SIZE, TILE_SIZE), STATE_UNKNOWN, dtype=np.uint8)
                padded_section[:grid_section.shape[0], :grid_section.shape[1]] = grid_section
                grid_section = padded_section
            
            # 生成圖磚圖片
            tile_img = create_tile_image(grid_section)
            
            # 儲存圖磚
            tile_filename = f"tile_{tile_x}_{tile_y}.png"
            tile_path = output_dir / tile_filename
            tile_img.save(tile_path, "PNG")
            
            tile_count += 1
            
            if tile_count % 10 == 0:
                print(f"已生成 {tile_count} 個圖磚...")
    
    print(f"圖磚生成完成！總共 {tile_count} 個圖磚")
    return tile_count

def create_metadata(tile_count: int, output_dir: Path):
    """
    建立圖磚元資料檔案
    """
    metadata = {
        "version": "poc-v1.0",
        "generated_at": "2024-01-01T00:00:00Z",  # POC 固定時間
        "grid_size": {
            "width": GRID_WIDTH,
            "height": GRID_HEIGHT
        },
        "tile_size": TILE_SIZE,
        "tile_count": tile_count,
        "bounds": GUANGFU_BOUNDS,
        "states": {
            "unknown": STATE_UNKNOWN,
            "clear": STATE_CLEAR,
            "muddy": STATE_MUDDY
        },
        "colors": {
            "unknown": COLOR_PALETTE[STATE_UNKNOWN],
            "clear": COLOR_PALETTE[STATE_CLEAR],
            "muddy": COLOR_PALETTE[STATE_MUDDY]
        },
        "description": "POC 測試圖磚 - 模擬淤泥狀態資料"
    }
    
    metadata_path = output_dir / "metadata.json"
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    print(f"元資料已儲存到: {metadata_path}")

def main():
    """
    主程式
    """
    print("=== 圖磚生成 POC 開始 ===")
    
    # 設定輸出目錄
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    output_dir = project_root / "public" / "tiles"
    
    # 確保輸出目錄存在
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"輸出目錄: {output_dir}")
    
    # 清理舊的圖磚檔案
    for file in output_dir.glob("*.png"):
        file.unlink()
    
    # 生成模擬資料
    grid = generate_mock_data()
    
    # 生成圖磚
    tile_count = generate_tiles(grid, output_dir)
    
    # 建立元資料
    create_metadata(tile_count, output_dir)
    
    print("=== 圖磚生成 POC 完成 ===")
    print(f"請查看 {output_dir} 目錄中的圖磚檔案")

if __name__ == "__main__":
    main()