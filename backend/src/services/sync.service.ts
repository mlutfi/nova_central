import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { BackupModel } from '../models/backup.model.js';
import { FileRecordModel } from '../models/file-record.model.js';
import { SettingsModel } from '../models/settings.model.js';
import { GDriveService } from './gdrive.service.js';
import { computeFileHash } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import { getDatabase } from '../config/database.js';

export interface SyncProgress {
  jobId: number;
  total: number;
  synced: number;
  failed: number;
  bytesTransferred: number;
  currentFile: string;
}

export class SyncService extends EventEmitter {
  private gdrive: GDriveService;
  private isCancelled = false;
  private isRunning = false;

  constructor(gdrive: GDriveService) {
    super();
    this.gdrive = gdrive;
  }

  get running(): boolean {
    return this.isRunning;
  }

  cancelSync(): void {
    this.isCancelled = true;
    logger.info('Sync cancellation requested');
  }

  /**
   * Run a full sync from source folder to Google Drive.
   */
  async runSync(jobId: number, sourcePath: string): Promise<void> {
    if (this.isRunning) {
      throw new Error('Sync is already running');
    }

    this.isRunning = true;
    this.isCancelled = false;

    const driveFolderId = SettingsModel.get('drive_folder_id');
    if (!driveFolderId) {
      BackupModel.fail(jobId, 'Google Drive folder ID is not configured');
      this.isRunning = false;
      return;
    }

    if (!this.gdrive.isInitialized()) {
      BackupModel.fail(jobId, 'Google Drive client is not initialized');
      this.isRunning = false;
      return;
    }

    try {
      const rawPaths = sourcePath.split('\n').map(p => p.trim()).filter(Boolean);
      const validPaths: string[] = [];

      for (const p of rawPaths) {
        const normalized = path.resolve(p);
        if (fs.existsSync(normalized)) {
          validPaths.push(normalized);
        } else {
          logger.warn(`Source path does not exist and will be skipped: ${normalized}`);
        }
      }

      if (validPaths.length === 0) {
        BackupModel.fail(jobId, `No valid source paths found`);
        this.isRunning = false;
        return;
      }

      // Scan all files recursively
      const files: { filePath: string, sourceRoot: string }[] = [];
      for (const p of validPaths) {
        const scanned = this.scanDirectory(p);
        files.push(...scanned.map(filePath => ({ filePath, sourceRoot: p })));
      }
      const total = files.length;

      BackupModel.updateProgress(jobId, 0, 0, 0, total);
      logger.info(`Sync started: ${total} files found in ${validPaths.join(', ')}`);

      let synced = 0;
      let failed = 0;
      let bytesTransferred = 0;

      // Build folder structure map for Drive
      const folderMap = new Map<string, string>();
      folderMap.set('', driveFolderId);

      for (const { filePath, sourceRoot } of files) {
        if (this.isCancelled) {
          BackupModel.cancel(jobId);
          logger.info('Sync cancelled by user');
          this.isRunning = false;
          return;
        }

        try {
          const relativeToRoot = path.relative(sourceRoot, filePath);
          const rootBaseName = path.basename(sourceRoot);
          const relativePath = validPaths.length > 1 ? path.join(rootBaseName, relativeToRoot) : relativeToRoot;
          const relativeDir = path.dirname(relativePath);

          // Ensure folder structure exists on Drive
          const parentId = await this.ensureDriveFolders(
            relativeDir,
            driveFolderId,
            folderMap
          );

          // Check if file needs syncing
          const stat = fs.statSync(filePath);
          const fileHash = await computeFileHash(filePath);
          const existingRecord = FileRecordModel.findByPath(filePath);

          let isDeletedOnDrive = false;
          if (existingRecord?.drive_file_id && SettingsModel.get('backup_delete_local') === 'true') {
            try {
              const meta = await this.gdrive.getFileMetadata(existingRecord.drive_file_id);
              if (!meta) {
                isDeletedOnDrive = true;
              }
            } catch (err: any) {
              logger.error(`Failed to check metadata for ${filePath} on Drive: ${err.message || err}`);
            }
          }

          if (isDeletedOnDrive) {
            try {
              fs.unlinkSync(filePath);
              FileRecordModel.markDeleted(filePath);
              logger.info(`Deleted local file because it was deleted on Drive: ${filePath}`);
              synced++;
              BackupModel.updateProgress(jobId, synced, failed, bytesTransferred, total);
              continue;
            } catch (err: any) {
              logger.error(`Failed to delete local file ${filePath}: ${err.message || err}`);
              failed++;
              BackupModel.updateProgress(jobId, synced, failed, bytesTransferred, total);
              continue;
            }
          }

          if (
            existingRecord &&
            existingRecord.file_hash === fileHash &&
            existingRecord.status === 'synced' &&
            existingRecord.drive_file_id
          ) {
            // File hasn't changed, skip
            synced++;
            BackupModel.updateProgress(jobId, synced, failed, bytesTransferred, total);
            continue;
          }

          // Upload or update
          let driveResult;
          if (existingRecord?.drive_file_id) {
            driveResult = await this.gdrive.updateFile(existingRecord.drive_file_id, filePath);
            if (!driveResult) {
              // File was deleted from Drive, re-upload
              driveResult = await this.gdrive.uploadFile(filePath, parentId);
            }
          } else {
            driveResult = await this.gdrive.uploadFile(filePath, parentId);
          }

          if (driveResult) {
            FileRecordModel.upsert({
              localPath: filePath,
              driveFileId: driveResult.id,
              driveParentId: parentId,
              fileHash,
              fileSize: stat.size,
              lastModified: stat.mtime.toISOString(),
              status: 'synced',
            });

            bytesTransferred += stat.size;
            synced++;
          } else {
            failed++;
            FileRecordModel.markError(filePath);
          }

          // Emit progress
          const progress: SyncProgress = {
            jobId,
            total,
            synced,
            failed,
            bytesTransferred,
            currentFile: relativePath,
          };
          this.emit('progress', progress);
          BackupModel.updateProgress(jobId, synced, failed, bytesTransferred, total);
        } catch (fileError: any) {
          failed++;
          FileRecordModel.upsert({
            localPath: filePath,
            status: 'error',
          });
          logger.error(`Failed to sync file ${filePath}: ${fileError.message || fileError}`);
          BackupModel.updateProgress(jobId, synced, failed, bytesTransferred, total);
        }
      }

      // Sync local deletions to Drive (if enabled) and update database status
      try {
        const db = getDatabase();
        const records = db.prepare("SELECT * FROM file_records WHERE status != 'deleted'").all() as any[];
        const deleteFromDrive = SettingsModel.get('backup_delete_on_drive') === 'true';

        for (const record of records) {
          if (this.isCancelled) {
            break;
          }
          const belongsToSource = validPaths.some(p => record.local_path.startsWith(p));
          if (belongsToSource) {
            if (!fs.existsSync(record.local_path)) {
              if (record.drive_file_id && deleteFromDrive) {
                try {
                  await this.gdrive.deleteFile(record.drive_file_id);
                  logger.info(`Backup cleanup: deleted from Drive: ${record.local_path}`);
                } catch (error: any) {
                  logger.error(`Failed to delete from Drive during backup cleanup: ${record.local_path}: ${error.message || error}`);
                }
              }
              FileRecordModel.markDeleted(record.local_path);
            }
          }
        }
      } catch (cleanupError: any) {
        logger.error(`Failed to execute backup deletion cleanup: ${cleanupError.message || cleanupError}`);
      }

      // Mark job as completed
      BackupModel.complete(jobId);
      logger.info(`Sync completed: ${synced} synced, ${failed} failed out of ${total}`);
      this.emit('complete', { jobId, synced, failed, total, bytesTransferred });
    } catch (error: any) {
      BackupModel.fail(jobId, error.message);
      logger.error(`Sync failed:`, error);
      this.emit('error', { jobId, error: error.message });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync a single file (used by file watcher).
   */
  async syncSingleFile(filePath: string): Promise<void> {
    const driveFolderId = SettingsModel.get('drive_folder_id');
    const sourcePath = SettingsModel.get('source_path');

    if (!driveFolderId || !sourcePath || !this.gdrive.isInitialized()) {
      return;
    }

    try {
      const rawPaths = sourcePath.split('\n').map(p => p.trim()).filter(Boolean);
      const validPaths = rawPaths.map(p => path.resolve(p)).filter(p => fs.existsSync(p));
      
      let sourceRoot = '';
      for (const p of validPaths) {
        if (filePath.startsWith(p)) {
          sourceRoot = p;
          break;
        }
      }

      if (!sourceRoot) {
        logger.error(`Watcher sync failed: file ${filePath} does not belong to any valid source path`);
        return;
      }

      const relativeToRoot = path.relative(sourceRoot, filePath);
      const rootBaseName = path.basename(sourceRoot);
      const relativePath = validPaths.length > 1 ? path.join(rootBaseName, relativeToRoot) : relativeToRoot;
      const relativeDir = path.dirname(relativePath);

      // Build folder on Drive
      const folderMap = new Map<string, string>();
      folderMap.set('', driveFolderId);
      const parentId = await this.ensureDriveFolders(relativeDir, driveFolderId, folderMap);

      const stat = fs.statSync(filePath);
      const fileHash = await computeFileHash(filePath);
      const existingRecord = FileRecordModel.findByPath(filePath);

      if (existingRecord?.file_hash === fileHash && existingRecord.status === 'synced') {
        return; // No changes
      }

      let driveResult;
      if (existingRecord?.drive_file_id) {
        driveResult = await this.gdrive.updateFile(existingRecord.drive_file_id, filePath);
        if (!driveResult) {
          driveResult = await this.gdrive.uploadFile(filePath, parentId);
        }
      } else {
        driveResult = await this.gdrive.uploadFile(filePath, parentId);
      }

      if (driveResult) {
        FileRecordModel.upsert({
          localPath: filePath,
          driveFileId: driveResult.id,
          driveParentId: parentId,
          fileHash,
          fileSize: stat.size,
          lastModified: stat.mtime.toISOString(),
          status: 'synced',
        });
        logger.debug(`Watcher synced: ${relativePath}`);
      }
    } catch (error: any) {
      logger.error(`Watcher sync failed for ${filePath}: ${error.message || error}`);
      FileRecordModel.markError(filePath);
    }
  }

  /**
   * Handle file deletion (from watcher).
   */
  async handleFileDeletion(filePath: string): Promise<void> {
    const deleteFromDrive = SettingsModel.get('watcher_delete_on_drive') === 'true';
    const record = FileRecordModel.findByPath(filePath);

    if (record?.drive_file_id && deleteFromDrive) {
      try {
        await this.gdrive.deleteFile(record.drive_file_id);
      } catch (error: any) {
        logger.error(`Failed to delete from Drive: ${filePath}: ${error.message || error}`);
      }
    }

    FileRecordModel.markDeleted(filePath);
    logger.debug(`File deleted: ${filePath}`);
  }

  /**
   * Recursively scan a directory and return all file paths.
   */
  private scanDirectory(dirPath: string): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip hidden files/folders and common exclusions
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        try {
          if (entry.isDirectory()) {
            files.push(...this.scanDirectory(fullPath));
          } else if (entry.isFile()) {
            files.push(fullPath);
          }
        } catch (innerError: any) {
          logger.warn(`Skipping path ${fullPath} due to error: ${innerError.message || innerError}`);
        }
      }
    } catch (error: any) {
      logger.warn(`Skipping directory ${dirPath} due to read error: ${error.message || error}`);
    }

    return files;
  }

  /**
   * Ensure all intermediate folders exist on Google Drive.
   */
  private async ensureDriveFolders(
    relativeDirPath: string,
    rootFolderId: string,
    folderMap: Map<string, string>
  ): Promise<string> {
    if (relativeDirPath === '.' || relativeDirPath === '') {
      return rootFolderId;
    }

    // Normalize path separators
    const normalizedPath = relativeDirPath.split(path.sep).join('/');

    if (folderMap.has(normalizedPath)) {
      return folderMap.get(normalizedPath)!;
    }

    const parts = normalizedPath.split('/');
    let currentParentId = rootFolderId;

    for (let i = 0; i < parts.length; i++) {
      const partialPath = parts.slice(0, i + 1).join('/');

      if (folderMap.has(partialPath)) {
        currentParentId = folderMap.get(partialPath)!;
      } else {
        const folderId = await this.gdrive.createFolder(parts[i], currentParentId);
        folderMap.set(partialPath, folderId);
        currentParentId = folderId;
      }
    }

    return currentParentId;
  }
}
