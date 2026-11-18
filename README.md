# 🤖 FRC 10114 隊務管理系統 (Jinhe High School Robotics Team)

本專案為新北市立錦和高級中學 **FRC 10114 機器人代表隊** 專屬隊務管理系統。

- **正式網站**：`https://frc10114-team-manage.vercel.app`
- **GitHub 儲存庫**：`https://github.com/QXJHSH/teamManage`
- **AI 交接與系統架構總覽（必讀）**：請參閱 [`AI_ARCHITECTURE_AND_HANDOVER.md`](./AI_ARCHITECTURE_AND_HANDOVER.md) 與 [`AGENTS.md`](./AGENTS.md)

## ⚠️ 開發者與 AI 代理重要提醒

1. **唯一前端程式碼來源**：所有前端頁面、React 元件與加解密邏輯皆集中於根目錄的 [`index.html`](./index.html)（Single-File React 18 SPA）。請勿修改 `src/` 目錄下的遺留空殼檔案。
2. **雙集合雲端架構**：
   - `frc10114_teams/team_state`：存放公開協作資料（行事曆、設備借還、考勤、任務審核、公開隊員名冊）。
   - `frc10114_vault/{docId}`：存放經端到端加密之隊員敏感個資（PII）與 SCRAM 雙層密碼驗證憑證。
3. **修改後主動維護文件**：任何 AI 代理在完成程式碼修改與驗證後，**必須主動更新 [`AI_ARCHITECTURE_AND_HANDOVER.md`](./AI_ARCHITECTURE_AND_HANDOVER.md)** 為最新版本。
