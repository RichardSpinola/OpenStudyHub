ALTER TABLE user_home_presentation ADD COLUMN control_enabled INTEGER NOT NULL DEFAULT 1 CHECK(control_enabled IN (0,1));
ALTER TABLE user_home_presentation ADD COLUMN control_x REAL CHECK(control_x BETWEEN 0 AND 100);
ALTER TABLE user_home_presentation ADD COLUMN control_y REAL CHECK(control_y BETWEEN 0 AND 100);
