import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 環境變數檢查
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// 用於前端的 Supabase 客戶端（使用匿名金鑰）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 用於後端 API 的 Supabase 客戶端（使用服務角色金鑰，具有完整權限）
export function createServiceSupabase(): SupabaseClient {
  if (!supabaseServiceKey) {
    throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
  }

  if (!supabaseUrl) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// reports 資料表型別定義
export interface ReportRecord {
  id: number;
  created_at: string;
  grid_x: number;
  grid_y: number;
  reported_state: 0 | 1;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [經度, 緯度]
  };
}

// 新增回報記錄到資料庫
export async function insertReport(
  gridX: number,
  gridY: number,
  reportedState: 0 | 1,
  lat: number,
  lon: number
): Promise<ReportRecord> {
  const supabaseService = createServiceSupabase();

  const { data, error } = await supabaseService
    .from('reports')
    .insert({
      grid_x: gridX,
      grid_y: gridY,
      reported_state: reportedState,
      location: `POINT(${lon} ${lat})`, // PostGIS 格式：經度在前，緯度在後
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert report: ${error.message}`);
  }

  return data;
}

// 查詢指定時間範圍內的回報記錄（用於演算法計算）
export async function getRecentReports(
  centerLat: number,
  centerLon: number,
  radiusMeters: number,
  sinceTimestamp: Date
): Promise<ReportRecord[]> {
  const supabaseService = createServiceSupabase();

  const { data, error } = await supabaseService
    .from('reports')
    .select('*')
    .filter('created_at', 'gte', sinceTimestamp.toISOString())
    .gte('location', `POINT(${centerLon} ${centerLat})`) // 這裡需要使用 PostGIS 的距離查詢
    .limit(100); // 限制查詢結果數量

  if (error) {
    throw new Error(`Failed to query recent reports: ${error.message}`);
  }

  return data || [];
}
