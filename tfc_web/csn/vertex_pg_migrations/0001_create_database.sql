-- Create the initial database "tfcserver" for use by the java real-time platform
--
-- This assumes:
--   - postgresql/postgis is already installed
--   - user is accessing psql as user 'postgres'
--  
--
-- -------------------Create database -----------------------------------
CREATE DATABASE tfcserver;
GRANT ALL PRIVILEGES ON DATABASE tfcserver TO tfc_prod;
--

