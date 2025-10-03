# 安全性政策 | Security Policy

本文件說明了「清淤地圖 - 光復計畫」專案的安全性政策與實踐。我們感謝所有協助我們提升專案安全性的研究人員與社群成員。

This document outlines the security policy and practices for the "Cleanup Map - Guangfu Project". We are grateful to all researchers and community members who help us improve the security of our project.

## 回報安全漏洞 | Reporting Security Vulnerabilities

**請勿在公開的 GitHub Issues 中回報安全漏洞！**

**DO NOT report security vulnerabilities in public GitHub Issues!**

如果您發現任何潛在的安全性漏洞，請透過以下任一私密管道與我們聯絡：

If you discover a potential security vulnerability, please contact us through one of the following private channels:

1.  **私密回報表單 | Private Report Form**: **[https://forms.gle/jJnvmbHxL4kLcFT28](https://forms.gle/jJnvmbHxL4kLcFT28)**
2.  **電子郵件 | Email**: **jackson90295@gmail.com**

請在您的回報中盡可能提供詳細資訊，特別是**重現步驟**與**潛在影響**。

Please include as much detail as possible in your report, especially the **steps to reproduce** and the **potential impact**.

## 我們的承諾與回應原則 | Our Commitment and Response Principles

本專案由志工在災後重建的背景下開發與維護。我們非常重視專案的安全性，但請理解我們的資源有限。

This project is developed and maintained by volunteers in the context of post-disaster reconstruction. We take the security of our project very seriously, but please understand that our resources are limited.

- **盡力而為 (Best-Effort Basis)**: 我們承諾會盡最大努力審查和回應您回報的問題。
- **沒有服務等級協議 (No SLA)**: 我們不提供商業等級的服務等級協議 (SLA) 或保證的回應時間。我們會根據問題的嚴重性和我們的可用時間來排定優先級。
- **感謝與致謝**: 對於所有負責任地回報漏洞並與我們合作的個人，我們將在問題修復後公開致謝（如果您願意）。

## 隱私保護：完全匿名設計 | Privacy Protection: Designed for Anonymity

本專案的核心設計原則之一就是**完全匿名**。

One of the core design principles of this project is **complete anonymity**.

- **不收集個人資訊**: 我們**不**收集、儲存或處理任何個人身份資訊 (PII)，例如姓名、Email、IP 位址或裝置 ID。系統中沒有使用者帳號或登入機制。
- **收集的資料**: 系統唯一收集的資料是您主動回報的：
  1.  地理座標 (緯度、經度)
  2.  您選擇的狀態 (例如「有淤泥」或「已清除」)
  3.  回報當下的時間戳記
- **資料保留政策**: 目前，所有回報的災情資料將被**無限期保留**，以用於災後重建的分析與歷史記錄。此政策未來可能會變更。我們目前**沒有**刪除舊資料的自動化機制。

## 實際的安全實踐 | Security Practices in Use

- **環境變數**: 所有敏感資訊（如 API 金鑰、資料庫連線字串）都透過環境變數進行管理，並未寫死在程式碼中。
- **依賴管理**: 我們使用 `yarn` 來管理專案依賴。開發者應定期執行 `yarn audit` 來檢查已知的安全性漏洞。
- **HTTPS 強制**: 所有網路通訊均透過 HTTPS 進行加密。
- **基礎設施**: 我們依賴 Vercel, Supabase, Cloudflare 等平台的基礎設施安全性。

## 法律聲明 | Legal Notice

本專案依循開源精神，以「現況」(as-is) 提供，不提供任何明示或暗示的保證。

我們致力於尊重使用者隱私並遵循相關的法律規範。然而，作為一個由志工維護的專案，本文件旨在提供透明的指引，不構成具有法律約束力的服務合約或對絕對安全的保證。

This project is provided "as-is" in the spirit of open source, without warranty of any kind, express or implied.

We are committed to respecting user privacy and adhering to relevant legal regulations. However, as a project maintained by volunteers, this document is intended to provide transparent guidance and does not constitute a legally binding service contract or a guarantee of absolute security.

---

**感謝您協助保護「清淤地圖 - 光復計畫」的安全！**
**Thank you for helping keep the Cleanup Map - Guangfu Project secure!**
