#!/usr/bin/env bash
# deploy.example.sh — V4 住戶管理系統一鍵部署
#
# 用法：
#   1. 複製到 deploy.sh：  cp deploy.example.sh deploy.sh
#   2. 編輯最下方的設定區（網域、密碼等）
#   3. 第一次跑：          bash deploy.sh init
#   4. 之後更新：          bash deploy.sh update
#
# 給非技術管委會主委看也懂：把這份檔 + README 印出來，依序照做就好。

set -euo pipefail

# ─── 設定區（依你的環境修改） ───────────────────────────────────────
# 對外網域或 IP（沒網域就填 VPS 的 IP）
PUBLIC_HOST="${PUBLIC_HOST:-http://your-vps-ip-or-domain}"

# 對外 web 埠（防火牆要打開這個 port）
WEB_PORT="${WEB_PORT:-8080}"

# 容器命名（預設即可，要多站並存再改）
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-v4-resident}"

# 是否要 rebuild（init 一定要 build，update 預設 rebuild）
SHOULD_BUILD="${SHOULD_BUILD:-1}"
# ─────────────────────────────────────────────────────────────────

cd "$(dirname "$0")"

log()  { printf "\033[1;34m[deploy]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[deploy]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[deploy]\033[0m %s\n" "$*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || fail "找不到指令：$1（請先安裝 Docker）"
}

# ─── 前置檢查 ──────────────────────────────────────────────────────
require docker

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  fail "找不到 docker compose（請升級 Docker Desktop 或安裝 docker-compose plugin）"
fi

# ─── 指令分流 ──────────────────────────────────────────────────────
cmd="${1:-help}"

case "$cmd" in
  init)
    log "Step 1/5  第一次部署：建映像 + 起服務"
    if [ "$SHOULD_BUILD" = "1" ]; then
      $DC build --pull
    fi
    $DC up -d

    log "Step 2/5  等服務就緒…"
    sleep 5
    $DC ps

    log "Step 3/5  驗證 API"
    if $DC exec -T api wget -qO- http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
      log "  ✓ API 健康"
    else
      warn "  ✗ API 還沒起來，請看 docker compose logs api"
    fi

    log "Step 4/5  驗證 Web"
    if curl -fsS -o /dev/null "http://127.0.0.1:${WEB_PORT}/"; then
      log "  ✓ Web 回應 200"
    else
      warn "  ✗ Web 還沒起來，請看 docker compose logs web"
    fi

    log "Step 5/5  完成！"
    log "  開瀏覽器：${PUBLIC_HOST}:${WEB_PORT}"
    log "  健康檢查：${PUBLIC_HOST}:${WEB_PORT}/api/health"
    log "  備份資料：bash deploy.sh backup"
    ;;

  update)
    log "Step 1/4  拉新程式碼（如果你用 git）"
    if [ -d .git ]; then
      git pull --ff-only || warn "git pull 失敗（也許你是直接上傳檔案）"
    else
      log "  （這個目錄不是 git repo，略過 pull）"
    fi

    log "Step 2/4  重新 build + 重啟"
    if [ "$SHOULD_BUILD" = "1" ]; then
      $DC build --pull
    fi
    $DC up -d

    log "Step 3/4  砍掉舊映像"
    docker image prune -f >/dev/null || true

    log "Step 4/4  驗證"
    sleep 5
    $DC ps
    log "  完成：${PUBLIC_HOST}:${WEB_PORT}"
    ;;

  backup)
    BACKUP_FILE="v4-data-$(date +%Y%m%d-%H%M%S).tgz"
    log "備份 SQLite volume → ${BACKUP_FILE}"
    docker run --rm \
      -v v4-data:/data:ro \
      -v "$(pwd):/backup" \
      alpine tar czf "/backup/${BACKUP_FILE}" -C /data .
    log "  ✓ 備份完成：$(pwd)/${BACKUP_FILE}"
    ;;

  restore)
    [ -n "${2:-}" ] || fail "用法：bash deploy.sh restore <備份檔.tgz>"
    BACKUP_FILE="$2"
    [ -f "$BACKUP_FILE" ] || fail "找不到檔案：$BACKUP_FILE"
    warn "即將還原 ${BACKUP_FILE} 到 v4-data volume（會覆蓋現有資料）"
    read -p "確定要繼續嗎？[y/N] " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || { log "已取消"; exit 0; }
    log "停止服務…"
    $DC down
    log "還原資料…"
    docker run --rm \
      -v v4-data:/data \
      -v "$(pwd):/backup" \
      alpine sh -c "rm -rf /data/* && tar xzf /backup/${BACKUP_FILE} -C /data"
    log "重啟服務…"
    $DC up -d
    log "  ✓ 還原完成"
    ;;

  logs)
    $DC logs -f --tail=100
    ;;

  stop)
    log "停止服務（資料保留）"
    $DC down
    ;;

  status)
    $DC ps
    echo
    log "Volume 狀態："
    docker volume inspect v4-data --format '{{ .Mountpoint }}' 2>/dev/null || true
    ;;

  help|*)
    cat <<EOF
V4 住戶管理系統一鍵部署

用法：
  bash deploy.sh init      第一次部署（建映像 + 起服務 + 驗證）
  bash deploy.sh update    更新（拉新 code + 重 build + 重啟）
  bash deploy.sh backup    備份 SQLite 資料庫到 ./v4-data-<時間>.tgz
  bash deploy.sh restore   從備份還原（會問 yes/no）
  bash deploy.sh logs      持續看 log
  bash deploy.sh stop      停服務（資料保留在 volume）
  bash deploy.sh status    看容器狀態

環境變數（可選）：
  PUBLIC_HOST=http://your-vps-ip   對外網址（給 log 提示用）
  WEB_PORT=8080                    對外 web port
EOF
    ;;
esac
