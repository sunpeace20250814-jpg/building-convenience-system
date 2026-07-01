/**
 * Calendar Module - 日曆 + 筆記/待辦/日記
 *
 * V4 改寫：原本用 queryAll/execute 讀 sql.js 的 schedule_notes；改用 useScheduleNotes hook。
 *
 * 注意：schedule_notes 目前 server 端尚未有獨立 route
 * （見 client/src/api/schedule-notes.ts 註解）。API contract 已定義，
 * 等 server route 補上後即可連通。
 */

import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, NotebookPen, ListTodo, BookHeart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { HolidayCell } from '@/components/HolidayCell';
import { useScheduleNotes, type ScheduleNoteDTO, type ScheduleNoteType } from '@/hooks/useScheduleNotes';

const TYPE_META: Record<ScheduleNoteType, { label: string; icon: any; color: string; description: string }> = {
  note: { label: '筆記', icon: NotebookPen, color: '#3b82f6', description: '一般記事' },
  todo: { label: '待辦', icon: ListTodo, color: '#f59e0b', description: '待辦事項' },
  diary: { label: '日記', icon: BookHeart, color: '#a855f7', description: '每日心情、紀錄' },
};

export function CalendarModule() {
  const toast = useToast();
  const { notes, load, create, update, remove } = useScheduleNotes(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [filterType, setFilterType] = useState<ScheduleNoteType | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const daysInMonth = useMemo(() => {
    const days: { date: string; day: number }[] = [];
    const numDays = new Date(year, month, 0).getDate();
    for (let d = 1; d <= numDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date: dateStr, day: d });
    }
    return days;
  }, [year, month]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(year, month - 1, 1).getDay();
  }, [year, month]);

  const notesByDate = useMemo(() => {
    const map = new Map<string, ScheduleNoteDTO[]>();
    for (const note of notes) {
      if (filterType !== 'all' && note.type !== filterType) continue;
      if (!map.has(note.date)) map.set(note.date, []);
      map.get(note.date)!.push(note);
    }
    return map;
  }, [notes, filterType]);

  const goPrev = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const goNext = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };
  const goToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  const handleSaveNote = async (
    date: string,
    type: ScheduleNoteType,
    content: string,
    color: string,
    isDone: boolean,
    existingId?: string
  ) => {
    try {
      if (existingId) {
        await update(existingId, { type, content, color, isDone });
      } else {
        await create({ date, type, content, color, isDone });
      }
      toast.addToast(existingId ? '已更新' : '已新增', 'success');
    } catch (err: any) {
      toast.addToast('儲存失敗：' + (err?.message ?? '未知錯誤'), 'error');
    }
  };

  const handleDeleteNote = (id: string) => {
    if (!confirm('確定刪除這則？')) return;
    void remove(id);
    toast.addToast('已刪除', 'info');
  };

  const handleToggleDone = (note: ScheduleNoteDTO) => {
    void update(note.id, { isDone: !note.isDone });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <NotebookPen className="w-6 h-6 text-blue-600" />
            日曆
          </h1>
          <p className="text-sm text-gray-500 mt-1">筆記 / 待辦 / 日記 — 你的個人時間管理</p>
        </div>
        <Button onClick={goToday}>回到今天</Button>
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            filterType === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          全部
        </button>
        {(Object.keys(TYPE_META) as ScheduleNoteType[]).map((t) => {
          const meta = TYPE_META[t];
          const Icon = meta.icon;
          return (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                filterType === t ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={filterType === t ? { backgroundColor: meta.color } : undefined}
            >
              <Icon className="w-3.5 h-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4 bg-white border border-gray-200 rounded-lg px-4 py-3">
        <Button variant="ghost" size="sm" onClick={goPrev}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold text-gray-900">
          {year} 年 {month} 月
        </h2>
        <Button variant="ghost" size="sm" onClick={goNext}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {['日', '一', '二', '三', '四', '五', '六'].map((d, idx) => (
            <div
              key={d}
              className={`px-2 py-2 text-center text-xs font-medium ${
                idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : 'text-gray-700'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square border-r border-b border-gray-100 bg-gray-50" />
          ))}

          {daysInMonth.map(({ date, day }) => {
            const dayNotes = notesByDate.get(date) || [];
            const isToday = date === today;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`aspect-square border-r border-b border-gray-100 p-1 text-left hover:bg-blue-50 transition-colors relative overflow-hidden ${
                  isToday ? 'bg-blue-50 ring-2 ring-blue-500 ring-inset' : ''
                }`}
              >
                <div className={`text-xs ${isToday ? 'font-bold text-blue-600' : 'text-gray-700'}`}>
                  {day}
                </div>
                {/* Holiday indicator */}
                <HolidayCell date={date} size="sm" variant="strip" showName className="mt-0.5" />
                <div className="mt-1 space-y-0.5">
                  {dayNotes.slice(0, 3).map((n) => (
                    <div
                      key={n.id}
                      className="text-[10px] truncate px-1 py-0.5 rounded text-white"
                      style={{ backgroundColor: n.color }}
                      title={n.content}
                    >
                      {n.type === 'todo' && (n.isDone ? '✓' : '○')} {n.content}
                    </div>
                  ))}
                  {dayNotes.length > 3 && (
                    <div className="text-[10px] text-gray-400">+{dayNotes.length - 3}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          notes={notesByDate.get(selectedDate) || []}
          onClose={() => setSelectedDate(null)}
          onSave={handleSaveNote}
          onDelete={handleDeleteNote}
          onToggleDone={handleToggleDone}
        />
      )}
    </div>
  );
}

interface DayDetailModalProps {
  date: string;
  notes: ScheduleNoteDTO[];
  onClose: () => void;
  onSave: (date: string, type: ScheduleNoteType, content: string, color: string, isDone: boolean, existingId?: string) => void;
  onDelete: (id: string) => void;
  onToggleDone: (note: ScheduleNoteDTO) => void;
}

function DayDetailModal({ date, notes, onClose, onSave, onDelete, onToggleDone }: DayDetailModalProps) {
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<ScheduleNoteType>('note');
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState(TYPE_META.note.color);

  const handleAdd = () => {
    if (!newContent.trim()) return;
    onSave(date, newType, newContent.trim(), newColor, false);
    setNewContent('');
    setAdding(false);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={date}
      size="lg"
      footer={
        <div className="flex justify-between items-center w-full">
          <Button variant="ghost" onClick={onClose}>關閉</Button>
          <Button onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" />
            新增
          </Button>
        </div>
      }
    >
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">這天還沒有任何紀錄</p>
        ) : (
          notes.map((n) => {
            const meta = TYPE_META[n.type];
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className="p-3 border rounded-lg"
                style={{ borderLeftWidth: '4px', borderLeftColor: n.color }}
              >
                <div className="flex items-start gap-2">
                  {n.type === 'todo' && (
                    <button
                      onClick={() => onToggleDone(n)}
                      className="mt-0.5 flex-shrink-0"
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          n.isDone ? 'bg-green-500 border-green-500' : 'border-gray-300'
                        }`}
                      >
                        {n.isDone && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded text-white flex items-center gap-1"
                        style={{ backgroundColor: n.color }}
                      >
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </div>
                    <p className={`text-sm ${n.isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {n.content}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(n.id)}
                    className="p-1 hover:bg-red-50 rounded text-red-500"
                    title="刪除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {adding && (
          <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
            <div className="flex gap-2">
              {(Object.keys(TYPE_META) as ScheduleNoteType[]).map((t) => {
                const meta = TYPE_META[t];
                const Icon = meta.icon;
                return (
                  <button
                    key={t}
                    onClick={() => { setNewType(t); setNewColor(meta.color); }}
                    className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 ${
                      newType === t ? 'text-white' : 'bg-white border border-gray-300 text-gray-700'
                    }`}
                    style={newType === t ? { backgroundColor: newColor } : undefined}
                  >
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="輸入內容..."
              rows={3}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setNewContent(''); }}>
                取消
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={!newContent.trim()}>
                儲存
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
