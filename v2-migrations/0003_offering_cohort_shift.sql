CREATE TRIGGER offering_cohort_shift_insert BEFORE INSERT ON offering_cohorts
WHEN NOT EXISTS (
 SELECT 1 FROM offerings o JOIN cohorts c ON c.program_id=o.program_id
 WHERE o.id=NEW.offering_id AND c.id=NEW.cohort_id AND (o.shift_id IS NULL OR o.shift_id=c.shift_id)
)
BEGIN SELECT RAISE(ABORT,'offering/cohort shift mismatch'); END;
CREATE TRIGGER offering_cohort_shift_update BEFORE UPDATE OF offering_id,cohort_id ON offering_cohorts
WHEN NOT EXISTS (
 SELECT 1 FROM offerings o JOIN cohorts c ON c.program_id=o.program_id
 WHERE o.id=NEW.offering_id AND c.id=NEW.cohort_id AND (o.shift_id IS NULL OR o.shift_id=c.shift_id)
)
BEGIN SELECT RAISE(ABORT,'offering/cohort shift mismatch'); END;
