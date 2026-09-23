-- Clean V2 foundation. V1 migrations remain untouched.
CREATE TABLE users (
 id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'pt-BR' CHECK(locale IN ('pt-BR','en')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);
CREATE TABLE admin_accounts (
 id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);
CREATE TABLE institutions (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name))>0),
 archived_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);
CREATE TABLE programs (
 id INTEGER PRIMARY KEY, institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
 code TEXT NOT NULL, name TEXT NOT NULL, archived_at INTEGER,
 UNIQUE(institution_id,code), UNIQUE(id,institution_id)
);
CREATE TABLE shifts (
 id INTEGER PRIMARY KEY, institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
 code TEXT NOT NULL, name TEXT NOT NULL, archived_at INTEGER,
 UNIQUE(institution_id,code), UNIQUE(id,institution_id)
);
CREATE TABLE curricula (
 id INTEGER PRIMARY KEY, program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
 version TEXT NOT NULL, archived_at INTEGER, UNIQUE(program_id,version), UNIQUE(id,program_id)
);
CREATE TABLE curriculum_semesters (
 id INTEGER PRIMARY KEY, curriculum_id INTEGER NOT NULL REFERENCES curricula(id) ON DELETE RESTRICT,
 ordinal INTEGER NOT NULL CHECK(ordinal>0), UNIQUE(curriculum_id,ordinal), UNIQUE(id,curriculum_id)
);
CREATE TABLE subjects (
 id INTEGER PRIMARY KEY, institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
 code TEXT, name TEXT NOT NULL CHECK(length(trim(name))>0), archived_at INTEGER,
 UNIQUE(id,institution_id)
);
CREATE TABLE curriculum_subjects (
 id INTEGER PRIMARY KEY, semester_id INTEGER NOT NULL REFERENCES curriculum_semesters(id) ON DELETE RESTRICT,
 subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
 required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)),
 UNIQUE(semester_id,subject_id), UNIQUE(id,subject_id)
);
CREATE TABLE cohorts (
 id INTEGER PRIMARY KEY, program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
 curriculum_id INTEGER NOT NULL, shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
 code TEXT NOT NULL, name TEXT NOT NULL, archived_at INTEGER,
 FOREIGN KEY(curriculum_id,program_id) REFERENCES curricula(id,program_id) ON DELETE RESTRICT,
 UNIQUE(program_id,code), UNIQUE(id,program_id)
);
CREATE TABLE academic_periods (
 id INTEGER PRIMARY KEY, institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
 label TEXT NOT NULL, starts_on TEXT NOT NULL, ends_on TEXT NOT NULL,
 archived_at INTEGER, CHECK(starts_on<=ends_on), UNIQUE(institution_id,label), UNIQUE(id,institution_id)
);
CREATE TABLE cohort_periods (
 id INTEGER PRIMARY KEY, cohort_id INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
 period_id INTEGER NOT NULL REFERENCES academic_periods(id) ON DELETE RESTRICT,
 semester_id INTEGER NOT NULL REFERENCES curriculum_semesters(id) ON DELETE RESTRICT,
 state TEXT NOT NULL CHECK(state IN ('planned','active','completed')),
 prepared_at INTEGER NOT NULL DEFAULT (unixepoch()*1000), activated_at INTEGER, completed_at INTEGER,
 UNIQUE(cohort_id,period_id), UNIQUE(id,cohort_id)
);
CREATE UNIQUE INDEX cohort_periods_one_active ON cohort_periods(cohort_id) WHERE state='active';
CREATE TABLE instructors (
 id INTEGER PRIMARY KEY, institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
 name TEXT NOT NULL, archived_at INTEGER, UNIQUE(id,institution_id)
);
CREATE TABLE locations (
 id INTEGER PRIMARY KEY, institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
 name TEXT NOT NULL, campus TEXT, room TEXT, archived_at INTEGER, UNIQUE(id,institution_id)
);
CREATE TABLE offerings (
 id INTEGER PRIMARY KEY, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
 program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
 period_id INTEGER NOT NULL REFERENCES academic_periods(id) ON DELETE RESTRICT,
 shift_id INTEGER REFERENCES shifts(id) ON DELETE RESTRICT,
 instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
 curriculum_subject_id INTEGER, class_group TEXT,
 state TEXT NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','active','completed','cancelled')),
 archived_at INTEGER,
 FOREIGN KEY(curriculum_subject_id,subject_id) REFERENCES curriculum_subjects(id,subject_id) ON DELETE RESTRICT,
 UNIQUE(id,program_id)
);
CREATE TABLE offering_cohorts (
 offering_id INTEGER NOT NULL REFERENCES offerings(id) ON DELETE RESTRICT,
 cohort_id INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
 PRIMARY KEY(offering_id,cohort_id)
);
CREATE TABLE enrollments (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 offering_id INTEGER NOT NULL REFERENCES offerings(id) ON DELETE RESTRICT,
 source TEXT NOT NULL CHECK(source IN ('cohort','exception','repeat')),
 prior_enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE RESTRICT,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000), UNIQUE(user_id,offering_id)
);
CREATE TABLE schedule_slots (
 id INTEGER PRIMARY KEY, offering_id INTEGER NOT NULL REFERENCES offerings(id) ON DELETE RESTRICT,
 location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),
 starts_at_minutes INTEGER NOT NULL CHECK(starts_at_minutes BETWEEN 0 AND 1439),
 ends_at_minutes INTEGER NOT NULL CHECK(ends_at_minutes BETWEEN 1 AND 1440),
 CHECK(starts_at_minutes<ends_at_minutes)
);
CREATE TABLE user_academic_contexts (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
 cohort_id INTEGER NOT NULL, cohort_period_id INTEGER NOT NULL,
 current INTEGER NOT NULL DEFAULT 0 CHECK(current IN (0,1)),
 started_at INTEGER, completed_at INTEGER,
 FOREIGN KEY(cohort_id,program_id) REFERENCES cohorts(id,program_id) ON DELETE RESTRICT,
 FOREIGN KEY(cohort_period_id,cohort_id) REFERENCES cohort_periods(id,cohort_id) ON DELETE RESTRICT,
 UNIQUE(user_id,cohort_period_id)
);
CREATE UNIQUE INDEX user_context_current ON user_academic_contexts(user_id,program_id) WHERE current=1;
CREATE TABLE community_groups (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, archived_at INTEGER
);
CREATE TABLE permission_grants (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 capability TEXT NOT NULL CHECK(capability IN ('manage_academics','manage_cohort','manage_schedule','manage_enrollments','moderate_chat')),
 institution_id INTEGER REFERENCES institutions(id) ON DELETE RESTRICT,
 program_id INTEGER REFERENCES programs(id) ON DELETE RESTRICT,
 cohort_id INTEGER REFERENCES cohorts(id) ON DELETE RESTRICT,
 offering_id INTEGER REFERENCES offerings(id) ON DELETE RESTRICT,
 group_id INTEGER REFERENCES community_groups(id) ON DELETE RESTRICT,
 granted_by_admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000), revoked_at INTEGER,
 CHECK((institution_id IS NOT NULL)+(program_id IS NOT NULL)+(cohort_id IS NOT NULL)+(offering_id IS NOT NULL)+(group_id IS NOT NULL)=1)
);
CREATE UNIQUE INDEX grants_active_unique ON permission_grants(user_id,capability,
 COALESCE(institution_id,-1),COALESCE(program_id,-1),COALESCE(cohort_id,-1),COALESCE(offering_id,-1),COALESCE(group_id,-1)) WHERE revoked_at IS NULL;
CREATE TABLE admin_audit_events (
 id INTEGER PRIMARY KEY,
 actor_admin_id INTEGER REFERENCES admin_accounts(id) ON DELETE RESTRICT,
 actor_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
 action TEXT NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL,
 occurred_at INTEGER NOT NULL DEFAULT (unixepoch()*1000),
 CHECK((actor_admin_id IS NOT NULL) != (actor_user_id IS NOT NULL))
);
CREATE TABLE storage_backends (
 id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('local','google-drive')),
 name TEXT NOT NULL UNIQUE, owner_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
 root_ref TEXT, state TEXT NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','degraded','disabled')),
 CHECK((kind='local' AND owner_user_id IS NULL) OR kind='google-drive')
);
CREATE TABLE storage_objects (
 id INTEGER PRIMARY KEY, backend_id INTEGER NOT NULL REFERENCES storage_backends(id) ON DELETE RESTRICT,
 object_key TEXT NOT NULL UNIQUE, provider_ref TEXT NOT NULL,
 size_bytes INTEGER NOT NULL CHECK(size_bytes>=0), sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000), archived_at INTEGER
);
CREATE TABLE user_classroom_mappings (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 offering_id INTEGER NOT NULL REFERENCES offerings(id) ON DELETE RESTRICT,
 course_id TEXT NOT NULL, course_name TEXT NOT NULL, confirmed_at INTEGER NOT NULL,
 UNIQUE(user_id,offering_id)
);
CREATE TABLE import_runs (
 id INTEGER PRIMARY KEY, source_fingerprint TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('preview','blocked','completed')),
 created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);
CREATE TABLE import_id_map (
 run_id INTEGER NOT NULL REFERENCES import_runs(id) ON DELETE RESTRICT,
 source_table TEXT NOT NULL, source_id INTEGER NOT NULL, target_table TEXT NOT NULL, target_id INTEGER NOT NULL,
 PRIMARY KEY(run_id,source_table,source_id)
);
CREATE TABLE import_review_items (
 id INTEGER PRIMARY KEY, run_id INTEGER NOT NULL REFERENCES import_runs(id) ON DELETE RESTRICT,
 source_table TEXT NOT NULL, source_id INTEGER, reason_code TEXT NOT NULL, resolved_at INTEGER
);
-- Cross-entity invariants also protect direct SQL and future import paths.
CREATE TRIGGER cohorts_shift_institution_insert BEFORE INSERT ON cohorts
WHEN NOT EXISTS (SELECT 1 FROM shifts s JOIN programs p ON p.institution_id=s.institution_id WHERE s.id=NEW.shift_id AND p.id=NEW.program_id)
BEGIN SELECT RAISE(ABORT,'cohort shift/institution mismatch'); END;
CREATE TRIGGER cohort_period_semester_insert BEFORE INSERT ON cohort_periods
WHEN NOT EXISTS (SELECT 1 FROM cohorts c JOIN curriculum_semesters s ON s.curriculum_id=c.curriculum_id WHERE c.id=NEW.cohort_id AND s.id=NEW.semester_id)
BEGIN SELECT RAISE(ABORT,'cohort period/semester mismatch'); END;
CREATE TRIGGER offering_curriculum_insert BEFORE INSERT ON offerings
WHEN NEW.curriculum_subject_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM curriculum_subjects m JOIN curriculum_semesters s ON s.id=m.semester_id JOIN curricula c ON c.id=s.curriculum_id
 WHERE m.id=NEW.curriculum_subject_id AND m.subject_id=NEW.subject_id AND c.program_id=NEW.program_id)
BEGIN SELECT RAISE(ABORT,'offering curriculum mismatch'); END;
CREATE TRIGGER offering_shift_insert BEFORE INSERT ON offerings
WHEN NEW.shift_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shifts s JOIN programs p ON p.institution_id=s.institution_id WHERE s.id=NEW.shift_id AND p.id=NEW.program_id)
BEGIN SELECT RAISE(ABORT,'offering shift mismatch'); END;
CREATE TRIGGER offering_cohort_program_insert BEFORE INSERT ON offering_cohorts
WHEN NOT EXISTS (SELECT 1 FROM offerings o JOIN cohorts c ON c.program_id=o.program_id WHERE o.id=NEW.offering_id AND c.id=NEW.cohort_id)
BEGIN SELECT RAISE(ABORT,'offering/cohort mismatch'); END;
CREATE TRIGGER cohorts_shift_institution_update BEFORE UPDATE OF program_id,curriculum_id,shift_id ON cohorts
WHEN NOT EXISTS (SELECT 1 FROM shifts s JOIN programs p ON p.institution_id=s.institution_id WHERE s.id=NEW.shift_id AND p.id=NEW.program_id)
BEGIN SELECT RAISE(ABORT,'cohort shift/institution mismatch'); END;
CREATE TRIGGER cohort_period_semester_update BEFORE UPDATE OF cohort_id,semester_id ON cohort_periods
WHEN NOT EXISTS (SELECT 1 FROM cohorts c JOIN curriculum_semesters s ON s.curriculum_id=c.curriculum_id WHERE c.id=NEW.cohort_id AND s.id=NEW.semester_id)
BEGIN SELECT RAISE(ABORT,'cohort period/semester mismatch'); END;
CREATE TRIGGER offering_curriculum_update BEFORE UPDATE OF subject_id,program_id,curriculum_subject_id ON offerings
WHEN NEW.curriculum_subject_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM curriculum_subjects m JOIN curriculum_semesters s ON s.id=m.semester_id JOIN curricula c ON c.id=s.curriculum_id
 WHERE m.id=NEW.curriculum_subject_id AND m.subject_id=NEW.subject_id AND c.program_id=NEW.program_id)
BEGIN SELECT RAISE(ABORT,'offering curriculum mismatch'); END;
CREATE TRIGGER offering_shift_update BEFORE UPDATE OF shift_id,program_id ON offerings
WHEN NEW.shift_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shifts s JOIN programs p ON p.institution_id=s.institution_id WHERE s.id=NEW.shift_id AND p.id=NEW.program_id)
BEGIN SELECT RAISE(ABORT,'offering shift mismatch'); END;
CREATE TRIGGER offering_cohort_program_update BEFORE UPDATE OF offering_id,cohort_id ON offering_cohorts
WHEN NOT EXISTS (SELECT 1 FROM offerings o JOIN cohorts c ON c.program_id=o.program_id WHERE o.id=NEW.offering_id AND c.id=NEW.cohort_id)
BEGIN SELECT RAISE(ABORT,'offering/cohort mismatch'); END;
