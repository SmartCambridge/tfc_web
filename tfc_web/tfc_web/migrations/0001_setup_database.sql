-- Create the database "tfcweb" and initial setup
--
-- This assumes:
--   - postgresql/postgis is already installed
--   - user is accessing psql as user 'postgres'
--
--
-- -------------------Create database -----------------------------------
CREATE DATABASE tfcweb;
CREATE USER tfc_prod;
ALTER ROLE tfc_prod SET client_encoding TO 'utf8';
ALTER ROLE tfc_prod SET default_transaction_isolation TO 'read committed';
ALTER ROLE tfc_prod SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE tfcweb TO tfc_prod;
\connect tfcweb
CREATE EXTENSION postgis;
\q
