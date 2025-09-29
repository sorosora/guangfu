# 花蓮光復清淤地圖專案指引

## 專案概述

這是一個為花蓮縣光復鄉颱風後清淤工作提供的即時互動地圖平台，讓民眾、救災人員及志工能快速回報與查看淤泥清理狀況。

## 核心功能

- **精準範圍地圖可視化**: 4km x 3km 範圍內的狀態網格顯示
- **GPS 現場回報**: 使用者在物理範圍內回報淤泥狀態
- **鎖定中心模式**: 地圖跟隨使用者位置移動
- **信任演算法**: 整合範圍效應的自動狀態判斷
- **即時更新**: 定期自動更新地圖資料

## 技術架構

### 前端

- **框架**: Next.js
- **UI 庫**: shadcn/ui
- **樣式**: Tailwind CSS
- **地圖**: Leaflet.js + react-leaflet
- **圖示**: lucide-react

### 後端

- **部署平台**: Vercel (API Routes)
- **資料庫**: Supabase (PostgreSQL)
- **快取**: Upstash (Redis)
- **背景任務**: GitHub Actions
- **檔案儲存**: Cloudflare R2

## 地圖規格

### 地理範圍 (WGS 84)

- 西北角: (23.68137, 121.41771)
- 東北角: (23.68108, 121.45639)
- 西南角: (23.65397, 121.41760)
- 東南角: (23.65396, 121.45657)

### 精度設定

- 物理尺寸: 4km × 3km
- 網格精度: 5m × 5m
- 網格維度: 800 × 600
- 總網格數: 480,000 個

## 專案結構

```
guangfu/
├── README.md
├── CLAUDE.md              # 專案指引
├── docs/                   # 詳細開發文件
│   ├── tech-spec.md      # 技術規格
|   └── plan.md             # 開發計劃
├── plan.md               # 執行計畫
├── package.json
├── next.config.js
├── tailwind.config.js
├── components.json        # shadcn/ui 配置
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/
│   │       └── report/
│   │           └── route.ts
│   ├── components/
│   │   ├── ui/           # shadcn/ui 元件
│   │   ├── Map/
│   │   │   ├── MapContainer.tsx
│   │   │   ├── TileLayer.tsx
│   │   │   └── LocationMarker.tsx
│   │   └── ReportButtons/
│   │       └── ReportButtons.tsx
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── supabase.ts
│   │   ├── redis.ts
│   │   └── coordinates.ts
│   └── types/
│       └── index.ts
├── scripts/
│   └── generate_tiles.py   # Python 圖磚生成腳本
└── .github/
    └── workflows/
        └── generate-tiles.yml
```

## 開發環境設定

### 必要軟體

- Node.js 18+
- Yarn (套件管理工具)
- Python 3.9+ (用於背景任務)

### 環境變數設定

#### 檔案結構

```
guangfu/
├── .env.example          # 開源專案範本（已提交）
├── .env.local.example    # 本地開發範本（已提交）
├── .env.local           # 本地環境變數（不提交）
└── .gitignore           # 確保 .env.local 不被提交
```

#### 設定步驟

1. **本地開發**: `cp .env.example .env.local`
2. **填入真實 API 金鑰**
3. **設定測試區域座標**（可選，用於開發測試）
   - 在 `.env.local` 中設定您當前位置的測試區域座標
   - 建議使用 4km × 3km 的範圍，與光復鄉相同尺寸
   - 如未設定，將使用程式碼中的預設測試區域
4. **檢查 .gitignore 確保 .env.local 被忽略**

#### 變數分類

**🌐 前端公開變數** (暴露於瀏覽器)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_TILES_BASE_URL=

# 測試區域配置（可選，用於開發測試）
NEXT_PUBLIC_TEST_AREA_NORTHWEST_LAT=
NEXT_PUBLIC_TEST_AREA_NORTHWEST_LON=
NEXT_PUBLIC_TEST_AREA_NORTHEAST_LAT=
NEXT_PUBLIC_TEST_AREA_NORTHEAST_LON=
NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LAT=
NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LON=
NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LAT=
NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LON=
NEXT_PUBLIC_TEST_AREA_CENTER_LAT=
NEXT_PUBLIC_TEST_AREA_CENTER_LON=
NEXT_PUBLIC_TEST_AREA_DESCRIPTION=
```

**🔒 後端私密變數** (僅伺服器端)

```env
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
```

#### 部署環境變數配置

**Vercel 部署** (設定於 Vercel Dashboard)

- 所有 `NEXT_PUBLIC_*` 變數
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**GitHub Actions** (設定於 GitHub Secrets)

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET_NAME`

### 測試區域配置

為保護開發者隱私，測試區域座標可透過環境變數設定，而非硬編碼於原始碼中。

#### 設定步驟

1. **確定測試區域**
   - 選擇您當前位置附近的區域
   - 建議使用與光復鄉相同的 4km × 3km 尺寸
   - 確保測試區域涵蓋您能實際到達的範圍

2. **獲取座標**
   - 使用 Google Maps 或其他地圖工具
   - 確定四個角落的經緯度座標
   - 計算區域中心點座標

3. **設定環境變數**
   - 在 `.env.local` 中加入所有測試區域環境變數
   - 參考 `.env.local.example` 中的範例格式
   - 確保所有座標都在有效範圍內（緯度 -90 到 90，經度 -180 到 180）

4. **驗證配置**
   - 啟動開發服務器：`yarn run dev`
   - 確認地圖顯示您設定的測試區域

#### 環境變數說明

```env
# 四個角落座標
NEXT_PUBLIC_TEST_AREA_NORTHWEST_LAT=25.055000  # 西北角緯度
NEXT_PUBLIC_TEST_AREA_NORTHWEST_LON=121.510000  # 西北角經度
NEXT_PUBLIC_TEST_AREA_NORTHEAST_LAT=25.055000  # 東北角緯度
NEXT_PUBLIC_TEST_AREA_NORTHEAST_LON=121.550000  # 東北角經度
NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LAT=25.020000  # 西南角緯度
NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LON=121.510000  # 西南角經度
NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LAT=25.020000  # 東南角緯度
NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LON=121.550000  # 東南角經度

# 中心點座標
NEXT_PUBLIC_TEST_AREA_CENTER_LAT=25.037500     # 中心點緯度
NEXT_PUBLIC_TEST_AREA_CENTER_LON=121.530000    # 中心點經度

# 區域描述
NEXT_PUBLIC_TEST_AREA_DESCRIPTION=我的測試區域
```

#### 注意事項

- 測試區域座標僅存在於您的 `.env.local` 檔案中
- `.env.local` 已被 `.gitignore` 忽略，不會被提交到 Git
- 如未設定環境變數，將使用程式碼中的預設測試區域
- 測試區域功能與光復鄉保持完全相同的精度和功能

## 版本控制指引

### GitHub Flow 工作流程

本專案採用 GitHub Flow 進行版本控制：

1. **建立分支**

   ```bash
   git checkout -b feature/功能名稱
   ```

2. **開發與提交**
   - 遵循 Conventional Commits 規範
   - 每次提交都應該是可運行的狀態
   - 撰寫清楚的提交訊息

3. **推送分支**

   ```bash
   git push origin feature/功能名稱
   ```

4. **建立 Pull Request**
   - 使用 PR 模板
   - 詳細描述變更內容
   - 指派審查者

5. **程式碼審查**
   - 至少需要一位審查者核准
   - 處理所有審查意見
   - 確保 CI/CD 通過

6. **合併到主分支**
   - 使用 "Squash and merge"
   - 刪除功能分支

### Conventional Commits 規範

提交訊息格式：`<類型>[可選範圍]: <描述>`

**類型：**

- `feat`: 新功能
- `fix`: 修復錯誤
- `docs`: 文件變更
- `style`: 格式調整（不影響程式邏輯）
- `refactor`: 重構程式碼
- `test`: 增加或修改測試
- `chore`: 建置工具或輔助工具的變動

**範例：**

```
feat(map): 新增 GPS 定位功能
fix(api): 修復座標轉換邊界檢查錯誤
docs(readme): 更新安裝說明
```

### 分支命名規範

- `feature/功能名稱` - 新功能開發
- `bugfix/錯誤描述` - 錯誤修復
- `hotfix/緊急修復` - 緊急修復
- `docs/文件更新` - 文件更新
- `refactor/重構項目` - 程式碼重構

### 程式碼審查標準

**必須檢查項目：**

- [ ] 程式碼符合專案規範
- [ ] 功能正常運作
- [ ] 測試覆蓋率足夠
- [ ] 無安全性問題
- [ ] 效能符合要求
- [ ] 文件已更新

## 重要指令

### 開發

```bash
yarn dev            # 啟動開發服務器
yarn build          # 建置專案
yarn lint           # 程式碼檢查
yarn type-check     # 型別檢查
```

### 元件管理

```bash
npx shadcn@latest add button       # 新增 UI 元件
npx shadcn@latest add toast
```

### 套件管理

```bash
yarn                # 安裝所有依賴
yarn add [package]  # 新增套件
yarn upgrade        # 更新所有套件
yarn audit          # 安全性檢查
```

### 版本管理

```bash
# 檢查過時的套件
yarn outdated

# 互動式升級套件
yarn upgrade-interactive

# 安裝最新版本
yarn add [package]@latest

# 檢查套件資訊
yarn info [package]
```

## API 端點

### POST /api/report

回報淤泥狀態

```json
{
  "lat": 23.6715,
  "lon": 121.4355,
  "state": 1
}
```

## 信任演算法重點

### 核心資料 (Redis)

- Score_0: 已清除信譽分數
- Score_1: 有淤泥信譽分數
- last_update_0/1: 最後更新時間

### 範圍效應

- 中心點: 100% 權重
- 8個鄰近點: 30% 權重
- 形成 3×3 影響範圍

### 非對稱邏輯

- 回報淤泥: Score_1 增加，Score_0 不變
- 回報清除: Score_0 增加5倍，Score_1 銳減90%

## 部署流程

1. **Vercel 部署**
   - 連接 GitHub 倉庫
   - 設定環境變數
   - 自動部署

2. **GitHub Actions**
   - 每5分鐘執行圖磚生成
   - 從 Redis 讀取狀態
   - 生成並上傳圖磚到 R2

3. **Cloudflare R2**
   - 設定公開讀取權限
   - 配置 CDN 子網域

## 測試策略

### 功能測試

- GPS 定位準確性
- 座標轉換正確性
- 範圍邊界檢查
- API 回應時間

### 信任演算法測試

- 單點回報驗證
- 範圍效應測試
- 時間衰減驗證
- 非對稱更新邏輯

## 監控與維護

### 關鍵指標

- API 回應時間
- 圖磚生成頻率
- Redis 記憶體使用
- 使用者回報數量

### 日誌記錄

- 所有回報記錄於 Supabase
- API 錯誤日誌
- GitHub Actions 執行日誌

## 安全考量

- GPS 位置驗證
- API 速率限制
- 輸入資料驗證
- CORS 設定
- 環境變數保護
