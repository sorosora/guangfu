# Pull Request | 拉取請求

## 變更摘要 | Summary of Changes

**簡潔描述這個 PR 的變更內容 | Briefly describe what this PR changes:**

## 變更類型 | Type of Change

請勾選適用的選項 | Please check the relevant options:

- [ ] 🐛 錯誤修復 | Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ 新功能 | New feature (non-breaking change which adds functionality)
- [ ] 💥 重大變更 | Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 文件更新 | Documentation update
- [ ] 🎨 程式碼格式調整 | Code style/formatting changes
- [ ] ♻️ 重構 | Refactoring (no functional changes)
- [ ] ⚡ 效能改善 | Performance improvements
- [ ] 🧪 測試相關 | Test-related changes
- [ ] 🔧 工具或配置變更 | Build/tool/configuration changes

## 相關 Issue | Related Issues

**此 PR 解決或相關的 issue | Issues that this PR fixes or relates to:**

- Fixes #(issue number)
- Relates to #(issue number)
- Part of #(issue number)

## 測試 | Testing

### 測試覆蓋 | Test Coverage

- [ ] 單元測試 | Unit tests
- [ ] 整合測試 | Integration tests
- [ ] E2E 測試 | End-to-end tests
- [ ] 手動測試 | Manual testing
- [ ] 無需測試 | No testing needed

### 測試環境 | Testing Environment

**已在以下環境測試 | Tested on the following environments:**

#### 瀏覽器 | Browsers

- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] 行動瀏覽器 | Mobile browsers

#### 裝置 | Devices

- [ ] 桌面電腦 | Desktop
- [ ] 行動裝置 | Mobile devices
- [ ] 平板 | Tablets

#### 作業系統 | Operating Systems

- [ ] Windows
- [ ] macOS
- [ ] Linux
- [ ] iOS
- [ ] Android

## 災難救援影響評估 | Disaster Relief Impact Assessment

**這個變更對災難救援工作的影響 | Impact of this change on disaster relief operations:**

- [ ] 🚨 緊急修復 | Critical fix - 解決影響救援工作的問題 | Fixes issues affecting rescue operations
- [ ] ⚡ 重要改善 | Important improvement - 提升救援效率 | Improves rescue efficiency
- [ ] 📈 功能增強 | Feature enhancement - 新增有用功能 | Adds useful functionality
- [ ] 🔧 技術改善 | Technical improvement - 內部優化 | Internal optimization
- [ ] 📝 文件更新 | Documentation update - 不影響核心功能 | No impact on core functionality

## 功能驗證 | Functionality Verification

### 地圖功能 | Map Functionality (如果適用 | if applicable)

- [ ] GPS 定位正常運作 | GPS positioning works correctly
- [ ] 地圖載入和顯示正常 | Map loading and display work properly
- [ ] 鎖定中心模式功能正常 | Lock-to-center mode functions correctly
- [ ] 圖磚更新機制正常 | Tile update mechanism works properly

### 回報功能 | Reporting Functionality (如果適用 | if applicable)

- [ ] 回報按鈕正常運作 | Report buttons work correctly
- [ ] 位置驗證正確 | Location validation works properly
- [ ] API 呼叫成功 | API calls succeed
- [ ] 錯誤處理正確 | Error handling works correctly

### 演算法功能 | Algorithm Functionality (如果適用 | if applicable)

- [ ] 信任演算法正確執行 | Trust algorithm executes correctly
- [ ] 範圍效應計算正確 | Area-of-effect calculations are correct
- [ ] Redis 資料更新正常 | Redis data updates work properly
- [ ] 狀態判斷邏輯正確 | Status determination logic is correct

## 效能影響 | Performance Impact

**這個變更對效能的影響 | Performance impact of this change:**

- [ ] 📈 效能改善 | Performance improvement
- [ ] 📊 效能中性 | Performance neutral
- [ ] 📉 輕微效能影響 | Minor performance impact
- [ ] ⚠️ 需要關注的效能影響 | Performance impact requiring attention

**效能測試結果 | Performance test results:**

```
在此提供效能測試數據 | Provide performance test data here
```

## 安全性考量 | Security Considerations

- [ ] 無安全性影響 | No security impact
- [ ] 已審查安全性影響 | Security impact has been reviewed
- [ ] 需要安全性審查 | Requires security review
- [ ] 包含安全性修復 | Contains security fixes

**安全性變更說明 | Security change description:**

## 向後相容性 | Backward Compatibility

- [ ] ✅ 完全向後相容 | Fully backward compatible
- [ ] ⚠️ 需要資料庫遷移 | Requires database migration
- [ ] ⚠️ 需要配置更新 | Requires configuration updates
- [ ] 💥 包含重大變更 | Contains breaking changes

**重大變更說明 | Breaking changes description:**

## 部署注意事項 | Deployment Notes

**部署此 PR 時需要注意的事項 | Notes for deploying this PR:**

### 環境變數 | Environment Variables

- [ ] 無新的環境變數 | No new environment variables
- [ ] 需要新增環境變數 | New environment variables required
- [ ] 需要更新現有環境變數 | Existing environment variables need updates

### 資料庫變更 | Database Changes

- [ ] 無資料庫變更 | No database changes
- [ ] 需要執行資料庫遷移 | Database migration required
- [ ] 需要手動資料處理 | Manual data processing required

### 依賴套件 | Dependencies

- [ ] 無新依賴 | No new dependencies
- [ ] 新增依賴套件 | New dependencies added
- [ ] 更新依賴套件 | Dependencies updated

## 文件更新 | Documentation Updates

- [ ] README.md 已更新 | README.md updated
- [ ] CLAUDE.md 已更新 | CLAUDE.md updated
- [ ] docs/tech-spec.md 已更新 | docs/tech-spec.md updated
- [ ] API 文件已更新 | API documentation updated
- [ ] 無需文件更新 | No documentation updates needed

## 檢查清單 | Checklist

請確認您已經完成以下步驟 | Please confirm you have completed the following:

### 程式碼品質 | Code Quality

- [ ] 程式碼遵循專案規範 | Code follows project standards
- [ ] 已執行 `npm run lint` 且無錯誤 | Ran `npm run lint` with no errors
- [ ] 已執行 `npm run type-check` 且無錯誤 | Ran `npm run type-check` with no errors
- [ ] 已執行 `npm run test` 且測試通過 | Ran `npm run test` and tests pass

### 提交規範 | Commit Standards

- [ ] 提交訊息遵循 Conventional Commits 規範 | Commit messages follow Conventional Commits
- [ ] 提交歷史清晰且有意義 | Commit history is clean and meaningful
- [ ] 分支名稱符合命名規範 | Branch name follows naming convention

### 審查準備 | Review Readiness

- [ ] PR 描述清楚完整 | PR description is clear and complete
- [ ] 已自我審查程式碼 | Self-reviewed the code
- [ ] 已解決所有 merge conflicts | Resolved all merge conflicts
- [ ] 已指派適當的審查者 | Assigned appropriate reviewers

### 特殊考量 | Special Considerations

- [ ] 考慮了行動裝置相容性 | Considered mobile device compatibility
- [ ] 考慮了網路連線不穩定的情況 | Considered unstable network conditions
- [ ] 考慮了災難現場的使用環境 | Considered disaster site usage environment
- [ ] 考慮了多語言支援需求 | Considered multilingual support requirements

## 審查者注意事項 | Notes for Reviewers

**請審查者特別關注的地方 | Please pay special attention to:**

## 部署後驗證 | Post-Deployment Verification

**部署後需要驗證的項目 | Items to verify after deployment:**

- [ ] 功能在生產環境正常運作 | Functionality works in production
- [ ] 效能監控指標正常 | Performance monitoring metrics are normal
- [ ] 錯誤日誌無異常 | Error logs show no anomalies
- [ ] 使用者回饋正面 | User feedback is positive

---

## 致謝 | Acknowledgments

**特別感謝 | Special thanks to:**

---

**感謝您的貢獻！讓我們一起改善花蓮光復清淤地圖！**  
**Thank you for your contribution! Let's improve the Hualien Guangfu Cleanup Progress Map together!**
