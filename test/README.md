# Tests

**English** · [繁體中文](#繁體中文)

Two kinds of tests live here:

- `logic.test.js`: unit tests for the Banqi rules in `logic.js`. Plain Node, runs in under a second.
- `e2e/`: browser tests. They drive several headless Chrome tabs at once (host, guest, spectators, an attacker) over the Chrome DevTools Protocol, play real games through the real networking, and check what each screen shows.

## Requirements

- **Node.js 22 or newer.** The tests use the built-in `fetch` and `WebSocket`; there is nothing to `npm install`.
- **Google Chrome**, or Playwright's headless Chrome. Found automatically on Windows, macOS and Linux; set `CHROME_PATH` to use a specific one.
- **Internet access.** The game talks through public MQTT brokers and PeerJS, so the browser tests do too, even against a local copy.

## Running

From the repository root:

```bash
node test/logic.test.js
```

```bash
node test/e2e/run-all.js
```

`run-all.js` starts its own small web server on the working copy, runs every browser test one at a time, and prints a summary. The full run takes about 35 minutes; most of that is waiting on real network round trips and timeouts the tests deliberately sit through (for example, a host tab that crashes).

| Command | What it does |
|---|---|
| `node test/e2e/run-all.js` | All functional tests plus frame timing, on the local copy |
| `node test/e2e/run-all.js flows attacks` | Only the tests whose file name contains one of the words |
| `node test/e2e/run-all.js --live` | Against the published site, `https://moyu-games.github.io/banqi-online` |
| `node test/e2e/run-all.js --metrics` | Also the load-speed and move-latency reports |
| `node test/e2e/run-all.js --verbose` | Prints every line, not just failures |

A single test can also run on its own against any URL: `node test/e2e/flows.test.js http://127.0.0.1:8765`.

Screenshots, reports and the frame-timing JSON go to `test/e2e/out/`, which git ignores. The browsers run headless at low priority, so the tests don't open windows or take over the computer.

## What is covered

| File | Covers |
|---|---|
| `flows.test.js` | A full game between a desktop host and a phone guest: flips, moves, captures, win and lose screens, rematch, take-back and resign with consent, reconnection, chat, stickers, taunts, hurry, trophies, a host whose key changes |
| `instant-feedback.test.js` | The guest's taps over the relay: a move is shown at once, a flip lifts, repeated taps are ignored, lost actions are re-sent, refused moves roll back |
| `attacks.test.js` | Forged, replayed and malformed messages against the guest, host, spectators, public chat, lobby and fair shuffle, from an attacker with its own signing key |
| `security.test.js` | Unsigned forgeries against the host, the room key never on the relay, what spectators may and may not send or see |
| `bugfixes.test.js` | Regressions: resign before any flip on one screen, queued dialogs, actions from an older game, who took a move back |
| `fair-shuffle.test.js` | The commit-reveal shuffle: joint seed, the secret stays hidden, verification at the end, cheating hosts are caught |
| `spectate.test.js` | Lobby, joining as a spectator, access levels, room full, desktop layout |
| `spectator-chat.test.js` | Every spectator level, public and private chat in every direction, the host badge, emoji bubbles |
| `password.test.js` | Locked rooms: wrong and right passwords for guests and spectators, changing the password mid-game |
| `block-lobby.test.js` | Blocking someone in public chat, public rooms start at board-only, the lobby summary |
| `same-browser.test.js` | Host and guest as two tabs of one browser keep separate names, avatars and keys |
| `social.test.js` | Stickers, emoji and taunts on one screen, sticker timing and tap-to-close, messages typed before the friend joins |
| `bubbles.test.js` | Sticker, taunt and chat bubbles never cover a name or avatar, nor each other, on desktop and phone |
| `layout.test.js` | Phone spectator, phone landscape, same-device mode on a phone, dark-mode contrast, a crowded and a hostile lobby |
| `stale-host.test.js` | A spectator is told when the host tab dies without saying goodbye |
| `p2p.test.js` | Out-of-turn moves, staying in sync, reload of either side, idle screens stay still |
| `effects.test.js` | Every capture style plays and cleans up |
| `home.test.js` | The home page and "continue" back into a game |
| `perf.test.js` | Frame timing of every effect with the CPU slowed down 4× (a mid-range phone); fails if an effect drops more than 5% of frames or blocks for over 200 ms |
| `load.test.js` | Report: first paint, bytes and requests on slow 4G, and how long an invited friend waits for the board |
| `latency.test.js` | Report: how long a guest's move takes to come back, direct or through the relay |

`lib.js` is the shared harness. A new test is a file like this:

```js
require('./lib').run(async ({ tab, until, check, setProfile, sleep, base }) => {
  const H = await tab(1366, 768);            // a desktop tab with its own browser profile
  await H.nav(base + '/index.html');
  check('home page shows the lobby', await until(H, "document.getElementById('roomList')", 5000));
});
```

---

## 繁體中文

這裡有兩種測試：

- `logic.test.js`：`logic.js` 暗棋規則的單元測試，用 Node 直接跑，不到一秒。
- `e2e/`：瀏覽器測試。透過 Chrome DevTools Protocol 同時操作好幾個無頭 Chrome 分頁，分別扮演房主、朋友、觀眾和攻擊者，用真的連線實際下棋，再檢查每個畫面顯示的內容。

### 需要的環境

- **Node.js 22 以上**：測試用的是 Node 內建的 `fetch` 和 `WebSocket`，不用另外 `npm install`。
- **Google Chrome**，或 Playwright 的無頭 Chrome。Windows、macOS、Linux 都會自動找到；想指定某個 Chrome 時，設定環境變數 `CHROME_PATH`。
- **要能上網**：遊戲是透過公共 MQTT 伺服器和 PeerJS 連線，所以就算測本機版本，瀏覽器測試也需要網路。

### 怎麼跑

在 repo 根目錄執行：

```bash
node test/logic.test.js
```

```bash
node test/e2e/run-all.js
```

`run-all.js` 會自己開一個小型網頁伺服器，提供目前資料夾裡的網站，再一項一項跑完所有瀏覽器測試，最後列出總結。全部跑完大約 35 分鐘，大部分時間花在真實網路的來回，以及測試刻意等待的情況，例如等房主分頁當掉後的偵測。

| 指令 | 用途 |
|---|---|
| `node test/e2e/run-all.js` | 跑所有功能測試和流暢度測試，對象是本機版本 |
| `node test/e2e/run-all.js flows attacks` | 只跑檔名包含這些字的測試 |
| `node test/e2e/run-all.js --live` | 對正式網址 `https://moyu-games.github.io/banqi-online` 測 |
| `node test/e2e/run-all.js --metrics` | 另外量載入速度和點棋延遲 |
| `node test/e2e/run-all.js --verbose` | 印出每一行結果，不只印失敗的 |

單一測試也可以自己跑，後面接任何網址，例如 `node test/e2e/flows.test.js http://127.0.0.1:8765`。

截圖、報告和流暢度數據會存到 `test/e2e/out/`，這個資料夾不會被 git 追蹤。瀏覽器以無頭模式、低優先權執行，不會跳出視窗，也不會搶走電腦的資源。

每個測試檔涵蓋的範圍，請看上面英文版的「What is covered」表格。
