# 猜密碼小遊戲（Telegram Mini App）

多人縮圈猜密碼遊戲：房主開房後，系統隨機選定一個密碼數字，玩家依序輪流猜測，每次猜完會回報「太大 / 太小」，可猜範圍逐漸縮小，**猜中密碼的人輸**，其餘玩家獲勝。

透過 Telegram 機器人的選單按鈕開啟，是一個純前端的 Telegram Mini App：不需要自己的後端伺服器，多人連線採用 WebRTC P2P，由「開房者」的瀏覽器分頁擔任該局的臨時權威主機。

## 專案結構

```
app/                  # Vite + React + TypeScript Mini App
├─ src/
│  ├─ telegram/       # Telegram SDK 初始化、開發環境模擬
│  ├─ game/           # 純遊戲邏輯（猜數字狀態機），含單元測試
│  ├─ net/            # PeerJS (WebRTC) 連線層 + React Context
│  └─ pages/          # Lobby / WaitingRoom / GameRoom
```

## 本機開發

```bash
cd app
npm install
npm run dev
```

在一般瀏覽器分頁開啟 `http://localhost:5173` 即可開發；不在 Telegram 環境內時，會自動套用開發用的模擬環境（假使用者、假主題），不影響 UI 開發與多人連線測試（開兩個分頁即可模擬房主／玩家）。

```bash
npm run test    # 執行猜密碼邏輯的單元測試
npm run build   # 型別檢查 + 產生 dist/ 靜態檔案
```

## 建立 Telegram Bot（需要你本人在 Telegram 內操作 @BotFather）

1. 對 **@BotFather** 傳送 `/newbot`，依提示輸入機器人名稱與唯一的 username（必須以 `bot` 結尾），完成後會拿到一組 **Bot Token**。這組 token 只有你自己留存即可，不需要放進這個專案（本專案完全不需要 bot token，因為沒有 bot 後端程式）。
2. 傳送 `/mybots`，選擇剛建立的機器人 → **Bot Settings** → **Menu Button** → **Configure Menu Button**。
3. 貼上你部署後的 HTTPS 網址（見下方部署步驟，例如 `https://igs-hongyou.github.io/tg-mini-game/`），並設定按鈕文字，例如「開始遊戲」。
4. 之後任何人在該機器人的對話視窗底部，點擊選單按鈕就會開啟這個 Mini App。
5. 如果想要「分享房間連結，對方點了就直接加入」的體驗（不需要對方先跟 bot 聊過天），要用 `/newapp` 設定成正式的 **Direct Link Mini App**，並取得一個短名稱（short name）。之後即可組出深連結：
   ```
   https://t.me/<你的bot_username>/<short_name>?startapp=<房號>
   ```
   使用者點這個連結，會直接開啟 Mini App 並自動帶入房號、進入加入房間流程（已在 `src/pages/Lobby.tsx` 處理 `startapp` 參數）。等候室的「分享到 Telegram」按鈕（`src/pages/WaitingRoom.tsx`）就是用這個深連結格式。

   目前設定：`app/src/telegram/botConfig.ts` 內的 `BOT_USERNAME` / `MINI_APP_SHORT_NAME` 對應 `t.me/little_minigame_bot/guessnum`。如果之後改了 bot username 或 short name，記得同步更新這個檔案。

全程都不需要撰寫或部署任何 Bot 後端程式碼——Menu Button 純粹是設定，不牽涉伺服器。

## 部署（不需要自架後端）

Mini App 是純靜態網站，`npm run build` 產生的 `app/dist` 可以放到任何免費、附 HTTPS 的靜態網站託管服務，只要能提供 HTTPS 網址即可（Cloudflare Pages、Vercel、Netlify 都可以）。

### 目前採用：GitHub Pages（GitHub Actions 自動部署）

`.github/workflows/deploy-pages.yml` 已設定好：每次 push 到 `main` 分支，會自動在 `app/` 內 build 並部署到 GitHub Pages，不需要手動執行部署指令。

一次性設定（僅需做一次）：

1. Repo 的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**（如果是透過 API/CLI 建立會自動設定好，這裡列出是備查）。
2. push 一次 `main` 分支後，到 repo 的 **Actions** 分頁確認 `Deploy to GitHub Pages` 工作流程跑成功。
3. 成功後網址會是：
   ```
   https://<github帳號>.github.io/tg-mini-game/
   ```
   （`app/vite.config.ts` 已把 production build 的 `base` 設成 `/tg-mini-game/` 來對應這個路徑；如果之後改了 repo 名稱，記得同步修改這裡的 `base`。）

之後每次改完程式碼、`git push` 到 `main`，GitHub Actions 就會自動重新部署，不需要再手動執行 `npm run build` 上傳。

部署完成後，把拿到的 HTTPS 網址貼回 BotFather 的 Menu Button 設定（見上一節）。

## 多人連線架構

- 使用 [PeerJS](https://peerjs.com/) 包裝 WebRTC DataChannel。房主建立房間時，向公用的 PeerJS Cloud 訊令伺服器（`0.peerjs.com`，免費）註冊一個房號，其他玩家用這個房號直接與房主的瀏覽器分頁建立 P2P 連線。
- ICE 設定同時包含 Google 公用 STUN 與 [OpenRelay](https://www.metered.ca/tools/openrelay/) 免費 TURN 伺服器（`src/net/peer.ts`），提高在嚴格 NAT／行動網路環境下的連線成功率。
- 所有玩家的猜測都送到房主驗證與計算，房主是該局唯一的權威來源，並把最新狀態廣播給所有人（`src/net/peer.ts` 的 `hostRoom` / `joinRoom`）。

### 已知限制

- **房主分頁關閉或斷線＝該局遊戲中止**：因為沒有後端接手權威狀態，房主離開後其他人只能重新建房。
- 純 P2P 連線在少數網路環境（例如公司防火牆、對稱型 NAT）下仍可能失敗，雖已加上免費 TURN 備援，但無法保證 100% 連通。
- 公用 PeerJS 訊令伺服器與 OpenRelay TURN 都沒有 SLA 保證。若之後要提高穩定度，可考慮申請一組免費的 [Metered.ca](https://www.metered.ca/) TURN 帳號（有免費額度），或自架 PeerServer。
