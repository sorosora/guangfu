# 貢獻指引 | Contributing Guide

感謝您對「清淤地圖 - 光復計畫」的關注！我們歡迎所有形式的貢獻，包括但不限於程式碼、文件、測試、錯誤回報和功能建議。

Thank you for your interest in the Cleanup Map - Guangfu Project! We welcome all forms of contributions, including but not limited to code, documentation, testing, bug reports, and feature suggestions.

## 📋 目錄 | Table of Contents

- [行為準則 | Code of Conduct](#行為準則--code-of-conduct)
- [如何貢獻 | How to Contribute](#如何貢獻--how-to-contribute)
- [開發環境設定 | Development Setup](#開發環境設定--development-setup)
- [提交指引 | Submission Guidelines](#提交指引--submission-guidelines)
- [程式碼規範 | Coding Standards](#程式碼規範--coding-standards)
- [測試 | Testing](#測試--testing)
- [文件撰寫 | Documentation](#文件撰寫--documentation)

## 行為準則 | Code of Conduct

本專案採用 [行為準則](CODE_OF_CONDUCT.md)，參與此專案的所有人員都必須遵守。請花時間閱讀完整內容。

This project adopts a [Code of Conduct](CODE_OF_CONDUCT.md) that all participants must follow. Please take the time to read the full text.

## 如何貢獻 | How to Contribute

### 🐛 回報錯誤 | Reporting Bugs

如果您發現錯誤，請建立一個 issue 並提供以下資訊：

If you find a bug, please create an issue with the following information:

- **清楚的標題 | Clear title**: 簡潔描述問題
- **重現步驟 | Steps to reproduce**: 詳細的重現步驟
- **預期行為 | Expected behavior**: 您期望發生的情況
- **實際行為 | Actual behavior**: 實際發生的情況
- **環境資訊 | Environment**: 瀏覽器、作業系統版本等
- **截圖 | Screenshots**: 如果適用的話

### 💡 功能建議 | Feature Requests

我們歡迎新功能的建議！請建立一個 issue 並說明：

We welcome suggestions for new features! Please create an issue explaining:

- **功能描述 | Feature description**: 詳細描述建議的功能
- **使用情境 | Use case**: 為什麼需要這個功能
- **實作建議 | Implementation suggestions**: 如果有想法的話

### 🔧 程式碼貢獻 | Code Contributions

1. **Fork 專案 | Fork the repository**
2. **建立分支 | Create a branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **進行變更 | Make your changes**
4. **新增測試 | Add tests** (如果適用 | if applicable)
5. **確保測試通過 | Ensure tests pass**:
   ```bash
   yarn test
   yarn lint
   yarn type-check
   ```
6. **提交變更 | Commit changes**:
   ```bash
   git commit -m "feat: add amazing feature"
   ```
7. **推送到 GitHub | Push to GitHub**:
   ```bash
   git push origin feature/amazing-feature
   ```
8. **建立 Pull Request | Create a Pull Request**

## 開發環境設定 | Development Setup

### 系統需求 | System Requirements

- Node.js 18 或更高版本 | Node.js 18 or higher
- Yarn (套件管理工具 | package manager)
- Git
- Python 3.9+ (用於背景任務 | for background tasks)

### 設定步驟 | Setup Steps

1. **複製專案 | Clone the repository**:

   ```bash
   git clone https://github.com/sorosora/guangfu.git
   cd guangfu
   ```

2. **安裝依賴 | Install dependencies**:

   ```bash
   yarn
   ```

3. **設定環境變數 | Set up environment variables**:

   ```bash
   cp .env.example .env.local
   # 編輯 .env.local 並填入必要的值 | Edit .env.local and fill in required values
   ```

   **⚠️ 環境變數安全提醒 | Environment Variables Security Reminder:**
   - 🚫 絕不將 `.env.local` 提交到 Git | Never commit `.env.local` to Git
   - 🔧 使用開發專用的 API 金鑰，避免影響生產環境 | Use development-specific API keys to avoid affecting production
   - 📋 參考 `.env.local.example` 獲取本地開發設定建議 | Refer to `.env.local.example` for local development setup tips

4. **啟動開發服務器 | Start development server**:

   ```bash
   yarn dev
   ```

5. **在瀏覽器中開啟 | Open in browser**: http://localhost:3000

## 提交指引 | Submission Guidelines

### 分支命名 | Branch Naming

使用以下格式為分支命名：
Use the following format for branch naming:

- `feature/功能名稱` - 新功能 | new features
- `bugfix/錯誤描述` - 錯誤修復 | bug fixes
- `docs/文件更新` - 文件更新 | documentation updates
- `refactor/重構項目` - 程式碼重構 | code refactoring
- `test/測試項目` - 測試相關 | test-related changes

### 提交訊息 | Commit Messages

我們使用 [Conventional Commits](https://www.conventionalcommits.org/) 規範：

We use [Conventional Commits](https://www.conventionalcommits.org/) specification:

格式 | Format: `<type>[optional scope]: <description>`

**類型 | Types:**

- `feat`: 新功能 | new feature
- `fix`: 錯誤修復 | bug fix
- `docs`: 文件變更 | documentation changes
- `style`: 格式調整 | formatting changes
- `refactor`: 程式碼重構 | code refactoring
- `test`: 測試相關 | test-related changes
- `chore`: 建置或工具變更 | build or tool changes

**範例 | Examples:**

```
feat(map): 新增 GPS 定位功能
fix(api): 修復座標轉換邊界檢查錯誤
docs(readme): 更新安裝說明
style(components): 修正 ESLint 警告
refactor(algorithm): 重構信任演算法實作
test(api): 新增 API 端點測試
chore(deps): 更新依賴套件版本
```

### Pull Request 要求 | Pull Request Requirements

- **清楚的標題和描述 | Clear title and description**
- **關聯的 issue 編號 | Link to related issue** (如果適用 | if applicable)
- **測試覆蓋 | Test coverage** (對於新功能 | for new features)
- **文件更新 | Documentation updates** (如果需要 | if needed)
- **截圖 | Screenshots** (對於 UI 變更 | for UI changes)

## 環境變數管理 | Environment Variables Management

### 開發環境設定 | Development Environment Setup

#### 本地開發環境變數 | Local Development Environment Variables

- 複製 `.env.example` 為 `.env.local`
- 使用開發專用的 API 金鑰和資料庫
- 確保 `.env.local` 已被 `.gitignore` 忽略

#### 測試環境設定 | Testing Environment Setup

- 使用測試專用的 Supabase 專案
- 使用獨立的 Redis 資料庫
- 設定測試專用的 R2 儲存桶

### 環境變數安全檢查清單 | Environment Variables Security Checklist

**提交 PR 前請確認 | Before submitting PR, please confirm:**

- [ ] 沒有在程式碼中硬編碼 API 金鑰 | No API keys are hardcoded in the code
- [ ] 所有敏感變數都使用環境變數 | All sensitive variables use environment variables
- [ ] `.env.local` 沒有被提交到 Git | `.env.local` is not committed to Git
- [ ] 新增的環境變數已更新到 `.env.example` | New environment variables are added to `.env.example`
- [ ] 相關文件已更新環境變數說明 | Related documentation has been updated with environment variable descriptions

### 生產環境變數配置 | Production Environment Variables Configuration

**Vercel 部署時需設定 | Required for Vercel deployment:**

- 前端公開變數 (以 `NEXT_PUBLIC_` 開頭)
- 後端 API 金鑰 (Supabase, Upstash)

**GitHub Actions 需要的 Secrets | Required GitHub Secrets:**

- Redis 連線設定 (用於圖磚生成)
- Cloudflare R2 設定 (用於檔案上傳)

## 程式碼規範 | Coding Standards

### TypeScript/JavaScript

- 使用 TypeScript 進行強型別檢查 | Use TypeScript for strong typing
- 遵循 ESLint 和 Prettier 規則 | Follow ESLint and Prettier rules
- 使用有意義的變數和函數名稱 | Use meaningful variable and function names
- 添加適當的註解 | Add appropriate comments
- 保持函數簡短和專注 | Keep functions short and focused

### React/Next.js

- 使用函數元件和 Hooks | Use functional components and Hooks
- 適當使用 `useCallback` 和 `useMemo` 進行效能優化 | Use `useCallback` and `useMemo` for performance optimization
- 保持元件純粹和可重用 | Keep components pure and reusable
- 使用 TypeScript 進行 props 型別定義 | Use TypeScript for props type definition

### CSS/Tailwind

- 優先使用 Tailwind CSS 類別 | Prefer Tailwind CSS classes
- 保持響應式設計 | Maintain responsive design
- 遵循行動優先原則 | Follow mobile-first principles
- 使用一致的間距和顏色系統 | Use consistent spacing and color system

## 測試 | Testing

### 執行測試 | Running Tests

```bash
# 執行所有測試 | Run all tests
yarn test

# 監看模式 | Watch mode
yarn test:watch

# 測試覆蓋率 | Test coverage
yarn test:coverage
```

### 測試要求 | Testing Requirements

- 為新功能編寫單元測試 | Write unit tests for new features
- 確保測試覆蓋率不下降 | Ensure test coverage doesn't decrease
- 測試邊界情況 | Test edge cases
- 使用有意義的測試描述 | Use meaningful test descriptions

### 測試類型 | Test Types

- **單元測試 | Unit Tests**: 測試個別函數和元件 | Test individual functions and components
- **整合測試 | Integration Tests**: 測試元件間的互動 | Test component interactions
- **E2E 測試 | End-to-End Tests**: 測試完整的使用者流程 | Test complete user flows

## 文件撰寫 | Documentation

### 程式碼文件 | Code Documentation

- 為複雜函數添加 JSDoc 註解 | Add JSDoc comments for complex functions
- 記錄 API 端點和參數 | Document API endpoints and parameters
- 更新 README 中的功能描述 | Update feature descriptions in README
- 保持技術規格文件最新 | Keep technical specification documents up to date

### 提交文件變更 | Submitting Documentation Changes

文件變更同樣重要！請遵循相同的提交流程。

Documentation changes are equally important! Please follow the same submission process.

## 🚀 發布流程 | Release Process

1. **功能完成 | Feature completion**: 所有功能測試通過 | All feature tests pass
2. **程式碼審查 | Code review**: 至少一位維護者審查 | At least one maintainer reviews
3. **整合測試 | Integration testing**: 在預備環境測試 | Test in staging environment
4. **版本標記 | Version tagging**: 使用語意化版本 | Use semantic versioning
5. **部署 | Deployment**: 自動部署到生產環境 | Automatic deployment to production

## 📞 取得協助 | Getting Help

如果您有任何問題，可以透過以下方式尋求協助：

If you have any questions, you can seek help through:

- **GitHub Issues**: 提出技術問題 | Ask technical questions
- **Email**: 聯絡維護者 | Contact maintainers

## 🙏 致謝 | Acknowledgments

感謝所有為此專案做出貢獻的人員！您的努力讓這個專案變得更好。

Thank you to all contributors to this project! Your efforts make this project better.

---

再次感謝您的貢獻！讓我們一起為花蓮光復鄉的災後重建努力！

Thank you again for your contribution! Let's work together for the post-disaster reconstruction of Hualien Guangfu Township!
