import { getDatabase } from '../config/database.js';

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

const DEFAULTS: Record<string, string> = {
  source_path: '/home/user/backup-source',
  file_manager_path: '/home/user/file-manager',
  drive_folder_id: '',
  backup_schedule: '0 */6 * * *',
  auto_backup_enabled: 'false',
  file_watcher_enabled: 'false',
  delete_on_drive_when_deleted: 'false',
  max_concurrent_uploads: '3',
  app_name: 'Nova Central',
  timezone: 'UTC',
  exclude_patterns: '*.log\n*.tmp\n*.cache\n.DS_Store\nThumbs.db\nnode_modules/**\n.git/**',
  max_file_size_mb: '0',
  google_client_id: '',
  google_client_secret: '',
  google_redirect_uri: 'http://localhost:4300/dashboard/settings',
  google_refresh_token: '',
};

export const SettingsModel = {
  get(key: string): string {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? DEFAULTS[key] ?? '';
  },

  set(key: string, value: string): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, value);
  },

  getAll(): Record<string, string> {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM settings').all() as Setting[];
    const settings: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  },

  setMultiple(entries: Record<string, string>): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    const transaction = db.transaction((entries: Record<string, string>) => {
      for (const [key, value] of Object.entries(entries)) {
        stmt.run(key, value);
      }
    });
    transaction(entries);
  },

  initDefaults(): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
    `);
    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(DEFAULTS)) {
        stmt.run(key, value);
      }
    });
    transaction();
  },
};
