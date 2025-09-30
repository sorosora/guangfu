# Redis 效能優化與增量更新策略

**版本：** 1.0  
**日期：** 2025年9月30日  
**狀態：** 待驗證  
**相關文件：** [tech-spec.md](./tech-spec.md)

## 問題背景

目前系統在 Redis 使用上存在效能瓶頸：

1. **單次回報高命令數：** 一次回報需要 ~200 個 Redis 命令，消耗免費額度
2. **圖磚生成全量讀取：** GitHub Actions 每5分鐘讀取全部 480,000 個網格
3. **全量圖磚重新生成：** 即使只有少數網格變更，仍重新生成所有圖磚

## 優化策略概覽

### 階段一：Redis 資料結構優化

將每個網格的 4 個獨立 key 合併為 1 個 hash，減少命令數量。

### 階段二：增量更新機制

只讀取和處理有變更的網格，實現圖磚的增量生成。

---

## 階段一：Redis 資料結構優化

### 1.1 現有結構問題

**目前結構（每個網格 4 個 key）：**

```
score_0:x_y           -> float
score_1:x_y           -> float
last_update_0:x_y     -> timestamp
last_update_1:x_y     -> timestamp
```

**問題：**

- 3×3 範圍效應需要讀取 36 個 key（9個網格 × 4個key）
- 寫入需要最多 36 個 SET 命令
- 圖磚生成需要 480,000 個 GET 命令

### 1.2 優化後結構

**新結構（每個網格 1 個 hash）：**

```
grid:x_y -> {
  score0: float,
  score1: float,
  lastUpdate0: timestamp,
  lastUpdate1: timestamp,
  finalState: 0|1
}
```

### 1.3 命令數量對比

| 操作         | 優化前      | 優化後       | 改善幅度 |
| ------------ | ----------- | ------------ | -------- |
| 單次回報讀取 | 36 個 MGET  | 9 個 HMGET   | -75%     |
| 單次回報寫入 | 36 個 SET   | 9 個 HMSET   | -75%     |
| 圖磚生成讀取 | 480K 個 GET | 480K 個 HGET | 效能提升 |

### 1.4 實作變更

#### 更新 Redis 鍵值生成器

```typescript
// src/lib/redis.ts
export const RedisKeys = {
  // 優化後：單一 hash per 網格
  gridData: (gridId: string) => `grid:${gridId}`,

  // 新增：變更追蹤（階段二使用）
  changedGrids: () => 'changed_grids',
  lastTileGeneration: () => 'last_tile_gen',
  tileVersion: () => 'tile_version',
};
```

#### 批次讀取優化

```typescript
// 優化前
const values = await redis.mget(...keys); // 36 個 key

// 優化後
const pipeline = redis.pipeline();
for (const gridId of gridIds) {
  pipeline.hmget(
    RedisKeys.gridData(gridId),
    'score0',
    'score1',
    'lastUpdate0',
    'lastUpdate1',
    'finalState'
  );
}
const results = await pipeline.exec(); // 9 個 HMGET
```

#### 批次寫入優化

```typescript
// 優化前
pipeline.set(RedisKeys.score0(gridId), data.score0);
// ... 更多 SET 命令

// 優化後
pipeline.hmset(RedisKeys.gridData(gridId), {
  score0: data.score0,
  score1: data.score1,
  lastUpdate0: data.lastUpdate0,
  lastUpdate1: data.lastUpdate1,
  finalState: data.finalState,
});
```

---

## 階段二：增量更新機制

### 2.1 變更追蹤設計

#### 新增 Redis 結構

```typescript
interface ChangeTracking {
  changedGrids: Set<string>; // 有變更的網格 ID
  lastTileGeneration: number; // 上次圖磚生成時間戳
  tileVersion: string; // 當前圖磚版本號
}
```

#### 回報時標記變更

```typescript
// src/app/api/report/route.ts
async function markGridsAsChanged(affectedGridIds: string[]): Promise<void> {
  const pipeline = redis.pipeline();

  for (const gridId of affectedGridIds) {
    pipeline.sadd(RedisKeys.changedGrids(), gridId);
  }

  // 設定變更標記的 TTL，避免長期累積
  pipeline.expire(RedisKeys.changedGrids(), 3600); // 1小時過期

  await pipeline.exec();
}
```

### 2.2 圖磚增量生成

#### GitHub Actions 新邏輯

```python
# scripts/generate_tiles.py

def generate_incremental_tiles():
    """增量圖磚生成主函數"""

    # 1. 檢查是否有變更
    changed_grid_ids = redis.smembers('changed_grids')

    if not changed_grid_ids:
        print("沒有網格變更，跳過圖磚生成")
        return

    print(f"發現 {len(changed_grid_ids)} 個網格有變更")

    # 2. 讀取變更網格的狀態
    changed_states = read_changed_grid_states(changed_grid_ids)

    # 3. 計算受影響的圖磚
    affected_tiles = calculate_affected_tiles(changed_grid_ids)
    print(f"需要更新 {len(affected_tiles)} 個圖磚")

    # 4. 只重新生成受影響的圖磚
    new_version = str(int(time.time()))

    for tile_coord in affected_tiles:
        tile_data = generate_single_tile(tile_coord, changed_states)
        upload_tile_to_r2(tile_coord, tile_data, new_version)

    # 5. 清理變更標記
    redis.delete('changed_grids')

    # 6. 更新版本號
    update_version_json(new_version)

    print(f"增量更新完成，新版本：{new_version}")

def read_changed_grid_states(grid_ids):
    """批次讀取變更網格的狀態"""
    pipeline = redis.pipeline()

    for grid_id in grid_ids:
        pipeline.hget(f'grid:{grid_id}', 'finalState')

    results = pipeline.execute()

    changed_states = {}
    for i, grid_id in enumerate(grid_ids):
        changed_states[grid_id] = int(results[i] or 1)  # 預設為有淤泥

    return changed_states

def calculate_affected_tiles(changed_grid_ids):
    """計算受影響的圖磚座標"""
    affected_tiles = set()

    for grid_id in changed_grid_ids:
        x, y = map(int, grid_id.split('_'))

        # 計算網格所在的圖磚座標
        tile_x = x // TILE_SIZE
        tile_y = y // TILE_SIZE

        affected_tiles.add((tile_x, tile_y))

        # 處理圖磚邊界情況
        if x % TILE_SIZE == 0 and tile_x > 0:
            affected_tiles.add((tile_x - 1, tile_y))
        if y % TILE_SIZE == 0 and tile_y > 0:
            affected_tiles.add((tile_x, tile_y - 1))
        if (x % TILE_SIZE == 0 and tile_x > 0 and
            y % TILE_SIZE == 0 and tile_y > 0):
            affected_tiles.add((tile_x - 1, tile_y - 1))

    return affected_tiles

def generate_single_tile(tile_coord, grid_states):
    """生成單個圖磚"""
    tile_x, tile_y = tile_coord

    # 計算圖磚對應的網格範圍
    start_grid_x = tile_x * TILE_SIZE
    start_grid_y = tile_y * TILE_SIZE
    end_grid_x = min(start_grid_x + TILE_SIZE, GRID_WIDTH)
    end_grid_y = min(start_grid_y + TILE_SIZE, GRID_HEIGHT)

    # 建立圖磚陣列
    tile_array = np.full((TILE_SIZE, TILE_SIZE), STATE_UNKNOWN, dtype=np.uint8)

    # 填入網格狀態
    for grid_y in range(start_grid_y, end_grid_y):
        for grid_x in range(start_grid_x, end_grid_x):
            grid_id = f"{grid_x}_{grid_y}"

            if grid_id in grid_states:
                state = grid_states[grid_id]
            else:
                # 如果不在變更列表中，從 Redis 讀取當前狀態
                state = redis.hget(f'grid:{grid_id}', 'finalState') or 1

            # 轉換為圖磚內座標
            local_x = grid_x - start_grid_x
            local_y = grid_y - start_grid_y

            tile_array[local_y, local_x] = int(state)

    return create_tile_image(tile_array)
```

### 2.3 前端圖磚快取優化

#### 版本檢查機制

```typescript
// src/components/Map/CustomTileLayer.tsx

class IncrementalTileLayer {
  private currentVersion: string = '';
  private tileCache: Map<string, HTMLImageElement> = new Map();

  async checkForUpdates() {
    try {
      const response = await fetch(`${TILES_BASE_URL}/version.json`);
      const { version } = await response.json();

      if (version !== this.currentVersion) {
        await this.updateToNewVersion(version);
        this.currentVersion = version;
      }
    } catch (error) {
      console.warn('版本檢查失敗:', error);
    }
  }

  private async updateToNewVersion(newVersion: string) {
    // 只需要重新載入 Leaflet 圖層
    // 瀏覽器會自動快取未變更的圖磚
    this.leafletLayer.setUrl(`${TILES_BASE_URL}/${newVersion}/{z}/{x}/{y}.png?t=${Date.now()}`);
  }
}
```

---

## 效能改善預估

### 命令數量對比

| 場景         | 優化前        | 階段一後      | 階段二後      | 總改善  |
| ------------ | ------------- | ------------- | ------------- | ------- |
| 單次回報     | ~200 commands | ~50 commands  | ~50 commands  | -75%    |
| 圖磚生成     | 480K commands | 480K commands | ~100 commands | -99.98% |
| 每日總命令數 | ~57M          | ~14M          | ~0.1M         | -99.8%  |

### 資源使用改善

| 資源                    | 改善幅度 | 備註                 |
| ----------------------- | -------- | -------------------- |
| Redis 命令數            | -99.8%   | 主要來自增量更新     |
| GitHub Actions 執行時間 | -95%     | 從分鐘級降到秒級     |
| CDN 上傳流量            | -99%     | 只上傳變更的圖磚     |
| 前端載入速度            | +50%     | 瀏覽器快取未變更圖磚 |

---

## 實作計劃

### 階段一：Redis 結構優化（預估 1-2 天）

1. **[ ]** 修改 `src/lib/redis.ts` 的資料結構
2. **[ ]** 更新 `getGridData()` 和 `setGridData()` 函數
3. **[ ]** 修改 `getAllGridStates()` 方法
4. **[ ]** 測試回報 API 功能
5. **[ ]** 驗證圖磚生成仍正常運作

### 階段二：增量更新機制（預估 2-3 天）

1. **[ ]** 實作變更追蹤功能
2. **[ ]** 修改回報 API 標記變更
3. **[ ]** 重寫 `generate_tiles.py` 腳本
4. **[ ]** 實作單個圖磚生成邏輯
5. **[ ]** 測試增量更新流程
6. **[ ]** 前端圖磚快取優化

### 驗證指標

- **[ ]** 單次回報 Redis 命令數 < 20
- **[ ]** 圖磚生成時間 < 30 秒
- **[ ]** 只有變更的圖磚被重新生成
- **[ ]** 前端地圖正常顯示和更新

---

## 風險評估與回退策略

### 主要風險

1. **資料遷移風險：** 從舊結構遷移到新結構可能遺失資料
2. **圖磚同步問題：** 增量更新可能導致圖磚不一致
3. **快取問題：** 瀏覽器可能快取過期的圖磚

### 緩解措施

1. **漸進式遷移：** 支援新舊格式並存，逐步遷移
2. **完整性檢查：** 定期驗證圖磚與 Redis 資料一致性
3. **強制更新機制：** 提供手動觸發全量更新的選項
4. **回退方案：** 保留原有邏輯，可快速切換回舊版本

### 回退觸發條件

- Redis 命令數未顯著減少
- 圖磚生成失敗率 > 5%
- 使用者回報功能異常
- 地圖顯示出現問題

---

## 後續優化建議

### 長期優化方向

1. **WebSocket 即時更新：** 減少輪詢，實現即時地圖更新
2. **邊緣運算：** 將圖磚生成移到 Cloudflare Workers
3. **壓縮優化：** 使用向量圖磚 (Vector Tiles) 進一步減少傳輸量
4. **快取策略：** 實作多層快取機制

### 監控指標

建議監控以下指標來評估優化效果：

- Redis 每日命令數
- GitHub Actions 平均執行時間
- 圖磚更新延遲時間
- 前端地圖載入速度
- 使用者回報成功率

---

**注意：** 此文件描述的是優化策略規劃，實際實作前需要進一步驗證技術可行性。驗證成功後，相關內容將合併回主要技術規格文件。
