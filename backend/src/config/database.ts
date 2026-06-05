import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Wrapper around sql.js to provide a better-sqlite3-like API.
 * sql.js is pure JavaScript/WASM, no native compilation needed.
 */
export class Database {
  private db: SqlJsDatabase;
  private dbPath: string;
  private saveInterval: ReturnType<typeof setInterval> | null = null;

  private constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;

    // Auto-save to disk every 5 seconds if there are changes
    this.saveInterval = setInterval(() => {
      this.saveToDisk();
    }, 5000);
  }

  static async create(dbPath: string): Promise<Database> {
    const SQL = await initSqlJs();
    const resolvedPath = path.resolve(dbPath);
    const dbDir = path.dirname(resolvedPath);

    // Ensure data directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    let db: SqlJsDatabase;
    if (fs.existsSync(resolvedPath)) {
      const buffer = fs.readFileSync(resolvedPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    // Enable WAL mode and foreign keys
    db.run('PRAGMA journal_mode = WAL;');
    db.run('PRAGMA foreign_keys = ON;');

    const instance = new Database(db, resolvedPath);
    return instance;
  }

  /**
   * Prepare a statement and return an object with get/all/run methods
   * (mimics better-sqlite3 API).
   */
  prepare(sql: string) {
    const db = this.db;

    return {
      /**
       * Execute query and return first row as object.
       */
      get(...params: any[]): any {
        try {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          if (stmt.step()) {
            const columns = stmt.getColumnNames();
            const values = stmt.get();
            const row: Record<string, any> = {};
            for (let i = 0; i < columns.length; i++) {
              row[columns[i]] = values[i];
            }
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (error) {
          throw error;
        }
      },

      /**
       * Execute query and return all rows as array of objects.
       */
      all(...params: any[]): any[] {
        try {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          const results: Record<string, any>[] = [];
          while (stmt.step()) {
            const columns = stmt.getColumnNames();
            const values = stmt.get();
            const row: Record<string, any> = {};
            for (let i = 0; i < columns.length; i++) {
              row[columns[i]] = values[i];
            }
            results.push(row);
          }
          stmt.free();
          return results;
        } catch (error) {
          throw error;
        }
      },

      /**
       * Execute a statement (INSERT/UPDATE/DELETE) and return run result.
       */
      run(...params: any[]): { changes: number; lastInsertRowid: number } {
        try {
          db.run(sql, params);
          // Get last insert rowid and changes
          const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
          const changesResult = db.exec('SELECT changes() as changes');
          const lastInsertRowid = lastIdResult[0]?.values[0]?.[0] as number ?? 0;
          const changes = changesResult[0]?.values[0]?.[0] as number ?? 0;
          return { changes, lastInsertRowid };
        } catch (error) {
          throw error;
        }
      },
    };
  }

  /**
   * Execute raw SQL (for DDL, multiple statements).
   */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Execute a pragma statement.
   */
  pragma(statement: string): void {
    this.db.run(`PRAGMA ${statement};`);
  }

  /**
   * Create a transaction wrapper.
   */
  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]) => {
      this.db.run('BEGIN TRANSACTION;');
      try {
        const result = fn(...args);
        this.db.run('COMMIT;');
        return result;
      } catch (error) {
        this.db.run('ROLLBACK;');
        throw error;
      }
    };
  }

  /**
   * Save database to disk.
   */
  saveToDisk(): void {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (error) {
      logger.error('Failed to save database to disk:', error);
    }
  }

  /**
   * Close database and save to disk.
   */
  close(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    this.saveToDisk();
    this.db.close();
    logger.info('Database connection closed');
  }
}

// ─── Singleton ───
let dbInstance: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.create(env.DATABASE_PATH);
    runMigrations(dbInstance);
    logger.info('Database initialized successfully');
  }
  return dbInstance;
}

export function getDatabase(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      must_change_password INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS backup_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('manual', 'scheduled', 'watcher')),
      status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
      source_path TEXT NOT NULL,
      files_total INTEGER DEFAULT 0,
      files_synced INTEGER DEFAULT 0,
      files_failed INTEGER DEFAULT 0,
      bytes_transferred INTEGER DEFAULT 0,
      error_message TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS file_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_path TEXT UNIQUE NOT NULL,
      drive_file_id TEXT,
      drive_parent_id TEXT,
      file_hash TEXT,
      file_size INTEGER,
      last_modified DATETIME,
      last_synced DATETIME,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'deleted', 'error'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
      progress INTEGER DEFAULT 0,
      result TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Create indexes separately (sql.js handles these fine in separate exec)
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_file_records_status ON file_records(status);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_file_records_local_path ON file_records(local_path);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_backup_jobs_status ON backup_jobs(status);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);');
    // Migration: add must_change_password column if it doesn't exist (for existing DBs)
    try {
      db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;');
    } catch {
      // Column already exists — ignore
    }
    // Migration: add verbose_log column to tasks for detailed transfer progress
    try {
      db.exec("ALTER TABLE tasks ADD COLUMN verbose_log TEXT DEFAULT '[]';");
    } catch {
      // Column already exists — ignore
    }
  } catch {
    // Indexes may already exist
  }

  db.saveToDisk();
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
