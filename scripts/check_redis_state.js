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
  console.log('已載入 .env.local 環境變數');
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function checkRedisState() {
  try {
    console.log('=== 檢查 Redis 狀態 ===');

    // 檢查變更集合
    const changedGrids = await redis.smembers('changed_grids');
    console.log('變更網格數量:', changedGrids?.length || 0);

    if (changedGrids && changedGrids.length > 0) {
      console.log('前 10 個變更網格:', changedGrids.slice(0, 10));
    }

    // 檢查變更網格的資料
    console.log('\n=== 檢查變更網格資料 ===');

    if (changedGrids && changedGrids.length > 0) {
      const testGrids = changedGrids.slice(0, 5); // 檢查前5個變更網格
      for (const gridId of testGrids) {
        const gridData = await redis.hmget(`grid:${gridId}`, 'score0', 'score1', 'finalState');
        console.log(`變更網格 ${gridId}:`, gridData);
      }
    }

    // 檢查所有 keys
    console.log('\n=== 檢查所有 Redis keys ===');
    const keys = await redis.keys('*');
    console.log('總 key 數量:', keys?.length || 0);

    if (keys && keys.length > 0) {
      console.log('前 20 個 keys:', keys.slice(0, 20));
    }
  } catch (error) {
    console.error('檢查 Redis 狀態失敗:', error);
  }
}

checkRedisState();
