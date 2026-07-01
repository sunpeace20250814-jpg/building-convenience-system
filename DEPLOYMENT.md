# V4 大樓便捷系統 — 部署指南

> 對象：要把這套系統部署到生產環境的開發者
>
> 適用版本：2026-07-01（含 M-50/M-51/M-52/M-53 修復）

---

## 系統需求

| 項目 | 最低 | 建議 |
|---|---|---|
| OS | Windows 10 / macOS 12 / Linux | Windows 11 / macOS 14 |
| Node.js | 18 LTS | 20 LTS |
| pnpm | 8 | 9+ |
| 磁碟 | 1 GB（含 node_modules）| 2 GB |
| RAM | 512 MB | 1 GB |
| CPU | 2 cores | 4 cores |
| 網路 | 不需要（純本地）| 不需要 |

**不需要**：
- Docker
- 雲端服務（AWS / GCP / Azure）
- 資料庫伺服器（PostgreSQL / MySQL）
- 域名 / SSL 憑證

---

## 部署步驟

### Step 1: Clone + 安裝依賴

```powershell
# Windows PowerShell
git clone https://github.com/sunpeace20250814-jpg/building-convenience-system.git
cd building-convenience-system
pnpm install        # ~5-10 分鐘
```

```bash
# macOS / Linux
git clone https://github.com/sunpeace20250814-jpg/building-convenience-system.git
cd building-convenience-system
pnpm install
```

### Step 2: Build 前端

```powershell
cd client
pnpm run build      # 產出 dist/
cd ..
```

### Step 3: 啟動 server

#### 方法 A：直接跑（推薦本地開發）

```powershell
$env:DATA_DIR = "C:\path\to\data"   # SQLite 資料夾
$env:PORT = "4567"
$env:HOST = "127.0.0.1"
cd server
npx tsx src/index.ts
```

#### 方法 B：背景跑（推薦生產）

使用專案提供的啟動腳本：

```powershell
# Windows
.\start-v4.bat

# 或用 Node.js 啟動器
.\start-v4.mjs
```

#### 方法 C：當 Windows 服務（自動開機啟動）

```powershell
# 用 NSSM (Non-Sucking Service Manager)
nssm install V4Server "C:\Program Files\nodejs\node.exe" "C:\path\to\v4-resident-system\start-v4.mjs"
nssm set V4Server AppDirectory "C:\path\to\v4-resident-system"
nssm set V4Server AppEnvironmentExtra DATA_DIR=C:\path\to\data^&PORT=4567
nssm start V4Server
```

### Step 4: 驗證

```powershell
curl http://127.0.0.1:4567/api/health
# 預期：{"status":"ok"}
```

打開瀏覽器：`http://127.0.0.1:4567/`

---

## 環境變數

| 變數 | 預設值 | 說明 |
|---|---|---|
| `DATA_DIR` | `<repo>/server/data` | SQLite 資料夾路徑 |
| `PORT` | `4567` | HTTP 監聽 port |
| `HOST` | `127.0.0.1` | 綁定的 IP（要讓其他機器訪問改成 `0.0.0.0`）|
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

**範例**（給區網內其他機器訪問）：

```powershell
$env:HOST = "0.0.0.0"
$env:PORT = "4567"
$env:DATA_DIR = "D:\V4Data"
```

⚠️ **綁定 0.0.0.0 等於對整個網路開放**。正式對外服務前建議加 reverse proxy（Nginx / Caddy）+ 防火牆。

---

## DB Schema Migration

### 自動 Migration

`initDatabase()` 會自動跑以下 idempotent migration：

| Migration | 內容 | 對舊 DB 影響 |
|---|---|---|
| `ensureHolidaysColumns` | 補 holidays 缺的欄位 | 安全 |
| `ensureScheduleUniqueConstraint` | 加 schedule UNIQUE 索引 | 失敗不影響啟動 |
| `ensureResidentsColumns` | 補 residents owner_address/delivery_date | 安全 |
| `ensureBuildingsColumns` | 補 buildings units_per_floor 等 | 安全 |
| `ensureParkingSpotsFK` | 加 parking_spots FK CASCADE | 重建表（保留資料）|
| `ensureDayColorsDropped` | DROP day_colors 表（M-51）| 表消失（V3 殘留，0 consumer）|

### 手動備份 / 還原

```powershell
# 備份
Copy-Item "$env:DATA_DIR\resident-system.db" "$env:DATA_DIR\backups\backup-$(Get-Date -Format yyyyMMdd-HHmmss).db"

# 還原（停止 server 後）
Copy-Item "$env:DATA_DIR\backups\backup-20260101-120000.db" "$env:DATA_DIR\resident-system.db"
```

或用 server `/api/backup-history` endpoint 觸發自動備份（需要 server 還在跑）。

---

## Port & 防火牆

### 預設 Port: 4567

要改 port：設定 `PORT` env var。

### Windows 防火牆（如果要讓其他機器訪問）

```powershell
# 開放 port 4567
New-NetFirewallRule -DisplayName "V4 Server" -Direction Inbound -LocalPort 4567 -Protocol TCP -Action Allow
```

### macOS / Linux firewall

```bash
# ufw
sudo ufw allow 4567/tcp

# firewalld
sudo firewall-cmd --permanent --add-port=4567/tcp
sudo firewall-cmd --reload
```

---

## 開機自動啟動

### Windows

1. 開「工作排程器」 (`taskschd.msc`)
2. 建立工作 → 觸發程序：「電腦啟動時」
3. 動作：啟動 `start-v4.bat`
4. 「以最高權限執行」打勾

### macOS

```bash
# ~/Library/LaunchAgents/com.v4.resident-system.plist
cat > ~/Library/LaunchAgents/com.v4.resident-system.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.v4.resident-system</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/start-v4.mjs</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>DATA_DIR</key><string>/path/to/data</string>
    <key>PORT</key><string>4567</string>
  </dict>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.v4.resident-system.plist
```

### Linux (systemd)

```ini
# /etc/systemd/system/v4-resident-system.service
[Unit]
Description=V4 Resident System
After=network.target

[Service]
Type=simple
User=v4user
WorkingDirectory=/path/to/building-convenience-system
Environment="DATA_DIR=/path/to/data"
Environment="PORT=4567"
ExecStart=/usr/bin/node /path/to/start-v4.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable v4-resident-system
sudo systemctl start v4-resident-system
```

---

## 升級流程

```powershell
# 1. 停止 server
$portPid = (Get-NetTCPConnection -LocalPort 4567 -ErrorAction SilentlyContinue).OwningProcess
if ($portPid) { taskkill /PID $portPid /F }

# 2. 備份
$backup = "C:\backups\v4-$(Get-Date -Format yyyyMMdd-HHmmss).zip"
Compress-Archive -Path "$env:DATA_DIR\*" -DestinationPath $backup

# 3. Pull 最新版
git pull origin main

# 4. 安裝新依賴 + build
pnpm install
cd client && pnpm run build && cd ..

# 5. 啟動 server（自動跑 migration）
npx tsx server/src/index.ts
```

⚠️ **升級前一定要備份**。雖然 migration 設計為 idempotent，但任何 schema 變更都可能出意外。

---

## Troubleshooting

### Server 啟動失敗：port 被佔用

```powershell
Get-NetTCPConnection -LocalPort 4567 -ErrorAction SilentlyContinue | Select-Object OwningProcess
taskkill /PID <PID> /F
```

### 資料庫 lock 錯誤

```powershell
# SQLite WAL mode 偶爾會留 -wal / -shm 檔
Remove-Item "$env:DATA_DIR\resident-system.db-shm" -ErrorAction SilentlyContinue
Remove-Item "$env:DATA_DIR\resident-system.db-wal" -ErrorAction SilentlyContinue
```

### 「FK constraint failed」

代表你的 DB schema 跟程式碼不同步。跑：

```powershell
# 確認 initDatabase 有跑
npx tsx server/src/index.ts
# 看 startup log 有無 migration 訊息
```

### 跑 regression 測試

```powershell
# Server unit tests
cd server
pnpm vitest run
# 預期 82/82 PASS（截至 2026-07-01）

# Daily cron 自動跑
# 看 log: C:\Users\<user>\.mavis\crons\logs\v4-regression-<date>.log
```

---

## 反向代理（如果要對外）

### Nginx 範例

```nginx
server {
    listen 80;
    server_name v4.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:4567;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy 範例

```
v4.your-domain.com {
    reverse_proxy 127.0.0.1:4567
}
```

⚠️ **強烈建議**：對外服務時 HTTPS + fail2ban + rate limiting。SQLite 本地檔案沒加密 — 如果被入侵等於資料裸奔。

---

## Backup 策略

### 自動備份

Server 內建 `backupManager.ts` job：
- Startup 立即備份
- 每小時備份一次
- 每日 00:00 完整備份
- Shutdown 備份

備份檔位置：`<DATA_DIR>/backups/`

### 保留策略

| 備份類型 | 保留天數 |
|---|---|
| 啟動備份 | 7 天 |
| 每小時備份 | 1 天 |
| 每日備份 | 30 天 |

---

## License

預設 demo key: `V4-FREE-DEMO-0001-AAAA`（30 天試用，1 裝置）

正式 key 由 admin 透過 `POST /api/license/activate` 啟用：
- `V4-FREE-{YYYYMMDD}-{XXXX}` — 免費試用 30 天
- `V4-PRO-{YYYYMMDD}-{XXXX}` — 專業版（年訂閱，5 裝置）
- `V4-ENT-{YYYYMMDD}-{XXXX}` — 企業版（永久，999 裝置）

License 持久化到 SQLite `licenses` 表（M-52 修復）— server 重啟不丟失。

---

## Migration 失敗恢復

如果升級後 server 啟動失敗且錯誤訊息提到 schema：

1. **看 startup log** 哪個 migration 失敗
2. **回滾 DB 備份**（如果有）
3. 如果沒備份 — DB 可能已損壞，**從 source code 重 build 完整 DB**

⚠️ 升級前**永遠**先備份。如果 production 資料重要，請先在 staging 環境測試升級流程。

---

## 參考文件

- `README.md` — 專案說明
- `CHANGELOG.md` — 變更日誌
- `client/docs/storage-audit.md` — V3→V4 儲存架構遷移
- `server/tests/` — 守護測試（82 個，截至 2026-07-01）