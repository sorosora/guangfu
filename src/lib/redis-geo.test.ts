/**
 * Redis 地理座標資料操作單元測試
 *
 * 驗證地理座標資料的 CRUD 操作和信任演算法邏輯
 */

import { describe, it, expect } from 'vitest';

// 浮點數精度處理工具函數
function roundFloat(value: number, decimals: number = 10): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// 地理座標資料結構定義
interface GeoCoordData {
  Score_0: number; // 已清除信譽分數
  Score_1: number; // 有淤泥信譽分數
  last_update_0: number; // 已清除最後更新時間戳
  last_update_1: number; // 有淤泥最後更新時間戳
  finalState: 0 | 1; // 最終判斷狀態
}

// 測試用的信任演算法邏輯函數
function calculateFinalState(Score_0: number, Score_1: number): 0 | 1 {
  return Score_0 > Score_1 ? 0 : 1;
}

function applyMudReport(
  currentData: GeoCoordData,
  baseWeight: number,
  timestamp: number
): GeoCoordData {
  return {
    Score_0: currentData.Score_0, // 保持不變
    Score_1: currentData.Score_1 + baseWeight, // 增加權重
    last_update_0: currentData.last_update_0, // 保持不變
    last_update_1: timestamp, // 更新時間戳
    finalState: calculateFinalState(currentData.Score_0, currentData.Score_1 + baseWeight),
  };
}

function applyClearReport(
  currentData: GeoCoordData,
  baseWeight: number,
  timestamp: number
): {
  newData: GeoCoordData;
  needsScore1Reduction: boolean;
} {
  const newScore_0 = currentData.Score_0 + baseWeight * 5;
  const newData: GeoCoordData = {
    Score_0: newScore_0,
    Score_1: currentData.Score_1, // 暫時保持不變
    last_update_0: timestamp, // 更新時間戳
    last_update_1: currentData.last_update_1, // 保持不變
    finalState: calculateFinalState(newScore_0, currentData.Score_1),
  };

  return {
    newData,
    needsScore1Reduction: currentData.Score_1 > 0,
  };
}

function applyScore1Reduction(currentData: GeoCoordData): GeoCoordData {
  const newScore_1 = roundFloat(currentData.Score_1 * 0.1); // 保留 10%，處理浮點數精度
  return {
    ...currentData,
    Score_1: newScore_1,
    finalState: calculateFinalState(currentData.Score_0, newScore_1),
  };
}

describe('Redis 地理座標資料操作邏輯', () => {
  describe('finalState 計算', () => {
    it('應該在 Score_0 > Score_1 時回傳 0 (已清除)', () => {
      expect(calculateFinalState(10, 5)).toBe(0);
      expect(calculateFinalState(5.1, 5.0)).toBe(0);
    });

    it('應該在 Score_1 >= Score_0 時回傳 1 (有淤泥)', () => {
      expect(calculateFinalState(5, 10)).toBe(1);
      expect(calculateFinalState(5, 5)).toBe(1);
      expect(calculateFinalState(0, 0)).toBe(1);
    });
  });

  describe('有淤泥回報處理 (state=1)', () => {
    it('應該增加 Score_1 並更新 last_update_1', () => {
      const currentData: GeoCoordData = {
        Score_0: 0,
        Score_1: 0,
        last_update_0: 0,
        last_update_1: 0,
        finalState: 1,
      };

      const result = applyMudReport(currentData, 1.0, 1759503825728);

      expect(result).toEqual({
        Score_0: 0, // 保持不變
        Score_1: 1.0, // 增加權重
        last_update_0: 0, // 保持不變
        last_update_1: 1759503825728, // 更新時間戳
        finalState: 1, // Score_0 (0) <= Score_1 (1)
      });
    });

    it('應該正確累加 Score_1', () => {
      const currentData: GeoCoordData = {
        Score_0: 2.0,
        Score_1: 3.0,
        last_update_0: 1000,
        last_update_1: 2000,
        finalState: 1,
      };

      const result = applyMudReport(currentData, 1.5, 1759503825728);

      expect(result).toEqual({
        Score_0: 2.0, // 保持不變
        Score_1: 4.5, // 3.0 + 1.5
        last_update_0: 1000, // 保持不變
        last_update_1: 1759503825728, // 更新時間戳
        finalState: 1, // Score_0 (2) < Score_1 (4.5)
      });
    });
  });

  describe('已清除回報處理 (state=0)', () => {
    it('應該增加 5倍 Score_0 並更新 last_update_0', () => {
      const currentData: GeoCoordData = {
        Score_0: 0,
        Score_1: 2.0,
        last_update_0: 0,
        last_update_1: 1000,
        finalState: 1,
      };

      const { newData, needsScore1Reduction } = applyClearReport(currentData, 1.0, 1759503825728);

      expect(newData).toEqual({
        Score_0: 5.0, // 0 + (1.0 * 5)
        Score_1: 2.0, // 保持不變
        last_update_0: 1759503825728, // 更新時間戳
        last_update_1: 1000, // 保持不變
        finalState: 0, // Score_0 (5) > Score_1 (2)
      });

      expect(needsScore1Reduction).toBe(true); // Score_1 > 0
    });

    it('應該正確累加 Score_0', () => {
      const currentData: GeoCoordData = {
        Score_0: 3.0,
        Score_1: 1.0,
        last_update_0: 1000,
        last_update_1: 2000,
        finalState: 0,
      };

      const { newData } = applyClearReport(currentData, 2.0, 1759503825728);

      expect(newData.Score_0).toBe(13.0); // 3.0 + (2.0 * 5)
      expect(newData.finalState).toBe(0); // Score_0 (13) > Score_1 (1)
    });

    it('當 Score_1 為 0 時不需要減少', () => {
      const currentData: GeoCoordData = {
        Score_0: 0,
        Score_1: 0,
        last_update_0: 0,
        last_update_1: 0,
        finalState: 1,
      };

      const { needsScore1Reduction } = applyClearReport(currentData, 1.0, 1759503825728);

      expect(needsScore1Reduction).toBe(false); // Score_1 === 0
    });
  });

  describe('Score_1 減少處理', () => {
    it('應該將 Score_1 減少到 10%', () => {
      const currentData: GeoCoordData = {
        Score_0: 5.0,
        Score_1: 10.0,
        last_update_0: 1759503825728,
        last_update_1: 1000,
        finalState: 0,
      };

      const result = applyScore1Reduction(currentData);

      expect(result).toEqual({
        Score_0: 5.0,
        Score_1: 1.0, // 10.0 * 0.1
        last_update_0: 1759503825728,
        last_update_1: 1000,
        finalState: 0, // Score_0 (5) > Score_1 (1)
      });
    });

    it('應該在減少後重新計算 finalState', () => {
      const currentData: GeoCoordData = {
        Score_0: 2.0,
        Score_1: 30.0, // 很高的 Score_1
        last_update_0: 1759503825728,
        last_update_1: 1000,
        finalState: 1,
      };

      const result = applyScore1Reduction(currentData);

      expect(result.Score_1).toBe(3.0); // 30.0 * 0.1
      expect(result.finalState).toBe(1); // Score_0 (2) < Score_1 (3)
    });

    it('應該處理邊界情況：非常小的 Score_1', () => {
      const currentData: GeoCoordData = {
        Score_0: 1.0,
        Score_1: 0.5,
        last_update_0: 1759503825728,
        last_update_1: 1000,
        finalState: 0,
      };

      const result = applyScore1Reduction(currentData);

      expect(result.Score_1).toBe(0.05); // 0.5 * 0.1
      expect(result.finalState).toBe(0); // Score_0 (1) > Score_1 (0.05)
    });
  });

  describe('完整信任演算法流程', () => {
    it('應該正確處理淤泥回報後清除回報的完整流程', () => {
      // 1. 初始狀態
      let data: GeoCoordData = {
        Score_0: 0,
        Score_1: 0,
        last_update_0: 0,
        last_update_1: 0,
        finalState: 1,
      };

      // 2. 回報有淤泥
      data = applyMudReport(data, 2.0, 1000);
      expect(data.Score_1).toBe(2.0);
      expect(data.finalState).toBe(1);

      // 3. 再次回報有淤泥
      data = applyMudReport(data, 1.5, 2000);
      expect(data.Score_1).toBe(3.5);
      expect(data.finalState).toBe(1);

      // 4. 回報已清除
      const { newData, needsScore1Reduction } = applyClearReport(data, 1.0, 3000);
      data = newData;
      expect(data.Score_0).toBe(5.0); // 1.0 * 5
      expect(data.Score_1).toBe(3.5); // 保持不變
      expect(data.finalState).toBe(0); // Score_0 > Score_1
      expect(needsScore1Reduction).toBe(true);

      // 5. 處理 Score_1 減少
      data = applyScore1Reduction(data);
      expect(data.Score_1).toBe(0.35); // 3.5 * 0.1，已處理浮點數精度
      expect(data.finalState).toBe(0); // Score_0 (5) > Score_1 (0.35)
    });

    it('應該處理多次清除回報的累積效應', () => {
      let data: GeoCoordData = {
        Score_0: 0,
        Score_1: 10.0,
        last_update_0: 0,
        last_update_1: 1000,
        finalState: 1,
      };

      // 第一次清除回報
      const result1 = applyClearReport(data, 1.0, 2000);
      data = result1.newData;
      if (result1.needsScore1Reduction) {
        data = applyScore1Reduction(data);
      }

      expect(data.Score_0).toBe(5.0); // 1.0 * 5
      expect(data.Score_1).toBe(1.0); // 10.0 * 0.1
      expect(data.finalState).toBe(0);

      // 第二次清除回報
      const result2 = applyClearReport(data, 2.0, 3000);
      data = result2.newData;
      if (result2.needsScore1Reduction) {
        data = applyScore1Reduction(data);
      }

      expect(data.Score_0).toBe(15.0); // 5.0 + (2.0 * 5)
      expect(data.Score_1).toBe(0.1); // 1.0 * 0.1
      expect(data.finalState).toBe(0);
    });
  });
});
