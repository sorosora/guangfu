# 花蓮光復清淤地圖系統 - 完整執行計畫

## 階段一：專案初始化與基礎設定

### 1.1 專案建立與套件安裝

- [x] 初始化 Next.js 專案 (App Router)：`npx create-next-app@latest`
- [x] 安裝 TypeScript 支援 (建立專案時選擇)
- [x] 設定 Tailwind CSS (建立專案時選擇)
- [x] 安裝並設定 shadcn/ui：`npx shadcn@latest init`
- [x] 安裝 Leaflet 相關套件
  - [x] `yarn add leaflet react-leaflet`
  - [x] `yarn add -D @types/leaflet`
- [x] 安裝其他必要套件
  - [x] `yarn add lucide-react`
  - [x] `yarn add @supabase/supabase-js`
  - [x] `yarn add @upstash/redis`
  - [x] `yarn add zod`

### 1.2 專案結構建立

- [x] 建立 `src/` 資料夾結構
- [x] 建立 `components/` 資料夾
- [x] 建立 `lib/` 資料夾
- [x] 建立 `types/` 資料夾
- [x] 建立 `scripts/` 資料夾
- [x] 建立環境變數檔案：
  - [x] `.env.example` (開源專案範本)
  - [x] `.env.local.example` (本地開發範本)
- [x] 建立 `.gitignore` 檔案 (確保 `.env.local` 被忽略)
- [x] 設定本地環境變數：`cp .env.example .env.local`

### 1.3 開發環境配置

- [x] 設定 TypeScript 配置檔案
- [x] 設定 ESLint 規則
- [x] 設定 Prettier 格式化規則
- [x] 配置 `next.config.ts`
- [x] 設定 `tailwind.config.js`
- [x] 初始化 `components.json` (shadcn/ui)

## 階段二：前端核心功能開發

### 2.1 基礎 UI 元件設定

- [x] 安裝 shadcn/ui Button 元件：`npx shadcn@latest add button`
- [x] 安裝 shadcn/ui Toast 元件：`npx shadcn@latest add toast`
- [x] 建立全域樣式檔案
- [x] 設定響應式布局
- [x] 建立載入中元件

### 2.2 地圖整合與顯示

- [x] 建立 MapContainer 元件
- [x] 整合 Leaflet 地圖
- [x] 設定地圖初始視野 (光復範圍)
- [x] 建立自訂圖磚圖層元件
- [x] 實作地圖縮放與拖動控制
- [ ] 測試地圖在行動裝置上的表現

### 2.3 GPS 定位功能

- [x] 實作 GPS 權限請求
- [x] 建立 `watchPosition` 功能
- [x] 建立使用者位置標記元件
- [x] 實作位置更新回調
- [x] 加入位置錯誤處理
- [ ] 測試 GPS 準確度

### 2.4 鎖定中心模式

- [x] 建立切換按鈕元件
- [x] 實作地圖跟隨模式
- [x] 禁用手動拖動功能 (鎖定時)
- [ ] 平滑的視野移動動畫
- [x] 狀態管理 (開啟/關閉)
- [x] 視覺回饋 (按鈕狀態)

### 2.5 回報按鈕介面

- [x] 建立固定底部操作列
- [x] 建立「有淤泥 🪏」按鈕
- [x] 建立「無淤泥 ✨」按鈕
- [x] 設定適當的按鈕大小 (行動裝置)
- [ ] 加入點擊回饋效果
- [x] 實作按鈕禁用狀態 (載入中)

### 2.6 使用者互動與回饋

- [x] 整合 Toast 通知系統
- [x] 建立成功/失敗訊息
- [x] 實作載入指示器
- [ ] 加入觸覺回饋 (手機震動)
- [ ] 實作網路狀態檢測
- [ ] 離線狀態處理

## 階段三：後端 API 與資料處理

### 3.1 Supabase 資料庫設定

- [ ] 建立 Supabase 專案
- [ ] 設計 `reports` 資料表結構
  - [ ] id (bigint, PK)
  - [ ] created_at (timestamp)
  - [ ] grid_x (integer)
  - [ ] grid_y (integer)
  - [ ] reported_state (smallint)
  - [ ] location (geography)
- [ ] 建立地理空間索引 (GIST)
- [ ] 設定資料表權限
- [ ] 建立 API 金鑰

### 3.2 Upstash Redis 設定

- [ ] 建立 Upstash Redis 實例
- [ ] 設計 Redis 資料結構
  - [ ] score_0:{grid_id} (已清除分數)
  - [ ] score_1:{grid_id} (有淤泥分數)
  - [ ] last_update_0:{grid_id}
  - [ ] last_update_1:{grid_id}
- [ ] 實作 Redis 連線函式
- [ ] 建立批次操作功能 (Pipeline)

### 3.3 座標轉換系統

- [x] 建立經緯度到網格座標轉換
- [x] 實作邊界檢查函式
- [x] 建立網格座標驗證
- [x] 實作鄰近網格計算 (3×3)
- [ ] 加入座標轉換測試
- [ ] 處理邊界網格的特殊情況

### 3.4 信任演算法實作

- [ ] 實作權重計算函式
  - [ ] GPS 鄰近度因子 (F_gps)
  - [ ] 時間密度抑制因子 (F_spam)
- [ ] 實作時間衰減計算
- [ ] 建立範圍效應更新邏輯
- [ ] 實作非對稱更新規則
- [ ] 建立最終狀態判斷函式
- [ ] 加入演算法單元測試

### 3.5 API 端點開發

- [ ] 建立 `/api/report` 路由
- [ ] 實作請求資料驗證 (Zod)
- [ ] 實作座標轉換與邊界檢查
- [ ] 實作範圍效應更新
- [ ] 實作 Supabase 資料寫入
- [ ] 加入錯誤處理與回應
- [ ] 實作 API 速率限制
- [ ] 加入詳細的錯誤日誌

## 階段四：背景任務與圖磚系統

### 4.1 Cloudflare R2 設定

- [ ] 建立 Cloudflare R2 Bucket
- [ ] 設定公開讀取權限
- [ ] 建立 API Token
- [ ] 設定 CDN 子網域
- [ ] 測試檔案上傳功能

### 4.2 Python 圖磚生成腳本

#### 4.2.1 POC 版本

- [x] 建立 `poc_generate_tiles.py` POC 腳本
- [x] 安裝 Python 套件：`pip install pillow numpy`
  - [x] pillow
  - [x] numpy
- [x] 實作模擬資料生成 (800×600 網格)
- [x] 實作圖片生成與調色盤設定
- [x] 實作圖磚切割邏輯 (4×3 tiles, 256×256)
- [x] 實作中繼資料 JSON 生成 (`metadata.json`)

#### 4.2.2 生產版本

- [ ] 建立 `generate_tiles.py` 生產腳本
- [ ] 新增 Redis 連線與資料讀取
- [ ] 新增 boto3 套件支援
- [ ] 實作 R2 並行上傳
- [ ] 實作版本號管理 (`version.json`)

### 4.3 GitHub Actions 設定

- [ ] 建立 `.github/workflows/generate-tiles.yml`
- [ ] 設定定時觸發 (每5分鐘)
- [ ] 設定手動觸發 (workflow_dispatch)
- [ ] 配置 Python 環境
- [ ] 設定 GitHub Secrets (用於 GitHub Actions)：
  - [ ] `UPSTASH_REDIS_REST_URL`
  - [ ] `UPSTASH_REDIS_REST_TOKEN`
  - [ ] `CLOUDFLARE_R2_ACCESS_KEY_ID`
  - [ ] `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
  - [ ] `CLOUDFLARE_R2_BUCKET_NAME`
- [ ] 實作錯誤通知機制
- [ ] 加入執行時間監控

### 4.4 前端圖磚載入

#### 4.4.1 POC 版本

- [x] CustomTileLayer 元件實作
- [x] 靜態圖磚載入與顯示
- [x] 中繼資料 JSON 讀取
- [x] 圖磚切割與地理座標對應
- [x] 載入失敗處理與狀態顯示
- [x] 圖層透明度與順序控制

#### 4.4.2 生產版本

- [ ] 實作 `version.json` 輪詢
- [ ] 建立動態圖磚 URL 生成
- [ ] 實作圖磚快取機制
- [ ] 實作圖磚更新通知
- [ ] 測試圖磚切換流暢度

### 4.5 預估區域

- [x] GeoJSON 向量圖層支援
- [x] 預估區域樣式設定 (橘紅色邊框與填充)
- [x] 點擊互動與區域資訊顯示
- [x] 圖層控制面板

### 4.6 救災資訊 Google My Maps 同步功能

- [x] 安裝 leaflet-kmz 套件支援
- [x] 建立 KMZLayer 元件
- [x] 與現有圖層系統整合
- [x] 環境變數配置 (NEXT_PUBLIC_KMZ_BASE_URL)
- [ ] 動態檔案檢測機制 (根據日期查找)
- [ ] 自動更新檢查機制

## 階段五：整合測試與優化

### 5.1 功能整合測試

- [ ] 執行程式碼品質檢查：`yarn lint && yarn type-check`
- [ ] 測試完整的回報流程
- [ ] 驗證座標轉換準確性
- [ ] 測試範圍效應影響
- [ ] 驗證信任演算法邏輯
- [ ] 測試圖磚生成與更新
- [ ] 驗證 GPS 定位精度

### 5.2 使用者體驗測試

- [ ] 行動裝置響應式測試
- [ ] 不同瀏覽器相容性測試
- [ ] 網路環境測試 (3G/4G/WiFi)
- [ ] 離線狀態處理測試
- [ ] 載入效能測試
- [ ] 使用者介面可用性測試

### 5.3 效能優化

- [ ] 檢查套件版本：`yarn outdated`
- [ ] API 回應時間優化
- [ ] Redis 查詢效能調整
- [ ] 圖磚載入速度優化
- [ ] 前端 Bundle 大小優化：`yarn build && yarn analyze`
- [ ] 圖片壓縮與格式優化
- [ ] CDN 快取策略調整

### 5.4 安全性檢查

- [ ] 安全性稽核：`yarn audit`
- [ ] API 輸入驗證強化
- [ ] CORS 設定檢查
- [ ] 環境變數安全檢查
- [ ] SQL 注入防護驗證
- [ ] 速率限制測試
- [ ] 敏感資料洩漏檢查

## 階段六：部署與上線

### 6.1 Vercel 部署配置

- [ ] 連接 GitHub 倉庫到 Vercel
- [ ] 設定 Vercel 環境變數：
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `NEXT_PUBLIC_TILES_BASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `UPSTASH_REDIS_REST_URL`
  - [ ] `UPSTASH_REDIS_REST_TOKEN`
- [ ] 配置自訂網域 (如需要)
- [ ] 設定部署分支策略
- [ ] 測試自動部署流程
- [ ] 設定部署通知

### 6.2 生產環境配置

- [ ] 生產環境資料庫配置
- [ ] 生產環境 Redis 配置
- [ ] 生產環境 R2 Bucket 配置
- [ ] CDN 快取策略配置
- [ ] 監控與警報設定
- [ ] 備份策略建立

### 6.3 上線前檢查

- [ ] 完整功能測試 (生產環境)
- [ ] 效能基準測試
- [ ] 安全性掃描
- [ ] 可用性測試
- [ ] 災難恢復測試
- [ ] 文件完整性檢查

### 6.4 上線與監控

- [ ] 正式上線部署
- [ ] 即時監控設定
- [ ] 錯誤追蹤設定
- [ ] 使用者行為分析
- [ ] 效能監控儀表板
- [ ] 定期健康檢查

## 階段七：維護與改進

### 7.1 監控與維護

- [ ] 設定自動化監控
- [ ] 建立故障處理手冊
- [ ] 設定定期備份
- [ ] 建立效能基準
- [ ] 實作日誌分析
- [ ] 設定容量監控

### 7.2 使用者回饋與改進

- [ ] 建立使用者回饋機制
- [ ] 分析使用者行為資料
- [ ] 收集效能瓶頸資訊
- [ ] 規劃功能改進計畫
- [ ] 實作 A/B 測試框架
- [ ] 建立版本發布流程

### 7.3 擴展性準備

- [ ] 評估系統擴展需求
- [ ] 規劃資料庫分割策略
- [ ] 評估 CDN 擴展需求
- [ ] 規劃快取策略升級
- [ ] 評估 API 負載能力
- [ ] 建立擴展監控指標

## 里程碑檢查點

### 🎯 里程碑 1：基礎建設完成

- [x] 專案建立與環境設定完成
- [x] 基礎 UI 框架建立完成
- [x] 地圖顯示功能正常

### 🎯 里程碑 2：核心功能完成

- [x] GPS 定位功能正常
- [ ] 回報按鈕功能完成
- [ ] API 端點運作正常

### 🎯 里程碑 2.5：POC 驗證完成

- [x] 圖磚生成 POC 實作
- [x] 前端圖磚載入系統
- [x] 載入手動描繪預估區域

### 🎯 里程碑 3：後端系統完成

- [ ] 信任演算法實作完成
- [ ] 資料庫操作正常
- [ ] Redis 快取系統運作

### 🎯 里程碑 4：圖磚系統完成

- [ ] 圖磚生成腳本完成
- [ ] GitHub Actions 自動化運作
- [ ] 圖磚顯示與更新正常

### 🎯 里程碑 5：系統整合完成

- [ ] 所有功能整合測試通過
- [ ] 效能測試達到標準
- [ ] 安全性檢查通過

### 🎯 里程碑 6：正式上線

- [ ] 生產環境部署完成
- [ ] 監控系統運作正常
- [ ] 系統穩定運行

## 預估時程

- **階段一至二**：2-3 週 (前端開發)
- **階段三**：2-3 週 (後端 API)
- **階段四**：1-2 週 (背景任務)
- **階段五**：1-2 週 (測試優化)
- **階段六**：1 週 (部署上線)
- **總計**：7-11 週

## 風險評估與應對

### 高風險項目

- [ ] GPS 定位準確度問題
  - 應對：多重定位驗證、範圍容錯機制
- [ ] 信任演算法複雜度
  - 應對：階段性測試、簡化版本先行
- [ ] 圖磚生成效能瓶頸
  - 應對：分批處理、快取策略優化

### 中風險項目

- [ ] 第三方服務依賴
  - 應對：服務降級機制、備選方案準備
- [ ] 行動裝置相容性
  - 應對：廣泛裝置測試、漸進式增強

### 低風險項目

- [ ] UI/UX 調整需求
  - 應對：模組化設計、快速迭代能力
