// Smoke test for all domain functions (Phase 6 verification)
// Pure functions only — no DB required

import {
  generateFloorLabels,
  totalFloorCount,
  sortFloors,
  parseFloorLabel,
  generateEmptyResidentsForBuilding,
} from '../domain/building.js';
import {
  isVacant,
  classifyStatus,
  displayName,
  matchesQuery,
  compareResidents,
  fullDescription,
  effectiveMemberCount,
} from '../domain/resident.js';
import {
  isHoliday,
  holidayName,
  filterByYear,
  isValidDateString,
  mergeHolidaysForRange,
} from '../domain/holiday.js';
import {
  detectConflicts,
  validateTimeRange,
  isValidScheduleDate,
  sortShifts,
  sameSlot,
} from '../domain/schedule.js';

let pass = 0;
let fail = 0;

function t(label, cond) {
  if (cond) {
    pass++;
    console.log(`  PASS: ${label}`);
  } else {
    fail++;
    console.error(`  FAIL: ${label}`);
  }
}

console.log('=== Domain: building.ts ===');
const b = { name: 'A棟', normalFloorCount: 12, rooftopFloorCount: 1, basementFloorCount: 2 };
const labels = generateFloorLabels(b);
t('total 15 floors', labels.length === 15);
t('first is B2', labels[0].floorLabel === 'B2' && labels[0].floorIndex === -2);
t('last is RF', labels[14].floorLabel === 'RF' && labels[14].isRooftop);
t('totalFloorCount === 15', totalFloorCount(b) === 15);
t('parseFloorLabel B2 === -2', parseFloorLabel('B2').floorIndex === -2);
t('parseFloorLabel B1 === -1', parseFloorLabel('B1').floorIndex === -1);
t('parseFloorLabel RF === 91', parseFloorLabel('RF').floorIndex === 91);
t('parseFloorLabel 5F === 5', parseFloorLabel('5F').floorIndex === 5);
t('parseFloorLabel empty', parseFloorLabel('').floorIndex === 0);
const sorted = sortFloors([
  { floorLabel: '3F', floorIndex: 3 },
  { floorLabel: 'B1', floorIndex: -1 },
  { floorLabel: 'RF', floorIndex: 91 },
]);
t('sortFloors order B1→3F→RF', sorted.map((f) => f.floorLabel).join(',') === 'B1,3F,RF');
const empty = generateEmptyResidentsForBuilding({ id: 'b1', ...b }, { unitsPerFloor: 2 });
t('empty residents 24 (12×2)', empty.length === 24);
t('empty resident name format', empty[0].name === 'B2-1-A');

console.log('\n=== Domain: resident.ts ===');
t('classifyStatus 空屋 → vacant', classifyStatus('空屋') === 'vacant');
t('classifyStatus 出租中 → rental', classifyStatus('出租中') === 'rental');
t('classifyStatus 已出售 → sold', classifyStatus('已出售') === 'sold');
t('classifyStatus 正常 → normal', classifyStatus('正常') === 'normal');
t('classifyStatus null → unknown', classifyStatus(null) === 'unknown');
t('classifyStatus xyz → unknown', classifyStatus('xyz') === 'unknown');

const past = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
t('isVacant status=空屋', isVacant({ name: 'x', status: '空屋' }) === true);
t('isVacant moveOutDate past', isVacant({ name: 'x', status: '正常', moveOutDate: past }) === true);
t('isVacant moveOutDate future', isVacant({ name: 'x', status: '正常', moveOutDate: future }) === false);

t('displayName owner', displayName({ name: 'F', ownerName: 'O', renterName: 'R' }) === 'O');
t('displayName fallback name', displayName({ name: 'F' }) === 'F');
t('fullDescription owner+renter', fullDescription({ ownerName: 'O', renterName: 'R' }) === 'O (租客: R)');
t('fullDescription owner only', fullDescription({ ownerName: 'O' }) === 'O');

t('matchesQuery 王 in 王小明', matchesQuery({ name: '王小明' }, '王') === true);
t('matchesQuery 0912', matchesQuery({ phone: '0912' }, '0912') === true);
t('matchesQuery empty q', matchesQuery({ name: '王小明' }, '') === true);
t('matchesQuery no match', matchesQuery({ name: '王小明' }, 'xyz') === false);

t('effectiveMemberCount set', effectiveMemberCount({ memberCount: 5 }) === 5);
t('effectiveMemberCount null + fallback 3', effectiveMemberCount({}, 3) === 3);
t('effectiveMemberCount negative clamp', effectiveMemberCount({ memberCount: -1 }) === 0);

console.log('\n=== Domain: holiday.ts ===');
t('isValidDateString 2026-02-30 false', isValidDateString('2026-02-30') === false);
t('isValidDateString 2026-02-28 true', isValidDateString('2026-02-28') === true);
t('isValidDateString 2024-02-29 leap', isValidDateString('2024-02-29') === true);
t('isValidDateString empty false', isValidDateString('') === false);
t('isValidDateString not date false', isValidDateString('abc') === false);

t('isHoliday 命中 holidays 表', isHoliday('2026-01-01', [{ id: '1', date: '2026-01-01', name: '元旦' }], []) === true);
t('isHoliday 命中 schedule_holidays isWorkDay=0', isHoliday('2026-09-28', [], [{ id: '1', date: '2026-09-28', name: '教師節', isWorkDay: 0 }]) === true);
t('isHoliday schedule_holidays isWorkDay=1 不是', isHoliday('2026-09-28', [], [{ id: '1', date: '2026-09-28', name: '補班', isWorkDay: 1 }]) === false);
t('isHoliday 沒命中', isHoliday('2026-01-01', [], []) === false);
t('holidayName 優先 holidays', holidayName('2026-01-01', [{ id: '1', date: '2026-01-01', name: '元旦' }], []) === '元旦');
t('holidayName fallback schedule', holidayName('2026-09-28', [], [{ id: '1', date: '2026-09-28', name: '教師節' }]) === '教師節');
t('holidayName null', holidayName('2026-01-01', [], []) === null);

const items2026 = filterByYear([{ date: '2026-01-01' }, { date: '2026-12-31' }, { date: '2025-12-31' }], 2026);
t('filterByYear 2026 count 2', items2026.length === 2);

const merged = mergeHolidaysForRange(
  '2026-01-01',
  '2026-12-31',
  [{ id: '1', date: '2026-10-10', name: '國慶日' }],
  [
    { id: '2', date: '2026-10-10', name: '補班', isWorkDay: 1 },
    { id: '3', date: '2026-09-28', name: '教師節', isWorkDay: 0 },
  ]
);
t('merged 2 entries', merged.length === 2);
t('merged 2026-10-10 source=merged', merged.find((m) => m.date === '2026-10-10').source === 'merged');
t('merged 2026-10-10 kind=holiday', merged.find((m) => m.date === '2026-10-10').kind === 'holiday');
t('merged 2026-09-28 kind=holiday (no work day)', merged.find((m) => m.date === '2026-09-28').kind === 'holiday');

console.log('\n=== Domain: schedule.ts ===');
const existing = [
  { id: 'e1', date: '2026-06-25', shiftId: 'morning', assigneeId: 'emp1' },
  { id: 'e2', date: '2026-06-25', shiftId: 'morning', assigneeId: 'emp1' },
];
t('detectConflicts same person diff shift', detectConflicts({ date: '2026-06-25', shiftId: 'night', assigneeId: 'emp1' }, existing).hasConflict === true);
t('detectConflicts same person same shift (idempotent)', detectConflicts({ date: '2026-06-25', shiftId: 'morning', assigneeId: 'emp1' }, existing).hasConflict === false);
t('detectConflicts diff person', detectConflicts({ date: '2026-06-25', shiftId: 'morning', assigneeId: 'emp2' }, existing).hasConflict === false);
t('detectConflicts public shift (assigneeId null)', detectConflicts({ date: '2026-06-25', shiftId: 'morning', assigneeId: null }, existing).hasConflict === false);
t('detectConflicts excludeId (update self)', detectConflicts({ id: 'e1', date: '2026-06-25', shiftId: 'night', assigneeId: 'emp1' }, existing, 'e1').hasConflict === false);

const validTR = validateTimeRange('09:00', '18:00');
t('validateTimeRange 09:00/18:00 valid', validTR.valid === true);
const invalidTR = validateTimeRange('18:00', '09:00');
t('validateTimeRange 18:00/09:00 invalid', invalidTR.valid === false);
const invalidFormat = validateTimeRange('xx:00', '18:00');
t('validateTimeRange bad format', invalidFormat.valid === false);

t('isValidScheduleDate 2026-06-25', isValidScheduleDate('2026-06-25') === true);
t('isValidScheduleDate 2026-02-30', isValidScheduleDate('2026-02-30') === false);
t('isValidScheduleDate empty', isValidScheduleDate('') === false);

const sortedShifts = sortShifts([
  { id: '1', name: 'C', orderIndex: 2 },
  { id: '2', name: 'A', orderIndex: undefined },
  { id: '3', name: 'B', orderIndex: 1 },
]);
t('sortShifts orderIndex asc, no-index last', sortedShifts.map((s) => s.name).join(',') === 'B,C,A');

t('sameSlot same person same date', sameSlot({ date: '2026-06-25', assigneeId: 'a' }, { date: '2026-06-25', assigneeId: 'a' }) === true);
t('sameSlot diff person', sameSlot({ date: '2026-06-25', assigneeId: 'a' }, { date: '2026-06-25', assigneeId: 'b' }) === false);
t('sameSlot diff date', sameSlot({ date: '2026-06-25', assigneeId: 'a' }, { date: '2026-06-26', assigneeId: 'a' }) === false);
t('sameSlot null assigneeId', sameSlot({ date: '2026-06-25', assigneeId: null }, { date: '2026-06-25', assigneeId: 'a' }) === false);

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
if (fail > 0) process.exit(1);
