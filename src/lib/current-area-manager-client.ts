import { AreaConfig, getDefaultAreaConfig } from '@/config/areas';

/**
 * 客戶端區域管理模組
 * 透過 API 呼叫來獲取區域配置，避免在客戶端直接存取 Redis
 */

/**
 * 當前區域類型
 */
export type CurrentAreaType = 'guangfu' | string; // guangfu 或測試區域 ID

/**
 * 本地儲存鍵值
 */
const STORAGE_KEY = 'guangfu_current_area';

/**
 * 獲取當前選擇的區域
 */
export function getCurrentAreaType(): CurrentAreaType {
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
 * 設定當前選擇的區域
 */
export function setCurrentAreaType(areaType: CurrentAreaType): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, areaType);
  } catch {
    // localStorage 不可用時忽略錯誤
  }
}

/**
 * 獲取當前區域的配置（客戶端版本）
 * 透過 API 呼叫獲取配置，避免直接存取 Redis
 */
export async function getCurrentAreaConfig(): Promise<AreaConfig> {
  try {
    const response = await fetch('/api/current-area');

    if (!response.ok) {
      throw new Error(`API 呼叫失敗: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    } else {
      console.warn('API 返回失敗，使用預設配置:', data.message);
      return getDefaultAreaConfig();
    }
  } catch (error) {
    console.error('獲取區域配置失敗，使用預設配置:', error);
    return getDefaultAreaConfig();
  }
}

/**
 * 切換到光復鄉區域
 */
export async function switchToGuangfu(): Promise<void> {
  setCurrentAreaType('guangfu');

  try {
    await fetch('/api/current-area', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        areaType: 'guangfu',
      }),
    });
  } catch (error) {
    console.error('切換到光復鄉失敗:', error);
  }
}

/**
 * 切換到測試區域
 */
export async function switchToTestArea(testAreaId: string): Promise<void> {
  setCurrentAreaType(testAreaId);

  try {
    await fetch('/api/current-area', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        areaType: testAreaId,
      }),
    });
  } catch (error) {
    console.error('切換到測試區域失敗:', error);
  }
}

/**
 * 檢查當前是否在測試區域
 */
export function isInTestArea(): boolean {
  return getCurrentAreaType() !== 'guangfu';
}

/**
 * 獲取當前區域的顯示名稱
 */
export async function getCurrentAreaDisplayName(): Promise<string> {
  const areaConfig = await getCurrentAreaConfig();
  return areaConfig.displayName;
}

/**
 * React Hook 風格的區域管理（客戶端版本）
 */
export function useCurrentArea() {
  /**
   * 獲取當前區域配置
   */
  const getCurrentConfig = async (): Promise<AreaConfig> => {
    return await getCurrentAreaConfig();
  };

  /**
   * 切換區域
   */
  const switchArea = async (areaType: CurrentAreaType): Promise<void> => {
    if (areaType === 'guangfu') {
      await switchToGuangfu();
    } else {
      await switchToTestArea(areaType);
    }
  };

  /**
   * 獲取當前區域類型
   */
  const getAreaType = (): CurrentAreaType => {
    return getCurrentAreaType();
  };

  return {
    getCurrentConfig,
    switchArea,
    getAreaType,
    isInTestArea: isInTestArea(),
  };
}
