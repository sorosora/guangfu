import { NextRequest, NextResponse } from 'next/server';
import {
  createSuccessResponse,
  createErrorResponse,
  HttpStatus,
  ErrorMessages,
} from '@/lib/validation';
import { getDefaultAreaConfig } from '@/config/areas';

/**
 * GET /api/current-area - 獲取當前區域配置
 *
 * 階段五：簡化為固定光復鄉配置
 */
export async function GET() {
  try {
    const areaConfig = getDefaultAreaConfig();

    return NextResponse.json(
      createSuccessResponse('成功獲取區域配置', {
        areaType: 'guangfu',
        config: areaConfig,
      }),
      { status: HttpStatus.OK }
    );
  } catch (error) {
    console.error('獲取區域配置錯誤:', error);
    return NextResponse.json(createErrorResponse(ErrorMessages.INTERNAL_ERROR), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}

/**
 * POST /api/current-area - 設定當前區域
 *
 * 階段五：只接受光復鄉配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { areaType } = body;

    // 階段五簡化：只接受光復鄉
    if (areaType === 'guangfu') {
      return NextResponse.json(
        createSuccessResponse('已設定為光復鄉區域', { areaType: 'guangfu' }),
        { status: HttpStatus.OK }
      );
    }

    return NextResponse.json(
      createErrorResponse(`階段五已移除測試區域功能，僅支援光復鄉 (guangfu)`),
      { status: HttpStatus.BAD_REQUEST }
    );
  } catch (error) {
    console.error('設定區域配置錯誤:', error);
    return NextResponse.json(createErrorResponse(ErrorMessages.INTERNAL_ERROR), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}

/**
 * 處理不支援的 HTTP 方法
 */
export async function PUT() {
  return NextResponse.json(createErrorResponse(ErrorMessages.METHOD_NOT_ALLOWED), {
    status: HttpStatus.METHOD_NOT_ALLOWED,
  });
}

export async function DELETE() {
  return NextResponse.json(createErrorResponse(ErrorMessages.METHOD_NOT_ALLOWED), {
    status: HttpStatus.METHOD_NOT_ALLOWED,
  });
}
