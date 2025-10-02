import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse, HttpStatus } from '@/lib/validation';
import { getTestArea, deleteTestArea, testAreaExists } from '@/lib/test-areas-redis';

/**
 * GET /api/test-areas/[id] - 獲取特定測試區域
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(createErrorResponse('無效的測試區域 ID'), {
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const area = await getTestArea(id);

    if (!area) {
      return NextResponse.json(createErrorResponse('測試區域不存在'), {
        status: HttpStatus.NOT_FOUND,
      });
    }

    return NextResponse.json(createSuccessResponse('獲取測試區域成功', { area }), {
      status: HttpStatus.OK,
    });
  } catch (error) {
    console.error('獲取測試區域失敗:', error);
    return NextResponse.json(createErrorResponse('獲取測試區域失敗'), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}

/**
 * DELETE /api/test-areas/[id] - 刪除測試區域
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(createErrorResponse('無效的測試區域 ID'), {
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // 檢查測試區域是否存在
    const exists = await testAreaExists(id);
    if (!exists) {
      return NextResponse.json(createErrorResponse('測試區域不存在'), {
        status: HttpStatus.NOT_FOUND,
      });
    }

    // 刪除測試區域
    const success = await deleteTestArea(id);

    if (!success) {
      return NextResponse.json(createErrorResponse('刪除測試區域失敗'), {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }

    return NextResponse.json(createSuccessResponse('測試區域刪除成功'), { status: HttpStatus.OK });
  } catch (error) {
    console.error('刪除測試區域失敗:', error);
    return NextResponse.json(createErrorResponse('刪除測試區域失敗'), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}

/**
 * 處理不支援的 HTTP 方法
 */
export async function POST() {
  return NextResponse.json(createErrorResponse('不支援的請求方法'), {
    status: HttpStatus.METHOD_NOT_ALLOWED,
  });
}

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
