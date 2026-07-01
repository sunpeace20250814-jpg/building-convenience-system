/**
 * ImageUpload - 共用圖片上傳元件（M-15 修復版）
 *
 * 功能：
 *   - 透過 <input type="file" accept="image/*"> 選檔
 *   - POST 到 /api/upload/<table> 取得 server 路徑
 *   - 顯示縮圖預覽（支援 base64 data URI 向後相容 + 新路徑模式）
 *   - 支援清除已選圖片
 *
 * 設計：
 *   - 受控元件:value (path | base64-data-URI | null) + onChange (newValue) => void
 *   - 上傳:fetch POST multipart/form-data,server 回 url
 *   - 大檔保護:超過 maxSizeMB 會 emit null 並 alert
 *   - 顯示:若 value 是 path 而非 base64,自動 prefix /api/upload/file/
 */

import { ChangeEvent, useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from './Button';

export interface ImageUploadProps {
  /** 圖片值：可以是 server 上傳路徑（如 "home_records/abc.jpg"）、base64 data URI、或 null */
  value: string | null;
  /** 值變更時觸發（清除時傳 null） */
  onChange: (value: string | null) => void;
  /** Server upload target table（home_records / residents / decoration_records） */
  uploadTable: string;
  /** 最大檔案大小（MB），預設 5 */
  maxSizeMB?: number;
  /** 額外 className 套在容器 */
  className?: string;
  /** 禁用 */
  disabled?: boolean;
}

const DEFAULT_MAX_SIZE_MB = 5;

/**
 * 判斷 value 是否為 server 上傳路徑（不是 base64 data URI）
 * 路徑特徵:不包含 "data:" 前綴且不含 base64 字元群
 */
function isServerPath(value: string): boolean {
  return !value.startsWith('data:') && !value.startsWith('http');
}

/**
 * 把 server 路徑轉成可在 <img src> 使用的完整 URL
 */
function toImageSrc(value: string): string {
  if (value.startsWith('data:') || value.startsWith('http')) return value;
  // server 路徑 — 假設是 "table/filename.jpg"
  return `/api/upload/file/${value}`;
}

export function ImageUpload({
  value,
  onChange,
  uploadTable,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  className = '',
  disabled = false,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 清空 input 讓下次選同一檔也能觸發 onChange
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片檔案');
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`檔案太大（${(file.size / 1024 / 1024).toFixed(1)} MB），上限 ${maxSizeMB} MB`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/upload/${uploadTable}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`上傳失敗 (${res.status}): ${body.slice(0, 200)}`);
      }

      const data = await res.json() as { url: string };
      if (!data.url) throw new Error('Server 回應缺少 url 欄位');

      onChange(data.url);
    } catch (e: any) {
      setUploadError(e.message ?? '上傳失敗');
      alert(`圖片上傳失敗：${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    onChange(null);
    setUploadError(null);
  };

  const handlePickClick = () => {
    inputRef.current?.click();
  };

  const isServerValue = value ? isServerPath(value) : false;
  const srcValue = value ? toImageSrc(value) : '';

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        disabled={disabled || isUploading}
      />
      {value ? (
        <div className="relative inline-block">
          <img
            src={srcValue}
            alt="預覽"
            className="block w-32 h-32 object-cover rounded-lg border border-gray-200"
          />
          {isServerValue && (
            <span className="absolute top-1 left-1 text-[10px] bg-green-100 text-green-700 px-1 rounded">
              已上傳
            </span>
          )}
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow hover:bg-red-600 disabled:opacity-50"
            aria-label="移除圖片"
            title="移除圖片"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handlePickClick}
          disabled={disabled || isUploading}
          className="flex items-center gap-1.5"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              上傳中...
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />
              上傳圖片
            </>
          )}
        </Button>
      )}
      {/* 狀態顯示 */}
      {value && (
        <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
          <ImageIcon className="w-3 h-3" />
          <span>
            {isServerValue
              ? `伺服器儲存（${value}）`
              : `Base64 舊格式（${(value.length / 1024).toFixed(1)} KB）`}
          </span>
        </div>
      )}
      {uploadError && (
        <div className="mt-1 text-xs text-red-600">上傳錯誤: {uploadError}</div>
      )}
    </div>
  );
}