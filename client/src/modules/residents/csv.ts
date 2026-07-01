/**
 * CSV 工具 - V1 規格
 * 住戶格式：房號,姓名,電話,Email,停車位,人數,狀態,備註
 * 成員格式：房號,成員姓名,關係,電話,身份證,生日,備註
 */

export interface ResidentCSVRow {
  property: string;
  name: string;
  phone: string;
  email: string;
  parkingId: string;
  memberCount: string;
  status: string;
  notes: string;
}

export interface MemberCSVRow {
  property: string;
  name: string;
  relation: string;
  phone: string;
  idNumber: string;
  birthdate: string;
  notes: string;
}

/** 解析 CSV 文字（支援引號跳脫） */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
        }
        if (char === '\r' && nextChar === '\n') i++;
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/** 把二維陣列組成 CSV 文字 */
export function toCSV(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(',')
    )
    .join('\n');
}

/** 解析住戶 CSV */
export function parseResidentsCSV(text: string): ResidentCSVRow[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((row) => {
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] || '').trim();
    });
    return {
      property: obj['房號'] || '',
      name: obj['姓名'] || '',
      phone: obj['電話'] || '',
      email: obj['Email'] || obj['email'] || '',
      parkingId: obj['停車位'] || '',
      memberCount: obj['人數'] || '0',
      status: obj['狀態'] || '正常',
      notes: obj['備註'] || '',
    };
  });
}

/** 解析成員 CSV */
export function parseMembersCSV(text: string): MemberCSVRow[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((row) => {
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] || '').trim();
    });
    return {
      property: obj['房號'] || '',
      name: obj['成員姓名'] || '',
      relation: obj['關係'] || '',
      phone: obj['電話'] || '',
      idNumber: obj['身份證'] || '',
      birthdate: obj['生日'] || '',
      notes: obj['備註'] || '',
    };
  });
}

/** 匯出住戶為 CSV */
export function exportResidentsCSV(residents: any[]): string {
  const headers = ['房號', '姓名', '電話', 'Email', '停車位', '人數', '狀態', '備註'];
  const rows = [headers];
  residents.forEach((r) => {
    rows.push([
      r.property || `${r.floor}-${r.unitNumber}`,
      r.name || r.ownerName || '',
      r.phone || '',
      r.email || '',
      r.parkingId || '',
      String(r.memberCount || 0),
      r.status || '正常',
      r.notes || r.note || '',
    ]);
  });
  return toCSV(rows);
}

/** 匯出成員為 CSV */
export function exportMembersCSV(members: any[]): string {
  const headers = ['房號', '成員姓名', '關係', '電話', '身份證', '生日', '備註'];
  const rows = [headers];
  members.forEach((m) => {
    rows.push([
      m.property || '',
      m.name || '',
      m.relation || m.relationship || '',
      m.phone || '',
      m.idNumber || '',
      m.birthdate || '',
      m.notes || m.note || '',
    ]);
  });
  return toCSV(rows);
}

/** 觸發瀏覽器下載 */
export function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}