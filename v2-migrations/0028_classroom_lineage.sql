ALTER TABLE classroom_feed_v2 ADD COLUMN submission_graded INTEGER CHECK(submission_graded IS NULL OR submission_graded IN (0,1));
-- Earlier development links did not identify the course. Keep their history;
-- do not infer a source course from a mapping that could have changed.
UPDATE legacy_classroom_activity_links SET external_id='_unverified:'||external_id WHERE external_id LIKE '0:%';

UPDATE academic_projection_state SET revision=revision+1 WHERE id=1;
