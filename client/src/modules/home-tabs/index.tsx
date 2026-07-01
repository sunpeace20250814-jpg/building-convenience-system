import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHomeTabsStore } from '@/stores';
import type { HomeTab, HomeRecord } from '@/stores/homeTabsStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  Plus,
  MessageSquare,
  Tag,
  Trash2,
  Edit,
  FileText,
  Clock,
  Image as ImageIcon,
  Pin,
  Upload,
} from 'lucide-react';
import { getCurrentLanguage } from '@/i18n';

interface TabFormData {
  name: string;
}

interface RecordFormData {
  title: string;
  content: string;
  /** 圖片參考：可以是 server path（如 "home_records/abc.jpg"）或 base64 data URI（舊資料） */
  imageBase64?: string;
  imagePath?: string;  // M-15 修復：server 上傳路徑優先
  imageFilename?: string;
  pinned: boolean;
}

export function HomeTabsModule() {
  const { t } = useTranslation();
  const {
    tabs,
    records,
    loadTabs,
    loadRecords,
    createTab,
    updateTab,
    deleteTab,
    addRecord,
    updateRecord,
    removeRecord,
    isLoading,
  } = useHomeTabsStore();

  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isTabModalOpen, setIsTabModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [editingTab, setEditingTab] = useState<HomeTab | null>(null);
  const [editingRecord, setEditingRecord] = useState<HomeRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<HomeRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tabForm, setTabForm] = useState<TabFormData>({
    name: '',
  });

  const [recordForm, setRecordForm] = useState<RecordFormData>({
    title: '',
    content: '',
    imageBase64: '',
    imagePath: '',
    imageFilename: '',
    pinned: false,
  });

  useEffect(() => {
    void loadTabs();
    void loadRecords();
  }, [loadTabs, loadRecords]);

  useEffect(() => {
    if (tabs.length > 0 && !activeTabId) {
      setActiveTabId(tabs[0].id);
      void loadRecords(tabs[0].id);
    }
  }, [tabs, activeTabId, loadRecords]);

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
    void loadRecords(tabId);
  };

  const handleNewTab = () => {
    setEditingTab(null);
    setTabForm({ name: '' });
    setIsTabModalOpen(true);
  };

  const handleEditTab = (tab: HomeTab, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTab(tab);
    setTabForm({ name: tab.name });
    setIsTabModalOpen(true);
  };

  const handleDeleteTab = async (tab: HomeTab) => {
    if (window.confirm(t('home-tabs.deleteTabConfirm', { name: tab.name }))) {
      await deleteTab(tab.id);
      if (activeTabId === tab.id) {
        const remaining = tabs.filter((tb) => tb.id !== tab.id);
        if (remaining.length > 0) {
          setActiveTabId(remaining[0].id);
          void loadRecords(remaining[0].id);
        } else {
          setActiveTabId(null);
        }
      }
    }
  };

  const handleTabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingTab) {
        // 用 updateTab in-place edit 取代 delete+create（保留 ID + createdAt + FK）
        await updateTab(editingTab.id, { name: tabForm.name });
      } else {
        await createTab({ name: tabForm.name, sortOrder: tabs.length });
      }
      setIsTabModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewRecord = () => {
    setEditingRecord(null);
    setRecordForm({ title: '', content: '', imageBase64: '', imagePath: '', imageFilename: '', pinned: false });
    setIsRecordModalOpen(true);
  };

  const handleEditRecord = (record: HomeRecord) => {
    setEditingRecord(record);
    setRecordForm({
      title: record.title,
      content: record.content ?? '',
      // 新格式優先:imagePath > 舊 imageBase64
      imageBase64: (record as any).imageBase64 ?? '',
      imagePath: (record as any).imagePath ?? '',
      imageFilename: record.imageFilename ?? '',
      pinned: !!record.pinned,
    });
    setIsRecordModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert(t('home-tabs.imageTooLarge'));
      return;
    }
    // 清 input value 讓下次選同一檔也能觸發
    e.target.value = '';
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/home_records', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`上傳失敗 (${res.status})`);
      }
      const data = await res.json() as { url: string };
      // 用 imagePath 欄位(server 路徑),向後相容老 imageBase64 column
      setRecordForm((prev) => ({
        ...prev,
        imagePath: data.url,
        imageFilename: file.name,
      }));
    } catch (err: any) {
      alert(`上傳失敗：${err.message}`);
    }
  };

  const handleViewRecord = (record: HomeRecord) => {
    setViewingRecord(record);
    setIsContentModalOpen(true);
  };

  const handleDeleteRecord = async (record: HomeRecord) => {
    if (window.confirm(t('home-tabs.deleteRecordConfirm'))) {
      await removeRecord(record.id);
    }
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTabId) return;

    setIsSubmitting(true);
    try {
      const payload = {
        title: recordForm.title,
        content: recordForm.content || null,
        imageBase64: recordForm.imageBase64 || null,
        imagePath: recordForm.imagePath || null,
        imageFilename: recordForm.imageFilename || null,
        pinned: recordForm.pinned ? 1 : 0,
        tabId: activeTabId,
      };
      if (editingRecord) {
        // server PUT 是 partial update；直接帶上要更新的欄位
        await updateRecord(editingRecord.id, payload);
      } else {
        await addRecord(activeTabId, payload);
      }
      await loadRecords(activeTabId);
      setIsRecordModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    // 跟著當前 i18n 語系
    const localeMap: Record<string, string> = {
      'zh-TW': 'zh-TW',
      'en': 'en-US',
    };
    const currentLang = getCurrentLanguage();
    return date.toLocaleDateString(localeMap[currentLang] || 'zh-TW', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeRecords = records;

  return (
    <div className="p-6">
      <PageHeader
        title={t('home-tabs.title')}
        description={t('home-tabs.description')}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleNewTab}>
              <Tag className="w-4 h-4 mr-2" />
              {t('home-tabs.addTab')}
            </Button>
            <Button onClick={handleNewRecord} disabled={!activeTabId}>
              <Plus className="w-4 h-4 mr-2" />
              {t('home-tabs.addRecord')}
            </Button>
          </div>
        }
      />

      <div className="flex gap-6">
        {/* Tab Sidebar */}
        <div className="w-64 flex-shrink-0">
          <Card padding="sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700">{t('home-tabs.tabs')}</h3>
            </div>

            {isLoading && tabs.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : tabs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Tag className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">{t('home-tabs.noTabs')}</p>
                <p className="text-xs mt-1">{t('home-tabs.noTabsHint')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      activeTabId === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                    onClick={() => handleTabClick(tab.id)}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-sm font-medium">{tab.name}</span>
                    </div>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => handleEditTab(tab, e)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteTab(tab);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {!activeTabId ? (
            <Card className="flex flex-col items-center justify-center py-16">
              <FileText className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-500">{t('home-tabs.selectTabFirst')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('home-tabs.orCreateTab')}</p>
            </Card>
          ) : (
            <>
              {/* Tab Header */}
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {tabs.find((tb) => tb.id === activeTabId)?.name}
                </h2>
                <Badge variant="info" size="sm">
                  {t('home-tabs.recordCount', { count: activeRecords.length })}
                </Badge>
              </div>

              {/* Records List */}
              {activeRecords.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-12">
                  <FileText className="w-12 h-12 text-gray-300 mb-4" />
                  <p className="text-lg font-medium text-gray-500">{t('home-tabs.noRecords')}</p>
                  <p className="text-sm text-gray-400 mt-1">{t('home-tabs.noRecordsHint')}</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {activeRecords.map((record) => (
                    <Card key={record.id} className="hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => handleViewRecord(record)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <h3 className="text-base font-medium text-gray-900">
                              {record.title}
                            </h3>
                            {record.pinned ? <Pin className="w-3.5 h-3.5 text-yellow-500" /> : null}
                            {record.imageBase64 ? <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> : null}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2 ml-6">
                            {record.content}
                          </p>
                          <div className="flex items-center gap-4 mt-3 ml-6 text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(record.createdAt ?? '')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRecord(record)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => void handleDeleteRecord(record)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tab Modal */}
      {isTabModalOpen && (
        <Modal
          isOpen={isTabModalOpen}
          onClose={() => setIsTabModalOpen(false)}
          title={editingTab ? t('home-tabs.editTab') : t('home-tabs.addTab')}
          size="sm"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsTabModalOpen(false)} disabled={isSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleTabSubmit} disabled={isSubmitting}>
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleTabSubmit} className="space-y-4">
            <Input
              label={t('home-tabs.tabName')}
              value={tabForm.name}
              onChange={(e) => setTabForm({ name: e.target.value })}
              placeholder={t('home-tabs.tabNamePlaceholder')}
              required
            />
          </form>
        </Modal>
      )}

      {/* Record Modal */}
      {isRecordModalOpen && (
        <Modal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          title={editingRecord ? t('home-tabs.editRecord') : t('home-tabs.addRecord')}
          size="lg"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsRecordModalOpen(false)} disabled={isSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleRecordSubmit} disabled={isSubmitting}>
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleRecordSubmit} className="space-y-4">
            <Input
              label={t('home-tabs.recordTitle')}
              value={recordForm.title}
              onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })}
              placeholder={t('home-tabs.recordTitlePlaceholder')}
              required
            />

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('home-tabs.recordContent')}</label>
              <textarea
                value={recordForm.content}
                onChange={(e) => setRecordForm({ ...recordForm, content: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('home-tabs.recordContentPlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('home-tabs.attachment')}</label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">{recordForm.imageFilename || t('home-tabs.chooseImage')}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                {(recordForm.imagePath || recordForm.imageBase64) && (
                  <Button size="sm" variant="ghost" onClick={() => setRecordForm({ ...recordForm, imageBase64: '', imagePath: '', imageFilename: '' })}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              {(recordForm.imagePath || recordForm.imageBase64) && (
                <img
                  src={recordForm.imagePath
                    ? `/api/upload/file/${recordForm.imagePath}`
                    : recordForm.imageBase64!}
                  alt={t('home-tabs.preview')}
                  className="mt-2 max-h-40 rounded border"
                />
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={recordForm.pinned}
                onChange={(e) => setRecordForm({ ...recordForm, pinned: e.target.checked })} />
              <Pin className="w-3.5 h-3.5" />{t('home-tabs.pinned')}
            </label>
          </form>
        </Modal>
      )}

      {/* Content View Modal */}
      {isContentModalOpen && viewingRecord && (
        <Modal
          isOpen={isContentModalOpen}
          onClose={() => setIsContentModalOpen(false)}
          title={viewingRecord.title}
          size="lg"
          footer={
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setIsContentModalOpen(false)}>
                {t('home-tabs.close')}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{formatDate(viewingRecord.createdAt ?? '')}</span>
              {viewingRecord.pinned ? (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-yellow-600"><Pin className="w-3 h-3" />{t('home-tabs.pinnedLabel')}</span>
              ) : null}
            </div>
            {/* 圖片顯示：新格式 imagePath 優先；舊 imageBase64 fallback */}
            {(viewingRecord as any).imagePath || viewingRecord.imageBase64 ? (
              <img
                src={(viewingRecord as any).imagePath
                  ? `/api/upload/file/${(viewingRecord as any).imagePath}`
                  : viewingRecord.imageBase64!}
                alt={viewingRecord.imageFilename || t('home-tabs.attachment')}
                className="max-w-full max-h-96 rounded border cursor-zoom-in hover:opacity-90 transition-opacity"
                onClick={() =>
                  setLightboxImage(
                    (viewingRecord as any).imagePath
                      ? `/api/upload/file/${(viewingRecord as any).imagePath}`
                      : viewingRecord.imageBase64 ?? null,
                  )
                }
              />
            ) : null}
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{viewingRecord.content}</p>
            </div>
          </div>
        </Modal>
      )}

      {/* Lightbox - 點圖放大預覽 */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300"
            onClick={() => setLightboxImage(null)}
            aria-label={t('home-tabs.lightboxClose')}
          >
            ×
          </button>
          <img
            src={lightboxImage}
            alt={t('home-tabs.lightboxAlt')}
            className="max-w-[95vw] max-h-[95vh] object-contain"
          />
        </div>
      )}
    </div>
  );
}
