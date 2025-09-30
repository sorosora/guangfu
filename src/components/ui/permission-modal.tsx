'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, AlertTriangle, Shield, Users } from 'lucide-react';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestPermission: () => void;
  areaName: string;
}

export function PermissionModal({
  isOpen,
  onClose,
  onRequestPermission,
  areaName,
}: PermissionModalProps) {
  const [step, setStep] = useState<'intro' | 'permission'>('intro');
  const [hostname, setHostname] = useState<string>('');

  const handleNext = () => {
    setStep('permission');
  };

  const handleRequestPermission = () => {
    onRequestPermission();
  };

  const handleClose = () => {
    setStep('intro');
    onClose();
  };

  // 當 Modal 打開時重置步驟
  useEffect(() => {
    if (isOpen) {
      setStep('intro');
    }
  }, [isOpen]);

  // 在客戶端設定 hostname
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHostname(window.location.hostname);
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {step === 'intro' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Users className="w-6 h-6 text-blue-600" />
                歡迎加入鏟子超人Go
              </DialogTitle>
              <DialogDescription className="text-left space-y-3 pt-2">
                <span className="text-base text-gray-700 block">
                  協助{areaName}颱風後清淤工作，一起讓家園更美好！
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-gray-900">精準回報位置</h4>
                  <p className="text-sm text-gray-600">使用GPS定位確保回報資訊準確</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-gray-900">隱私保護</h4>
                  <p className="text-sm text-gray-600">
                    位置資訊僅用於淤泥狀態回報，不會儲存個人資料
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-gray-900">注意事項</h4>
                  <ul className="text-sm text-gray-600 space-y-1 mt-1">
                    <li>• 請在安全的情況下進行回報</li>
                    <li>• 確保在{areaName}範圍內才能回報</li>
                    <li>• 請誠實回報實際狀況</li>
                  </ul>
                </div>
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                繼續
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'permission' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <MapPin className="w-6 h-6 text-blue-600" />
                位置權限授權
              </DialogTitle>
              <DialogDescription className="text-left space-y-3 pt-2">
                <span className="text-base text-gray-700 block">
                  為了確保回報資訊的準確性，我們需要取得您的位置權限。
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">瀏覽器將會詢問您：</h4>
                <p className="text-sm text-blue-800">「{hostname || '此網站'} 想要知道您的位置」</p>
                <p className="text-sm text-blue-700 mt-2">
                  請點擊「<strong>允許</strong>」或「<strong>Allow</strong>」以繼續使用。
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">我們承諾：</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• 僅在您進行回報時使用位置資訊</li>
                  <li>• 不會追蹤您的移動軌跡</li>
                  <li>• 不會與第三方分享位置資料</li>
                  <li>• 您可以隨時在瀏覽器設定中撤銷權限</li>
                </ul>
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                稍後再說
              </Button>
              <Button onClick={handleRequestPermission} className="bg-green-600 hover:bg-green-700">
                授予位置權限
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
