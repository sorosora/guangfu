import { ReportData } from '@/types/map';
import { ApiResponse } from './validation';

/**
 * API 客戶端服務 - 處理前端與後端 API 的通訊
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * 發送回報請求到後端 API
   * @param reportData 回報資料
   * @param areaName 區域名稱（可選，預設使用光復鄉）
   * @returns API 回應
   */
  async submitReport(reportData: ReportData, areaName?: string): Promise<ApiResponse> {
    try {
      // 建立 URL 查詢參數
      const url = new URL(`${this.baseUrl}/api/report`, window.location.origin);
      if (areaName) {
        url.searchParams.set('area', areaName);
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      const data: ApiResponse = await response.json();

      // 即使 HTTP 狀態碼不是 200，也要檢查回應內容
      if (!response.ok && !data.success) {
        throw new ApiError(data.message || '請求失敗', response.status, data.error);
      }

      return data;
    } catch (error) {
      // 處理網路錯誤或其他非 API 錯誤
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError('網路連線失敗，請檢查網路狀態', 0);
      }

      throw new ApiError(error instanceof Error ? error.message : '未知錯誤', 0);
    }
  }

  /**
   * 檢查 API 服務狀態
   * @returns 服務是否可用
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        cache: 'no-cache',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * API 錯誤類別
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }

  /**
   * 判斷是否為網路錯誤
   */
  isNetworkError(): boolean {
    return this.statusCode === 0;
  }

  /**
   * 判斷是否為客戶端錯誤 (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * 判斷是否為伺服器錯誤 (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }

  /**
   * 獲取使用者友善的錯誤訊息
   */
  getUserFriendlyMessage(): string {
    if (this.isNetworkError()) {
      return '網路連線失敗，請檢查網路狀態後重試';
    }

    if (this.statusCode === 422) {
      return '位置資訊無效，請確認您在允許的回報範圍內';
    }

    if (this.statusCode === 429) {
      return '回報過於頻繁，請稍後再試';
    }

    if (this.isServerError()) {
      return '伺服器暫時無法處理請求，請稍後再試';
    }

    return this.message || '回報失敗，請重試';
  }
}

/**
 * 預設 API 客戶端實例
 */
export const apiClient = new ApiClient();

/**
 * Hook 風格的 API 服務（適用於 React 元件）
 */
export function useApiClient() {
  /**
   * 提交回報
   */
  const submitReport = async (reportData: ReportData, areaName?: string): Promise<ApiResponse> => {
    return await apiClient.submitReport(reportData, areaName);
  };

  /**
   * 檢查服務狀態
   */
  const checkHealth = async (): Promise<boolean> => {
    return await apiClient.checkHealth();
  };

  return {
    submitReport,
    checkHealth,
  };
}

/**
 * 重試機制 wrapper
 * @param fn 要重試的函數
 * @param maxRetries 最大重試次數
 * @param delay 重試間隔（毫秒）
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 最後一次嘗試，直接拋出錯誤
      if (attempt === maxRetries) {
        break;
      }

      // 如果是客戶端錯誤（4xx），不需要重試
      if (error instanceof ApiError && error.isClientError()) {
        break;
      }

      // 等待後重試
      await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)));
    }
  }

  throw lastError!;
}

/**
 * 帶重試機制的回報提交
 */
export async function submitReportWithRetry(
  reportData: ReportData,
  maxRetries: number = 2,
  areaName?: string
): Promise<ApiResponse> {
  return await withRetry(() => apiClient.submitReport(reportData, areaName), maxRetries, 1000);
}
