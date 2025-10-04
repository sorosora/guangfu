'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';
import { Location } from '@/types/map';

interface ReportButtonsProps {
  userLocation?: Location;
  onReport: (state: 0 | 1) => Promise<void>;
  disabled?: boolean;
}

export default function ReportButtons({
  userLocation,
  onReport,
  disabled = false,
}: ReportButtonsProps) {
  const [loading, setLoading] = useState<0 | 1 | null>(null);

  const handleReport = async (state: 0 | 1) => {
    if (!userLocation || disabled) return;

    setLoading(state);
    try {
      await onReport(state);
    } finally {
      setLoading(null);
    }
  };

  const isLocationAvailable = !!userLocation;
  const isOutOfBounds = isLocationAvailable && disabled;

  // 決定狀態文字和樣式
  const getLocationStatus = () => {
    if (!isLocationAvailable) {
      return {
        text: '正在取得位置...',
        className: 'text-gray-500',
      };
    }

    if (isOutOfBounds) {
      return {
        text: '不在範圍內，無法使用下面功能',
        className: 'text-orange-600',
      };
    }

    return {
      text: '已取得位置',
      className: 'text-primary',
    };
  };

  const status = getLocationStatus();

  return (
    <div className="p-2 max-w-md mx-auto space-y-3 relative">
      {/* 位置狀態指示 */}
      <div className={`flex items-center justify-center space-x-2 text-sm ${status.className}`}>
        <MapPin className="w-4 h-4" />
        <span>{status.text}</span>
      </div>

      {/* 回報按鈕 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 有淤泥按鈕 */}
        <Button
          size="lg"
          className="h-16 text-lg font-medium"
          disabled={!isLocationAvailable || disabled || loading !== null}
          onClick={() => handleReport(1)}
        >
          {loading === 1 ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <span className="mr-2">🪏</span>
          )}
          有淤泥
        </Button>

        {/* 無淤泥按鈕 */}
        <Button
          size="lg"
          className="h-16 text-lg font-medium"
          disabled={!isLocationAvailable || disabled || loading !== null}
          onClick={() => handleReport(0)}
        >
          {loading === 0 ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <span className="mr-2">✨</span>
          )}
          已清除
        </Button>
      </div>

      {/* 提示文字 */}
      {!isLocationAvailable && (
        <p className="text-center text-sm text-gray-500">請允許位置權限以進行回報</p>
      )}
    </div>
  );
}
