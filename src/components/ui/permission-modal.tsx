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
import { useSetAtom } from 'jotai';
import { projectInfoOpenAtom } from '@/stores/project-info-store';

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
  const setProjectInfoOpen = useSetAtom(projectInfoOpenAtom);

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

  const handleOpenProjectInfo = () => {
    handleClose();
    setProjectInfoOpen(true);
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
                先謝謝你們，辛苦了
              </DialogTitle>
              <DialogDescription className="text-left space-y-3 pt-2">
                <span className="text-base text-gray-700 block">
                  關於花蓮樺加沙颱風災後重建的記憶，誠摯邀請你們：
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-gray-900">記錄眼前的景象</h4>
                  <p className="text-sm text-gray-600">
                    透過最簡單的按鈕，記錄下你眼前的景象——是「有需要」，還是「好多了」
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-gray-900">共同書寫歷史</h4>
                  <p className="text-sm text-gray-600">
                    每一次點擊，都是一筆珍貴的歷史筆觸，見證土地重新潔淨的可能
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-gray-900">留意幾件事</h4>
                  <ul className="text-sm text-gray-600 space-y-1 mt-1">
                    <li>• 請在安全的情況下進行記錄</li>
                    <li>• 在{areaName}範圍內才能進行</li>
                    <li>• 請誠實回報實際狀況</li>
                  </ul>
                </div>
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={handleOpenProjectInfo}>
                先認識這個計畫
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
                  為了確保回報資訊的準確性，我們需要取得你的位置權限。
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">我們承諾：</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• 僅在你進行回報時使用位置資訊</li>
                  <li>• 不會追蹤你的移動軌跡</li>
                  <li>• 不會與第三方分享位置資料</li>
                  <li>• 你可以隨時在瀏覽器設定中撤銷權限</li>
                </ul>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">瀏覽器將會詢問你：</h4>
                <p className="text-sm text-blue-800">「{hostname || '此網站'} 想要知道你的位置」</p>
                <p className="text-sm text-blue-700 mt-2">
                  請點擊「<strong>允許</strong>」或「<strong>Allow</strong>」以繼續使用。
                </p>
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
