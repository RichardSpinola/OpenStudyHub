-- V2 baseline only: catalog ownership cannot drift after creation.
CREATE TRIGGER programs_institution_immutable BEFORE UPDATE OF institution_id ON programs
WHEN NEW.institution_id != OLD.institution_id
BEGIN SELECT RAISE(ABORT,'program institution is immutable'); END;
CREATE TRIGGER curricula_program_immutable BEFORE UPDATE OF program_id ON curricula
WHEN NEW.program_id != OLD.program_id
BEGIN SELECT RAISE(ABORT,'curriculum program is immutable'); END;
CREATE TRIGGER curriculum_semesters_curriculum_immutable BEFORE UPDATE OF curriculum_id ON curriculum_semesters
WHEN NEW.curriculum_id != OLD.curriculum_id
BEGIN SELECT RAISE(ABORT,'semester curriculum is immutable'); END;
CREATE TRIGGER cohorts_program_immutable BEFORE UPDATE OF program_id ON cohorts
WHEN NEW.program_id != OLD.program_id
BEGIN SELECT RAISE(ABORT,'cohort program is immutable'); END;
CREATE TRIGGER offerings_program_immutable BEFORE UPDATE OF program_id ON offerings
WHEN NEW.program_id != OLD.program_id
BEGIN SELECT RAISE(ABORT,'offering program is immutable'); END;
CREATE TRIGGER subjects_institution_immutable BEFORE UPDATE OF institution_id ON subjects
WHEN NEW.institution_id != OLD.institution_id
BEGIN SELECT RAISE(ABORT,'subject institution is immutable'); END;
CREATE TRIGGER periods_institution_immutable BEFORE UPDATE OF institution_id ON academic_periods
WHEN NEW.institution_id != OLD.institution_id
BEGIN SELECT RAISE(ABORT,'period institution is immutable'); END;
CREATE TRIGGER instructors_institution_immutable BEFORE UPDATE OF institution_id ON instructors
WHEN NEW.institution_id != OLD.institution_id
BEGIN SELECT RAISE(ABORT,'instructor institution is immutable'); END;
CREATE TRIGGER locations_institution_immutable BEFORE UPDATE OF institution_id ON locations
WHEN NEW.institution_id != OLD.institution_id
BEGIN SELECT RAISE(ABORT,'location institution is immutable'); END;

CREATE TRIGGER curriculum_subject_institution_insert BEFORE INSERT ON curriculum_subjects
WHEN NOT EXISTS (
 SELECT 1 FROM curriculum_semesters cs JOIN curricula c ON c.id=cs.curriculum_id
 JOIN programs p ON p.id=c.program_id JOIN subjects s ON s.id=NEW.subject_id
 WHERE cs.id=NEW.semester_id AND s.institution_id=p.institution_id
)
BEGIN SELECT RAISE(ABORT,'curriculum subject/institution mismatch'); END;
CREATE TRIGGER curriculum_subject_institution_update BEFORE UPDATE OF semester_id,subject_id ON curriculum_subjects
WHEN NOT EXISTS (
 SELECT 1 FROM curriculum_semesters cs JOIN curricula c ON c.id=cs.curriculum_id
 JOIN programs p ON p.id=c.program_id JOIN subjects s ON s.id=NEW.subject_id
 WHERE cs.id=NEW.semester_id AND s.institution_id=p.institution_id
)
BEGIN SELECT RAISE(ABORT,'curriculum subject/institution mismatch'); END;

CREATE TRIGGER cohort_period_institution_insert BEFORE INSERT ON cohort_periods
WHEN NOT EXISTS (
 SELECT 1 FROM cohorts c JOIN programs p ON p.id=c.program_id
 JOIN academic_periods ap ON ap.id=NEW.period_id
 WHERE c.id=NEW.cohort_id AND ap.institution_id=p.institution_id
)
BEGIN SELECT RAISE(ABORT,'cohort period/institution mismatch'); END;
CREATE TRIGGER cohort_period_institution_update BEFORE UPDATE OF cohort_id,period_id ON cohort_periods
WHEN NOT EXISTS (
 SELECT 1 FROM cohorts c JOIN programs p ON p.id=c.program_id
 JOIN academic_periods ap ON ap.id=NEW.period_id
 WHERE c.id=NEW.cohort_id AND ap.institution_id=p.institution_id
)
BEGIN SELECT RAISE(ABORT,'cohort period/institution mismatch'); END;

CREATE TRIGGER offering_institution_insert BEFORE INSERT ON offerings
WHEN NOT EXISTS (
 SELECT 1 FROM programs p JOIN subjects s ON s.id=NEW.subject_id
 JOIN academic_periods ap ON ap.id=NEW.period_id
 LEFT JOIN instructors i ON i.id=NEW.instructor_id
 WHERE p.id=NEW.program_id AND s.institution_id=p.institution_id
 AND ap.institution_id=p.institution_id
 AND (NEW.instructor_id IS NULL OR i.institution_id=p.institution_id)
)
BEGIN SELECT RAISE(ABORT,'offering institution mismatch'); END;
CREATE TRIGGER offering_institution_update BEFORE UPDATE OF program_id,subject_id,period_id,instructor_id ON offerings
WHEN NOT EXISTS (
 SELECT 1 FROM programs p JOIN subjects s ON s.id=NEW.subject_id
 JOIN academic_periods ap ON ap.id=NEW.period_id
 LEFT JOIN instructors i ON i.id=NEW.instructor_id
 WHERE p.id=NEW.program_id AND s.institution_id=p.institution_id
 AND ap.institution_id=p.institution_id
 AND (NEW.instructor_id IS NULL OR i.institution_id=p.institution_id)
)
BEGIN SELECT RAISE(ABORT,'offering institution mismatch'); END;

CREATE TRIGGER schedule_location_institution_insert BEFORE INSERT ON schedule_slots
WHEN NEW.location_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM offerings o JOIN programs p ON p.id=o.program_id
 JOIN locations l ON l.id=NEW.location_id
 WHERE o.id=NEW.offering_id AND l.institution_id=p.institution_id
)
BEGIN SELECT RAISE(ABORT,'schedule location/institution mismatch'); END;
CREATE TRIGGER schedule_location_institution_update BEFORE UPDATE OF offering_id,location_id ON schedule_slots
WHEN NEW.location_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM offerings o JOIN programs p ON p.id=o.program_id
 JOIN locations l ON l.id=NEW.location_id
 WHERE o.id=NEW.offering_id AND l.institution_id=p.institution_id
)
BEGIN SELECT RAISE(ABORT,'schedule location/institution mismatch'); END;
