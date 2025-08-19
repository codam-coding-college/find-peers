PRAGMA foreign_keys=ON;
BEGIN TRANSACTION;
CREATE TABLE project(
		id		INT PRIMARY KEY,
		slug	text,
		name	text
	);
COMMIT;
