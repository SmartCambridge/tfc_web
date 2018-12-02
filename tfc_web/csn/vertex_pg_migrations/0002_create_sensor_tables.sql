-- Create the initial tfcserver tables (csn_sensor, csn_destination)
--
-- Connect to database tfcserver
\connect tfcserver
--
-- -------------------Add PostGIS extension -----------------------------
CREATE EXTENSION postgis;
--
-- -------------------Change user to tfc_prod
--
SET ROLE tfc_prod;
--
-- -------------------Create tables -------------------------------------
--
-- Create table csn_sensors
--
BEGIN;
CREATE TABLE "csn_sensor" 
(   "id" serial NOT NULL PRIMARY KEY, 
    "info" jsonb NOT NULL
);
--
CREATE        INDEX "idx_csn_sensor_info_sensor_type"             ON "csn_sensor" USING BTREE ((info->>'sensor_type'));
CREATE UNIQUE INDEX "idx_csn_sensor_info_sensor_id_and_type"      ON "csn_sensor" ((info->>'sensor_id'),(info->>'sensor_type'));
CREATE        INDEX "idx_csn_sensor_info_destination_id"          ON "csn_sensor" USING BTREE ((info->>'destination_id'));
CREATE        INDEX "idx_csn_sensor_info_destination_type"        ON "csn_sensor" USING BTREE ((info->>'destination_type'));
CREATE        INDEX "idx_csn_sensor_info_user_id"                 ON "csn_sensor" USING BTREE ((info->>'user_id'));
--
COMMIT;
--
-- Create table csn_destination
--
BEGIN;
CREATE TABLE "csn_destination" 
(   "id" serial NOT NULL PRIMARY KEY, 
    "info" jsonb NOT NULL
);
--
CREATE        INDEX "idx_csn_destination_info_destination_type"        ON "csn_destination" USING BTREE ((info->>'destination_type'));
CREATE UNIQUE INDEX "idx_csn_destination_info_destination_id_and_type" ON "csn_destination" ((info->>'destination_id'),(info->>'destination_type'));
CREATE        INDEX "idx_csn_destination_info_user_id"                 ON "csn_destination" USING BTREE ((info->>'user_id'));
--
COMMIT;

