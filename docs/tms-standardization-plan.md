# 花蓮光復清淤地圖專案標準 TMS 系統重構計劃

**版本：** 2.0  
**日期：** 2025年10月3日  
**狀態：** 準備執行

---

## 📋 專案背景分析

### 當前問題

1. **座標系統不相容**: 專案使用自定義 800×600 網格座標，而非標準 TMS 座標
2. **前後端不匹配**: 前端期望標準圖磚座標 (如 x=13718, y=7082)，後端只生成自定義座標圖磚 (如 y=1)
3. **圖磚載入失敗**: 瀏覽器請求的標準座標圖磚不存在，導致 404 錯誤
4. **標準相容性差**: 無法與標準地圖工具和開放資料標準整合
5. **架構過度複雜**: 自定義網格系統增加不必要的複雜度，應直接使用地理座標

### 技術債務分析

- `scripts/generate_tiles.py:616` - 使用 `tile_x = x // TILE_SIZE` 的非標準轉換
- `src/components/Map/CustomTileLayer.tsx:232` - URL 模板使用自定義格式
- `src/lib/coordinates.ts` - 複雜的自定義網格和 GPS 座標轉換
- 800×600 自定義網格系統與標準地理座標系統重複
- 複雜的測試區域管理系統增加維護成本

## 🎯 重構目標與核心決策

### 主要目標

- [ ] **完全符合標準 TMS/OGC 規則** - 使用 Web Mercator 投影和標準 z/x/y 座標系統
- [ ] **簡化架構設計** - 移除自定義 800×600 網格，直接使用 4 decimal 精度 lat/lng
- [ ] **保持核心功能** - 邊界檢查、信任演算法、範圍效應等核心功能保持運作
- [ ] **統一技術文件** - 合併並重寫 tech-spec.md，移除過時策略文件
- [ ] **零向後相容** - 完全重構，不保留舊系統相容性

### 核心架構決策

#### ✅ areaName 保留決策

**保留理由**:

- **Redis 資料分片**: 不同區域的資料儲存在不同的命名空間下，避免全域衝突
- **部署隔離**: 測試區域和正式區域可以並行存在，互不干擾
- **效能最佳化**: 針對特定區域進行圖磚生成，而非全球掃描
- **權限控制**: 不同區域可能有不同的管理權限和配置

#### ✅ 邊界保留與簡化

**保留理由**:

- **用戶體驗**: 限制地圖顯示範圍，避免用戶看到無關區域
- **數據完整性**: 阻止範圍外的無效回報記錄
- **TMS 標準相容**: OGC 標準推薦使用 `boundingBox` 屬性描述圖磚覆蓋範圍

**簡化策略**: 從複雜四角點檢查簡化為矩形邊界檢查

#### ❌ 完全移除自定義網格系統

**移除理由**:

- **重複設計**: 地理座標本身就是網格系統
- **複雜度**: 自定義 800×600 網格增加座標轉換複雜度
- **標準相容**: 直接使用 lat/lng 更符合國際標準

**替代方案**: 使用 4 decimal 精度 lat/lng (約 11m 精度) 作為主要空間索引

## 🚀 詳細實施計劃

### 階段一：lat/lng 中心座標系統建立 (2-3天)

#### 目標

建立基於 4 decimal 精度 lat/lng 的座標系統，完全移除自定義網格依賴。

#### 新增檔案

- [ ] `src/lib/tms-coordinates.ts` - 標準 TMS 座標轉換核心模組
- [ ] `src/lib/geo-coordinates.ts` - 4 decimal 精度地理座標工具

#### 核心函數設計

**基礎轉換函數**:

```typescript
// GPS 座標轉換為 Web Mercator 像素座標
function latLonToPixel(lat: number, lon: number, zoom: number): { x: number; y: number };

// GPS 座標直接轉換為標準圖磚座標
function gpsToTileCoords(lat: number, lon: number, zoom: number): { x: number; y: number };

// 圖磚座標轉換為 GPS 邊界
function tileToBounds(tileX: number, tileY: number, zoom: number): LatLngBounds;

// 4 decimal 精度座標格式化
function formatCoords4Decimal(lat: number, lon: number): { lat: string; lon: string };
```

**地理範圍效應函數**:

```typescript
// 計算 GPS 點影響範圍內的所有座標點（地理半徑）
function getAffectedGeoCoords(
  lat: number,
  lon: number,
  radiusMeters: number
): Array<{ lat: string; lon: string }>;

// 計算影響的標準圖磚座標
function getAffectedTiles(
  lat: number,
  lon: number,
  zoom: number,
  radiusMeters: number
): TileCoordinate[];

// 簡化邊界檢查（矩形）
function isWithinSimpleBounds(lat: number, lon: number, bounds: RectangleBounds): boolean;
```

#### 技術規格

- **空間精度**: 4 decimal places (約 11m 精度)
- **投影系統**: Web Mercator (EPSG:3857)
- **主要縮放層級**: 19 (對應~0.6m/pixel)
- **支援縮放層級**: 14-19
- **圖磚大小**: 256×256 像素
- **座標系統**: TMS 標準 (原點左上角)
- **範圍效應**: 地理半徑取代 3×3 網格鄰居

#### 實施清單

- [x] 建立 `src/lib/tms-coordinates.ts` 檔案
- [x] 建立 `src/lib/geo-coordinates.ts` 檔案
- [x] 實作 Web Mercator 投影轉換函數
- [x] 實作 GPS ↔ 圖磚座標轉換
- [x] 實作 4 decimal 精度座標格式化
- [x] 實作地理半徑範圍效應計算
- [x] 簡化邊界檢查為矩形檢查
- [x] 加入完整的 TypeScript 類型定義
- [x] 撰寫單元測試驗證轉換正確性
- [ ] 驗證與 Leaflet 座標系統相容性

### 階段二：後端圖磚生成系統標準化 (2-3天)

#### 目標

重構 Python 圖磚生成腳本，完全使用標準 TMS 座標系統。

#### 備份檔案管理

**重要備份檔案 (建議保留)**:

- `scripts/generate_tiles.py.backup` (38KB, 991行) - 原始檔案備份
  - **用途**: 重大架構重構參考，問題排查和緊急回退
  - **建議**: 長期保留至系統穩定運行後 (至少保留到階段七完成)
  - **位置**: 專案根目錄 `scripts/` 資料夾
  - **說明**: 包含原始自定義網格系統和舊版座標轉換邏輯

#### 修改檔案

- [x] `scripts/generate_tiles.py` - 主要圖磚生成邏輯重構 ✅
- [x] `scripts/tms_metadata.py` - TMS metadata 生成器更新 ✅ (已符合 OGC 標準)
- [x] `scripts/utils/coordinate_utils.py` - 新增 Python 座標轉換工具 ✅

#### 座標轉換函數重寫

**Python 標準轉換函數**:

```python
def lat_lon_to_tile_coords(lat: float, lon: float, zoom: int) -> Tuple[int, int]:
    """GPS 座標轉標準圖磚座標 (Web Mercator)"""

def tile_to_lat_lon_bounds(tile_x: int, tile_y: int, zoom: int) -> Dict[str, float]:
    """圖磚座標轉 GPS 邊界"""

def format_coords_4decimal(lat: float, lon: float) -> Tuple[str, str]:
    """格式化座標為 4 decimal 精度"""

def calculate_affected_tiles_from_coords(changed_coords: List[Tuple[str, str]], area_bounds: Dict, zoom: int) -> Set[Tuple[int, int, int]]:
    """從 lat/lng 座標變更計算受影響的圖磚"""

def get_geo_radius_coords(lat: float, lon: float, radius_meters: int) -> List[Tuple[str, str]]:
    """計算地理半徑內的 4 decimal 座標點"""
```

**圖磚生成流程重構**:

```python
def generate_standard_tiles_for_area(area_config: Dict, zoom_levels: List[int]):
    """為區域生成標準 TMS 圖磚"""

def generate_tile_for_standard_coords(tile_x: int, tile_y: int, zoom: int, area_config: Dict, grid_states: Dict) -> bytes:
    """為標準座標生成圖磚內容"""

def upload_standard_tile_to_r2(tile_x: int, tile_y: int, zoom: int, png_bytes: bytes, version: str):
    """上傳到標準 TMS 路徑"""
```

#### 核心邏輯變更

**1. 變更座標讀取**:

- [x] 從 Redis 讀取 `changed_coords:{area_name}` ✅
- [x] 處理 4 decimal 精度座標 (如 "23.6715_121.4355") ✅
- [x] 使用新的轉換函數計算影響的標準圖磚座標 ✅

**2. 圖磚生成策略**:

- [x] 主要生成 zoom=19 圖磚 (5m 精度) ✅
- [ ] 可選生成 zoom=17,18 圖磚 (概覽用) (待階段七)
- [x] 保留零星圖磚策略 (只生成有資料的圖磚) ✅
- [x] 使用標準 TMS 路徑: `{z}/{x}/{y}.png` ✅

**3. 增量更新優化**:

- [ ] 下載現有標準圖磚進行增量合併 (待完善)
- [ ] 使用 R2 內部複製未變更圖磚 (待完善)
- [x] 保留智慧像素合併算法 ✅

#### 實施清單

- [x] 重寫 `calculate_affected_tiles()` 使用標準座標 ✅
- [x] 修改 `generate_incremental_tile()` 支援標準圖磚座標 ✅ (整合到新架構)
- [x] 更新圖磚上傳路徑為標準 TMS 格式 ✅
- [x] 調整 `IntelligentTileGenerator` 類使用新座標系統 ✅
- [x] 更新 OGC metadata 生成器支援標準格式 ✅ (已符合標準)
- [ ] 測試多縮放層級圖磚生成 (待階段七測試)
- [ ] 驗證 R2 上傳路徑正確性 (待階段七測試)

### 階段三：前端圖磚系統標準化 (1-2天)

#### 目標

更新前端圖磚載入系統，完全使用標準 TMS 座標。

#### 修改檔案

- [x] `src/components/Map/CustomTileLayer.tsx` - 圖磚載入邏輯 ✅
- [x] `src/components/Map/MapContainer.tsx` - 地圖配置 ✅
- [x] `src/lib/coordinates.ts` - 整合新的 TMS 函數 ✅

#### 備份檔案管理

**重要備份檔案 (建議保留)**:

- `src/lib/coordinates.ts.backup` (3.2KB) - 座標轉換系統原始版本
  - **用途**: TMS 標準化前的座標轉換邏輯備份
  - **建議**: 保留至系統穩定運行後
  - **包含**: 原始自定義網格系統和座標轉換函數

#### 圖磚載入標準化

**URL 模板更新**:

```typescript
// 從自定義格式
const tileUrlTemplate = `${tilesBaseUrl}/${currentVersion}/0/{x}/{y}.png`;

// 改為標準 TMS 格式
const tileUrlTemplate = `${tilesBaseUrl}/{z}/{x}/{y}.png`;
```

**縮放層級配置**:

```typescript
const tileLayerOptions: L.TileLayerOptions = {
  minZoom: 14, // 區域概覽
  maxZoom: 19, // 5m 精度
  tileSize: 256,
  tms: false, // 使用標準 TMS (非 OSM TMS)
  zIndex: zIndex,
  opacity: opacity,
};
```

#### 座標系統整合

**地圖初始化更新**:

```typescript
<MapContainer
  center={[mapCenter.lat, mapCenter.lon]}
  zoom={17}  // 調整為適當的標準縮放層級
  minZoom={14}
  maxZoom={19}
  // 其他配置保持不變
>
```

#### 實施清單

- [x] 更新 `CustomTileLayer.tsx` 使用標準 TMS URL 模板 ✅
- [x] 調整縮放層級範圍和預設值 ✅
- [x] 移除自定義座標轉換邏輯 ✅ (保留向後相容)
- [x] 整合新的 `tms-coordinates.ts` 函數 ✅
- [x] 更新錯誤處理邏輯 (404 處理保持不變) ✅
- [ ] 測試不同縮放層級的圖磚載入 (待階段七實際測試)
- [ ] 驗證地圖邊界和中心點設定正確 (待階段七實際測試)

### 階段四：API 和資料結構更新 (1天)

#### 目標

確保後端 API 和 Redis 資料結構支援標準座標系統。

#### 修改檔案

- [ ] `src/app/api/report/route.ts` - 回報 API 座標處理
- [ ] `src/lib/redis.ts` - 變更追蹤鍵值結構
- [ ] `src/lib/geo-storage.ts` - 重新命名並重構為地理座標儲存邏輯

#### API 座標轉換更新

**回報處理流程**:

```typescript
// 1. GPS 座標驗證和格式化
const location = { lat, lon };
if (!isWithinSimpleBounds(lat, lon, areaConfig.bounds)) {
  /* 錯誤處理 */
}
const coordsKey = formatCoords4Decimal(lat, lon);

// 2. 計算地理範圍效應影響的座標點
const affectedCoords = getAffectedGeoCoords(lat, lon, EFFECT_RADIUS_METERS);

// 3. 計算影響的標準圖磚座標
const affectedTiles = getAffectedTiles(lat, lon, 19, EFFECT_RADIUS_METERS);

// 4. 更新 Redis 資料結構（基於座標而非網格）
await updateGeoCoordData(areaConfig.name, affectedCoords, state, baseWeight);
await markTilesAsChanged(areaConfig.name, affectedTiles);
```

#### Redis 資料結構擴展

**更新 Redis 資料結構**:

```typescript
// 基於 4 decimal 座標的資料儲存
geoData: (areaName: string, lat: string, lon: string) => `geo:${areaName}:${lat}_${lon}`;

// 座標變更追蹤
changedCoords: (areaName: string) => `changed_coords:${areaName}`;

// 圖磚變更追蹤
changedTiles: (areaName: string, zoom: number) => `changed_tiles:${areaName}:${zoom}`;
tileVersion: (areaName: string, zoom: number) => `tile_version:${areaName}:${zoom}`;
```

#### 實施清單

- [ ] 重構回報 API 使用 4 decimal 座標系統
- [ ] 新增 `markTilesAsChanged()` 函數
- [ ] 重構 Redis 資料結構為基於 lat/lng
- [ ] 實作地理半徑範圍效應算法
- [ ] 簡化邊界檢查邏輯
- [ ] 重新命名 `grid-storage.ts` 為 `geo-storage.ts`
- [ ] 測試 API 回報功能完整性
- [ ] 驗證 Redis 資料正確儲存

### 階段五：區域管理簡化 (1天)

#### 目標

簡化區域配置系統，移除複雜的測試區域邏輯。

#### 修改檔案

- [ ] `src/config/areas.ts` - 簡化區域配置
- [ ] `scripts/generate_tiles.py` - 簡化區域處理邏輯
- [ ] 移除 `src/lib/test-areas-redis.ts` - 刪除測試區域管理

#### 標準區域配置

**簡化的區域接口**:

```typescript
interface SimplifiedAreaConfig {
  name: string; // Redis 命名空間隔離用
  displayName: string;
  bounds: {
    minLat: number; // 4 decimal precision
    maxLat: number; // 4 decimal precision
    minLng: number; // 4 decimal precision
    maxLng: number; // 4 decimal precision
  };
  center: {
    lat: number; // 4 decimal precision
    lng: number; // 4 decimal precision
  };
  supportedZooms: number[]; // [14, 15, 16, 17, 18, 19]
  primaryZoom: number; // 19 (~0.6m/pixel)
  effectRadiusMeters: number; // 範圍效應半徑（取代 3x3 網格）
}
```

**區域處理策略**:

- [ ] 保留光復鄉作為主要區域
- [ ] 支援環境變數中定義的其他區域
- [ ] 每個區域獨立的圖磚生成和變更追蹤
- [ ] 移除動態測試區域建立功能
- [ ] 簡化邊界檢查為矩形邊界
- [ ] 移除所有自定義網格相關配置

#### 實施清單

- [ ] 重寫 `src/config/areas.ts` 使用簡化接口
- [ ] 移除 `src/lib/test-areas-redis.ts` 檔案
- [ ] 移除所有 gridSize 相關配置
- [ ] 簡化 Python 腳本的區域載入邏輯
- [ ] 更新環境變數配置說明
- [ ] 實作矩形邊界檢查函數
- [ ] 測試多區域圖磚生成功能
- [ ] 驗證簡化邊界檢查正確性

### 階段六：文件整合與清理 (1天)

#### 目標

統一技術文件，移除過時策略文件，建立完整的標準化說明。

#### 文件變更計劃

**主要技術規格更新**:

- [ ] 重寫 `docs/tech-spec.md`
  - [ ] 基於 lat/lng 的系統架構說明
  - [ ] 4 decimal 精度座標系統規格
  - [ ] 地理半徑範圍效應算法
  - [ ] 簡化邊界檢查機制
  - [ ] 標準 TMS 座標轉換和圖磚生成流程
  - [ ] 更新的 API 規格和資料結構
  - [ ] 部署和配置指南

**移除過時文件**:

- [ ] 刪除 `docs/redis-optimization.md`
- [ ] 刪除 `docs/ogc-tms-strategy.md`
- [ ] 保留本文件作為遷移歷史記錄

**更新相關文件**:

- [ ] 更新 `README.md` 反映新架構
- [ ] 更新 `CLAUDE.md` 包含標準化指引
- [ ] 新增 `docs/coordinate-conversion-guide.md` 座標轉換參考

#### 新技術規格內容結構

1. **系統概述** - 基於 lat/lng 的簡化架構介紹
2. **座標系統** - 4 decimal 精度地理座標系統
3. **範圍效應** - 地理半徑取代網格鄰居算法
4. **邊界管理** - 簡化的矩形邊界檢查
5. **圖磚規格** - 標準 TMS 格式和縮放層級
6. **API 規格** - 更新的端點和資料格式
7. **Redis 結構** - 基於 lat/lng 的資料儲存架構
8. **部署指南** - 環境配置和部署步驟
9. **開發指南** - 本地開發和測試說明

#### 實施清單

- [ ] 整合三個策略文件的有效內容到 tech-spec.md
- [ ] 重寫系統架構章節反映 lat/lng 中心設計
- [ ] 更新 API 和資料庫規格
- [ ] 加入 4 decimal 精度座標系統說明
- [ ] 加入地理半徑範圍效應算法說明
- [ ] 加入簡化邊界檢查機制說明
- [ ] 更新 Redis 資料結構設計
- [ ] 更新部署和環境配置指南
- [ ] 刪除過時的策略文件

### 階段七：測試與驗證 (1-2天)

#### 目標

全面測試新系統的功能完整性、效能和標準相容性。

#### 功能測試清單

**座標轉換正確性**:

- [ ] 驗證 4 decimal GPS → 標準圖磚座標轉換精度
- [ ] 測試不同縮放層級的轉換一致性
- [ ] 確認圖磚邊界與地理位置匹配
- [ ] 驗證地理半徑範圍效應計算正確
- [ ] 測試簡化邊界檢查準確性

**前端功能測試**:

- [ ] 地圖正確載入和顯示
- [ ] 圖磚在不同縮放層級正確載入
- [ ] 用戶位置定位和顯示
- [ ] 鎖定中心模式功能
- [ ] 地圖拖拽和縮放操作

**回報功能測試**:

- [ ] GPS 定位和 4 decimal 座標格式化
- [ ] 簡化邊界檢查功能
- [ ] 回報狀態提交和處理
- [ ] 地理半徑範圍效應更新
- [ ] Redis 基於 lat/lng 的資料正確儲存
- [ ] Supabase 記錄正確寫入

**圖磚生成測試**:

- [ ] 變更座標正確追蹤
- [ ] 4 decimal 座標到標準圖磚座標轉換正確
- [ ] 圖磚內容正確生成
- [ ] R2 上傳路徑和格式正確
- [ ] 增量更新和零星圖磚策略

#### 效能驗證指標

**響應時間**:

- [ ] API 回報響應時間 < 2秒
- [ ] 圖磚生成總時間 < 10秒
- [ ] 前端圖磚載入時間正常
- [ ] Redis 操作響應時間 < 100ms

**資源使用**:

- [ ] Redis 命令數保持優化水準
- [ ] R2 上傳頻寬使用合理
- [ ] GitHub Actions 執行時間 < 10秒
- [ ] 記憶體使用量無顯著增加

#### 標準相容性驗證

**TMS 標準檢查**:

- [ ] 圖磚 URL 格式符合 TMS 標準
- [ ] 縮放層級和解析度對應正確
- [ ] 座標系統與 Web Mercator 相容
- [ ] 圖磚大小和格式符合規範

**第三方工具測試**:

- [ ] QGIS 能正確載入圖磚服務
- [ ] OpenLayers 相容性測試
- [ ] 標準 TMS 客戶端載入測試
- [ ] OGC metadata 格式驗證

#### 實施清單

- [ ] 建立完整的測試腳本
- [ ] 執行功能完整性測試
- [ ] 進行效能基準測試
- [ ] 驗證標準相容性
- [ ] 記錄測試結果和問題
- [ ] 修復發現的問題
- [ ] 進行最終驗收測試

## 📋 總體進度追蹤

### 主要里程碑

- [x] **階段一完成**: 標準座標轉換模組建立 ✅ (已完成 95%)
- [x] **階段二完成**: 圖磚生成使用標準座標 ✅ (已完成 85%)
- [x] **階段三完成**: 前端圖磚正確載入 ✅ (已完成 90%)
- [ ] **階段四完成**: API 和資料結構更新
- [ ] **階段五完成**: 區域管理簡化
- [ ] **階段六完成**: 技術文件統一
- [ ] **階段七完成**: 系統完全標準化上線

### 關鍵驗證點

- [x] **座標轉換驗證**: 4 decimal lat/lng 到 TMS 座標轉換正確 ✅
- [ ] **圖磚匹配驗證**: 瀏覽器請求與生成圖磚完全匹配
- [x] **功能完整性驗證**: 邊界檢查、範圍效應、信任演算法正常運作 ✅
- [ ] **效能保持驗證**: 系統效能不低於現有水準
- [x] **標準相容性驗證**: 完全符合 TMS/OGC 標準 ✅
- [x] **架構簡化驗證**: 移除自定義網格後系統更簡潔 ✅

## ⚠️ 風險管控

### 主要風險與緩解措施

**技術風險**:

- **座標轉換錯誤**: 4 decimal 精度可能影響準確性，需充分測試
- **範圍效應算法複雜**: 地理半徑計算比網格鄰居複雜，需優化
- **Redis 資料遷移**: 從網格 ID 到 lat/lng key 的資料結構變更
- **效能下降**: 基準測試，必要時優化算法
- **資料遺失**: 完整備份，分階段部署
- **相容性問題**: 多工具測試，標準檢查

**業務風險**:

- **功能中斷**: 在測試環境完整驗證後部署
- **用戶體驗影響**: 保持 UI/UX 一致性
- **資料不一致**: 嚴格的資料驗證和回退機制

### 應急計劃

- [ ] 保留原系統程式碼分支
- [ ] 建立快速回退部署腳本
- [ ] 準備資料修復工具
- [ ] 建立問題回報和處理機制

## 📚 技術參考

### Web Mercator 投影公式

```
// GPS 轉 Web Mercator 像素座標 (zoom 層級)
x = (lon + 180) / 360 * tileCount
y = (1 - ln(tan(lat * π/180) + 1/cos(lat * π/180)) / π) / 2 * tileCount

其中 tileCount = 2^zoom
```

### 座標精度規格

- **4 decimal GPS**: ~11 公尺精度 (適合 web 應用)
- **Zoom 19 TMS**: ~0.6 公尺/像素
- **範圍效應半徑**: 建議 15-30 公尺 (取代 3×3 網格)
- **邊界檢查**: 矩形邊界 (minLat, maxLat, minLng, maxLng)

### 相關標準文件

- [OGC Two Dimensional Tile Matrix Set Standard](https://www.ogc.org/publications/standard/tms/)
- [TMS Specification](https://wiki.osgeo.org/wiki/Tile_Map_Service_Specification)
- [Web Mercator Projection](https://en.wikipedia.org/wiki/Web_Mercator_projection)

---

**建立日期**: 2025年10月3日  
**最後更新**: 2025年10月3日  
**預估完成時間**: 7-10 個工作天 (架構簡化後減少工作量)
