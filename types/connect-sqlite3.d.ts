// Type stub for connect-sqlite3
declare module 'connect-sqlite3' {
  import * as session from 'express-session';
  
  interface SqliteStoreOptions {
    db?: string;
    dir?: string;
    table?: string;
    ttl?: number;
    prefix?: string;
    concurrentDB?: boolean;
  }

  interface SqliteStore extends session.Store {
    new (options?: SqliteStoreOptions): SqliteStore;
  }

  function connectSqlite3(session: any): { new (options?: SqliteStoreOptions): session.Store };
  
  export = connectSqlite3;
}
