import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

/**
 * 清理損壞的測試區域資料
 */
export async function POST() {
  try {
    const REDIS_KEYS = {
      TEST_AREAS_LIST: 'test_areas:list',
      TEST_AREA: (id: string) => `test_areas:${id}`,
    };

    // 獲取所有測試區域 ID
    const areaIds = await redis.smembers(REDIS_KEYS.TEST_AREAS_LIST);

    let cleanedCount = 0;
    const totalCount = areaIds.length;

    console.log(`開始清理，共 ${totalCount} 個測試區域`);

    for (const areaId of areaIds) {
      try {
        const encodedData = await redis.get(REDIS_KEYS.TEST_AREA(areaId));

        if (!encodedData) {
          console.log(`清理空資料: ${areaId}`);
          await redis.srem(REDIS_KEYS.TEST_AREAS_LIST, areaId);
          cleanedCount++;
          continue;
        }

        // 嘗試解碼和解析 JSON
        try {
          const decodedJson = Buffer.from(encodedData as string, 'base64').toString('utf8');
          const areaData = JSON.parse(decodedJson);

          // 檢查關鍵欄位
          if (!areaData.bounds || !areaData.center || !areaData.id) {
            throw new Error('缺少必要欄位');
          }

          // 驗證結構
          if (
            !areaData.bounds.northWest ||
            !areaData.bounds.northEast ||
            !areaData.bounds.southWest ||
            !areaData.bounds.southEast
          ) {
            throw new Error('bounds 結構無效');
          }

          if (typeof areaData.center.lat !== 'number' || typeof areaData.center.lon !== 'number') {
            throw new Error('center 結構無效');
          }

          console.log(`資料正常: ${areaId}`);
        } catch (parseError) {
          console.log(`清理無效資料: ${areaId}`, parseError);
          await redis.srem(REDIS_KEYS.TEST_AREAS_LIST, areaId);
          await redis.del(REDIS_KEYS.TEST_AREA(areaId));
          cleanedCount++;
        }
      } catch (error) {
        console.error(`處理測試區域 ${areaId} 時發生錯誤:`, error);
        await redis.srem(REDIS_KEYS.TEST_AREAS_LIST, areaId);
        await redis.del(REDIS_KEYS.TEST_AREA(areaId));
        cleanedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `清理完成，移除了 ${cleanedCount} 個損壞的測試區域`,
      data: {
        totalCount,
        cleanedCount,
        remainingCount: totalCount - cleanedCount,
      },
    });
  } catch (error) {
    console.error('清理測試區域失敗:', error);

    return NextResponse.json(
      {
        success: false,
        message: '清理失敗',
        error: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 }
    );
  }
}
