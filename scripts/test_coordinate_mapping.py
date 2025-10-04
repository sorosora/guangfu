#!/usr/bin/env python3
"""
座標轉換精度測試工具
用於診斷和驗證經緯度到像素的映射精度
"""

import os
import sys
import math

# 確保能正確導入本地模組
scripts_dir = os.path.dirname(os.path.abspath(__file__))
if scripts_dir not in sys.path:
    sys.path.insert(0, scripts_dir)

from utils.coordinate_utils import (
    lat_lon_to_tile_coords, tile_to_lat_lon_bounds, 
    lat_lon_to_tile_pixel, TMSConfig
)

def test_coordinate_precision():
    """測試座標轉換精度"""
    print("🧪 === 座標轉換精度測試 ===")
    
    # 測試台北地區的座標（與 preview 區域相同）
    test_coords = [
        (25.0873, 121.4583),  # 基準點
        (25.0873, 121.4584),  # 經度 +0.0001
        (25.0874, 121.4583),  # 緯度 +0.0001
        (25.0875, 121.4585),  # 對角線移動
    ]
    
    zoom_levels = [14, 17, 18, 19]
    
    for zoom in zoom_levels:
        print(f"\n📏 Zoom Level {zoom} 測試:")
        print(f"理論精度: ~{2**(19-zoom):.1f} 像素/點")
        
        for i, (lat, lon) in enumerate(test_coords):
            # 計算圖磚座標
            tile_x, tile_y, tile_z = lat_lon_to_tile_coords(lat, lon, zoom)
            
            # 獲取圖磚邊界
            bounds = tile_to_lat_lon_bounds(tile_x, tile_y, zoom)
            
            # 檢查是否在邊界內
            in_bounds = (bounds['minLat'] <= lat <= bounds['maxLat'] and
                        bounds['minLng'] <= lon <= bounds['maxLng'])
            
            print(f"  {i+1}. ({lat}, {lon})")
            print(f"     圖磚: {tile_x}/{tile_y}")
            print(f"     邊界: lat({bounds['minLat']:.6f}, {bounds['maxLat']:.6f}), lng({bounds['minLng']:.6f}, {bounds['maxLng']:.6f})")
            print(f"     在邊界內: {in_bounds}")
            
            if in_bounds:
                try:
                    pixel_x, pixel_y = lat_lon_to_tile_pixel(lat, lon, tile_x, tile_y, zoom)
                    print(f"     像素: ({pixel_x}, {pixel_y})")
                except Exception as e:
                    print(f"     像素計算失敗: {e}")
            else:
                print(f"     ❌ 座標超出圖磚邊界")
        
        # 計算相鄰座標的像素距離
        if len(test_coords) >= 2:
            print(f"\n📐 相鄰座標像素距離分析 (Zoom {zoom}):")
            base_coord = test_coords[0]
            base_tile_x, base_tile_y, _ = lat_lon_to_tile_coords(base_coord[0], base_coord[1], zoom)
            
            try:
                base_pixel_x, base_pixel_y = lat_lon_to_tile_pixel(
                    base_coord[0], base_coord[1], base_tile_x, base_tile_y, zoom
                )
                
                for j, coord in enumerate(test_coords[1:], 1):
                    tile_x, tile_y, _ = lat_lon_to_tile_coords(coord[0], coord[1], zoom)
                    
                    # 如果在同一圖磚內，計算像素距離
                    if tile_x == base_tile_x and tile_y == base_tile_y:
                        try:
                            pixel_x, pixel_y = lat_lon_to_tile_pixel(
                                coord[0], coord[1], tile_x, tile_y, zoom
                            )
                            
                            pixel_distance = math.sqrt(
                                (pixel_x - base_pixel_x)**2 + (pixel_y - base_pixel_y)**2
                            )
                            
                            geo_distance = math.sqrt(
                                (coord[0] - base_coord[0])**2 + (coord[1] - base_coord[1])**2
                            )
                            
                            print(f"     座標 {j}: 地理距離 {geo_distance:.6f}° -> 像素距離 {pixel_distance:.1f}")
                        except Exception as e:
                            print(f"     座標 {j}: 像素計算失敗: {e}")
                    else:
                        print(f"     座標 {j}: 在不同圖磚 {tile_x}/{tile_y}")
                        
            except Exception as e:
                print(f"     基準座標像素計算失敗: {e}")

def test_tile_boundaries():
    """測試圖磚邊界的連續性"""
    print(f"\n🗺️  === 圖磚邊界連續性測試 ===")
    
    # 測試相鄰圖磚的邊界是否連續
    zoom = 19
    test_tile_x, test_tile_y = 439030, 224380
    
    tiles_to_test = [
        (test_tile_x, test_tile_y, "中心"),
        (test_tile_x + 1, test_tile_y, "右鄰"),
        (test_tile_x, test_tile_y + 1, "下鄰"),
        (test_tile_x + 1, test_tile_y + 1, "右下")
    ]
    
    for tile_x, tile_y, desc in tiles_to_test:
        bounds = tile_to_lat_lon_bounds(tile_x, tile_y, zoom)
        print(f"圖磚 {tile_x}/{tile_y} ({desc}):")
        print(f"  Lat: {bounds['minLat']:.8f} ~ {bounds['maxLat']:.8f}")
        print(f"  Lng: {bounds['minLng']:.8f} ~ {bounds['maxLng']:.8f}")
        print(f"  大小: {bounds['maxLat']-bounds['minLat']:.8f}° x {bounds['maxLng']-bounds['minLng']:.8f}°")

def calculate_theoretical_precision():
    """計算理論精度"""
    print(f"\n📊 === 理論精度計算 ===")
    
    # 在台灣緯度 25° 的情況下
    lat = 25.0
    
    for zoom in [14, 17, 18, 19, 20, 21, 22, 23]:
        # 計算圖磚大小（度）
        tile_count = 2 ** zoom
        lat_size = 360.0 / tile_count  # 緯度方向的圖磚大小
        lng_size = 360.0 / tile_count  # 經度方向的圖磚大小
        
        # 計算像素精度（度/像素）
        lat_precision = lat_size / TMSConfig.TILE_SIZE
        lng_precision = lng_size / TMSConfig.TILE_SIZE
        
        # 轉換為公尺（概略）
        lat_meters = lat_precision * 111320  # 1度緯度約 111.32 km
        lng_meters = lng_precision * 111320 * math.cos(math.radians(lat))  # 經度在緯度25°的修正
        
        print(f"Zoom {zoom}:")
        print(f"  圖磚大小: {lat_size:.8f}° x {lng_size:.8f}°")
        print(f"  像素精度: {lat_precision:.8f}°/pixel x {lng_precision:.8f}°/pixel")
        print(f"  地理精度: {lat_meters:.2f}m/pixel x {lng_meters:.2f}m/pixel")
        print(f"  0.0001° 對應: {0.0001/lat_precision:.1f} x {0.0001/lng_precision:.1f} 像素")

def main():
    """主程式"""
    print("🔬 座標轉換診斷工具")
    print("=" * 50)
    
    calculate_theoretical_precision()
    test_coordinate_precision()
    test_tile_boundaries()
    
    print(f"\n✅ 測試完成")

if __name__ == "__main__":
    main()