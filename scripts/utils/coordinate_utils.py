#!/usr/bin/env python3
"""
標準 TMS 座標轉換工具模組

符合 OGC Two Dimensional Tile Matrix Set 標準
使用 Web Mercator 投影 (EPSG:3857) 和標準 z/x/y 座標系統
支援 4 decimal 精度地理座標系統
"""

import math
from typing import Dict, List, Tuple, Set, Optional

# TMS 技術規格常數
class TMSConfig:
    # Web Mercator 投影常數
    EARTH_RADIUS = 6378137  # WGS84 地球半徑 (公尺)
    EARTH_CIRCUMFERENCE = 2 * math.pi * 6378137  # 地球周長
    ORIGIN_SHIFT = math.pi * 6378137  # Web Mercator 原點偏移
    
    # 圖磚規格
    TILE_SIZE = 256  # 像素
    MAX_ZOOM = 19
    MIN_ZOOM = 14
    PRIMARY_ZOOM = 19  # 主要縮放層級 (~0.6m/pixel)
    
    # 4 decimal 精度設定
    COORD_PRECISION = 4  # ~11m 精度
    DEFAULT_RADIUS_METERS = 25  # 預設範圍效應半徑


def lat_lon_to_pixel(lat: float, lon: float, zoom: int) -> Tuple[float, float]:
    """
    GPS 座標轉換為 Web Mercator 像素座標
    
    Args:
        lat: 緯度 (-85.0511 ~ 85.0511)
        lon: 經度 (-180 ~ 180)
        zoom: 縮放層級 (0-19)
    
    Returns:
        Tuple[float, float]: (x_pixel, y_pixel)
    """
    # 限制緯度範圍以避免 Web Mercator 奇點
    lat = max(min(lat, 85.0511), -85.0511)
    
    # 計算像素數量
    pixel_count = 2 ** zoom * TMSConfig.TILE_SIZE
    
    # 經度轉換 (線性)
    x_pixel = (lon + 180.0) / 360.0 * pixel_count
    
    # 緯度轉換 (Mercator 投影)
    lat_rad = math.radians(lat)
    y_pixel = (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * pixel_count
    
    return (x_pixel, y_pixel)


def pixel_to_tile(pixel_x: float, pixel_y: float) -> Tuple[int, int]:
    """
    像素座標轉換為圖磚座標
    
    Args:
        pixel_x: X 像素座標
        pixel_y: Y 像素座標
    
    Returns:
        Tuple[int, int]: (tile_x, tile_y)
    """
    return (int(pixel_x // TMSConfig.TILE_SIZE), int(pixel_y // TMSConfig.TILE_SIZE))


def lat_lon_to_tile_coords(lat: float, lon: float, zoom: int) -> Tuple[int, int, int]:
    """
    GPS 座標直接轉換為標準圖磚座標 (Web Mercator)
    
    Args:
        lat: 緯度
        lon: 經度
        zoom: 縮放層級
    
    Returns:
        Tuple[int, int, int]: (tile_x, tile_y, zoom)
    """
    x_pixel, y_pixel = lat_lon_to_pixel(lat, lon, zoom)
    tile_x, tile_y = pixel_to_tile(x_pixel, y_pixel)
    return (tile_x, tile_y, zoom)


def tile_to_lat_lon_bounds(tile_x: int, tile_y: int, zoom: int) -> Dict[str, float]:
    """
    圖磚座標轉換為 GPS 邊界
    
    Args:
        tile_x: 圖磚 X 座標
        tile_y: 圖磚 Y 座標
        zoom: 縮放層級
    
    Returns:
        Dict[str, float]: {'minLat', 'maxLat', 'minLng', 'maxLng'}
    """
    pixel_count = 2 ** zoom * TMSConfig.TILE_SIZE
    
    # 計算圖磚的像素邊界
    min_x_pixel = tile_x * TMSConfig.TILE_SIZE
    max_x_pixel = (tile_x + 1) * TMSConfig.TILE_SIZE
    min_y_pixel = tile_y * TMSConfig.TILE_SIZE
    max_y_pixel = (tile_y + 1) * TMSConfig.TILE_SIZE
    
    # 轉換為經緯度
    min_lng = (min_x_pixel / pixel_count) * 360.0 - 180.0
    max_lng = (max_x_pixel / pixel_count) * 360.0 - 180.0
    
    # 緯度轉換 (逆 Mercator 投影)
    max_lat_y = (min_y_pixel / pixel_count) * 2.0 - 1.0
    min_lat_y = (max_y_pixel / pixel_count) * 2.0 - 1.0
    
    max_lat = math.degrees(math.atan(math.sinh(math.pi * (1 - max_lat_y))))
    min_lat = math.degrees(math.atan(math.sinh(math.pi * (1 - min_lat_y))))
    
    return {
        'minLat': min_lat,
        'maxLat': max_lat,
        'minLng': min_lng,
        'maxLng': max_lng
    }


def format_coords_4decimal(lat: float, lon: float, precision: int = 4) -> Tuple[str, str]:
    """
    格式化座標為 4 decimal 精度
    
    Args:
        lat: 緯度
        lon: 經度
        precision: 精度位數 (預設 4)
    
    Returns:
        Tuple[str, str]: (lat_str, lon_str)
    """
    lat_str = f"{lat:.{precision}f}"
    lon_str = f"{lon:.{precision}f}"
    return (lat_str, lon_str)


def coords_to_key(lat: float, lon: float) -> str:
    """
    座標轉換為 Redis key 格式
    
    Args:
        lat: 緯度
        lon: 經度
    
    Returns:
        str: Redis key 格式 "lat_lon"
    """
    lat_str, lon_str = format_coords_4decimal(lat, lon)
    return f"{lat_str}_{lon_str}"


def key_to_coords(key: str) -> Tuple[str, str]:
    """
    Redis key 轉換為座標
    
    Args:
        key: Redis key 格式 "lat_lon"
    
    Returns:
        Tuple[str, str]: (lat_str, lon_str)
    
    Raises:
        ValueError: 無效的 key 格式
    """
    parts = key.split('_')
    if len(parts) != 2:
        raise ValueError(f"無效的座標 key 格式: {key}")
    
    return (parts[0], parts[1])


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    計算兩點之間的地理距離 (Haversine 公式)
    
    Args:
        lat1, lon1: 第一點座標
        lat2, lon2: 第二點座標
    
    Returns:
        float: 距離 (公尺)
    """
    if lat1 == lat2 and lon1 == lon2:
        return 0.0
    
    # 轉換為弧度
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Haversine 公式
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    
    return TMSConfig.EARTH_RADIUS * c


def get_geo_radius_coords(lat: float, lon: float, radius_meters: int, 
                         precision: int = 4, max_coords: int = 50) -> List[Tuple[str, str]]:
    """
    計算地理半徑內的 4 decimal 座標點
    
    Args:
        lat: 中心緯度
        lon: 中心經度
        radius_meters: 半徑 (公尺)
        precision: 座標精度 (預設 4)
        max_coords: 最大座標數量限制
    
    Returns:
        List[Tuple[str, str]]: 受影響的座標點列表 [(lat_str, lon_str), ...]
    """
    if radius_meters <= 0:
        # 零半徑只返回中心點
        lat_str, lon_str = format_coords_4decimal(lat, lon, precision)
        return [(lat_str, lon_str)]
    
    affected_coords = set()
    
    # 計算搜索範圍的座標步長
    coord_step = 1 / (10 ** precision)
    
    # 估算搜索範圍 (經緯度)
    # 緯度：固定距離
    lat_range = radius_meters / 111320.0  # 1度緯度約 111.32km
    
    # 經度：根據緯度調整
    lat_rad = math.radians(lat)
    lon_range = radius_meters / (111320.0 * math.cos(lat_rad))
    
    # 搜索範圍的網格數量
    lat_steps = int(lat_range / coord_step) + 1
    lon_steps = int(lon_range / coord_step) + 1
    
    # 防止搜索範圍過大
    lat_steps = min(lat_steps, 10)
    lon_steps = min(lon_steps, 10)
    
    # 掃描鄰近座標點
    for lat_offset in range(-lat_steps, lat_steps + 1):
        for lon_offset in range(-lon_steps, lon_steps + 1):
            test_lat = lat + (lat_offset * coord_step)
            test_lon = lon + (lon_offset * coord_step)
            
            # 檢查距離
            distance = calculate_distance(lat, lon, test_lat, test_lon)
            if distance <= radius_meters:
                lat_str, lon_str = format_coords_4decimal(test_lat, test_lon, precision)
                affected_coords.add((lat_str, lon_str))
                
                # 數量限制
                if len(affected_coords) >= max_coords:
                    print(f"範圍效應座標點數量達到上限 {max_coords}，停止生成")
                    break
        
        if len(affected_coords) >= max_coords:
            break
    
    return list(affected_coords)


def calculate_affected_tiles_from_coords(changed_coords: List[Tuple[str, str]], 
                                       area_bounds: Dict[str, float], 
                                       zoom: int) -> Set[Tuple[int, int, int]]:
    """
    從 lat/lng 座標變更計算受影響的圖磚
    
    Args:
        changed_coords: 變更的座標列表 [(lat_str, lon_str), ...]
        area_bounds: 區域邊界 {'minLat', 'maxLat', 'minLng', 'maxLng'}
        zoom: 縮放層級
    
    Returns:
        Set[Tuple[int, int, int]]: 受影響的圖磚 {(tile_x, tile_y, zoom), ...}
    """
    affected_tiles = set()
    
    for lat_str, lon_str in changed_coords:
        try:
            lat = float(lat_str)
            lon = float(lon_str)
            
            # 檢查是否在區域範圍內
            if (area_bounds['minLat'] <= lat <= area_bounds['maxLat'] and
                area_bounds['minLng'] <= lon <= area_bounds['maxLng']):
                
                tile_x, tile_y, tile_z = lat_lon_to_tile_coords(lat, lon, zoom)
                affected_tiles.add((tile_x, tile_y, tile_z))
                
        except (ValueError, TypeError):
            print(f"警告：無法解析座標 {lat_str}, {lon_str}")
            continue
    
    return affected_tiles


def is_within_simple_bounds(lat: float, lon: float, bounds: Dict[str, float]) -> bool:
    """
    簡化邊界檢查 (矩形)
    
    Args:
        lat: 緯度
        lon: 經度
        bounds: 邊界 {'minLat', 'maxLat', 'minLng', 'maxLng'}
    
    Returns:
        bool: 是否在邊界內
    """
    return (bounds['minLat'] <= lat <= bounds['maxLat'] and
            bounds['minLng'] <= lon <= bounds['maxLng'])


def is_valid_zoom(zoom: int) -> bool:
    """驗證縮放層級有效性"""
    return TMSConfig.MIN_ZOOM <= zoom <= TMSConfig.MAX_ZOOM


def get_recommended_zoom(bounds: Dict[str, float]) -> int:
    """
    根據區域大小建議縮放層級
    
    Args:
        bounds: 區域邊界
    
    Returns:
        int: 建議的縮放層級
    """
    # 計算區域大小
    lat_range = bounds['maxLat'] - bounds['minLat']
    lon_range = bounds['maxLng'] - bounds['minLng']
    
    # 根據範圍推薦縮放層級
    if lat_range < 0.01 and lon_range < 0.01:  # 小於 1km
        return 19
    elif lat_range < 0.05 and lon_range < 0.05:  # 小於 5km
        return 18
    elif lat_range < 0.1 and lon_range < 0.1:  # 小於 10km
        return 17
    elif lat_range < 0.5 and lon_range < 0.5:  # 小於 50km
        return 16
    elif lat_range < 1.0 and lon_range < 1.0:  # 小於 100km
        return 15
    else:
        return 14