import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSuccessResponse, createErrorResponse, HttpStatus } from '@/lib/validation';
import {
  createTestArea,
  getAllTestAreas,
  getTestAreasList,
  TestAreaConfig,
} from '@/lib/test-areas-redis';

/**
 * 建立測試區域請求驗證 Schema
 */
const CreateTestAreaSchema = z.object({
  center: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  customName: z.string().optional(),
  createdBy: z.enum(['gps', 'manual']).default('manual'),
});

/**
 * GET /api/test-areas - 獲取所有測試區域
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listOnly = searchParams.get('list') === 'true';

    let areas;
    if (listOnly) {
      // 只返回 ID 和顯示名稱（用於下拉選單）
      areas = await getTestAreasList();
    } else {
      // 返回完整的測試區域配置
      areas = await getAllTestAreas();
    }

    return NextResponse.json(
      createSuccessResponse('獲取測試區域成功', { areas, count: areas.length }),
      { status: HttpStatus.OK }
    );
  } catch (error) {
    console.error('獲取測試區域失敗:', error);
    return NextResponse.json(createErrorResponse('獲取測試區域失敗'), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}

/**
 * POST /api/test-areas - 建立新的測試區域
 */
export async function POST(request: NextRequest) {
  try {
    // 解析和驗證請求資料
    const body = await request.json();
    const { center, customName, createdBy } = CreateTestAreaSchema.parse(body);

    // 驗證座標範圍
    if (center.lat < -90 || center.lat > 90) {
      return NextResponse.json(createErrorResponse('緯度必須在 -90 到 90 之間'), {
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (center.lon < -180 || center.lon > 180) {
      return NextResponse.json(createErrorResponse('經度必須在 -180 到 180 之間'), {
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // 建立測試區域
    const testArea: TestAreaConfig = await createTestArea(center, customName, createdBy);

    return NextResponse.json(createSuccessResponse('測試區域建立成功', { area: testArea }), {
      status: HttpStatus.OK,
    });
  } catch (error) {
    console.error('建立測試區域失敗:', error);

    // 處理驗證錯誤
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json(createErrorResponse(`輸入資料無效: ${firstError.message}`), {
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // 處理自訂錯誤訊息
    if (error instanceof Error) {
      return NextResponse.json(createErrorResponse(error.message), {
        status: HttpStatus.BAD_REQUEST,
      });
    }

    return NextResponse.json(createErrorResponse('建立測試區域失敗'), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}

/**
 * 處理不支援的 HTTP 方法
 */
export async function PUT() {
  return NextResponse.json(createErrorResponse('不支援的請求方法'), {
    status: HttpStatus.METHOD_NOT_ALLOWED,
  });
}

export async function PATCH() {
  return NextResponse.json(createErrorResponse('不支援的請求方法'), {
    status: HttpStatus.METHOD_NOT_ALLOWED,
  });
}
