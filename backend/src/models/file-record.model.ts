import { getDatabase } from '../config/database.js';

export interface FileRecord {
  id: number;
  local_path: string;
  drive_file_id: string | null;
  drive_parent_id: string | null;
  file_hash: string | null;
  file_size: number | null;
  last_modified: string | null;
  last_synced: string | null;
  status: 'pending' | 'synced' | 'deleted' | 'error';
}

export const FileRecordModel = {
  findByPath(localPath: string): FileRecord | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM file_records WHERE local_path = ?').get(localPath) as FileRecord | undefined;
  },

  upsert(record: {
    localPath: string;
    driveFileId?: string;
    driveParentId?: string;
    fileHash?: string;
    fileSize?: number;
    lastModified?: string;
    status?: FileRecord['status'];
  }): void {
    const db = getDatabase();
    const existing = this.findByPath(record.localPath);

    if (existing) {
      db.prepare(`
        UPDATE file_records
        SET drive_file_id = COALESCE(?, drive_file_id),
            drive_parent_id = COALESCE(?, drive_parent_id),
            file_hash = COALESCE(?, file_hash),
            file_size = COALESCE(?, file_size),
            last_modified = COALESCE(?, last_modified),
            last_synced = CURRENT_TIMESTAMP,
            status = COALESCE(?, status)
        WHERE local_path = ?
      `).run(
        record.driveFileId ?? null,
        record.driveParentId ?? null,
        record.fileHash ?? null,
        record.fileSize ?? null,
        record.lastModified ?? null,
        record.status ?? null,
        record.localPath
      );
    } else {
      db.prepare(`
        INSERT INTO file_records (local_path, drive_file_id, drive_parent_id, file_hash, file_size, last_modified, last_synced, status)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).run(
        record.localPath,
        record.driveFileId ?? null,
        record.driveParentId ?? null,
        record.fileHash ?? null,
        record.fileSize ?? null,
        record.lastModified ?? null,
        record.status ?? 'pending'
      );
    }
  },

  markDeleted(localPath: string): void {
    const db = getDatabase();
    db.prepare("UPDATE file_records SET status = 'deleted' WHERE local_path = ?").run(localPath);
  },

  markError(localPath: string): void {
    const db = getDatabase();
    db.prepare("UPDATE file_records SET status = 'error' WHERE local_path = ?").run(localPath);
  },

  getPending(limit: number = 100): FileRecord[] {
    const db = getDatabase();
    return db.prepare(
      "SELECT * FROM file_records WHERE status = 'pending' LIMIT ?"
    ).all(limit) as FileRecord[];
  },

  getSynced(): FileRecord[] {
    const db = getDatabase();
    return db.prepare("SELECT * FROM file_records WHERE status = 'synced'").all() as FileRecord[];
  },

  getStats() {
    const db = getDatabase();
    const total = db.prepare('SELECT COUNT(*) as count FROM file_records').get() as { count: number };
    const synced = db.prepare("SELECT COUNT(*) as count FROM file_records WHERE status = 'synced'").get() as { count: number };
    const pending = db.prepare("SELECT COUNT(*) as count FROM file_records WHERE status = 'pending'").get() as { count: number };
    const errors = db.prepare("SELECT COUNT(*) as count FROM file_records WHERE status = 'error'").get() as { count: number };
    const totalSize = db.prepare(
      "SELECT COALESCE(SUM(file_size), 0) as total FROM file_records WHERE status = 'synced'"
    ).get() as { total: number };

    return {
      total: total.count,
      synced: synced.count,
      pending: pending.count,
      errors: errors.count,
      totalSyncedBytes: totalSize.total,
    };
  },

  deleteByPath(localPath: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM file_records WHERE local_path = ?').run(localPath);
  },
};
