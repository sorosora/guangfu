# 花蓮光復清淤地圖 | Hualien Guangfu Cleanup Progress Map

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)

一個為花蓮縣光復鄉颱風後清淤工作提供的即時互動地圖平台，讓在地民眾、救災人員及志工能快速回報與查看指定區域內的淤泥清理狀況。

An interactive real-time map platform for post-typhoon cleanup efforts in Guangfu Township, Hualien County, enabling local residents, rescue workers, and volunteers to quickly report and monitor sediment cleanup progress in designated areas.

## ✨ 核心功能 | Key Features

### 🗺️ 精準範圍地圖可視化

- 4km × 3km 範圍內的狀態網格顯示
- 5公尺精度的網格系統
- 即時狀態更新

### 📍 GPS 現場回報

- 使用者在物理範圍內回報淤泥狀態
- 位置驗證機制
- 一鍵式操作介面

### 🎯 鎖定中心模式

- 地圖跟隨使用者位置移動
- 自動定位功能
- 智慧視野調整

### 🧠 信任演算法

- 整合範圍效應的自動狀態判斷
- 多使用者回報信譽系統
- 防止惡意回報機制

---

### 🗺️ Precision Area Map Visualization

- Status grid display within 4km × 3km area
- 5-meter precision grid system
- Real-time status updates

### 📍 GPS On-Site Reporting

- Users report sediment status within physical range
- Location verification mechanism
- One-click operation interface

### 🎯 Lock-to-Center Mode

- Map follows user location movement
- Automatic positioning
- Smart viewport adjustment

### 🧠 Trust Algorithm

- Automatic status determination with area-of-effect integration
- Multi-user reporting reputation system
- Anti-malicious reporting mechanism

## 🚀 快速開始 | Quick Start

### 前置需求 | Prerequisites

```bash
Node.js 18+
Yarn
Python 3.9+ (用於背景任務 | for background tasks)
```

### 安裝 | Installation

```bash
# 複製專案 | Clone the repository
git clone https://github.com/your-username/guangfu-cleanup-map.git
cd guangfu-cleanup-map

# 安裝依賴 | Install dependencies
yarn

# 設定環境變數 | Set up environment variables
cp .env.example .env.local
# 編輯 .env.local 並填入必要的 API 金鑰 | Edit .env.local and fill in required API keys
# 詳細設定說明請參考下方「環境變數設定」章節 | See "Environment Variables" section below for detailed setup

# 啟動開發服務器 | Start development server
yarn dev
```

### 環境變數設定 | Environment Variables

#### 🔧 本地開發設定 | Local Development Setup

1. **複製環境變數範本 | Copy environment template:**

   ```bash
   cp .env.example .env.local
   ```

2. **編輯 `.env.local` 並填入以下變數 | Edit `.env.local` with the following variables:**

**🌐 前端公開變數 | Frontend Public Variables**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_TILES_BASE_URL=https://tiles.yourdomain.com
```

**🔒 後端私密變數 | Backend Private Variables**

```env
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFLARE_R2_BUCKET_NAME=your_bucket_name
```

#### ☁️ 生產環境部署 | Production Deployment

**Vercel 環境變數設定 | Vercel Environment Variables:**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_TILES_BASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**GitHub Secrets 設定 (用於 GitHub Actions) | GitHub Secrets (for GitHub Actions):**

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET_NAME`

#### ⚠️ 安全性提醒 | Security Reminders

- 🚫 **絕不將 `.env.local` 提交到 Git** | Never commit `.env.local` to Git
- 🔄 **定期輪換 API 金鑰** | Regularly rotate API keys
- 🏭 **生產環境使用不同的金鑰** | Use different keys for production
- 🛡️ **啟用 Supabase RLS** | Enable Supabase Row Level Security

## 🏗️ 技術架構 | Tech Stack

### 前端 | Frontend

- **框架 | Framework**: Next.js 14 (App Router)
- **UI 庫 | UI Library**: shadcn/ui
- **樣式 | Styling**: Tailwind CSS
- **地圖 | Mapping**: Leaflet.js + react-leaflet
- **圖示 | Icons**: lucide-react
- **語言 | Language**: TypeScript

### 後端 | Backend

- **部署平台 | Hosting**: Vercel
- **資料庫 | Database**: Supabase (PostgreSQL)
- **快取 | Cache**: Upstash (Redis)
- **背景任務 | Background Jobs**: GitHub Actions
- **檔案儲存 | File Storage**: Cloudflare R2

### 開發工具 | Development Tools

- **程式碼品質 | Code Quality**: ESLint + Prettier
- **型別檢查 | Type Checking**: TypeScript
- **版本控制 | Version Control**: Git + GitHub Flow
- **提交規範 | Commit Convention**: Conventional Commits

## 📋 可用指令 | Available Scripts

```bash
# 開發 | Development
yarn dev             # 啟動開發服務器 | Start development server
yarn build           # 建置專案 | Build for production
yarn start           # 啟動生產服務器 | Start production server

# 程式碼品質 | Code Quality
yarn lint            # 執行 ESLint 檢查 | Run ESLint
yarn type-check      # 執行型別檢查 | Run TypeScript check
yarn format          # 格式化程式碼 | Format code with Prettier

# 測試 | Testing
yarn test            # 執行測試 | Run tests
yarn test:watch      # 監看模式測試 | Run tests in watch mode
```

## 📊 地圖規格 | Map Specifications

### 地理範圍 | Geographic Area (WGS 84)

- **西北角 | Northwest**: (23.68137, 121.41771)
- **東北角 | Northeast**: (23.68108, 121.45639)
- **西南角 | Southwest**: (23.65397, 121.41760)
- **東南角 | Southeast**: (23.65396, 121.45657)

### 精度設定 | Precision Settings

- **物理尺寸 | Physical Size**: 4km × 3km
- **網格精度 | Grid Precision**: 5m × 5m
- **網格維度 | Grid Dimensions**: 800 × 600
- **總網格數 | Total Grids**: 480,000

## 🤝 貢獻指引 | Contributing

我們歡迎任何形式的貢獻！請查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解詳細的貢獻指引。

We welcome contributions of all kinds! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

### 開發流程 | Development Workflow

1. Fork 此專案 | Fork the repository
2. 建立功能分支 | Create a feature branch (`git checkout -b feature/amazing-feature`)
3. 提交變更 | Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 | Push to the branch (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request | Open a Pull Request

## 📜 授權條款 | License

此專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案。

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🚨 安全性 | Security

如果您發現安全性問題，請查看我們的 [安全性政策](SECURITY.md)。

If you discover a security vulnerability, please see our [Security Policy](SECURITY.md).

## 📞 聯絡資訊 | Contact

- **專案維護者 | Project Maintainer**: [Your Name]
- **電子郵件 | Email**: your.email@example.com
- **專案連結 | Project Link**: [https://github.com/your-username/guangfu-cleanup-map](https://github.com/your-username/guangfu-cleanup-map)

## 🙏 致謝 | Acknowledgments

- 花蓮縣光復鄉公所 | Guangfu Township Office, Hualien County
- 所有參與清淤工作的志工與民眾 | All volunteers and residents participating in cleanup efforts
- 開源社群的技術支援 | Technical support from the open source community

---

**讓我們一起為光復鄉的災後重建貢獻力量！**

**Let's work together to contribute to the post-disaster reconstruction of Guangfu Township!**
