-- 清淤地圖 - 光復計畫 - Supabase 資料庫設定
-- 在 Supabase SQL Editor 中執行以下 SQL 語句

-- 0. 啟用 PostGIS 擴展（地理空間功能）
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. 建立 reports 資料表
CREATE TABLE IF NOT EXISTS reports (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    grid_x INTEGER NOT NULL,
    grid_y INTEGER NOT NULL,
    reported_state SMALLINT NOT NULL CHECK (reported_state IN (0, 1)),
    location GEOGRAPHY(POINT, 4326) NOT NULL
);

-- 2. 建立地理空間索引 (GIST) 以加速位置查詢
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports USING GIST (location);

-- 3. 建立網格座標的複合索引
CREATE INDEX IF NOT EXISTS idx_reports_grid ON reports (grid_x, grid_y);

-- 4. 建立時間索引以加速時間範圍查詢
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at);

-- 5. 建立狀態索引
CREATE INDEX IF NOT EXISTS idx_reports_state ON reports (reported_state);

-- 6. 設定 Row Level Security (RLS)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 7. 建立 RLS 政策：允許插入新回報（任何人都可以回報）
CREATE POLICY "允許插入回報" ON reports
    FOR INSERT
    WITH CHECK (true);

-- 8. 建立 RLS 政策：允許讀取所有回報（用於分析和統計）
CREATE POLICY "允許讀取回報" ON reports
    FOR SELECT
    USING (true);

-- 9. （可選）建立視圖，用於快速查詢統計資料
CREATE OR REPLACE VIEW report_statistics AS
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    reported_state,
    COUNT(*) as report_count,
    COUNT(DISTINCT ST_SnapToGrid(location::geometry, 0.00005)) as unique_grid_count
FROM reports
GROUP BY DATE_TRUNC('hour', created_at), reported_state
ORDER BY hour DESC;

-- 10. 建立函數：計算兩點間距離（以公尺為單位）
CREATE OR REPLACE FUNCTION calculate_distance_meters(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
BEGIN
    RETURN ST_Distance(
        ST_SetSRID(ST_MakePoint(lon1, lat1), 4326)::geography,
        ST_SetSRID(ST_MakePoint(lon2, lat2), 4326)::geography
    );
END;
$$ LANGUAGE plpgsql;

-- 11. 建立函數：查詢指定範圍內的回報
CREATE OR REPLACE FUNCTION get_reports_within_radius(
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    radius_meters INTEGER,
    since_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '1 hour'
) RETURNS TABLE (
    id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE,
    grid_x INTEGER,
    grid_y INTEGER,
    reported_state SMALLINT,
    distance_meters DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.created_at,
        r.grid_x,
        r.grid_y,
        r.reported_state,
        ST_Distance(
            r.location,
            ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography
        ) as distance_meters
    FROM reports r
    WHERE
        r.created_at >= since_timestamp
        AND ST_DWithin(
            r.location,
            ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography,
            radius_meters
        )
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- 執行完成後的驗證查詢
-- 檢查資料表是否建立成功
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reports'
ORDER BY ordinal_position;

-- 檢查索引是否建立成功
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'reports';

-- 檢查 RLS 是否啟用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'reports';

-- 測試插入資料（可選）
-- INSERT INTO reports (grid_x, grid_y, reported_state, location)
-- VALUES (400, 300, 1, ST_SetSRID(ST_MakePoint(121.43705, 23.66767), 4326));

-- 測試查詢函數（可選）
-- SELECT * FROM get_reports_within_radius(23.66767, 121.43705, 100, NOW() - INTERVAL '1 day');
