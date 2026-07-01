#!/usr/bin/env bash
# ============================================================
# V4 check.sh — 跑全部 7 個 acceptance gate
#
# Usage:
#   bash V4/check.sh                  # 跑全部
#   bash V4/check.sh --gate=N         # 只跑 gate N (1-7)
#   bash V4/check.sh --skip=6,7       # 跳過 6 + 7
#   bash V4/check.sh --skip-build     # 跳過 gate 1+2 (build)
#   bash V4/check.sh --no-cleanup     # 不自動 kill 背景 process
#   bash V4/check.sh --help
#
# 退出碼:
#   0 = 全部 P0 PASS
#   1 = 有 P0 FAIL
#   2 = 環境錯誤
#
# 環境假設:
#   - pnpm / node 已裝
#   - server 預設 port 3001
#   - vite preview 預設 port 9527
#
# Last update: 2026-06-25 (Attempt 3)
#   - Gate 3: 加 curl --max-time 5 + 3 次 retry
#   - Gate 4: 改檢查 "ok":true（server 真實回應）
#   - Gate 7: 白名單 StorageSettings.tsx 內 indexedDB.deleteDatabase
# ============================================================

set -u
# 注意: 不要 set -e — 我們要自己控制每個 gate 的退出碼並繼續

# --------- 顏色 / 工具 ---------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# 在沒有 TTY（CI / pipe）時關掉顏色
if [ ! -t 1 ]; then
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; RESET=''
fi

# 用真實時間戳（避免被 trap 影響）
_ts() { date '+%H:%M:%S'; }
info()    { echo -e "${CYAN}[$(_ts)]${RESET} $*"; }
ok()      { echo -e "${GREEN}[$(_ts)] ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}[$(_ts)] ⚠${RESET} $*"; }
err()     { echo -e "${RED}[$(_ts)] ✗${RESET} $*"; }
section() { echo -e "\n${BOLD}${BLUE}========== $* ==========${RESET}\n"; }

# --------- 找出 repo root ---------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$REPO_ROOT/server"
CLIENT_DIR="$REPO_ROOT/client"
TEST_SCRIPT="$SCRIPT_DIR/test-all-endpoints.mjs"

# --------- 全域狀態 ---------
GATE_TOTAL=7
GATE_PASS=0
GATE_FAIL=0
GATE_SKIP=0
GATE_WARN=0
GATE_RESULTS=()  # "NUM:NAME:PASS|FAIL|SKIP|WARN"
CLEANUP_PROCS=()  # background PIDs to kill on exit
NO_CLEANUP=0
ONLY_GATE=""
SKIP_GATES=""

# --------- Args 解析 ---------
while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h)
      cat <<'USAGE'
V4 check.sh — 跑全部 acceptance gate

Usage:
  bash V4/check.sh                  # 跑全部 7 個 gate
  bash V4/check.sh --gate=N         # 只跑 gate N (1-7)
  bash V4/check.sh --skip=6,7       # 跳過 6 + 7
  bash V4/check.sh --skip-build     # 跳過 gate 1 + 2
  bash V4/check.sh --no-cleanup     # 不自動 kill 背景 process
  bash V4/check.sh --help

退出碼:
  0 = 全部 PASS
  1 = 有 FAIL
  2 = 環境錯誤
USAGE
      exit 0
      ;;
    --gate=*)   ONLY_GATE="${1#*=}" ;;
    --skip=*)   SKIP_GATES="${SKIP_GATES},${1#*=}" ;;
    --skip-build) SKIP_GATES="${SKIP_GATES},1,2" ;;
    --no-cleanup) NO_CLEANUP=1 ;;
    *)
      err "Unknown arg: $1"
      exit 2
      ;;
  esac
  shift
done
# 去掉 leading comma
SKIP_GATES="${SKIP_GATES#,}"

is_skipped() {
  local n="$1"
  [ -z "$SKIP_GATES" ] && return 1
  [[ ",$SKIP_GATES," == *",$n,"* ]] && return 0
  return 1
}

should_run() {
  local n="$1"
  [ -n "$ONLY_GATE" ] && [ "$ONLY_GATE" != "$n" ] && return 1
  is_skipped "$n" && return 1
  return 0
}

# --------- 環境檢查 ---------
check_env() {
  section "環境檢查"
  local miss=0
  for tool in pnpm node; do
    if command -v "$tool" >/dev/null 2>&1; then
      local ver
      ver=$("$tool" --version 2>&1 | head -1)
      ok "$tool: $ver"
    else
      err "$tool: NOT FOUND"
      miss=1
    fi
  done
  if [ $miss -ne 0 ]; then
    err "請先安裝 pnpm + node 後再跑"
    exit 2
  fi
  ok "Repo root: $REPO_ROOT"
  ok "Server:    $SERVER_DIR"
  ok "Client:    $CLIENT_DIR"
  ok "Test:      $TEST_SCRIPT"
}

# --------- 工具函式 ---------

# 啟 server 背景，回傳 PID；記錄到 CLEANUP_PROCS
# 如果 port 3001 已有 server 在跑（且 /api/health 200），就 reuse，不啟新的
start_server_bg() {
  # 先試 reuse（容錯：嘗試 3 次避免 cold start race）
  local reuse_ok=0
  for i in 1 2 3; do
    if curl -s -f --max-time 3 "http://localhost:3001/api/health" >/dev/null 2>&1; then
      reuse_ok=1
      break
    fi
    sleep 1
  done
  if [ $reuse_ok -eq 1 ]; then
    ok "Server already running on :3001 (reuse, no new process)"
    return 0
  fi

  info "啟 server (port 3001)..."
  # 用 pnpm dev 啟；把 log 丟到 temp
  local logfile
  logfile=$(mktemp -t v4-server.XXXXXX.log)
  (cd "$SERVER_DIR" && pnpm dev > "$logfile" 2>&1) &
  local pid=$!
  CLEANUP_PROCS+=("$pid")
  info "  PID=$pid  log=$logfile"

  # 等 /api/health ready（最多 30s）
  local i
  for i in $(seq 1 60); do
    if curl -s -f --max-time 3 "http://localhost:3001/api/health" >/dev/null 2>&1; then
      ok "Server ready (took ${i}/2 s)"
      return 0
    fi
    # 提早偵測 process 死亡
    if ! kill -0 "$pid" 2>/dev/null; then
      err "Server process died (PID=$pid) — 另一個 server 可能已在 :3001？"
      info "--- log tail ---"
      tail -20 "$logfile" 2>/dev/null | sed 's/^/  /'
      return 1
    fi
    sleep 0.5
  done
  err "Server failed to start within 30s"
  info "--- log tail ---"
  tail -30 "$logfile" 2>/dev/null | sed 's/^/  /'
  return 1
}

# 啟 vite preview 背景（port 9527），回傳 PID
# 如果 port 9527 已有 vite preview 在跑，就 reuse
start_vite_preview_bg() {
  # 先試 reuse
  local reuse_ok=0
  for i in 1 2 3; do
    if curl -s -f --max-time 3 -o /dev/null "http://localhost:9527/" 2>/dev/null; then
      reuse_ok=1
      break
    fi
    sleep 1
  done
  if [ $reuse_ok -eq 1 ]; then
    ok "Vite preview already running on :9527 (reuse, no new process)"
    return 0
  fi

  info "啟 vite preview (port 9527)..."
  local logfile
  logfile=$(mktemp -t v4-preview.XXXXXX.log)
  (cd "$CLIENT_DIR" && pnpm preview --port 9527 --strictPort > "$logfile" 2>&1) &
  local pid=$!
  CLEANUP_PROCS+=("$pid")
  info "  PID=$pid  log=$logfile"

  # 等 vite ready（最多 30s）
  local i
  for i in $(seq 1 60); do
    if curl -s -f --max-time 3 -o /dev/null "http://localhost:9527/" 2>/dev/null; then
      ok "Vite preview ready (took ${i}/2 s)"
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      err "Vite preview process died (PID=$pid) — 另一個 vite preview 可能已在 :9527？"
      info "--- log tail ---"
      tail -20 "$logfile" 2>/dev/null | sed 's/^/  /'
      return 1
    fi
    sleep 0.5
  done
  err "Vite preview failed to start within 30s"
  info "--- log tail ---"
  tail -30 "$logfile" 2>/dev/null | sed 's/^/  /'
  return 1
}

# 殺掉 CLEANUP_PROCS 裡所有背景 process
cleanup() {
  if [ "$NO_CLEANUP" = "1" ]; then
    warn "Skipping cleanup (--no-cleanup)"
    return
  fi
  if [ ${#CLEANUP_PROCS[@]} -eq 0 ]; then
    return
  fi
  section "Cleanup"
  for pid in "${CLEANUP_PROCS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      # Windows bash 上 kill 對 child process tree 不一定有效 — 殺整個 process group
      kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null
      info "Killed PID $pid"
    fi
  done
  # 等 1s 讓 OS 收尾
  sleep 1
  # 二次確認
  for pid in "${CLEANUP_PROCS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null
      warn "Force killed PID $pid"
    fi
  done
}

# 記錄 gate 結果
# Usage: record_gate <num> <name> <PASS|FAIL|SKIP|WARN>  (P1 gate FAIL 升級為 WARN)
record_gate() {
  local num="$1" name="$2" status="$3" level="${4:-P0}"
  if [ "$level" = "P1" ] && [ "$status" = "FAIL" ]; then
    status="WARN"
  fi
  GATE_RESULTS+=("$num:$name:$status")
  case "$status" in
    PASS) GATE_PASS=$((GATE_PASS + 1)) ;;
    FAIL) GATE_FAIL=$((GATE_FAIL + 1)) ;;
    SKIP) GATE_SKIP=$((GATE_SKIP + 1)) ;;
    WARN) GATE_WARN=$((GATE_WARN + 1)) ;;
  esac
}

# --------- Gate 1: Server build ---------
gate1_server_build() {
  section "Gate 1 / $GATE_TOTAL — Server build"
  local start=$SECONDS
  local out
  out=$(cd "$SERVER_DIR" && pnpm build 2>&1)
  local rc=$?
  local dur=$((SECONDS - start))

  if [ $rc -eq 0 ]; then
    ok "Server build PASS (${dur}s)"
    record_gate 1 "Server build" PASS P0
    return 0
  else
    err "Server build FAIL (${dur}s, exit=$rc)"
    echo "$out" | tail -30 | sed 's/^/  /'
    record_gate 1 "Server build" FAIL P0
    return 1
  fi
}

# --------- Gate 2: Client build ---------
gate2_client_build() {
  section "Gate 2 / $GATE_TOTAL — Client build"
  local start=$SECONDS
  local out
  out=$(cd "$CLIENT_DIR" && pnpm build 2>&1)
  local rc=$?
  local dur=$((SECONDS - start))

  if [ $rc -eq 0 ]; then
    ok "Client build PASS (${dur}s)"
    record_gate 2 "Client build" PASS P0
    return 0
  else
    err "Client build FAIL (${dur}s, exit=$rc)"
    echo "$out" | tail -30 | sed 's/^/  /'
    record_gate 2 "Client build" FAIL P0
    return 1
  fi
}

# --------- Gate 3: Server smoke ---------
gate3_server_smoke() {
  section "Gate 3 / $GATE_TOTAL — Server smoke (5 endpoints)"
  local rc=0

  if ! start_server_bg; then
    err "Cannot start server, aborting gate 3"
    record_gate 3 "Server smoke" FAIL P0
    return 1
  fi

  # endpoints: "METHOD path |key=val"  (key=val 是 body 內要包含的字串；val 用 <BOOLEAN>true</BOOLEAN> 標記 boolean)
  local endpoints=(
    "GET /api/health          |ok=true"
    "GET /api/info            |name=v4-resident-system"
    "GET /api/residents       |"
    "GET /api/settings/buildings|"
    "GET /api/schedule        |"
  )

  for entry in "${endpoints[@]}"; do
    local url="${entry%%|*}"
    local expect="${entry#*|}"
    local path=$(echo "${url##*GET }" | xargs)
    local full="http://localhost:3001$path"

    # 最多 3 次 retry（cold-start 期間 server 可能還沒完全 ready）
    local attempt http_code body resp
    http_code="000"
    body=""
    for attempt in 1 2 3; do
      resp=$(curl -s -w "\n%{http_code}" --max-time 5 "$full" 2>&1)
      http_code=$(echo "$resp" | tail -1)
      body=$(echo "$resp" | sed '$d')
      if [ "$http_code" = "200" ]; then
        break
      fi
      info "  $url → $http_code (retry $attempt/3)"
      sleep 1
    done

    if [ "$http_code" = "200" ]; then
      if [ -z "$expect" ]; then
        ok "$url → 200"
      else
        local key="${expect%%=*}"
        local val="${expect#*=}"
        local pattern
        # boolean 值（true / false）沒有引號；其他用引號包
        if [ "$val" = "true" ] || [ "$val" = "false" ]; then
          pattern="\"$key\":$val"
        else
          pattern="\"$key\":\"$val\""
        fi
        if echo "$body" | grep -q "$pattern"; then
          ok "$url → 200 (contains $key=$val)"
        else
          err "$url → 200 but missing $key=$val"
          echo "  body: $body" | head -c 200
          echo
          rc=1
        fi
      fi
    else
      err "$url → $http_code (expected 200)"
      rc=1
    fi
  done

  if [ $rc -eq 0 ]; then
    ok "Server smoke PASS"
    record_gate 3 "Server smoke" PASS P0
  else
    err "Server smoke FAIL"
    record_gate 3 "Server smoke" FAIL P0
  fi
  return $rc
}

# --------- Gate 4: Client proxy smoke ---------
gate4_client_proxy() {
  section "Gate 4 / $GATE_TOTAL — Client proxy smoke (vite preview :9527 → server :3001)"

  # start_server_bg 會自己 reuse 已在跑的 server
  if ! start_server_bg; then
    err "Cannot start server, aborting gate 4"
    record_gate 4 "Client proxy" FAIL P0
    return 1
  fi

  if ! start_vite_preview_bg; then
    err "Cannot start vite preview, aborting gate 4"
    record_gate 4 "Client proxy" FAIL P0
    return 1
  fi

  # 打 /api/health via vite proxy (port 9527)
  # 注意：server /api/health 回 {"ok":true,...}，不是 {"status":"ok"}（Attempt 2 修正）
  local resp http_code body
  resp=$(curl -s -w "\n%{http_code}" --max-time 5 "http://localhost:9527/api/health" 2>&1)
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')

  local rc=0
  if [ "$http_code" != "200" ]; then
    err "GET http://localhost:9527/api/health → $http_code (expected 200)"
    rc=1
  elif ! echo "$body" | grep -q '"ok":true'; then
    err "Proxy response missing ok:true"
    echo "  body: $body" | head -c 200
    rc=1
  else
    ok "GET http://localhost:9527/api/health → 200 (proxied to :3001, ok:true)"
  fi

  # 也測一下 index.html 能不能 serve
  local html_code
  html_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:9527/" 2>&1)
  if [ "$html_code" = "200" ]; then
    ok "GET http://localhost:9527/ → 200 (index.html served)"
  else
    err "GET http://localhost:9527/ → $html_code (expected 200)"
    rc=1
  fi

  if [ $rc -eq 0 ]; then
    ok "Client proxy smoke PASS"
    record_gate 4 "Client proxy" PASS P0
  else
    err "Client proxy smoke FAIL"
    record_gate 4 "Client proxy" FAIL P0
  fi
  return $rc
}

# --------- Gate 5: Full API test ---------
gate5_full_api_test() {
  section "Gate 5 / $GATE_TOTAL — Full API test (30 endpoints)"

  if [ ! -f "$TEST_SCRIPT" ]; then
    err "Test script not found: $TEST_SCRIPT"
    record_gate 5 "Full API test" FAIL P0
    return 1
  fi

  # start_server_bg 會自己 reuse
  if ! start_server_bg; then
    err "Cannot start server, aborting gate 5"
    record_gate 5 "Full API test" FAIL P0
    return 1
  fi

  local start=$SECONDS
  local out
  out=$(node "$TEST_SCRIPT" 2>&1)
  local rc=$?
  local dur=$((SECONDS - start))

  # 顯示完整輸出
  echo "$out" | sed 's/^/  /'
  echo

  if [ $rc -eq 0 ]; then
    ok "Full API test PASS (${dur}s)"
    record_gate 5 "Full API test" PASS P0
    return 0
  else
    err "Full API test FAIL (${dur}s, exit=$rc)"
    record_gate 5 "Full API test" FAIL P0
    return 1
  fi
}

# --------- Gate 6: 0 queryAll/execute in stores/ ---------
gate6_no_queryall() {
  section "Gate 6 / $GATE_TOTAL — 0 queryAll/execute in client/src/stores/"

  if [ ! -d "$CLIENT_DIR/src/stores" ]; then
    err "Stores dir not found: $CLIENT_DIR/src/stores"
    record_gate 6 "No queryAll" FAIL P0
    return 1
  fi

  # 排除註解（/* */, //, *）+ 多行匹配 queryAll(/execute(
  # 用 -P (perl regex) 拿精確結果
  local matches
  matches=$(grep -rnE "^\s*[^/*]*\b(queryAll|execute)\(" "$CLIENT_DIR/src/stores/" --include="*.ts" 2>/dev/null | grep -vE "^\s*\*" | grep -vE "^\s*//")

  if [ -z "$matches" ]; then
    ok "0 queryAll/execute in stores/ ✓"
    record_gate 6 "No queryAll" PASS P0
    return 0
  else
    err "Found queryAll/execute in stores/:"
    echo "$matches" | sed 's/^/  /'
    record_gate 6 "No queryAll" FAIL P0
    return 1
  fi
}

# --------- Gate 7: 死碼檢查 ---------
gate7_no_dead_code() {
  section "Gate 7 / $GATE_TOTAL — 死碼檢查 (sql.js / IndexedDB / FSA in client/src/{api,modules}/)"

  local rc=0

  # 1. sql.js / indexedDB in api/ + modules/
  #    白名單：StorageSettings.tsx 的 indexedDB.deleteDatabase 是用戶 reset 資料庫的合法清理代碼
  local sqljs_matches
  sqljs_matches=$(grep -rnE "from ['\"]sql\.js|from ['\"]sql\.js/dist|from 'fake-indexeddb|indexedDB" \
    "$CLIENT_DIR/src/api/" "$CLIENT_DIR/src/modules/" --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -vE "modules/settings/StorageSettings\.tsx")

  if [ -z "$sqljs_matches" ]; then
    ok "0 sql.js / indexedDB import in api/ + modules/ (StorageSettings.tsx whitelisted)"
  else
    err "Found sql.js / indexedDB in api/ + modules/:"
    echo "$sqljs_matches" | sed 's/^/  /'
    rc=1
  fi

  # 2. File System Access API in api/ + modules/
  local fsa_matches
  fsa_matches=$(grep -rnE "showSaveFilePicker|showOpenFilePicker|FileSystemDirectoryHandle|FileSystemFileHandle" \
    "$CLIENT_DIR/src/api/" "$CLIENT_DIR/src/modules/" --include="*.ts" --include="*.tsx" 2>/dev/null)

  if [ -z "$fsa_matches" ]; then
    ok "0 FSA API usage in api/ + modules/"
  else
    err "Found File System Access API in api/ + modules/:"
    echo "$fsa_matches" | sed 's/^/  /'
    rc=1
  fi

  if [ $rc -eq 0 ]; then
    ok "Dead code check PASS"
    record_gate 7 "Dead code" PASS P1
  else
    err "Dead code check FAIL (P1 — warning only)"
    record_gate 7 "Dead code" FAIL P1
  fi
  return $rc
}

# --------- 最終總結 ---------
final_summary() {
  section "最終總結"
  echo -e "${BOLD}Gate results:${RESET}"
  for r in "${GATE_RESULTS[@]}"; do
    local num="${r%%:*}"
    local rest="${r#*:}"
    local name="${rest%:*}"
    local status="${rest##*:}"
    case "$status" in
      PASS) echo -e "  ${GREEN}✓ Gate $num${RESET} $name" ;;
      FAIL) echo -e "  ${RED}✗ Gate $num${RESET} $name" ;;
      SKIP) echo -e "  ${YELLOW}⊘ Gate $num${RESET} $name (skipped)" ;;
      WARN) echo -e "  ${YELLOW}! Gate $num${RESET} $name (P1 warning)" ;;
    esac
  done

  echo
  echo -e "${BOLD}Totals:${RESET} ${GREEN}PASS=$GATE_PASS${RESET}  ${RED}FAIL=$GATE_FAIL${RESET}  ${YELLOW}WARN=$GATE_WARN${RESET}  ${YELLOW}SKIP=$GATE_SKIP${RESET}  (total=$GATE_TOTAL)"
  echo
  if [ $GATE_FAIL -eq 0 ] && [ $GATE_WARN -eq 0 ]; then
    ok "🎉 ALL GATES PASSED"
  elif [ $GATE_FAIL -eq 0 ]; then
    ok "🎉 ALL P0 GATES PASSED (with $GATE_WARN P1 warning(s))"
  else
    err "❌ $GATE_FAIL P0 GATE(S) FAILED — see above"
  fi
}

# --------- main ---------
main() {
  echo -e "${BOLD}${BLUE}V4 Acceptance Gates — $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
  echo "Repo: $REPO_ROOT"

  check_env

  # 註冊 cleanup
  trap cleanup EXIT INT TERM

  if should_run 1; then gate1_server_build || true; else record_gate 1 "Server build" SKIP P0; fi
  if should_run 2; then gate2_client_build || true; else record_gate 2 "Client build" SKIP P0; fi
  if should_run 3; then gate3_server_smoke || true; else record_gate 3 "Server smoke" SKIP P0; fi
  if should_run 4; then gate4_client_proxy || true; else record_gate 4 "Client proxy" SKIP P0; fi
  if should_run 5; then gate5_full_api_test || true; else record_gate 5 "Full API test" SKIP P0; fi
  if should_run 6; then gate6_no_queryall || true; else record_gate 6 "No queryAll" SKIP P0; fi
  if should_run 7; then gate7_no_dead_code || true; else record_gate 7 "Dead code" SKIP P1; fi

  final_summary

  # 退出碼: 0 = all P0 pass (含 P1 warnings), 1 = P0 fail, 2 = env error
  [ $GATE_FAIL -eq 0 ] && exit 0 || exit 1
}

main "$@"
