/**
 * 情境感知橫幅
 * 偵測到重要情境時顯示（如：偵測到雲端硬碟、偵測到雲端有備份等）
 * 不擋操作、可隨時關閉
 */

import { useEffect, useState } from 'react';
import { Cloud, X } from 'lucide-react';
import { detectEnvironment } from '@/lib/environment';
import {
  shouldShowCloudBindingPrompt,
  markCloudBindingPrompted,
} from '@/lib/onboarding';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface ContextAwareBannerProps {
  /** 讓使用者重新跑精靈的回呼 */
  onChangeSettings?: () => void;
}

type BannerType = 'cloud-detected' | 'cloud-backup-found' | 'upgrade-available';

interface Banner {
  type: BannerType;
  title: string;
  description: string;
  icon: React.ReactNode;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  dismissed?: boolean;
}

export function ContextAwareBanner({ onChangeSettings }: ContextAwareBannerProps) {
  // 抑制未使用警告（保留 prop 以備未來使用）
  void onChangeSettings;
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const env = await detectEnvironment();
        const newBanners: Banner[] = [];

        // 情境 1：偵測到雲端硬碟但未綁定備份
        if (shouldShowCloudBindingPrompt()) {
          const availableDrives = env.cloudDrives.filter((d) => d.available);
          if (availableDrives.length > 0) {
            const driveNames = availableDrives.map((d) => d.name).join('、');
            const backupEnabled = localStorage.getItem('v4-auto-backup-enabled') === '1';
            const backupDir = localStorage.getItem('v4-auto-backup-dir') || '';

            // 檢查備份是否已綁定到雲端
            const isCloudBound = backupEnabled && availableDrives.some((d) =>
              d.mountPath && backupDir.startsWith(d.mountPath)
            );

            if (!isCloudBound) {
              newBanners.push({
                type: 'cloud-detected',
                title: `偵測到你的 ${driveNames}`,
                description: '要不要把備份綁定到雲端硬碟？這樣換電腦時資料可以無縫接軌。',
                icon: <Cloud className="w-5 h-5" />,
                primaryAction: {
                  label: '綁定雲端備份',
                  onClick: () => {
                    markCloudBindingPrompted();
                    // 跳到備份模組
                    window.location.hash = '#/backup';
                  },
                },
                secondaryAction: {
                  label: '之後再說',
                  onClick: () => markCloudBindingPrompted(),
                },
              });
            } else {
              // 已綁定就標記已顯示
              markCloudBindingPrompted();
            }
          }
        }

        setBanners(newBanners);
      } catch (err) {
        console.warn('ContextAwareBanner detection failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || banners.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-30 pointer-events-none">
      <div className="max-w-4xl mx-auto p-3 space-y-2">
        {banners.map((banner, idx) => (
          <BannerItem
            key={`${banner.type}-${idx}`}
            banner={banner}
            onDismiss={() => {
              setBanners((prev) => prev.filter((_, i) => i !== idx));
              markCloudBindingPrompted();
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface BannerItemProps {
  banner: Banner;
  onDismiss: () => void;
}

function BannerItem({ banner, onDismiss }: BannerItemProps) {
  return (
    <div
      className={cn(
        'pointer-events-auto rounded-lg shadow-lg border p-4 flex items-start gap-3 bg-white',
        banner.type === 'cloud-detected' && 'border-blue-200',
        banner.type === 'cloud-backup-found' && 'border-green-200',
        banner.type === 'upgrade-available' && 'border-amber-200'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          banner.type === 'cloud-detected' && 'bg-blue-100 text-blue-600',
          banner.type === 'cloud-backup-found' && 'bg-green-100 text-green-600',
          banner.type === 'upgrade-available' && 'bg-amber-100 text-amber-600'
        )}
      >
        {banner.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900">{banner.title}</div>
        <div className="text-sm text-gray-600 mt-0.5">{banner.description}</div>

        {(banner.primaryAction || banner.secondaryAction) && (
          <div className="flex items-center gap-2 mt-2">
            {banner.primaryAction && (
              <Button
                size="sm"
                onClick={() => {
                  banner.primaryAction!.onClick();
                  onDismiss();
                }}
              >
                {banner.primaryAction.label}
              </Button>
            )}
            {banner.secondaryAction && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  banner.secondaryAction!.onClick();
                  onDismiss();
                }}
              >
                {banner.secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}