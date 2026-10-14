-- Additive follow-up: 0025 was already applied by the local preview.
ALTER TABLE legacy_offering_links ALTER COLUMN linked_by_admin_id DROP NOT NULL;
ALTER TABLE legacy_offering_links ADD COLUMN link_source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE academic_projection_state ADD COLUMN instance_id TEXT NOT NULL DEFAULT '';
UPDATE academic_projection_state SET instance_id=lower(hex(randomblob(16))) WHERE id=1;
CREATE TRIGGER projection_curricula_insert AFTER INSERT ON curricula BEGIN UPDATE academic_projection_state SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER projection_curricula_update AFTER UPDATE ON curricula BEGIN UPDATE academic_projection_state SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER projection_curricula_delete AFTER DELETE ON curricula BEGIN UPDATE academic_projection_state SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER projection_curriculum_subjects_insert AFTER INSERT ON curriculum_subjects BEGIN UPDATE academic_projection_state SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER projection_curriculum_subjects_update AFTER UPDATE ON curriculum_subjects BEGIN UPDATE academic_projection_state SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER projection_curriculum_subjects_delete AFTER DELETE ON curriculum_subjects BEGIN UPDATE academic_projection_state SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER projection_curriculum_semesters_insert AFTER INSERT ON curriculum_semesters BEGIN UPDATE academic_projection_state SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER projection_curriculum_semesters_update AFTER UPDATE ON curriculum_semesters BEGIN UPDATE academic_projection_state SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER projection_curriculum_semesters_delete AFTER DELETE ON curriculum_semesters BEGIN UPDATE academic_projection_state SET revision=revision+1 WHERE id=1; END;
