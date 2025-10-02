import { atom } from 'jotai';
import { AreaConfig, getDefaultAreaConfig } from '@/config/areas';

/**
 * 當前區域類型
 */
export type CurrentAreaType = 'guangfu' | string; // guangfu 或測試區域 ID

/**
 * 本地儲存鍵值
 */
const STORAGE_KEY = 'guangfu_current_area';

/**
 * 獲取初始區域類型（從 localStorage）
 */
function getInitialAreaType(): CurrentAreaType {
  if (typeof window === 'undefined') {
    return 'guangfu';
  }

  try {
    return localStorage.getItem(STORAGE_KEY) || 'guangfu';
  } catch {
    return 'guangfu';
  }
}

/**
 * 當前區域類型 Atom
 */
export const currentAreaTypeAtom = atom<CurrentAreaType>(getInitialAreaType());

/**
 * 當前區域配置 Atom（衍生狀態）
 * 自動根據 currentAreaTypeAtom 獲取對應的區域配置
 */
export const currentAreaConfigAtom = atom(async (get): Promise<AreaConfig> => {
  const areaType = get(currentAreaTypeAtom);

  if (areaType === 'guangfu') {
    return getDefaultAreaConfig();
  }

  try {
    // 呼叫 API 獲取測試區域配置
    const response = await fetch(`/api/current-area?areaId=${encodeURIComponent(areaType)}`);

    if (!response.ok) {
      throw new Error(`API 呼叫失敗: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      return result.data;
    } else {
      console.warn('API 返回失敗，使用預設配置:', result.message);
      return getDefaultAreaConfig();
    }
  } catch (error) {
    console.error('獲取測試區域配置失敗，使用預設配置:', error);
    return getDefaultAreaConfig();
  }
});

/**
 * 切換區域動作 Atom
 */
export const switchAreaAtom = atom(null, (get, set, areaType: CurrentAreaType) => {
  // 更新 Jotai 狀態
  set(currentAreaTypeAtom, areaType);

  // 持久化到 localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, areaType);
    } catch (error) {
      console.warn('無法儲存區域類型到 localStorage:', error);
    }
  }
});

/**
 * 是否在測試區域 Atom（衍生狀態）
 */
export const isInTestAreaAtom = atom((get) => {
  const areaType = get(currentAreaTypeAtom);
  return areaType !== 'guangfu';
});

/**
 * 當前區域顯示名稱 Atom（衍生狀態）
 */
export const currentAreaDisplayNameAtom = atom(async (get): Promise<string> => {
  const areaConfig = await get(currentAreaConfigAtom);
  return areaConfig.displayName;
});

/**
 * 切換到光復鄉的便利函數 Atom
 */
export const switchToGuangfuAtom = atom(null, (get, set) => {
  set(switchAreaAtom, 'guangfu');
});

/**
 * 切換到測試區域的便利函數 Atom
 */
export const switchToTestAreaAtom = atom(null, (get, set, testAreaId: string) => {
  set(switchAreaAtom, testAreaId);
});

/**
 * 區域變更監聽器 Atom（用於觸發副作用）
 */
export const areaChangeListenerAtom = atom(null, () => {
  // 這個 atom 可以用來註冊區域變更時的回調函數
  // 主要用於頁面組件監聽區域變化並執行相應操作
  // Currently a placeholder for future implementation
});
