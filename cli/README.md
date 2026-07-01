# 大樓住戶系統 V4 - CLI 工具

完整的命令列介面，讓 AI Agent 或指令稿可以讀寫系統資料。

## 快速開始

```bash
# 列出所有住戶
v4-cli residents list

# 用表格格式輸出
v4-cli residents list --format=table

# 搜尋住戶
v4-cli residents search --q=王

# 取得單筆
v4-cli residents get --id=r123

# 新增住戶
v4-cli residents create --ownerName=王大明 --floor=3F --unitType=normal --buildingId=b1 --statusId=status-normal --moveInDate=2024-01-01

# 批次匯入（從 JSON 檔）
v4-cli residents create --from-file=new-residents.json

# 更新部分欄位
v4-cli residents patch --id=r123 --phone=0912345678

# 刪除
v4-cli residents delete --id=r123
```

## 可用資源

| 資源 | 說明 | 範例 |
|------|------|------|
| `residents` | 住戶管理 | `residents list/get/create/update/patch/delete/search` |
| `residents` | 家庭成員 | `residents list-members/add-member/remove-member` |
| `residents` | 鑰匙卡 | `residents list-keycards/add-keycard/remove-keycard` |
| `expenses` | 收支記錄 | `expenses list/get/create/update/delete/range` |
| `expense-categories` | 收支類別 | `expense-categories list/get/create/.../by-type` |
| `allowance-holders` | 零用金持有人 | `allowance-holders list/.../list-transactions/add-transaction` |
| `schedule` | 班表記錄 | `schedule list/get/.../by-date/by-range` |
| `shifts` | 班別 | `shifts list/get/create/update/delete` |
| `employees` | 員工 | `employees list/get/create/update/delete` |
| `holidays` | 國定假日 | `holidays list/.../by-year/by-date` |
| `statuses` | 狀態選項 | `statuses list/.../by-type` |
| `buildings` | 建築物 | `buildings list/get/create/update/delete` |
| `parking` | 停車位 | `parking list/.../by-building` |
| `home-tabs` | 公告標籤 | `home-tabs list/get/create/update/delete` |
| `home-records` | 公告記錄 | `home-records list/.../by-tab` |
| `system` | 系統 | `system ping/schema` |

## 全域選項

- `--api-url=<url>` API 伺服器（預設 `http://localhost:9527`，可用 `V4_API_URL` 環境變數）
- `--format=<fmt>` 輸出格式：`json` (預設) | `table` | `csv`
- `--from-file=<path>` 從 JSON 檔批次執行
- `--output-file=<path>` 將輸出寫入檔案
- `--dry-run` 預覽模式，不實際執行
- `--quiet` 抑制非錯誤輸出

## 批次匯入範例

`new-residents.json`：
```json
[
  {
    "ownerName": "王大明",
    "buildingId": "b1",
    "floor": "3F",
    "unitType": "normal",
    "statusId": "status-normal",
    "moveInDate": "2024-01-15"
  },
  {
    "ownerName": "李小華",
    "buildingId": "b1",
    "floor": "5F",
    "unitType": "rental",
    "statusId": "status-rental",
    "renterName": "陳小美",
    "moveInDate": "2024-02-01"
  }
]
```

執行：
```bash
v4-cli residents create --from-file=new-residents.json
```

## 在 AI Agent 中使用

CLI 透過 HTTP 呼叫後端，不需要直接連 DB，AGENT 可：

1. 從 LLM 產生 JSON 結構描述
2. 寫入暫存檔
3. 呼叫 `v4-cli <resource> create --from-file=<path>`
4. 讀取 stdout 取得回傳結果（已建立的 ID 等）

或直接用 shell 拼字串呼叫：
```bash
v4-cli residents create --ownerName="$NAME" --floor="$FLOOR" ...
```
