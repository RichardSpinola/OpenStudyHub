CREATE TABLE note_images (
 id text PRIMARY KEY NOT NULL,
 data blob NOT NULL,
 mime_type text NOT NULL,
 width integer NOT NULL,
 height integer NOT NULL,
 created_at integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE note_image_refs (
 note_id integer NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
 image_id text NOT NULL REFERENCES note_images(id) ON DELETE CASCADE,
 PRIMARY KEY(note_id, image_id)
);
--> statement-breakpoint
CREATE INDEX note_image_refs_image ON note_image_refs(image_id);
--> statement-breakpoint
CREATE TRIGGER note_image_refs_cleanup AFTER DELETE ON note_image_refs
BEGIN
 DELETE FROM note_images WHERE id=OLD.image_id AND NOT EXISTS (SELECT 1 FROM note_image_refs WHERE image_id=OLD.image_id);
END;
