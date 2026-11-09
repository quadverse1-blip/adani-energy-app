-- ==============================================================================
-- Adani Smart Meter Workforce - PostgreSQL + PostGIS Production Schema
-- Spatial Indexing and Nearby POI Search Engine for Maharashtra State
-- ==============================================================================

-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create Maharashtra POI Table
CREATE TABLE IF NOT EXISTS maharashtra_pois (
    id VARCHAR(64) PRIMARY KEY,                    -- e.g. 'osm/node/101001'
    name VARCHAR(255) NOT NULL,                    -- Primary English / Latin Name
    name_mr VARCHAR(255),                          -- Marathi Localization
    name_hi VARCHAR(255),                          -- Hindi Localization
    category VARCHAR(64) NOT NULL,                 -- healthcare, fuel, financial, food, shop, civic, transit, education
    sub_category VARCHAR(64) NOT NULL,             -- hospital, pharmacy, fuel, bank, atm, supermarket, restaurant, police, railway_station
    brand VARCHAR(128),                            -- Brand / Franchise name
    operator VARCHAR(128),                         -- Operator entity (e.g. Adani Electricity, MSEDCL, HPCL)
    street VARCHAR(255),                           -- Local road / street name
    locality VARCHAR(255),                         -- Area / neighborhood
    city VARCHAR(100) NOT NULL,                    -- Mumbai, Pune, Nashik, Nagpur, Thane, etc.
    district VARCHAR(100) NOT NULL,                -- Administrative district
    pincode VARCHAR(10),                           -- Indian Postal PIN code
    phone VARCHAR(50),                             -- Contact number
    opening_hours VARCHAR(100),                    -- e.g. '24/7' or '08:00-22:00'
    latitude DOUBLE PRECISION NOT NULL,            -- WGS84 Latitude
    longitude DOUBLE PRECISION NOT NULL,           -- WGS84 Longitude
    geom GEOMETRY(Point, 4326) NOT NULL,           -- PostGIS Point Geometry in EPSG:4326
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Spatial and Text Search Indexes
-- PostGIS Spatial Index for lightning-fast ST_DWithin and KNN (<->) nearest neighbor searches
CREATE INDEX IF NOT EXISTS idx_pois_geom ON maharashtra_pois USING GIST (geom);

-- B-Tree Indexes on category and city for fast filtered queries
CREATE INDEX IF NOT EXISTS idx_pois_category ON maharashtra_pois (category);
CREATE INDEX IF NOT EXISTS idx_pois_sub_category ON maharashtra_pois (sub_category);
CREATE INDEX IF NOT EXISTS idx_pois_city ON maharashtra_pois (city);

-- Trigram Indexes for multi-word fuzzy search and autocomplete on name, brand, street
CREATE INDEX IF NOT EXISTS idx_pois_name_trgm ON maharashtra_pois USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pois_brand_trgm ON maharashtra_pois USING GIN (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pois_street_trgm ON maharashtra_pois USING GIN (street gin_trgm_ops);

-- 4. Spatial Function: Find Nearby POIs around coordinates within given radius in meters
CREATE OR REPLACE FUNCTION find_nearby_pois(
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION DEFAULT 1000,
    filter_category VARCHAR DEFAULT NULL,
    search_query VARCHAR DEFAULT NULL,
    max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
    id VARCHAR(64),
    name VARCHAR(255),
    name_mr VARCHAR(255),
    category VARCHAR(64),
    sub_category VARCHAR(64),
    brand VARCHAR(128),
    address TEXT,
    city VARCHAR(100),
    district VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    phone VARCHAR(50),
    opening_hours VARCHAR(100),
    distance_meters DOUBLE PRECISION
) AS $$
DECLARE
    center_geom GEOMETRY;
BEGIN
    center_geom := ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326);

    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.name_mr,
        p.category,
        p.sub_category,
        p.brand,
        COALESCE(p.street, '') || CASE WHEN p.street IS NOT NULL AND p.locality IS NOT NULL THEN ', ' ELSE '' END || COALESCE(p.locality, '') || ', ' || p.city AS address,
        p.city,
        p.district,
        p.latitude,
        p.longitude,
        p.phone,
        p.opening_hours,
        ST_DistanceSphere(p.geom, center_geom) AS distance_meters
    FROM maharashtra_pois p
    WHERE ST_DWithin(p.geom::geography, center_geom::geography, radius_meters)
      AND (filter_category IS NULL OR p.category = filter_category OR p.sub_category = filter_category)
      AND (search_query IS NULL OR p.name ILIKE '%' || search_query || '%' OR p.brand ILIKE '%' || search_query || '%' OR p.street ILIKE '%' || search_query || '%')
    ORDER BY p.geom <-> center_geom
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

