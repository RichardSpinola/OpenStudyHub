ALTER TABLE enrollments ADD COLUMN withdrawn_at INTEGER;
CREATE INDEX enrollments_current_offering ON enrollments(offering_id,user_id) WHERE withdrawn_at IS NULL;
