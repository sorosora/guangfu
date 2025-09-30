/**
 * 環境檢測工具
 */

/**
 * 檢查是否應該啟用測試區域功能
 * 條件：有測試區域環境變數 AND (開發環境 OR Vercel Preview 環境)
 */
export function shouldEnableTestArea(): boolean {
  try {
    // 使用更完整的測試區域配置檢查
    const hasCompleteTestArea = hasTestAreaConfiguration();

    // 檢查環境類型
    const envType = getEnvironmentType();
    const isDevelopmentOrPreview = envType === 'development' || envType === 'preview';

    return hasCompleteTestArea && isDevelopmentOrPreview;
  } catch {
    // 如果在檢查期間發生錯誤，返回 false
    return false;
  }
}

/**
 * 檢查是否應該顯示區域切換功能
 */
export function shouldShowAreaSwitcher(): boolean {
  // 確保在客戶端執行
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const shouldShow = shouldEnableTestArea();

    // 在開發環境下輸出除錯資訊
    if (process.env.NODE_ENV === 'development' && typeof console !== 'undefined') {
      console.log('區域切換顯示檢查:', {
        shouldShow,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
      });
    }

    return shouldShow;
  } catch {
    // 如果在 SSR 期間發生錯誤，返回 false
    return false;
  }
}

/**
 * 檢查當前環境類型
 */
export function getEnvironmentType(): 'development' | 'preview' | 'production' | 'unknown' {
  if (process.env.NODE_ENV === 'development') {
    return 'development';
  }

  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') {
    return 'preview';
  }

  if (
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  ) {
    return 'production';
  }

  return 'unknown';
}

/**
 * 檢查是否應該顯示除錯面板
 */
export function shouldShowDebugPanel(): boolean {
  // 確保在客戶端執行
  if (typeof window === 'undefined') {
    return false;
  }

  const envType = getEnvironmentType();
  return envType === 'development' || envType === 'preview';
}

/**
 * 檢查是否有完整的測試區域配置
 */
export function hasTestAreaConfiguration(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_TEST_AREA_NORTHWEST_LAT &&
    process.env.NEXT_PUBLIC_TEST_AREA_NORTHWEST_LON &&
    process.env.NEXT_PUBLIC_TEST_AREA_NORTHEAST_LAT &&
    process.env.NEXT_PUBLIC_TEST_AREA_NORTHEAST_LON &&
    process.env.NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LAT &&
    process.env.NEXT_PUBLIC_TEST_AREA_SOUTHWEST_LON &&
    process.env.NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LAT &&
    process.env.NEXT_PUBLIC_TEST_AREA_SOUTHEAST_LON &&
    process.env.NEXT_PUBLIC_TEST_AREA_CENTER_LAT &&
    process.env.NEXT_PUBLIC_TEST_AREA_CENTER_LON
  );
}
