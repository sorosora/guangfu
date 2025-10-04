'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
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
  // 基本狀態
  const [loading, setLoading] = useState<0 | 1 | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [clickedButton, setClickedButton] = useState<0 | 1 | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  // 清理計時器
  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
    };
  }, []);

  // 倒數計時效果
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      countdownTimer.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => {
        if (countdownTimer.current) clearTimeout(countdownTimer.current);
      };
    } else {
      // 倒數結束處理
      setCountdown(null);
      setClickedButton(null);
    }
  }, [countdown]);

  const handleReport = async (state: 0 | 1) => {
    if (!userLocation || disabled) return;

    setLoading(state);
    setCountdown(3); // 開始3秒倒數
    setClickedButton(state); // 記錄哪個按鈕被點擊

    // 立即執行 API 回報
    try {
      await onReport(state);
    } finally {
      // API 完成後清除 loading 狀態
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
        {/* 有需要按鈕 */}
        <Button
          size="lg"
          className="h-16 text-lg font-medium"
          disabled={!isLocationAvailable || disabled || loading !== null || countdown !== null}
          onClick={() => handleReport(1)}
        >
          <div className="flex items-center space-x-2">
            <span>🪏</span>
            <div className="flex flex-col items-center leading-tight">
              <span className="text-md">有需要</span>
              <div className="relative h-5 flex items-center justify-center">
                {clickedButton === 1 && countdown !== null ? (
                  <span className="text-sm font-semibold tabular-nums">00:0{countdown}</span>
                ) : (
                  <span className="text-md opacity-80">有淤泥</span>
                )}
              </div>
            </div>
          </div>
        </Button>

        {/* 好多了按鈕 */}
        <Button
          size="lg"
          className="h-16 text-lg font-medium"
          disabled={!isLocationAvailable || disabled || loading !== null || countdown !== null}
          onClick={() => handleReport(0)}
        >
          <div className="flex items-center space-x-2">
            <span>✨</span>
            <div className="flex flex-col items-center leading-tight">
              <span className="text-md">好多了</span>
              <div className="relative h-5 flex items-center justify-center">
                {clickedButton === 0 && countdown !== null ? (
                  <span className="text-sm font-semibold tabular-nums">00:0{countdown}</span>
                ) : (
                  <span className="text-md opacity-80">清理了</span>
                )}
              </div>
            </div>
          </div>
        </Button>
      </div>

      {/* 提示文字 */}
      {!isLocationAvailable && (
        <p className="text-center text-sm text-gray-500">請允許位置權限以進行回報</p>
      )}
    </div>
  );
}
