--
-- Create table csn_sensordata in database tfcserver
--
\connect tfcserver
--
SET ROLE tfc_prod;

BEGIN;
CREATE TABLE "csn_sensordata" 
(   "id" serial NOT NULL PRIMARY KEY, 
    "ts" timestamp with time zone NOT NULL, 
    "location_4d" geography(POINTZM,4326) NOT NULL, 
    "info" jsonb NOT NULL
);
--
CREATE INDEX "idx_csn_sensordata_info_sensor_id" ON "csn_sensordata" USING BTREE ((info->>'sensor_id'));
CREATE INDEX "idx_csn_sensordata_info_sensor_type" ON "csn_sensordata" USING BTREE ((info->>'sensor_type'));
CREATE INDEX "idx_csn_sensordata_timestamp" ON "csn_sensordata" USING BTREE ("ts" );
CREATE INDEX "idx_csn_sensordata_location_4d" ON "csn_sensordata" USING GIST ("location_4d" );
--
COMMIT;
--
