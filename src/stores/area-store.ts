import { atom } from 'jotai';
import { AreaConfig, getAreaConfig } from '@/config/areas';

/**
 * 區域狀態管理（雙區域版本：guangfu + preview）
 */

/**
 * 當前區域類型（支援光復鄉和測試區域）
 */
export type CurrentAreaType = 'guangfu' | 'preview';

/**
 * 本地儲存鍵值
 */
const STORAGE_KEY = 'guangfu_current_area';

/**
 * 獲取初始區域類型（從 localStorage 讀取，預設為光復鄉）
 */
function getInitialAreaType(): CurrentAreaType {
  if (typeof window === 'undefined') {
    return 'guangfu'; // SSR 時預設為光復鄉
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'guangfu' || stored === 'preview') {
      return stored as CurrentAreaType;
    }
  } catch (error) {
    console.warn('無法讀取儲存的區域類型:', error);
  }

  return 'guangfu'; // 預設為光復鄉
}

/**
 * 當前區域類型 Atom
 */
export const currentAreaTypeAtom = atom<CurrentAreaType>(getInitialAreaType());

/**
 * 當前區域配置 Atom（動態根據區域類型返回配置）
 */
export const currentAreaConfigAtom = atom<AreaConfig>((get) => {
  const areaType = get(currentAreaTypeAtom);
  return getAreaConfig(areaType);
});

/**
 * 切換區域動作 Atom（支援 guangfu 和 preview）
 */
export const switchAreaAtom = atom(null, (get, set, areaType: CurrentAreaType) => {
  // 驗證區域類型
  if (areaType !== 'guangfu' && areaType !== 'preview') {
    console.warn(`不支援的區域類型: ${areaType}`);
    return;
  }

  const currentAreaType = get(currentAreaTypeAtom);

  // 如果已經是目標區域，不需要切換
  if (currentAreaType === areaType) {
    console.log(`已經在 ${areaType} 區域，無需切換`);
    return;
  }

  // 更新 Jotai 狀態
  set(currentAreaTypeAtom, areaType);

  // 持久化到 localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, areaType);
      console.log(`已切換到 ${areaType} 區域並儲存設定`);
    } catch (error) {
      console.warn('無法儲存區域類型到 localStorage:', error);
    }
  }
});

/**
 * 當前區域顯示名稱 Atom
 */
export const currentAreaDisplayNameAtom = atom<string>((get) => {
  const areaConfig = get(currentAreaConfigAtom);
  return areaConfig.displayName;
});

/**
 * 切換到光復鄉的便利函數 Atom
 */
export const switchToGuangfuAtom = atom(null, (get, set) => {
  set(switchAreaAtom, 'guangfu');
});

/**
 * 切換到預覽區域的便利函數 Atom
 */
export const switchToPreviewAtom = atom(null, (get, set) => {
  set(switchAreaAtom, 'preview');
});

/**
 * 獲取支援的區域列表
 */
export const supportedAreasAtom = atom<Array<{ id: CurrentAreaType; name: string }>>(() => [
  { id: 'guangfu', name: '花蓮光復鄉' },
  { id: 'preview', name: 'Preview 測試區域' },
]);

/**
 * 驗證區域類型是否有效
 */
export function validateAreaType(areaType: string): areaType is CurrentAreaType {
  return areaType === 'guangfu' || areaType === 'preview';
}
