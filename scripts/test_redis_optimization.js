#!/usr/bin/env node
/**
 * Redis 優化效果測試腳本
 * 模擬單次回報並統計 Redis 命令數量
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Redis } from '@upstash/redis';

// 載入 .env.local 檔案
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFile = path.join(__dirname, '..', '.env.local');

if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  envContent.split('\n').forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
  console.log('已載入 .env.local 環境變數');
}

// 設定 Redis 連線
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 測試資料
const TEST_GRID_IDS = [
  '400_300',
  '399_300',
  '401_300',
  '400_299',
  '399_299',
  '401_299',
  '400_301',
  '399_301',
  '401_301',
]; // 3x3 範圍效應

let commandCount = 0;

// 重寫 Redis 方法來統計命令數
const originalMethods = {};
const methodsToTrack = ['hmget', 'hmset', 'sadd', 'expire', 'pipeline'];

function trackRedisCommands() {
  methodsToTrack.forEach((method) => {
    if (redis[method]) {
      originalMethods[method] = redis[method].bind(redis);
      redis[method] = function (...args) {
        commandCount++;
        console.log(`[${commandCount}] ${method.toUpperCase()}:`, args[0] || 'pipeline');
        return originalMethods[method](...args);
      };
    }
  });

  // 特別處理 pipeline
  if (redis.pipeline) {
    const originalPipeline = redis.pipeline.bind(redis);
    redis.pipeline = function () {
      const pipeline = originalPipeline();
      const originalExec = pipeline.exec.bind(pipeline);

      let pipelineCommands = 0;
      ['hmget', 'hmset', 'sadd', 'expire'].forEach((method) => {
        if (pipeline[method]) {
          const originalMethod = pipeline[method].bind(pipeline);
          pipeline[method] = function (...args) {
            pipelineCommands++;
            console.log(`  pipeline[${pipelineCommands}] ${method.toUpperCase()}:`, args[0]);
            return originalMethod(...args);
          };
        }
      });

      pipeline.exec = function () {
        commandCount += pipelineCommands;
        console.log(`[PIPELINE EXEC] 執行了 ${pipelineCommands} 個命令`);
        return originalExec();
      };

      return pipeline;
    };
  }
}

async function testOptimizedRead() {
  console.log('\n=== 測試優化後的讀取操作 ===');
  commandCount = 0;

  try {
    // 模擬 getGridData() 函數
    const pipeline = redis.pipeline();

    for (const gridId of TEST_GRID_IDS) {
      pipeline.hmget(
        `grid:${gridId}`,
        'score0',
        'score1',
        'lastUpdate0',
        'lastUpdate1',
        'finalState'
      );
    }

    const results = await pipeline.exec();
    console.log(`讀取 ${TEST_GRID_IDS.length} 個網格，使用了 ${commandCount} 個 Redis 命令`);

    return results;
  } catch (error) {
    console.error('讀取測試失敗:', error);
    return null;
  }
}

async function testOptimizedWrite() {
  console.log('\n=== 測試優化後的寫入操作 ===');
  commandCount = 0;

  try {
    // 模擬 setGridData() 函數
    const pipeline = redis.pipeline();

    for (const gridId of TEST_GRID_IDS) {
      const testData = {
        score0: Math.random() * 10,
        score1: Math.random() * 10,
        lastUpdate0: Date.now(),
        lastUpdate1: Date.now(),
        finalState: Math.random() > 0.5 ? 1 : 0,
      };

      pipeline.hmset(`grid:${gridId}`, testData);
    }

    await pipeline.exec();
    console.log(`寫入 ${TEST_GRID_IDS.length} 個網格，使用了 ${commandCount} 個 Redis 命令`);
  } catch (error) {
    console.error('寫入測試失敗:', error);
  }
}

async function testChangeTracking() {
  console.log('\n=== 測試變更追蹤操作 ===');
  commandCount = 0;

  try {
    // 模擬 markGridsAsChanged() 函數
    const pipeline = redis.pipeline();

    for (const gridId of TEST_GRID_IDS) {
      pipeline.sadd('changed_grids', gridId);
    }

    pipeline.expire('changed_grids', 3600);

    await pipeline.exec();
    console.log(
      `標記 ${TEST_GRID_IDS.length} 個網格為已變更，使用了 ${commandCount} 個 Redis 命令`
    );
  } catch (error) {
    console.error('變更追蹤測試失敗:', error);
  }
}

async function testCompleteReportFlow() {
  console.log('\n=== 測試完整回報流程 ===');
  commandCount = 0;

  try {
    // 1. 讀取當前網格資料
    await testOptimizedRead();

    // 2. 寫入更新後的資料
    await testOptimizedWrite();

    // 3. 標記變更
    await testChangeTracking();

    console.log(`\n完整回報流程總計使用了 ${commandCount} 個 Redis 命令`);

    // 計算改善幅度
    const oldCommandCount = TEST_GRID_IDS.length * 4 * 2 + TEST_GRID_IDS.length + 1; // 舊版本估計
    const improvement = (((oldCommandCount - commandCount) / oldCommandCount) * 100).toFixed(1);

    console.log(`舊版本預估命令數: ${oldCommandCount}`);
    console.log(`新版本實際命令數: ${commandCount}`);
    console.log(`改善幅度: ${improvement}%`);
  } catch (error) {
    console.error('完整流程測試失敗:', error);
  }
}

async function main() {
  console.log('🚀 開始 Redis 優化效果測試');
  console.log(`測試範圍: ${TEST_GRID_IDS.length} 個網格 (3x3 範圍效應)`);

  // 啟用 Redis 命令追蹤
  trackRedisCommands();

  // 執行各項測試
  await testOptimizedRead();
  await testOptimizedWrite();
  await testChangeTracking();
  await testCompleteReportFlow();

  console.log('\n✅ Redis 優化效果測試完成');
}

// 檢查環境變數
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error('❌ 請設定 Redis 環境變數:');
  console.error('   UPSTASH_REDIS_REST_URL');
  console.error('   UPSTASH_REDIS_REST_TOKEN');
  process.exit(1);
}

main().catch(console.error);
