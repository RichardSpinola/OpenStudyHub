ALTER TABLE programs ADD COLUMN short_name TEXT;
UPDATE programs SET short_name=code WHERE short_name IS NULL OR trim(short_name)='';
