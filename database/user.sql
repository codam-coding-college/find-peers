PRAGMA foreign_keys=ON;
BEGIN TRANSACTION;
CREATE TABLE user(
		id					INT PRIMARY KEY,
		login				UNIQUE text,
		primary_campus_id	integer,
		image_url			text,
		anonymize_date		timestamp,
		FOREIGN KEY (primary_campus_id) REFERENCES campus(id)
	);
COMMIT;
