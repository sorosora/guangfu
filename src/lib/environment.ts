/**
 * 環境檢測工具
 */

/**
 * 檢查是否應該顯示動態測試區域功能
 * 條件：開發環境 OR Vercel Preview 環境
 */
export function shouldShowTestAreaFeature(): boolean {
  try {
    const envType = getEnvironmentType();
    return envType === 'development' || envType === 'preview';
  } catch {
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
