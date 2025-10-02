#!/usr/bin/env node

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
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function createTestChanges() {
  console.log('模擬新回報，創建測試變更...');

  // 模擬更新幾個網格
  const testGrids = ['400_300', '401_300', '400_301'];

  for (const gridId of testGrids) {
    // 模擬更新網格資料
    await redis.hmset(`grid:${gridId}`, {
      score0: 5.0,
      score1: 2.0,
      lastUpdate0: Date.now(),
      lastUpdate1: Date.now() - 1000,
      finalState: 0, // 已清除
    });

    // 標記為變更
    await redis.sadd('changed_grids', gridId);
  }

  await redis.expire('changed_grids', 3600);

  console.log(`已添加 ${testGrids.length} 個測試變更網格:`, testGrids);

  // 驗證
  const changedGrids = await redis.smembers('changed_grids');
  console.log('當前變更網格:', changedGrids);
}

createTestChanges().catch(console.error);
