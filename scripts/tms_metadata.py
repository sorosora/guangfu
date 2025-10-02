#!/usr/bin/env python3
"""
OGC TMS (Tile Matrix Set) 標準相容的 metadata 生成器
符合開放地理空間聯盟 (OGC) Two Dimensional Tile Matrix Set 標準
"""

import json
import time
from typing import Dict, List, Optional
from datetime import datetime

# 光復鄉地理邊界
GUANGFU_BOUNDS = {
    'north_west': {'lat': 23.68137, 'lon': 121.41771},
    'north_east': {'lat': 23.68108, 'lon': 121.45639},
    'south_west': {'lat': 23.65397, 'lon': 121.41760},
    'south_east': {'lat': 23.65396, 'lon': 121.45657},
}

# 計算邊界
MIN_LON = min(GUANGFU_BOUNDS['north_west']['lon'], GUANGFU_BOUNDS['south_west']['lon'])
MAX_LON = max(GUANGFU_BOUNDS['north_east']['lon'], GUANGFU_BOUNDS['south_east']['lon'])
MIN_LAT = min(GUANGFU_BOUNDS['south_west']['lat'], GUANGFU_BOUNDS['south_east']['lat'])
MAX_LAT = max(GUANGFU_BOUNDS['north_west']['lat'], GUANGFU_BOUNDS['north_east']['lat'])

class TMSMetadataGenerator:
    """TMS 標準 metadata 生成器"""
    
    def __init__(self):
        self.tile_size = 256
        self.grid_width = 800
        self.grid_height = 600
        
    def generate_tilesetmetadata(self) -> Dict:
        """生成符合 OGC 標準的圖磚集 metadata"""
        return {
            "dataType": "vector",
            "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
            "tileMatrixSetURI": "http://www.opengis.net/def/tilematrixset/OGC/1.0/WebMercatorQuad",
            "title": "花蓮縣光復鄉颱風清淤進度地圖",
            "description": "即時顯示花蓮縣光復鄉颱風後清淤工作進度的互動式地圖，包含民眾回報和清理狀態資訊",
            "keywords": [
                "花蓮縣", "光復鄉", "颱風", "清淤", "災後復原", 
                "即時地圖", "群眾外包", "開放資料", "Taiwan", "Hualien", "Cleanup"
            ],
            "attribution": "資料來源：民眾即時回報系統 | Data Source: Citizen Reporting System",
            "bounds": [MIN_LON, MIN_LAT, MAX_LON, MAX_LAT],
            "center": [
                (MIN_LON + MAX_LON) / 2,
                (MIN_LAT + MAX_LAT) / 2
            ],
            "minzoom": 0,
            "maxzoom": 0,
            "pixel_scale": 5,  # 5m 精度
            "grid_dimensions": {
                "width": self.grid_width,
                "height": self.grid_height
            },
            "coverage_area": {
                "physical_size": "4km × 3km",
                "total_grids": self.grid_width * self.grid_height
            },
            "update_frequency": "每 5 分鐘 / Every 5 minutes",
            "data_source": {
                "type": "crowdsourced",
                "method": "GPS-based citizen reporting",
                "trust_algorithm": "範圍效應加權信任演算法"
            },
            "contact": {
                "organization": "光復鄉災後復原資訊系統",
                "email": "contact@guangfu-recovery.gov.tw"
            },
            "license": "CC BY 4.0",
            "created": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "schema_version": "1.0.0",
            "ogc_compliance": "OGC Two Dimensional Tile Matrix Set Standard"
        }

    def generate_tilematrixset(self) -> Dict:
        """生成 TMS 圖磚矩陣集定義"""
        return {
            "type": "TileMatrixSetType",
            "identifier": "GuangfuCleanupGrid",
            "title": "光復鄉清淤網格系統",
            "abstract": "專為光復鄉清淤工作設計的 5m 精度網格圖磚矩陣",
            "keywords": ["cleanup", "grid", "5m", "precision"],
            "supportedCRS": "urn:ogc:def:crs:OGC:1.3:CRS84",
            "wellKnownScaleSet": "urn:ogc:def:wkss:OGC:1.0:GuangfuCustom",
            "boundingBox": {
                "type": "BoundingBoxType",
                "crs": "urn:ogc:def:crs:OGC:1.3:CRS84",
                "lowerCorner": [MIN_LON, MIN_LAT],
                "upperCorner": [MAX_LON, MAX_LAT]
            },
            "tileMatrix": [
                {
                    "type": "TileMatrixType",
                    "identifier": "0",
                    "scaleDenominator": 1.0,
                    "topLeftCorner": [MIN_LON, MAX_LAT],
                    "tileWidth": self.tile_size,
                    "tileHeight": self.tile_size,
                    "matrixWidth": (self.grid_width + self.tile_size - 1) // self.tile_size,
                    "matrixHeight": (self.grid_height + self.tile_size - 1) // self.tile_size
                }
            ]
        }

    def generate_versions_metadata(self, versions: List[str]) -> Dict:
        """生成版本管理 metadata"""
        return {
            "type": "VersionCollection",
            "title": "光復鄉清淤地圖版本歷史",
            "description": "所有歷史版本的完整記錄，提供時間序列分析和回溯功能",
            "versions": [
                {
                    "version": version,
                    "timestamp": version,
                    "iso_datetime": datetime.fromtimestamp(int(version)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "url": f"{version}/",
                    "metadata_url": f"{version}/metadata.json"
                }
                for version in sorted(versions, reverse=True)
            ],
            "total_versions": len(versions),
            "latest_version": versions[0] if versions else None,
            "created": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "update_policy": "每次網格狀態變更時創建新版本"
        }

    def generate_version_metadata(self, version: str, stats: Dict, 
                                affected_tiles: List, grid_coverage: Dict) -> Dict:
        """生成特定版本的 metadata"""
        version_time = datetime.fromtimestamp(int(version))
        
        return {
            "type": "TilesetMetadata",
            "version": version,
            "title": f"光復鄉清淤地圖 - {version_time.strftime('%Y-%m-%d %H:%M:%S')}",
            "description": f"版本 {version} 的清淤狀態快照",
            "created": version_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "bounds": [MIN_LON, MIN_LAT, MAX_LON, MAX_LAT],
            "minzoom": 0,
            "maxzoom": 0,
            "attribution": "資料來源：民眾即時回報系統",
            "license": "CC BY 4.0",
            "generation_stats": {
                "execution_time_seconds": stats.get('execution_time', 0),
                "redis_requests": stats.get('redis_requests', 0),
                "tiles_processed": stats.get('tiles_processed', 0),
                "bytes_uploaded": stats.get('bytes_uploaded', 0),
                "generation_mode": stats.get('generation_mode', 'unknown')
            },
            "coverage": {
                "affected_tiles": len(affected_tiles),
                "affected_tile_coordinates": affected_tiles,
                "grid_states": grid_coverage,
                "total_reported_grids": sum(1 for state in grid_coverage.values() if state != -1),
                "clear_grids": sum(1 for state in grid_coverage.values() if state == 0),
                "muddy_grids": sum(1 for state in grid_coverage.values() if state == 1),
                "undefined_grids": sum(1 for state in grid_coverage.values() if state == -1)
            },
            "tile_format": "image/png",
            "tile_mime_type": "image/png",
            "encoding": "PNG with RGBA channels",
            "coordinate_system": {
                "crs": "EPSG:4326",
                "datum": "WGS84",
                "projection": "Geographic"
            },
            "spatial_reference": {
                "grid_precision_meters": 5,
                "pixel_to_meter_ratio": "1:5",
                "coverage_area_km2": 12.0
            },
            "data_quality": {
                "last_reports_considered": stats.get('last_reports_timestamp', None),
                "trust_algorithm_version": "1.0",
                "confidence_level": "high"
            },
            "access_urls": {
                "tile_pattern": f"{version}/0/{{x}}/{{y}}.png",
                "metadata": f"{version}/metadata.json",
                "bounds": f"{version}/bounds/0.json"
            },
            "ogc_compliance": {
                "standard": "OGC Two Dimensional Tile Matrix Set",
                "version": "1.0",
                "profile": "WebMercatorQuad"
            }
        }

    def generate_bounds_metadata(self, zoom_level: int, existing_tiles: List) -> Dict:
        """生成邊界和覆蓋範圍 metadata"""
        if not existing_tiles:
            return {
                "zoom_level": zoom_level,
                "bounds": [MIN_LON, MIN_LAT, MAX_LON, MAX_LAT],
                "tile_count": 0,
                "tiles": [],
                "coverage_percentage": 0.0
            }
        
        # 計算實際覆蓋範圍
        tile_coords = [(int(t.split('/')[0]), int(t.split('/')[1])) for t in existing_tiles]
        min_x = min(coord[0] for coord in tile_coords)
        max_x = max(coord[0] for coord in tile_coords)
        min_y = min(coord[1] for coord in tile_coords)
        max_y = max(coord[1] for coord in tile_coords)
        
        total_possible_tiles = ((self.grid_width + self.tile_size - 1) // self.tile_size) * \
                             ((self.grid_height + self.tile_size - 1) // self.tile_size)
        
        return {
            "zoom_level": zoom_level,
            "bounds": [MIN_LON, MIN_LAT, MAX_LON, MAX_LAT],
            "actual_coverage": {
                "min_tile_x": min_x,
                "max_tile_x": max_x,
                "min_tile_y": min_y,
                "max_tile_y": max_y
            },
            "tile_count": len(existing_tiles),
            "total_possible_tiles": total_possible_tiles,
            "coverage_percentage": round((len(existing_tiles) / total_possible_tiles) * 100, 2),
            "tiles": existing_tiles,
            "sparse_coverage": True,
            "last_updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        }

def create_metadata_files():
    """創建範例 metadata 檔案"""
    generator = TMSMetadataGenerator()
    
    # 生成範例檔案
    tilesetmetadata = generator.generate_tilesetmetadata()
    tilematrixset = generator.generate_tilematrixset()
    versions_meta = generator.generate_versions_metadata(["1759299905", "1759296335"])
    
    sample_stats = {
        'execution_time': 2.1,
        'redis_requests': 6,
        'tiles_processed': 1,
        'bytes_uploaded': 345,
        'generation_mode': 'incremental_with_copy'
    }
    
    version_meta = generator.generate_version_metadata(
        "1759299905", 
        sample_stats,
        [{"x": 1, "y": 1}],
        {"400_300": 0, "401_300": 0, "400_301": 0}
    )
    
    bounds_meta = generator.generate_bounds_metadata(0, ["1/1"])
    
    print("📄 範例 TMS Metadata 檔案已生成")
    print("\n🔖 tilesetmetadata.json:")
    print(json.dumps(tilesetmetadata, indent=2, ensure_ascii=False))
    
    print("\n🗂️ tilematrixset.json:")
    print(json.dumps(tilematrixset, indent=2, ensure_ascii=False))
    
    print("\n📅 versions.json:")
    print(json.dumps(versions_meta, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    create_metadata_files()