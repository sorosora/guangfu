import { NextRequest, NextResponse } from 'next/server';
import { getDefaultAreaConfig } from '@/config/areas';
import { getTestArea, testAreaToAreaConfig } from '@/lib/test-areas-redis';
import { createSuccessResponse, createErrorResponse, HttpStatus } from '@/lib/validation';

/**
 * 獲取指定區域配置
 * 支援查詢參數: ?areaId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const areaId = request.nextUrl.searchParams.get('areaId');

    // 如果沒有指定 areaId 或者是光復鄉，返回預設配置
    if (!areaId || areaId === 'guangfu') {
      return NextResponse.json({
        success: true,
        data: getDefaultAreaConfig(),
        areaType: 'guangfu',
      });
    }

    // 嘗試獲取測試區域配置
    const testArea = await getTestArea(areaId);

    if (testArea) {
      const areaConfig = testAreaToAreaConfig(testArea);
      return NextResponse.json({
        success: true,
        data: areaConfig,
        areaType: areaId,
      });
    } else {
      // 測試區域不存在，回退到預設配置
      return NextResponse.json({
        success: true,
        data: getDefaultAreaConfig(),
        areaType: 'guangfu',
        warning: `測試區域 ${areaId} 不存在，已回退到光復鄉`,
      });
    }
  } catch (error) {
    console.error('獲取區域配置失敗:', error);

    // 發生錯誤時回退到預設配置
    return NextResponse.json({
      success: true,
      data: getDefaultAreaConfig(),
      areaType: 'guangfu',
      warning: '獲取區域配置失敗，使用預設配置',
    });
  }
}

/**
 * POST /api/current-area - 設定當前區域（用於客戶端區域切換）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { areaType } = body;

    if (!areaType || typeof areaType !== 'string') {
      return NextResponse.json(createErrorResponse('無效的區域類型'), {
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // 驗證區域類型
    if (areaType === 'guangfu') {
      return NextResponse.json(createSuccessResponse('已切換到光復鄉', { areaType: 'guangfu' }), {
        status: HttpStatus.OK,
      });
    }

    // 驗證測試區域是否存在
    const testArea = await getTestArea(areaType);
    if (!testArea) {
      return NextResponse.json(createErrorResponse(`測試區域 ${areaType} 不存在`), {
        status: HttpStatus.NOT_FOUND,
      });
    }

    return NextResponse.json(
      createSuccessResponse(`已切換到測試區域: ${testArea.displayName}`, {
        areaType,
        areaConfig: testAreaToAreaConfig(testArea),
      }),
      { status: HttpStatus.OK }
    );
  } catch (error) {
    console.error('設定當前區域失敗:', error);
    return NextResponse.json(createErrorResponse('設定區域失敗'), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
