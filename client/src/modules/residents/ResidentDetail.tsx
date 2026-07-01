import { useEffect, useState } from 'react';
import { X, Phone, Mail, Calendar, User, CreditCard, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useResidentStore } from '@/stores';

interface ResidentDetailProps {
  resident: any;
  onClose: () => void;
}

export function ResidentDetail({ resident, onClose }: ResidentDetailProps) {
  const members: any[] = useResidentStore((s) => s.members[resident.id] || []);
  const keycards: any[] = useResidentStore((s) => s.keycards[resident.id] || []);
  const loadMembers = useResidentStore((s) => s.loadMembers);
  const loadKeycards = useResidentStore((s) => s.loadKeycards);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadMembers(resident.id);
    loadKeycards(resident.id);
    setLoading(false);
  }, [resident.id, loadMembers, loadKeycards]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getUnitTypeLabel = (type: string) => {
    return type === 'rental' ? '租賃' : '一般';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-30" onClick={onClose} />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">住戶詳情</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-3">基本資訊</h3>
            <Card padding="md">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xl font-bold text-gray-900">{resident.name || resident.ownerName}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {resident.property || `${resident.floor}${resident.unitNumber ? ` 戶 ${resident.unitNumber}` : ''}`}
                  </p>
                </div>
                <Badge variant={resident.unitType === 'rental' ? 'warning' : 'info'}>
                  {getUnitTypeLabel(resident.unitType)}
                </Badge>
              </div>

              <div className="space-y-3">
                {resident.renterName && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">租客</p>
                      <p className="text-sm text-gray-900">{resident.renterName}</p>
                    </div>
                  </div>
                )}

                {resident.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">電話</p>
                      <p className="text-sm text-gray-900">{resident.phone}</p>
                    </div>
                  </div>
                )}

                {resident.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm text-gray-900">{resident.email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">入住日期</p>
                    <p className="text-sm text-gray-900">{formatDate(resident.moveInDate)}</p>
                  </div>
                </div>

                {resident.moveOutDate && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">搬出日期</p>
                      <p className="text-sm text-gray-900">{formatDate(resident.moveOutDate)}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </section>

          {/* Emergency Contact */}
          {(resident.emergencyContact || resident.emergencyPhone) && (
            <section>
              <h3 className="text-sm font-medium text-gray-500 mb-3">緊急聯絡人</h3>
              <Card padding="md">
                <div className="space-y-3">
                  {resident.emergencyContact && (
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">姓名</p>
                        <p className="text-sm text-gray-900">{resident.emergencyContact}</p>
                      </div>
                    </div>
                  )}
                  {resident.emergencyPhone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">電話</p>
                        <p className="text-sm text-gray-900">{resident.emergencyPhone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </section>
          )}

          {/* Family Members */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-3">家庭成員 ({members.length})</h3>
            {loading ? (
              <Card padding="md">
                <p className="text-sm text-gray-500 text-center">載入中...</p>
              </Card>
            ) : members.length === 0 ? (
              <Card padding="md">
                <div className="flex flex-col items-center text-gray-400 py-4">
                  <User className="w-8 h-8 mb-2" />
                  <p className="text-sm">尚無家庭成員資料</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <Card key={member.id} padding="sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.relationship || '家人'}</p>
                      </div>
                      {member.phone && (
                        <p className="text-sm text-gray-600">{member.phone}</p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Keycards */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-3">鑰匙卡 ({keycards.length})</h3>
            {loading ? (
              <Card padding="md">
                <p className="text-sm text-gray-500 text-center">載入中...</p>
              </Card>
            ) : keycards.length === 0 ? (
              <Card padding="md">
                <div className="flex flex-col items-center text-gray-400 py-4">
                  <CreditCard className="w-8 h-8 mb-2" />
                  <p className="text-sm">尚無鑰匙卡資料</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {keycards.map((card) => (
                  <Card key={card.id} padding="sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        <p className="text-sm font-medium text-gray-900">{card.cardNumber}</p>
                      </div>
                      {card.note && (
                        <p className="text-xs text-gray-500">{card.note}</p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Note */}
          {resident.note && (
            <section>
              <h3 className="text-sm font-medium text-gray-500 mb-3">備註</h3>
              <Card padding="md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5" />
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{resident.note}</p>
                </div>
              </Card>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
