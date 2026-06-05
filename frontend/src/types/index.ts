// ─── File Manager Types ───────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  id: string;
}

export interface LocalFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  extension: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  isFolder: boolean;
}

export type FileItem =
  | ({ source: 'local' } & LocalFile)
  | ({ source: 'drive' } & DriveFile);

// ─── Transfer / Task Types ────────────────────────────────────────────────────

export interface VerboseLogEntry {
  type: 'scan' | 'info' | 'folder' | 'upload' | 'done' | 'error' | 'skip';
  message: string;
  file?: string;
  size?: number;
  status?: 'uploading' | 'done' | 'error' | 'skipped';
  ts: string;
}

export interface TransferItem {
  id: string;
  fileName: string;
  type: 'upload' | 'download';
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  error?: string;
  bytesTransferred?: number;
  totalBytes?: number;
  // Verbose folder upload fields
  isFolder?: boolean;
  totalFiles?: number;
  uploadedFiles?: number;
  totalSize?: number;
  uploadedSize?: number;
  currentFile?: string;
  verboseLog?: VerboseLogEntry[];
}

// ─── Backup / Dashboard Types ─────────────────────────────────────────────────

export interface BackupJob {
  id: number;
  type: string;
  status: string;
  files_synced: number;
  files_total: number;
  bytes_transferred: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface FileStats {
  total: number;
  synced: number;
  pending: number;
  errors: number;
  totalSyncedBytes: number;
}

export interface BackupStats {
  lastBackup: { completed_at: string | null } | null;
  completed: number;
  failed: number;
  totalBytesTransferred: number;
}

export interface DashboardStats {
  fileStats: FileStats;
  backupStats: BackupStats;
  settings: { sourcePath: string };
}

export interface BackupStatus {
  isRunning: boolean;
  autoBackupEnabled: boolean;
  fileWatcherEnabled: boolean;
  currentJob: BackupJob | null;
  fileStats: FileStats;
  serverTime: string;
}

// ─── Log Types ────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: number;
  type: string;
  status: string;
  sourcePath: string;
  filesTotal: number;
  filesSynced: number;
  filesFailed: number;
  bytesTransferred: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  username: string;
  ip_address: string | null;
  details: string | null;
  created_at: string;
}

export interface PaginationMeta {
  page: number;
  totalPages: number;
  total: number;
}

// ─── Settings Types ───────────────────────────────────────────────────────────

export interface AppSettings {
  source_path?: string;
  file_manager_path?: string;
  google_client_id?: string;
  google_client_secret?: string;
  google_redirect_uri?: string;
  google_refresh_token?: string;
  drive_folder_id?: string;
  backup_schedule?: string;
  max_concurrent_uploads?: string;
  exclude_patterns?: string;
  max_file_size_mb?: string;
  auto_backup_enabled?: string;
  file_watcher_enabled?: string;
  [key: string]: string | undefined;
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  role: string;
  must_change_password: number;
  created_at: string;
}
