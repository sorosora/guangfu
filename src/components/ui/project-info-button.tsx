'use client';

import { Info, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAtom } from 'jotai';
import { projectInfoOpenAtom } from '@/stores/project-info-store';

export function ProjectInfoButton() {
  const [isOpen, setIsOpen] = useAtom(projectInfoOpenAtom);

  return (
    <>
      {/* 按鈕 */}
      <div className="fixed top-4 left-4 z-[1020]">
        <Button
          variant="outline"
          size="sm"
          className="bg-white/90 backdrop-blur-sm border-gray-300 text-gray-700 hover:bg-white/95 shadow-md"
          aria-label="打開專案資訊"
          onClick={() => setIsOpen(true)}
        >
          <Info className="w-4 h-4" />
          清淤地圖 - 光復計畫
        </Button>
      </div>

      {/* 蓋版內容 - 直接渲染在 DOM，不使用 Portal */}
      <div
        className={cn(
          'fixed inset-0 z-[1060] flex items-center justify-center transition-all duration-200',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* 背景遮罩 */}
        <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />

        {/* 內容區域 */}
        <div
          className={cn(
            'relative bg-white rounded-lg shadow-xl max-w-4xl w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto p-6 transition-transform duration-200',
            isOpen ? 'scale-100' : 'scale-95'
          )}
        >
          {/* 關閉按鈕 */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none p-1"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>

          {/* 標題 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-center">清淤地圖 - 光復計畫</h1>
          </div>

          <div className="prose prose-gray max-w-none space-y-6">
            <div className="text-center italic text-lg text-gray-600 border-l-4 border-blue-500 pl-4 mb-8">
              這不只是一張地圖，而是一部由眾人書寫的土地記憶
            </div>

            <section>
              <p className="text-gray-700 leading-relaxed">
                當颱風過後，塵土與淤泥覆蓋了我們熟悉的家園，許多資訊平台可以告訴我們「哪裡需要清掃」。我有個想法：我們該如何記憶這段從滿目瘡痍到重新站起的完整歷程？
              </p>
              <p className="text-gray-700 leading-relaxed">
                「清淤地圖 -
                光復計畫」因此誕生。它不僅僅是一個標示進度的工具，更希望它成為一部動態的、由群眾共同書寫的視覺史詩。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">看見掙扎，也看見希望</h2>
              <p className="text-gray-700 leading-relaxed">
                重建的路從不是一帆風順，有的地方髒了又清，清了又髒。這個平台的目的，就是忠實地記錄下這份真實的拉鋸。
              </p>
              <p className="text-gray-700 leading-relaxed">
                想邀請所有在現場的人，透過最簡單的按鈕，記錄下你眼前的景象
                ——是「有需要」，還是「好多了」。
              </p>
              <p className="text-gray-700 leading-relaxed">
                每一次點擊，都是一筆珍貴的歷史筆觸。當這些點滴紀錄匯集，地圖的色塊便會隨之變化。我們將親眼見證，這片灰暗的土地，如何在眾人的努力下，一點一滴地，迎來再次潔淨的可能。
              </p>
              <p className="text-gray-700 leading-relaxed">
                這個過程或許緩慢，甚至充滿反覆，但群眾的力量，讓我們看見彼此，也讓我們還願意等待明天的曙光。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">一個為關心者而開的窗口</h2>
              <p className="text-gray-700 leading-relaxed">
                我們深知，清淤只是重建的一部分。在這片土地上，有無數人捲起袖子，有人提供物資、有人煮飯、有人給予關懷。各種無私的力量在此匯聚。
              </p>
              <p className="text-gray-700 leading-relaxed">
                這個平台，也是為全台灣所有心繫此地、卻無法親臨現場的朋友們，打開的一扇窗口。
              </p>
              <p className="text-gray-700 leading-relaxed">
                你不必親身在場，也能透過這張動態的地圖，感受每一次微小的進展，看見力量如何匯集，默默地守望這片土地與家園的守護者們。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">一份獻給未來的歷史檔案</h2>
              <p className="text-gray-700 leading-relaxed">
                希望這段眾志成城的記憶，值得被永久珍藏。這是一個開源專案，歡迎所有人的參與及貢獻。專案所產生的圖磚資料，目標採用通用標準格式儲存。未來若有學術研究或各界應用的需求，非常樂意以「開放資料
                (Open
                Data)」的形式釋出。由於我個人能力及知識有限，這部分的規劃尚未完善，期待在社群的幫助下逐步實現。
              </p>
            </section>

            <div className="text-center italic text-lg text-gray-600 border-l-4 border-green-500 pl-4 my-8">
              「清淤地圖 - 光復計畫」，記錄的不是淤泥，而是人心。
            </div>

            <p className="text-gray-700 leading-relaxed text-center">
              它見證了在塵土飛揚之中，人們如何一次又一次，用雙手與善意，重新描繪家園的輪廓。
            </p>
          </div>

          {/* Footer */}
          <footer className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
              <div>Copyright © sorosora</div>
              <div className="flex items-center gap-1">
                <ExternalLink className="w-4 h-4" />
                <a
                  href="https://github.com/sorosora/guangfu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors underline"
                >
                  GitHub 專案
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
