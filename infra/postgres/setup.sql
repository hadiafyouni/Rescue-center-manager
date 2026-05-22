-- Run this script as your postgres superuser:
--   psql -U postgres -f infra/postgres/setup.sql
--
-- It creates the dispatch user and database.

-- Create user (ignore if exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dispatch') THEN
    CREATE ROLE dispatch WITH LOGIN PASSWORD 'dispatch_dev';
  END IF;
END
$$;

-- Create database (must be run separately if it doesn't exist)
SELECT 'CREATE DATABASE dispatch OWNER dispatch'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dispatch');
\gexec

-- Connect to the dispatch database
\c dispatch

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE dispatch TO dispatch;
GRANT ALL PRIVILEGES ON SCHEMA public TO dispatch;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dispatch;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dispatch;
