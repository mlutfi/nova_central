import { getDatabase } from '../config/database.js';

export interface BackupJob {
  id: number;
  type: 'manual' | 'scheduled' | 'watcher';
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  source_path: string;
  files_total: number;
  files_synced: number;
  files_failed: number;
  bytes_transferred: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export const BackupModel = {
  create(type: BackupJob['type'], sourcePath: string): BackupJob {
    const db = getDatabase();
    const stmt = db.prepare(
      'INSERT INTO backup_jobs (type, status, source_path) VALUES (?, ?, ?)'
    );
    const result = stmt.run(type, 'running', sourcePath);
    return this.findById(result.lastInsertRowid as number)!;
  },

  findById(id: number): BackupJob | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM backup_jobs WHERE id = ?').get(id) as BackupJob | undefined;
  },

  findAll(limit: number = 50, offset: number = 0, type?: string, status?: string): BackupJob[] {
    const db = getDatabase();
    if (type && status) {
      return db.prepare(
        'SELECT * FROM backup_jobs WHERE type = ? AND status = ? ORDER BY started_at DESC LIMIT ? OFFSET ?'
      ).all(type, status, limit, offset) as BackupJob[];
    }
    if (type) {
      return db.prepare(
        'SELECT * FROM backup_jobs WHERE type = ? ORDER BY started_at DESC LIMIT ? OFFSET ?'
      ).all(type, limit, offset) as BackupJob[];
    }
    if (status) {
      return db.prepare(
        'SELECT * FROM backup_jobs WHERE status = ? ORDER BY started_at DESC LIMIT ? OFFSET ?'
      ).all(status, limit, offset) as BackupJob[];
    }
    return db.prepare(
      'SELECT * FROM backup_jobs ORDER BY started_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset) as BackupJob[];
  },

  getRunning(): BackupJob | undefined {
    const db = getDatabase();
    return db.prepare(
      "SELECT * FROM backup_jobs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1"
    ).get() as BackupJob | undefined;
  },

  updateProgress(id: number, synced: number, failed: number, bytes: number, total: number): void {
    const db = getDatabase();
    db.prepare(
      'UPDATE backup_jobs SET files_synced = ?, files_failed = ?, bytes_transferred = ?, files_total = ? WHERE id = ?'
    ).run(synced, failed, bytes, total, id);
  },

  complete(id: number): void {
    const db = getDatabase();
    db.prepare(
      "UPDATE backup_jobs SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(id);
  },

  fail(id: number, errorMessage: string): void {
    const db = getDatabase();
    db.prepare(
      "UPDATE backup_jobs SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(errorMessage, id);
  },

  cancel(id: number): void {
    const db = getDatabase();
    db.prepare(
      "UPDATE backup_jobs SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(id);
  },

  cancelAll(): number {
    const db = getDatabase();
    const result = db.prepare(
      "UPDATE backup_jobs SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE status = 'running'"
    ).run();
    return result.changes;
  },

  cleanupStaleJobs(): number {
    const db = getDatabase();
    const result = db.prepare(
      "UPDATE backup_jobs SET status = 'failed', error_message = 'Interrupted by server restart', completed_at = CURRENT_TIMESTAMP WHERE status = 'running'"
    ).run();
    return result.changes;
  },

  getStats() {
    const db = getDatabase();
    const total = db.prepare('SELECT COUNT(*) as count FROM backup_jobs').get() as { count: number };
    const completed = db.prepare("SELECT COUNT(*) as count FROM backup_jobs WHERE status = 'completed'").get() as { count: number };
    const failed = db.prepare("SELECT COUNT(*) as count FROM backup_jobs WHERE status = 'failed'").get() as { count: number };
    const running = db.prepare("SELECT COUNT(*) as count FROM backup_jobs WHERE status = 'running'").get() as { count: number };
    const lastBackup = db.prepare(
      "SELECT * FROM backup_jobs WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1"
    ).get() as BackupJob | undefined;
    const totalBytes = db.prepare(
      'SELECT COALESCE(SUM(bytes_transferred), 0) as total FROM backup_jobs'
    ).get() as { total: number };

    return {
      total: total.count,
      completed: completed.count,
      failed: failed.count,
      running: running.count,
      lastBackup,
      totalBytesTransferred: totalBytes.total,
    };
  },

  count(type?: string, status?: string): number {
    const db = getDatabase();
    if (type && status) {
      const result = db.prepare('SELECT COUNT(*) as count FROM backup_jobs WHERE type = ? AND status = ?').get(type, status) as { count: number };
      return result.count;
    }
    if (type) {
      const result = db.prepare('SELECT COUNT(*) as count FROM backup_jobs WHERE type = ?').get(type) as { count: number };
      return result.count;
    }
    if (status) {
      const result = db.prepare('SELECT COUNT(*) as count FROM backup_jobs WHERE status = ?').get(status) as { count: number };
      return result.count;
    }
    const result = db.prepare('SELECT COUNT(*) as count FROM backup_jobs').get() as { count: number };
    return result.count;
  },
};
