import { redis } from '@/lib/redis';
import { AreaConfig } from '@/config/areas';
import { Location } from '@/types/map';

/**
 * 測試區域配置介面
 */
export interface TestAreaConfig
  extends Omit<AreaConfig, 'description' | 'physicalSize' | 'gridSize' | 'gridPrecision'> {
  id: string; // 唯一識別碼
  createdAt: number; // 建立時間戳
  createdBy: string; // 建立方式 ('gps' | 'manual')
  customName?: string; // 自訂名稱
}

/**
 * Redis 鍵值常數
 */
const REDIS_KEYS = {
  TEST_AREAS_LIST: 'test_areas:list',
  TEST_AREA: (id: string) => `test_areas:${id}`,
} as const;

/**
 * 預設的區域尺寸配置（與光復鄉相同）
 */
const DEFAULT_CONFIG = {
  physicalSize: { width: 4000, height: 3000 }, // 4km x 3km
  gridSize: { width: 800, height: 600 },
  gridPrecision: 5,
  description: '測試區域',
} as const;

/**
 * 生成唯一的測試區域 ID
 */
function generateTestAreaId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `test_${timestamp}_${random}`;
}

/**
 * 從中心點計算邊界座標
 */
function calculateBoundsFromCenter(
  center: Location,
  widthMeters: number = DEFAULT_CONFIG.physicalSize.width,
  heightMeters: number = DEFAULT_CONFIG.physicalSize.height
) {
  // 緯度 1 度約 111 公里
  const latDegreeInMeters = 111000;
  // 經度 1 度在緯度 center.lat 處的距離
  const lonDegreeInMeters = latDegreeInMeters * Math.cos((center.lat * Math.PI) / 180);

  const halfWidthDegrees = widthMeters / 2 / lonDegreeInMeters;
  const halfHeightDegrees = heightMeters / 2 / latDegreeInMeters;

  return {
    northWest: {
      lat: center.lat + halfHeightDegrees,
      lon: center.lon - halfWidthDegrees,
    },
    northEast: {
      lat: center.lat + halfHeightDegrees,
      lon: center.lon + halfWidthDegrees,
    },
    southWest: {
      lat: center.lat - halfHeightDegrees,
      lon: center.lon - halfWidthDegrees,
    },
    southEast: {
      lat: center.lat - halfHeightDegrees,
      lon: center.lon + halfWidthDegrees,
    },
  };
}

/**
 * 驗證區域名稱（只允許英文數字和底線）
 */
function validateAreaName(name: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

/**
 * 建立新的測試區域
 */
export async function createTestArea(
  center: Location,
  customName?: string,
  createdBy: 'gps' | 'manual' = 'manual'
): Promise<TestAreaConfig> {
  const areaId = generateTestAreaId();
  const bounds = calculateBoundsFromCenter(center);

  // 生成顯示名稱
  let displayName: string;
  if (customName) {
    // 驗證自訂名稱
    if (!validateAreaName(customName)) {
      throw new Error('區域名稱只能包含英文字母、數字和底線');
    }
    displayName = customName;
  } else {
    displayName = `測試區域 (${center.lat.toFixed(5)}, ${center.lon.toFixed(5)})`;
  }

  const testArea: TestAreaConfig = {
    id: areaId,
    name: areaId, // 使用唯一 ID 作為名稱
    displayName,
    bounds,
    center,
    createdAt: Date.now(),
    createdBy,
    customName,
  };

  // 強制轉換為純物件以確保 JSON.stringify 正常工作
  const pureBounds = {
    northWest: { lat: testArea.bounds.northWest.lat, lon: testArea.bounds.northWest.lon },
    northEast: { lat: testArea.bounds.northEast.lat, lon: testArea.bounds.northEast.lon },
    southWest: { lat: testArea.bounds.southWest.lat, lon: testArea.bounds.southWest.lon },
    southEast: { lat: testArea.bounds.southEast.lat, lon: testArea.bounds.southEast.lon },
  };

  const pureCenter = { lat: testArea.center.lat, lon: testArea.center.lon };

  // 序列化整個 testArea 為單一 JSON 字串
  const serializedTestArea = JSON.stringify({
    id: testArea.id,
    name: testArea.name,
    displayName: testArea.displayName,
    bounds: pureBounds,
    center: pureCenter,
    createdAt: testArea.createdAt,
    createdBy: testArea.createdBy,
    customName: testArea.customName,
  });

  // 使用 Base64 編碼來避免 Upstash Redis 自動解析 JSON
  const encodedData = Buffer.from(serializedTestArea, 'utf8').toString('base64');

  console.log('序列化的完整測試區域:', serializedTestArea);
  console.log('Base64 編碼後:', encodedData);

  // 儲存 Base64 編碼的資料
  await redis.set(REDIS_KEYS.TEST_AREA(areaId), encodedData);

  // 更新測試區域清單
  await redis.sadd(REDIS_KEYS.TEST_AREAS_LIST, areaId);

  return testArea;
}

/**
 * 獲取所有測試區域
 */
export async function getAllTestAreas(): Promise<TestAreaConfig[]> {
  const areaIds = await redis.smembers(REDIS_KEYS.TEST_AREAS_LIST);

  if (areaIds.length === 0) {
    return [];
  }

  const areas: TestAreaConfig[] = [];

  for (const areaId of areaIds) {
    try {
      const encodedData = await redis.get(REDIS_KEYS.TEST_AREA(areaId));

      if (encodedData) {
        try {
          // 解碼 Base64 並解析 JSON
          const decodedJson = Buffer.from(encodedData as string, 'base64').toString('utf8');
          const areaData = JSON.parse(decodedJson);

          // 檢查關鍵欄位是否存在
          if (!areaData.bounds || !areaData.center || !areaData.id) {
            throw new Error('缺少必要欄位');
          }

          // 驗證資料結構
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

          // 建立 TestAreaConfig 物件
          const area: TestAreaConfig = {
            id: areaData.id,
            name: areaData.name,
            displayName: areaData.displayName,
            bounds: areaData.bounds,
            center: areaData.center,
            createdAt: areaData.createdAt,
            createdBy: areaData.createdBy,
            customName: areaData.customName || undefined,
          };
          areas.push(area);
        } catch (parseError) {
          console.error(`解析測試區域 ${areaId} 失敗:`, parseError);
          console.error('損壞的編碼資料:', encodedData);
          // 移除損壞的區域
          await redis.srem(REDIS_KEYS.TEST_AREAS_LIST, areaId);
          await redis.del(REDIS_KEYS.TEST_AREA(areaId));
        }
      }
    } catch (error) {
      console.error(`獲取測試區域 ${areaId} 失敗:`, error);
      // 移除損壞的區域
      await redis.srem(REDIS_KEYS.TEST_AREAS_LIST, areaId);
      await redis.del(REDIS_KEYS.TEST_AREA(areaId));
    }
  }

  // 按建立時間排序（最新的在前）
  return areas.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 獲取特定測試區域
 */
export async function getTestArea(areaId: string): Promise<TestAreaConfig | null> {
  try {
    const encodedData = await redis.get(REDIS_KEYS.TEST_AREA(areaId));

    if (!encodedData) {
      return null;
    }

    // 解碼 Base64 並解析 JSON
    const decodedJson = Buffer.from(encodedData as string, 'base64').toString('utf8');
    const areaData = JSON.parse(decodedJson);

    // 檢查關鍵欄位是否存在
    if (!areaData.bounds || !areaData.center || !areaData.id) {
      console.error(`測試區域 ${areaId} 缺少必要欄位`);
      return null;
    }

    // 驗證資料結構
    if (
      !areaData.bounds.northWest ||
      !areaData.bounds.northEast ||
      !areaData.bounds.southWest ||
      !areaData.bounds.southEast
    ) {
      console.error(`測試區域 ${areaId} bounds 結構無效`);
      return null;
    }

    if (typeof areaData.center.lat !== 'number' || typeof areaData.center.lon !== 'number') {
      console.error(`測試區域 ${areaId} center 結構無效`);
      return null;
    }

    return {
      id: areaData.id,
      name: areaData.name,
      displayName: areaData.displayName,
      bounds: areaData.bounds,
      center: areaData.center,
      createdAt: areaData.createdAt,
      createdBy: areaData.createdBy,
      customName: areaData.customName || undefined,
    };
  } catch (error) {
    console.error(`獲取測試區域 ${areaId} 失敗:`, error);
    return null;
  }
}

/**
 * 刪除測試區域
 */
export async function deleteTestArea(areaId: string): Promise<boolean> {
  try {
    // 從清單中移除
    await redis.srem(REDIS_KEYS.TEST_AREAS_LIST, areaId);

    // 刪除區域資料
    await redis.del(REDIS_KEYS.TEST_AREA(areaId));

    // 清理相關的網格資料（選擇性）
    // 可以考慮保留歷史資料或者清理
    // await redis.del(`grid:${areaId}:*`); // 需要掃描並刪除

    return true;
  } catch (error) {
    console.error(`刪除測試區域 ${areaId} 失敗:`, error);
    return false;
  }
}

/**
 * 檢查測試區域是否存在
 */
export async function testAreaExists(areaId: string): Promise<boolean> {
  const result = await redis.sismember(REDIS_KEYS.TEST_AREAS_LIST, areaId);
  return result === 1;
}

/**
 * 將測試區域配置轉換為 AreaConfig 格式
 */
export function testAreaToAreaConfig(testArea: TestAreaConfig): AreaConfig {
  return {
    name: testArea.name,
    displayName: testArea.displayName,
    bounds: testArea.bounds,
    center: testArea.center,
    description: testArea.customName || DEFAULT_CONFIG.description,
    physicalSize: DEFAULT_CONFIG.physicalSize,
    gridSize: DEFAULT_CONFIG.gridSize,
    gridPrecision: DEFAULT_CONFIG.gridPrecision,
  };
}

/**
 * 獲取測試區域清單（僅 ID 和顯示名稱）
 */
export async function getTestAreasList(): Promise<
  Array<{ id: string; displayName: string; createdAt: number }>
> {
  const areas = await getAllTestAreas();
  return areas.map((area) => ({
    id: area.id,
    displayName: area.displayName,
    createdAt: area.createdAt,
  }));
}
