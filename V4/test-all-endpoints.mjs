// V4 API 完整測試 v3 — 涵蓋所有 30 個 resources
const tests = [
  // 既有完整 routes
  { group: 'residents', name: 'residents', body: { property: 'T-R-X', buildingId: 'b1', floorId: 'f1', floor: '1F', floorIndex: 1, unitNumber: '88', unitType: 'normal', name: 'Test User', status: '空屋' } },
  { group: 'expenses', name: 'expenses', body: { date: '2025-06-25', amount: 100, type: 'expense', category: 'food', description: 'Test', payerId: 'r1' } },
  { group: 'schedule', name: 'schedule', body: { date: '2025-06-25', shiftType: 'day', startTime: '09:00', endTime: '18:00' } },
  { group: 'settings/buildings', name: 'buildings', body: { name: 'T-A-X', normalFloorCount: 5, rooftopFloorCount: 1, basementFloorCount: 2, unitsPerFloor: 4, unitArea: 30 } },
  { group: 'home-tabs', name: 'home-tabs', body: { title: 'T-TAB-X', icon: 'home', sortOrder: 99 } },
  { group: 'floors', name: 'floors', body: { buildingId: 'b1', floorLabel: 'T-F-X', floorIndex: 99, unitArea: 120, unitCount: 4 } },
  { group: 'facilities', name: 'facilities', body: { buildingId: 'b1', name: 'T-FAC-X', type: 'meeting-room', capacity: 10 } },
  { group: 'house-statuses', name: 'house-statuses', body: { label: 'T-X', color: '#22c55e', sortOrder: 99 } },
  { group: 'parking-statuses', name: 'parking-statuses', body: { label: 'T-X', color: '#3b82f6', sortOrder: 99 } },
  { group: 'employees', name: 'employees', body: { name: 'T-Emp-X', role: 'guard', phone: '0912-345-678' } },
  { group: 'shifts', name: 'shifts', body: { name: 'T-Shift-X', startTime: '09:00', endTime: '18:00', color: '#3b82f6' } },
  { group: 'schedule-holidays', name: 'schedule-holidays', body: { date: '2025-12-25', name: 'T-Hol-X', isWorkDay: 0 } },
  { group: 'training', name: 'training', body: { employeeId: 'e1', date: '2025-06-25', content: 'T-X', duration: 60 } },
  { group: 'allowance-holders', name: 'allowance-holders', body: { residentId: 'r1', name: 'T-AH-X', monthlyAmount: 5000 } },
  { group: 'allowance-records', name: 'allowance-records', body: { allowanceId: 'a1', date: '2025-06-25', amount: 500, type: 'monthly', balance: 5000 } },
  { group: 'expense-budgets', name: 'expense-budgets', body: { year: 2025, month: 6, categoryId: 'c1', amount: 10000 } },
  { group: 'backup-history', name: 'backup-history', body: { filename: 'test-X.db', format: 'db', size: 1024, note: 'test' } },
  { group: 'home-records', name: 'home-records', body: { tabId: 't1', title: 'T-REC-X', content: 'test' } },
  { group: 'calendar-events', name: 'calendar-events', body: { date: '2025-06-25', title: 'T-EVT-X' } },
  // 新補的 routes
  { group: 'parking-spots', name: 'parking-spots', body: { buildingId: 'b1', floor: 'B1', number: 'PX', type: 'normal' } },
  { group: 'status-options', name: 'status-options', body: { label: 'T-X', color: '#22c55e', sortOrder: 99, isWorking: true } },
  { group: 'parking-binding', name: 'parking-binding', body: { residentId: 'r1', parkingSpotId: 'p1' } },
  { group: 'resident-parking', name: 'resident-parking', body: { residentId: 'r1', parkingSpotId: 'p1', etcNumber: 'ETC-X' } },
  { group: 'resident-emergency-contacts', name: 'resident-emergency-contacts', body: { residentId: 'r1', name: 'T-C-X', phone: '0912-XXX' } },
  { group: 'decoration-records', name: 'decoration-records', body: { residentId: 'r1', name: 'T-Decor-X' } },
  { group: 'facility-bookings', name: 'facility-bookings', body: { facilityId: 'f1', residentId: 'r1', startTime: new Date().toISOString(), endTime: new Date().toISOString(), status: 'pending' } },
  { group: 'holidays', name: 'holidays', body: { date: '2025-11-11', name: 'T-Holiday-X' } },
  { group: 'holiday-categories', name: 'holiday-categories', body: { name: 'T-CAT-X', color: '#ef4444', sortOrder: 99 } },
  { group: 'schedule-entries', name: 'schedule-entries', body: { employeeId: 'e1', date: '2025-06-25', startTime: '09:00', endTime: '18:00' } },
  { group: 'schedule-notes', name: 'schedule-notes', body: { date: '2025-06-25', content: 'T-X', type: 'note', color: '#3b82f6' } },
];

async function runOne(t) {
  const url = `http://localhost:3001/api/${t.group}`;
  const rnd = Math.floor(Math.random() * 100000);
  const body = JSON.parse(JSON.stringify(t.body).replace(/X/g, String(rnd)));

  const result = { name: t.name, group: t.group, pass: false, steps: [] };
  try {
    const listResp = await fetch(url);
    result.steps.push(`GET→${listResp.status}`);
    if (listResp.status === 404) { result.detail = 'NOT IMPLEMENTED'; return result; }
    if (!listResp.ok) { result.detail = `list ${listResp.status}`; return result; }

    const postResp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const postText = await postResp.text();
    result.steps.push(`POST→${postResp.status}`);
    if (!postResp.ok) { result.detail = `POST ${postResp.status}: ${postText.substring(0, 200)}`; return result; }
    const created = JSON.parse(postText);
    const id = created.id;
    if (!id) { result.detail = 'no id'; return result; }

    const getResp = await fetch(`${url}/${encodeURIComponent(id)}`);
    result.steps.push(`GET id→${getResp.status}`);
    if (!getResp.ok) { result.detail = `GET ${getResp.status}`; return result; }

    const delResp = await fetch(`${url}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    result.steps.push(`DEL→${delResp.status}`);
    if (!delResp.ok && delResp.status !== 204) { result.detail = `DEL ${delResp.status}`; return result; }

    const getDelResp = await fetch(`${url}/${encodeURIComponent(id)}`);
    result.steps.push(`after→${getDelResp.status}`);
    if (getDelResp.status !== 404) { result.detail = `AfterDel ${getDelResp.status}`; return result; }

    result.pass = true;
    result.detail = `id=${id}`;
    return result;
  } catch (e) {
    result.detail = `EXC: ${e.message}`;
    return result;
  }
}

(async () => {
  console.log('\n=== V4 API 完整測試 v3 (30 endpoints) ===');
  let pass = 0, fail = 0;
  const results = [];
  for (const t of tests) {
    const r = await runOne(t);
    results.push(r);
    if (r.pass) { console.log(`✓ ${r.name.padEnd(28)} ${r.detail}`); pass++; }
    else { console.log(`✗ ${r.name.padEnd(28)} ${r.detail}`); fail++; }
  }
  console.log(`\n=== Summary: PASS=${pass} FAIL=${fail} ===`);
  if (fail > 0) {
    console.log('\n失敗清單：');
    results.filter(r => !r.pass).forEach(r => console.log(`  ${r.name}: ${r.detail}`));
  }
  process.exit(fail > 0 ? 1 : 0);
})();