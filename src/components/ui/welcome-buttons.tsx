'use client';

import { Button } from '@/components/ui/button';
import { Users, MapPin } from 'lucide-react';

interface WelcomeButtonsProps {
  onJoin: () => void;
  areaName: string;
}

export function WelcomeButtons({ onJoin, areaName }: WelcomeButtonsProps) {
  return (
    <div className="p-2 max-w-md mx-auto space-y-3 relative">
      {/* 歡迎資訊 */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4" />
          <span>{areaName}</span>
        </div>
        <div className="text-xs text-gray-500">協助颱風災後各項工作，一起讓家園更美好</div>
      </div>

      {/* 加入按鈕 */}
      <Button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onJoin();
        }}
        size="lg"
        className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6 h-16"
      >
        <Users className="w-5 h-5 mr-2" />
        加入光復計畫
      </Button>
    </div>
  );
}
