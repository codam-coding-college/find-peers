PRAGMA foreign_keys=ON;
BEGIN TRANSACTION;
CREATE TABLE project_user(
		project_id		integer,
		user_id			integer,
		created_at		timestamp,
		updated_at		timestamp,
		validated_at	timestamp,
		status			text,
		PRIMARY KEY (project_id, user_id),
		FOREIGN KEY (user_id) REFERENCES user(id),
		FOREIGN KEY (project_id) REFERENCES project(id)
	);
COMMIT;
