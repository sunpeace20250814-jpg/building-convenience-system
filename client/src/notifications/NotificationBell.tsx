/**
 * 通知鈴鐺
 * Header 上的鈴鐺 + 下拉選單
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import {
  refreshNotifications,
  subscribeNotifications,
  getNotifications,
  type Notification,
  type NotificationSeverity,
} from './system';

const SEVERITY_ICON: Record<NotificationSeverity, React.ComponentType<{ className?: string }>> = {
  urgent: AlertCircle,
  warning: AlertCircle,
  info: Info,
};

const SEVERITY_COLOR: Record<NotificationSeverity, string> = {
  urgent: 'text-red-600 bg-red-50',
  warning: 'text-orange-600 bg-orange-50',
  info: 'text-blue-600 bg-blue-50',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    refreshNotifications();
    const unsub = subscribeNotifications(() => {
      setNotifications(getNotifications());
    });
    return unsub;
  }, []);

  // 每 5 分鐘自動重新整理
  useEffect(() => {
    const id = setInterval(() => refreshNotifications(true), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const visible = notifications.filter((n) => !dismissed.has(n.id));
  const urgentCount = visible.filter((n) => n.severity === 'urgent').length;

  function handleClick(n: Notification) {
    setOpen(false);
    setDismissed((prev) => new Set(prev).add(n.id));
    if (n.link) navigate(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 hover:bg-gray-100 rounded-lg"
      >
        <Bell className={`w-5 h-5 ${urgentCount > 0 ? 'text-red-600' : 'text-gray-500'}`} />
        {visible.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {visible.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-96 overflow-y-auto">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">通知</h3>
              <button
                onClick={() => refreshNotifications(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                重新整理
              </button>
            </div>

            {visible.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle2 className="w-8 h-8 mx-auto text-green-500 mb-2" />
                <p className="text-sm">沒有任何提醒</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {visible.map((n) => {
                  const Icon = SEVERITY_ICON[n.severity];
                  return (
                    <div
                      key={n.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer flex items-start gap-2"
                      onClick={() => handleClick(n)}
                    >
                      <div className={`p-1.5 rounded ${SEVERITY_COLOR[n.severity]}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                        <p className="text-xs text-gray-500">{n.description}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <Badge variant="default" size="sm">
                            {{
                              contract: '合約',
                              birthday: '生日',
                              overdue: '逾期',
                              low_balance: '餘額',
                              system: '系統',
                            }[n.category]}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {formatRelative(n.createdAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDismissed((prev) => new Set(prev).add(n.id));
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '剛剛';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分鐘前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小時前`;
  return `${Math.floor(diff / 86400_000)} 天前`;
}
