import { z } from 'zod';

// 區域配置 Schema（用於前端傳遞完整的區域資訊）
const AreaConfigSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  bounds: z.object({
    northWest: z.object({ lat: z.number(), lon: z.number() }),
    northEast: z.object({ lat: z.number(), lon: z.number() }),
    southWest: z.object({ lat: z.number(), lon: z.number() }),
    southEast: z.object({ lat: z.number(), lon: z.number() }),
  }),
  center: z.object({ lat: z.number(), lon: z.number() }),
  description: z.string(),
  physicalSize: z.object({
    width: z.number(),
    height: z.number(),
  }),
  gridSize: z.object({
    width: z.number(),
    height: z.number(),
  }),
  gridPrecision: z.number(),
});

// 回報請求資料驗證 Schema
export const ReportRequestSchema = z.object({
  lat: z.number().min(-90, '緯度必須在 -90 到 90 之間').max(90, '緯度必須在 -90 到 90 之間'),
  lon: z.number().min(-180, '經度必須在 -180 到 180 之間').max(180, '經度必須在 -180 到 180 之間'),
  state: z.union([z.literal(0), z.literal(1)]).refine((val) => val === 0 || val === 1, {
    message: '狀態必須為 0（已清除）或 1（有淤泥）',
  }),
  areaConfig: AreaConfigSchema.optional(),
});

// 推導型別
export type ReportRequest = z.infer<typeof ReportRequestSchema>;

// API 回應資料結構
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;

// 成功回應
export function createSuccessResponse(message: string, data?: unknown): ApiResponse {
  return {
    success: true,
    message,
    data,
  };
}

// 錯誤回應
export function createErrorResponse(message: string, error?: string): ApiResponse {
  return {
    success: false,
    message,
    error,
  };
}

// 驗證並解析回報請求
export function validateReportRequest(body: unknown): ReportRequest {
  try {
    return ReportRequestSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      throw new Error(`輸入資料無效: ${firstError.message}`);
    }
    throw new Error('請求資料格式錯誤');
  }
}

// 座標範圍驗證 Schema（用於邊界檢查）
export const CoordinateRangeSchema = z.object({
  minLat: z.number(),
  maxLat: z.number(),
  minLon: z.number(),
  maxLon: z.number(),
});

export type CoordinateRange = z.infer<typeof CoordinateRangeSchema>;

// 網格座標驗證 Schema
export const GridCoordinateSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

export type GridCoordinate = z.infer<typeof GridCoordinateSchema>;

// HTTP 狀態碼常數
export const HttpStatus = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// 常用錯誤訊息
export const ErrorMessages = {
  INVALID_REQUEST_BODY: '請求內容格式錯誤',
  MISSING_REQUIRED_FIELDS: '缺少必要欄位',
  COORDINATES_OUT_OF_BOUNDS: '座標超出允許的範圍',
  INVALID_STATE_VALUE: '狀態值無效',
  LOCATION_SERVICE_ERROR: '位置服務錯誤',
  DATABASE_ERROR: '資料庫操作失敗',
  REDIS_ERROR: 'Redis 操作失敗',
  INTERNAL_ERROR: '內部伺服器錯誤',
  METHOD_NOT_ALLOWED: '不允許的請求方法',
} as const;
