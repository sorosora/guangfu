# 安全性政策 | Security Policy

## 支援的版本 | Supported Versions

我們致力於為以下版本提供安全性更新：

We are committed to providing security updates for the following versions:

| 版本 Version | 支援狀態 Supported |
| ------------ | ------------------ |
| 1.0.x        | ✅ 是 Yes          |
| < 1.0        | ❌ 否 No           |

## 回報安全漏洞 | Reporting Security Vulnerabilities

### 🚨 重要提醒 | Important Notice

**請勿在公開的 GitHub Issues 中回報安全漏洞！**
**DO NOT report security vulnerabilities in public GitHub Issues!**

如果您發現安全漏洞，請透過私人管道聯絡我們，以便我們能夠妥善處理問題而不會對使用者造成風險。

If you discover a security vulnerability, please contact us through private channels so we can properly address the issue without putting users at risk.

### 回報方式 | How to Report

#### 優先聯絡方式 | Preferred Contact Methods

1. **電子郵件 | Email**: security@[project-domain].com
2. **GitHub 安全諮詢 | GitHub Security Advisory**: 透過 GitHub 的私人漏洞回報功能
3. **緊急聯絡 | Emergency Contact**: [backup-email]@[domain].com

#### 回報資訊 | Information to Include

請在您的回報中包含以下資訊：

Please include the following information in your report:

- **漏洞描述 | Vulnerability Description**: 清楚描述安全問題
- **影響範圍 | Impact Scope**: 說明可能的影響和嚴重程度
- **重現步驟 | Reproduction Steps**: 詳細的重現步驟
- **建議修復方式 | Suggested Fix**: 如果有修復建議的話
- **發現者資訊 | Discoverer Information**: 您希望如何被致謝

### 回應時程 | Response Timeline

我們承諾在以下時間內回應：

We commit to responding within the following timeframes:

- **初步確認 | Initial Acknowledgment**: 24 小時內
- **問題評估 | Issue Assessment**: 72 小時內
- **修復計畫 | Fix Timeline**: 7 天內（視嚴重程度而定）
- **公開揭露 | Public Disclosure**: 修復後 30 天

## 安全最佳實踐 | Security Best Practices

### 對開發者 | For Developers

#### 程式碼安全 | Code Security

- **輸入驗證 | Input Validation**: 所有使用者輸入都必須經過驗證
- **輸出編碼 | Output Encoding**: 適當編碼所有輸出內容
- **SQL 注入防護 | SQL Injection Protection**: 使用參數化查詢
- **XSS 防護 | XSS Protection**: 實作適當的內容安全政策
- **CSRF 防護 | CSRF Protection**: 使用 CSRF 令牌保護表單
- **環境變數安全 | Environment Variables Security**: 敏感資訊僅透過環境變數傳遞

#### API 安全 | API Security

- **驗證機制 | Authentication**: 實作強化的使用者驗證
- **授權控制 | Authorization**: 確保適當的權限檢查
- **速率限制 | Rate Limiting**: 防止 API 濫用
- **HTTPS 強制 | HTTPS Enforcement**: 所有通訊都使用 HTTPS
- **敏感資料保護 | Sensitive Data Protection**: 加密儲存敏感資訊

#### 依賴管理 | Dependency Management

```bash
# 定期檢查安全漏洞 | Regularly check for vulnerabilities
npm audit
npm audit fix

# 保持依賴套件更新 | Keep dependencies updated
npm update
npm outdated
```

### 對使用者 | For Users

#### 安全使用指引 | Secure Usage Guidelines

- **GPS 隱私 | GPS Privacy**: 了解位置資訊的使用方式
- **資料分享 | Data Sharing**: 注意分享的資訊內容
- **瀏覽器安全 | Browser Security**: 使用最新版本的瀏覽器
- **網路安全 | Network Security**: 避免在不安全的網路環境中使用

#### 可疑活動回報 | Reporting Suspicious Activity

如果您注意到以下情況，請立即聯絡我們：

If you notice any of the following, please contact us immediately:

- 未經授權的資料存取 | Unauthorized data access
- 異常的系統行為 | Unusual system behavior
- 可疑的使用者活動 | Suspicious user activity
- 資料洩漏跡象 | Signs of data breach

## 隱私保護 | Privacy Protection

### 資料收集 | Data Collection

我們只收集必要的資料：

We only collect necessary data:

- **位置資訊 | Location Data**: 僅用於災情回報功能
- **時間戳記 | Timestamps**: 記錄回報時間
- **狀態資訊 | Status Information**: 淤泥清理狀態

### 資料處理 | Data Processing

- **匿名化 | Anonymization**: 個人識別資訊經過匿名化處理
- **最小化原則 | Minimization**: 只保留必要的資料
- **加密儲存 | Encrypted Storage**: 敏感資料經過加密保護
- **存取控制 | Access Control**: 嚴格控制資料存取權限

### 資料保留 | Data Retention

- **災情資料 | Disaster Data**: 災後重建期間保留
- **系統日誌 | System Logs**: 30 天後自動刪除
- **使用者資料 | User Data**: 根據用途和法規要求決定保留期間

## 環境變數安全管理 | Environment Variables Security Management

### 🔒 敏感資訊保護 | Sensitive Information Protection

#### 環境變數分類 | Environment Variables Classification

**🌐 公開變數 (NEXT*PUBLIC*)**

- 會暴露於瀏覽器端，不可包含敏感資訊
- 適用於: API 端點 URL、公開配置選項
- 範例: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_TILES_BASE_URL`

**🔒 私密變數**

- 僅在伺服器端使用，絕不暴露於瀏覽器
- 適用於: API 金鑰、資料庫連線字串、密碼
- 範例: `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`

### 🛡️ 安全最佳實踐 | Security Best Practices

#### 開發環境 | Development Environment

- ✅ 使用 `.env.local` 儲存本地環境變數
- ✅ 確保 `.env.local` 被 `.gitignore` 忽略
- ✅ 使用開發專用的 API 金鑰，避免影響生產環境
- ✅ 定期檢查是否意外提交敏感檔案

#### 生產環境 | Production Environment

- ✅ 在 Vercel Dashboard 設定環境變數
- ✅ 在 GitHub Secrets 設定 Actions 所需變數
- ✅ 使用不同的 API 金鑰區分開發與生產環境
- ✅ 啟用 API 金鑰的 IP 白名單限制 (如果支援)

### 🚨 安全事件應對 | Security Incident Response

#### 環境變數洩漏處理 | Environment Variables Leak Handling

**如果環境變數意外暴露:**

1. **立即輪換 | Immediate Rotation**: 立即更換所有相關 API 金鑰
2. **撤銷存取 | Revoke Access**: 撤銷洩漏金鑰的所有權限
3. **清理歷史 | Clean History**: 使用 `git filter-branch` 清理 Git 歷史
4. **更新部署 | Update Deployment**: 更新所有部署環境的環境變數
5. **監控活動 | Monitor Activity**: 監控可疑的 API 使用活動

#### 預防措施 | Prevention Measures

- 🔍 使用 `git log --all -S "API_KEY"` 搜尋可能的金鑰洩漏
- 🛠️ 設定 pre-commit hooks 檢查敏感資訊
- 📊 定期稽核環境變數使用情況
- 🔄 建立 API 金鑰輪換計畫

### 📋 環境變數安全檢查清單 | Environment Variables Security Checklist

**開發階段 | Development Phase**

- [ ] `.env.local` 已被 `.gitignore` 忽略
- [ ] 沒有在程式碼中硬編碼 API 金鑰
- [ ] 使用開發專用的 API 金鑰
- [ ] 環境變數名稱遵循命名慣例

**部署階段 | Deployment Phase**

- [ ] Vercel 環境變數已正確設定
- [ ] GitHub Secrets 已正確配置
- [ ] 生產環境使用獨立的 API 金鑰
- [ ] 環境變數權限已適當限制

**維護階段 | Maintenance Phase**

- [ ] 定期輪換 API 金鑰
- [ ] 監控 API 使用情況
- [ ] 檢查環境變數是否過期
- [ ] 移除不再使用的環境變數

## 基礎設施安全 | Infrastructure Security

### 託管安全 | Hosting Security

- **Vercel**: 通過 SOC 2 認證的平台
- **Supabase**: 企業級資料庫安全性
- **Upstash**: Redis 資料加密和存取控制
- **Cloudflare**: DDoS 防護和 CDN 安全

### 網路安全 | Network Security

- **TLS 1.3**: 最新的傳輸層安全協定
- **HSTS**: 強制 HTTPS 連線
- **CSP**: 內容安全政策防護
- **CORS**: 跨來源資源分享控制

### 監控與警報 | Monitoring and Alerting

- **即時監控 | Real-time Monitoring**: 24/7 系統監控
- **異常偵測 | Anomaly Detection**: 自動偵測可疑活動
- **日誌分析 | Log Analysis**: 定期分析安全日誌
- **事件回應 | Incident Response**: 快速回應安全事件

## 合規性 | Compliance

### 相關法規 | Applicable Regulations

- **個人資料保護法 | Personal Data Protection Act** (台灣)
- **GDPR** (歐盟一般資料保護規範)
- **災害防救法 | Disaster Prevention and Protection Act** (台灣)

### 稽核與認證 | Auditing and Certification

- 定期進行安全性評估 | Regular security assessments
- 第三方安全稽核 | Third-party security audits
- 漏洞掃描與滲透測試 | Vulnerability scanning and penetration testing

## 事件回應計畫 | Incident Response Plan

### 回應團隊 | Response Team

- **技術負責人 | Technical Lead**: 技術問題處理
- **安全專家 | Security Expert**: 安全分析與修復
- **溝通協調 | Communication Coordinator**: 對外溝通
- **法務顧問 | Legal Advisor**: 法律合規諮詢

### 回應流程 | Response Process

1. **偵測與分析 | Detection and Analysis**
2. **包含與根除 | Containment and Eradication**
3. **復原與後續 | Recovery and Post-Incident**
4. **學習與改進 | Lessons Learned and Improvement**

## 致謝 | Acknowledgments

我們感謝所有協助改善專案安全性的安全研究人員和社群成員。

We thank all security researchers and community members who help improve the security of our project.

### 負責任的揭露 | Responsible Disclosure

我們支持負責任的安全漏洞揭露，並承諾：

We support responsible security vulnerability disclosure and commit to:

- 不對善意的安全研究採取法律行動
- 與研究人員合作解決問題
- 適當致謝發現者（如果他們希望的話）
- 提供合理的修復時間

---

## 聯絡資訊 | Contact Information

**安全團隊 | Security Team**: security@[project-domain].com  
**緊急聯絡 | Emergency Contact**: +886-XXX-XXXXXX  
**PGP 金鑰 | PGP Key**: [PGP Key ID/Fingerprint]

**感謝您協助保護花蓮光復清淤地圖的安全！**  
**Thank you for helping keep the Hualien Guangfu Cleanup Progress Map secure!**
