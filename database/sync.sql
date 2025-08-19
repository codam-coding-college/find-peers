PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE sync(
		last_pull	timestamp,
	);
COMMIT;