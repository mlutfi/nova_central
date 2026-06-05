import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { getDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { GDriveService } from './gdrive.service.js';
import fs from 'fs';
import path from 'path';

// ─── Types ───

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'COMPLETED_WITH_ERRORS';

export interface TaskRecord {
  id: string;
  type: 'UPLOAD' | 'DOWNLOAD';
  payload: string; // JSON string
  status: TaskStatus;
  progress: number; // 0 to 100
  result: string | null;
  error_message: string | null;
  verbose_log: string; // JSON array of VerboseLogEntry
  completed_files: string; // JSON array of completed relative paths
  failed_files: string; // JSON array of { path, error }
  last_checkpoint: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerboseLogEntry {
  type: 'scan' | 'info' | 'folder' | 'upload' | 'download' | 'done' | 'error' | 'skip' | 'resume';
  message: string;
  file?: string;    // relative path for file entries
  size?: number;    // file size in bytes
  status?: 'uploading' | 'downloading' | 'done' | 'error' | 'skipped' | 'resumed';
  ts: string;       // ISO timestamp
}

export interface FailedFileEntry {
  path: string;
  error: string;
}

interface UploadContext {
  totalFiles: number;
  uploadedFiles: number;
  totalSize: number;
  uploadedSize: number;
  basePath: string; // root folder path for calculating relative paths
  overwriteMap: Record<string, string>; // relativePath -> driveFileId
  skipPaths: string[]; // relativePaths to skip
  completedPaths: string[]; // already-completed files (for resume)
  failedFiles: FailedFileEntry[]; // accumulated per-file errors
  resumeFromCheckpoint: boolean; // whether we're resuming
}

interface DownloadContext {
  totalFiles: number;
  downloadedFiles: number;
  totalSize: number;
  downloadedSize: number;
  completedPaths: string[];
  failedFiles: FailedFileEntry[];
}

// ─── SSE Event Emitter ───

export const taskEvents = new EventEmitter();
taskEvents.setMaxListeners(50); // Support many concurrent SSE clients

export class TaskService {
  private gdriveService: GDriveService | null = null;
  private isProcessing = false;

  setGDriveService(service: GDriveService) {
    this.gdriveService = service;
  }

  // ─── Task CRUD ───

  createTask(type: TaskRecord['type'], payload: any): string {
    const db = getDatabase();
    const taskId = uuidv4();
    const payloadStr = JSON.stringify(payload);
    
    db.prepare(`
      INSERT INTO tasks (id, type, payload, status, progress, verbose_log, completed_files, failed_files) 
      VALUES (?, ?, ?, 'PENDING', 0, '[]', '[]', '[]')
    `).run(taskId, type, payloadStr);
    
    logger.info(`Task created: ${taskId} (${type})`);
    
    // Emit for SSE clients
    this.emitTaskUpdate(taskId);
    
    // Trigger processing asynchronously
    this.processQueue();
    
    return taskId;
  }

  getTask(taskId: string): TaskRecord | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRecord | undefined;
  }

  getAllTasks(): TaskRecord[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as TaskRecord[];
  }

  // ─── Resume a failed/interrupted task ───

  resumeTask(taskId: string): boolean {
    const db = getDatabase();
    const task = this.getTask(taskId);
    if (!task) return false;

    // Only resume FAILED or COMPLETED_WITH_ERRORS or interrupted IN_PROGRESS tasks
    if (!['FAILED', 'COMPLETED_WITH_ERRORS', 'IN_PROGRESS'].includes(task.status)) {
      return false;
    }

    // Reset to PENDING so processQueue picks it up, but keep completed_files for resume
    db.prepare(`
      UPDATE tasks SET status = 'PENDING', progress = ?, error_message = NULL, failed_files = '[]', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(task.progress, taskId);

    this.appendVerboseLog(taskId, {
      type: 'resume',
      message: 'Task resumed — will skip already-completed files',
      status: 'resumed',
    });

    logger.info(`Task resumed: ${taskId}`);
    this.emitTaskUpdate(taskId);
    this.processQueue();
    return true;
  }

  // ─── Status Updates ───

  private updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    progress?: number,
    result?: any,
    error_message?: string
  ) {
    const db = getDatabase();
    let query = 'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [status];

    if (progress !== undefined) {
      query += ', progress = ?';
      params.push(progress);
    }
    if (result !== undefined) {
      query += ', result = ?';
      params.push(JSON.stringify(result));
    }
    if (error_message !== undefined) {
      query += ', error_message = ?';
      params.push(error_message);
    }

    query += ' WHERE id = ?';
    params.push(taskId);

    db.prepare(query).run(...params);
    this.emitTaskUpdate(taskId);
  }

  // ─── Checkpoint Persistence ───

  private persistCheckpoint(taskId: string, completedPaths: string[], failedFiles: FailedFileEntry[], lastFile?: string) {
    const db = getDatabase();
    let query = 'UPDATE tasks SET completed_files = ?, failed_files = ?, updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [JSON.stringify(completedPaths), JSON.stringify(failedFiles)];

    if (lastFile !== undefined) {
      query += ', last_checkpoint = ?';
      params.push(lastFile);
    }

    query += ' WHERE id = ?';
    params.push(taskId);

    db.prepare(query).run(...params);
  }

  private loadCompletedFiles(taskId: string): string[] {
    const task = this.getTask(taskId);
    if (!task?.completed_files) return [];
    try {
      return JSON.parse(task.completed_files);
    } catch {
      return [];
    }
  }

  // ─── Verbose Log Helpers ───

  private appendVerboseLog(taskId: string, entry: Omit<VerboseLogEntry, 'ts'>): void {
    const db = getDatabase();
    const fullEntry: VerboseLogEntry = {
      ...entry,
      ts: new Date().toISOString(),
    };

    try {
      // Read current log, append, and write back
      const task = db.prepare('SELECT verbose_log FROM tasks WHERE id = ?').get(taskId) as { verbose_log: string } | undefined;
      let logs: VerboseLogEntry[] = [];
      if (task?.verbose_log) {
        try {
          logs = JSON.parse(task.verbose_log);
        } catch { logs = []; }
      }
      logs.push(fullEntry);

      db.prepare('UPDATE tasks SET verbose_log = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(logs), taskId);

      // Emit for SSE
      this.emitTaskUpdate(taskId);
    } catch (err) {
      logger.error(`Failed to append verbose log for task ${taskId}:`, err);
    }
  }

  private updateVerboseLogLast(taskId: string, update: Partial<VerboseLogEntry>): void {
    const db = getDatabase();
    try {
      const task = db.prepare('SELECT verbose_log FROM tasks WHERE id = ?').get(taskId) as { verbose_log: string } | undefined;
      let logs: VerboseLogEntry[] = [];
      if (task?.verbose_log) {
        try { logs = JSON.parse(task.verbose_log); } catch { logs = []; }
      }
      if (logs.length > 0) {
        logs[logs.length - 1] = { ...logs[logs.length - 1], ...update, ts: new Date().toISOString() };
        db.prepare('UPDATE tasks SET verbose_log = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(JSON.stringify(logs), taskId);
        this.emitTaskUpdate(taskId);
      }
    } catch (err) {
      logger.error(`Failed to update verbose log for task ${taskId}:`, err);
    }
  }

  // ─── SSE Emitter ───

  private emitTaskUpdate(taskId: string) {
    try {
      const task = this.getTask(taskId);
      if (task) {
        taskEvents.emit('task-update', task);
      }
    } catch {
      // Non-critical — don't break task processing
    }
  }

  // ─── File Counting ───

  private countFilesRecursive(dirPath: string): { totalFiles: number; totalSize: number; folders: number } {
    let totalFiles = 0;
    let totalSize = 0;
    let folders = 0;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          folders++;
          const sub = this.countFilesRecursive(fullPath);
          totalFiles += sub.totalFiles;
          totalSize += sub.totalSize;
          folders += sub.folders;
        } else {
          totalFiles++;
          try {
            const stat = fs.statSync(fullPath);
            totalSize += stat.size;
          } catch { /* skip */ }
        }
      }
    } catch { /* skip unreadable dirs */ }

    return { totalFiles, totalSize, folders };
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  // ─── Queue Processing ───

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (true) {
        const db = getDatabase();
        // Pick oldest PENDING task OR interrupted IN_PROGRESS task (for resume on server restart)
        const task = db.prepare(
          `SELECT * FROM tasks WHERE status IN ('PENDING', 'IN_PROGRESS') ORDER BY 
           CASE status WHEN 'IN_PROGRESS' THEN 0 ELSE 1 END, 
           created_at ASC LIMIT 1`
        ).get() as TaskRecord | undefined;
        
        if (!task) {
          break; // Queue is empty
        }

        const isResume = task.status === 'IN_PROGRESS' || (
          task.status === 'PENDING' && !!task.completed_files && task.completed_files !== '[]'
        );

        // Mark as in progress
        this.updateTaskStatus(task.id, 'IN_PROGRESS', isResume ? task.progress : 0);

        if (isResume) {
          this.appendVerboseLog(task.id, {
            type: 'resume',
            message: 'Resuming task from last checkpoint...',
            status: 'resumed',
          });
        }
        
        try {
          if (task.type === 'UPLOAD') {
            await this.processUploadTask(task, isResume);
          } else if (task.type === 'DOWNLOAD') {
            await this.processDownloadTask(task);
          } else {
            throw new Error(`Unknown task type: ${task.type}`);
          }

          // Check if there were any per-file failures
          const failedFiles = this.loadFailedFiles(task.id);
          if (failedFiles.length > 0) {
            const errMsg = `${failedFiles.length} file(s) failed during transfer`;
            this.updateTaskStatus(task.id, 'COMPLETED_WITH_ERRORS', 100, undefined, errMsg);
            this.appendVerboseLog(task.id, {
              type: 'done',
              message: `Transfer completed with ${failedFiles.length} error(s)`,
            });
            logger.info(`Task completed with errors: ${task.id} (${failedFiles.length} failures)`);
          } else {
            this.updateTaskStatus(task.id, 'COMPLETED', 100);
            this.appendVerboseLog(task.id, {
              type: 'done',
              message: 'Transfer completed successfully',
            });
            logger.info(`Task completed successfully: ${task.id}`);
          }
        } catch (error: any) {
          // Fatal error — the whole task failed (e.g., Drive not connected, directory missing)
          logger.error(`Task failed: ${task.id}`, error);
          this.updateTaskStatus(task.id, 'FAILED', task.progress, undefined, error.message || 'Unknown error');
          this.appendVerboseLog(task.id, {
            type: 'error',
            message: `Transfer failed: ${error.message || 'Unknown error'}`,
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private loadFailedFiles(taskId: string): FailedFileEntry[] {
    const task = this.getTask(taskId);
    if (!task?.failed_files) return [];
    try {
      return JSON.parse(task.failed_files);
    } catch {
      return [];
    }
  }

  // ─── Upload Task Processing ───

  private async processUploadTask(task: TaskRecord, isResume: boolean) {
    if (!this.gdriveService) throw new Error('GDriveService not initialized');
    
    const payload = JSON.parse(task.payload);
    const { localPath, driveFolderId } = payload;

    if (!fs.existsSync(localPath)) {
      throw new Error('Local file or directory not found');
    }

    const stat = fs.statSync(localPath);
    
    if (stat.isDirectory()) {
      // ─── Pre-scan folder for total counts ───
      const folderName = path.basename(localPath);

      if (!isResume) {
        this.appendVerboseLog(task.id, {
          type: 'scan',
          message: `Scanning folder: ${folderName}`,
        });
      }

      const counts = this.countFilesRecursive(localPath);

      // Parse skip/overwrite maps from payload
      const overwriteMap: Record<string, string> = payload.overwriteMap || {};
      const skipPaths: string[] = payload.skipPaths || [];
      const skipCount = skipPaths.length;
      const overwriteCount = Object.keys(overwriteMap).length;

      // Load already-completed files for resume
      const completedPaths = isResume ? this.loadCompletedFiles(task.id) : [];

      // Adjust total files: subtract skipped and already completed
      const effectiveTotal = counts.totalFiles - skipCount - completedPaths.length;

      if (!isResume) {
        let infoMsg = `Found ${counts.totalFiles} file${counts.totalFiles !== 1 ? 's' : ''} in ${counts.folders + 1} folder${counts.folders !== 0 ? 's' : ''} (total: ${this.formatSize(counts.totalSize)})`;
        if (skipCount > 0) {
          infoMsg += ` — ${skipCount} identical will be skipped`;
        }
        if (overwriteCount > 0) {
          infoMsg += ` — ${overwriteCount} will be overwritten`;
        }

        this.appendVerboseLog(task.id, {
          type: 'info',
          message: infoMsg,
        });
      } else {
        this.appendVerboseLog(task.id, {
          type: 'info',
          message: `Resuming: ${completedPaths.length} file(s) already completed, ${effectiveTotal} remaining`,
        });
      }

      const context: UploadContext = {
        totalFiles: Math.max(effectiveTotal, 1),
        uploadedFiles: 0,
        totalSize: counts.totalSize,
        uploadedSize: 0,
        basePath: path.dirname(localPath),
        overwriteMap,
        skipPaths,
        completedPaths,
        failedFiles: [],
        resumeFromCheckpoint: isResume,
      };

      const result = await this.uploadDirectoryRecursive(localPath, driveFolderId, task.id, context);
      
      // Persist final state
      this.persistCheckpoint(task.id, context.completedPaths, context.failedFiles);
      this.updateTaskStatus(task.id, 'IN_PROGRESS', 100, result);
    } else {
      // Single file upload
      const fileName = path.basename(localPath);
      const { overwrite, existingDriveFileId } = payload;

      this.appendVerboseLog(task.id, {
        type: 'upload',
        message: overwrite
          ? `Overwriting: ${fileName} (replacing existing file)`
          : `Uploading: ${fileName}`,
        file: fileName,
        size: stat.size,
        status: 'uploading',
      });

      let lastProgressUpdate = Date.now();
      const onProgress = (bytesRead: number) => {
        const now = Date.now();
        if (now - lastProgressUpdate > 1000) {
          const percent = Math.floor((bytesRead / stat.size) * 100);
          this.updateTaskStatus(task.id, 'IN_PROGRESS', percent);
          lastProgressUpdate = now;
        }
      };

      let result;
      if (overwrite && existingDriveFileId) {
        // Overwrite: update existing file on Drive
        result = await this.gdriveService.updateFile(existingDriveFileId, localPath, undefined, onProgress);
        // If updateFile returns null (file not found on Drive), fall back to new upload
        if (!result) {
          this.appendVerboseLog(task.id, {
            type: 'info',
            message: `Existing file not found on Drive, uploading as new file`,
          });
          result = await this.gdriveService.uploadFile(localPath, driveFolderId, undefined, onProgress);
        }
      } else {
        result = await this.gdriveService.uploadFile(localPath, driveFolderId, undefined, onProgress);
      }

      this.appendVerboseLog(task.id, {
        type: 'upload',
        message: overwrite
          ? `Overwritten: ${fileName}`
          : `Completed: ${fileName}`,
        file: fileName,
        size: stat.size,
        status: 'done',
      });

      this.updateTaskStatus(task.id, 'IN_PROGRESS', 100, result);
    }
  }

  private async uploadDirectoryRecursive(
    dirPath: string,
    parentDriveId: string,
    taskId: string,
    context: UploadContext
  ): Promise<Array<{ name: string; id: string }>> {
    if (!this.gdriveService) throw new Error('Drive not initialized');

    const results: Array<{ name: string; id: string }> = [];
    const folderName = path.basename(dirPath);
    const relativeFolderPath = path.relative(context.basePath, dirPath).replace(/\\/g, '/');

    // Log folder creation
    this.appendVerboseLog(taskId, {
      type: 'folder',
      message: `Creating folder: ${relativeFolderPath}`,
    });

    const folderId = await this.gdriveService.createFolder(folderName, parentDriveId);

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    // Sort: directories first, then files
    const sortedEntries = [...entries].sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sortedEntries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subResults = await this.uploadDirectoryRecursive(fullPath, folderId, taskId, context);
        results.push(...subResults);
      } else {
        const relativePath = path.relative(context.basePath, fullPath).replace(/\\/g, '/');
        let fileSize = 0;
        try {
          fileSize = fs.statSync(fullPath).size;
        } catch { /* skip */ }

        // Check if this file should be skipped (same name + same size)
        if (context.skipPaths.includes(relativePath)) {
          this.appendVerboseLog(taskId, {
            type: 'skip',
            message: `Skipped (identical): ${relativePath}`,
            file: relativePath,
            size: fileSize,
            status: 'skipped',
          });
          continue;
        }

        // Check if this file was already completed (for resume)
        if (context.completedPaths.includes(relativePath)) {
          this.appendVerboseLog(taskId, {
            type: 'skip',
            message: `Skipped (already uploaded): ${relativePath}`,
            file: relativePath,
            size: fileSize,
            status: 'skipped',
          });
          continue;
        }

        // Check if this file should be overwritten
        const overwriteDriveId = context.overwriteMap[relativePath];

        if (overwriteDriveId) {
          // Overwrite existing file on Drive
          this.appendVerboseLog(taskId, {
            type: 'upload',
            message: `Overwriting: ${relativePath} (${this.formatSize(fileSize)})`,
            file: relativePath,
            size: fileSize,
            status: 'uploading',
          });

          try {
            let result = await this.gdriveService.updateFile(overwriteDriveId, fullPath);
            // Fallback to new upload if file not found on Drive
            if (!result) {
              result = await this.gdriveService.uploadFile(fullPath, folderId);
            }
            if (result) results.push(result);

            context.uploadedFiles++;
            context.uploadedSize += fileSize;
            context.completedPaths.push(relativePath);

            this.appendVerboseLog(taskId, {
              type: 'upload',
              message: `Overwritten: ${relativePath}`,
              file: relativePath,
              size: fileSize,
              status: 'done',
            });

            const percent = context.totalFiles > 0
              ? Math.floor((context.uploadedFiles / context.totalFiles) * 100)
              : 0;
            this.updateTaskStatus(taskId, 'IN_PROGRESS', Math.min(percent, 99));

            // Persist checkpoint
            this.persistCheckpoint(taskId, context.completedPaths, context.failedFiles, relativePath);

          } catch (err: any) {
            // Per-file error — log and continue instead of throwing
            context.uploadedFiles++;
            const failEntry: FailedFileEntry = { path: relativePath, error: err.message || 'Unknown error' };
            context.failedFiles.push(failEntry);

            this.appendVerboseLog(taskId, {
              type: 'upload',
              message: `Failed to overwrite: ${relativePath} — ${err.message || 'Unknown error'}`,
              file: relativePath,
              size: fileSize,
              status: 'error',
            });
            logger.error(`Failed to overwrite file ${fullPath}:`, err);

            // Persist checkpoint even on failure
            this.persistCheckpoint(taskId, context.completedPaths, context.failedFiles, relativePath);
          }
        } else {
          // New file — normal upload
          this.appendVerboseLog(taskId, {
            type: 'upload',
            message: `Uploading: ${relativePath} (${this.formatSize(fileSize)})`,
            file: relativePath,
            size: fileSize,
            status: 'uploading',
          });

          try {
            const result = await this.gdriveService.uploadFile(fullPath, folderId);
            if (result) results.push(result);

            context.uploadedFiles++;
            context.uploadedSize += fileSize;
            context.completedPaths.push(relativePath);

            this.appendVerboseLog(taskId, {
              type: 'upload',
              message: `Completed: ${relativePath}`,
              file: relativePath,
              size: fileSize,
              status: 'done',
            });

            const percent = context.totalFiles > 0
              ? Math.floor((context.uploadedFiles / context.totalFiles) * 100)
              : 0;
            this.updateTaskStatus(taskId, 'IN_PROGRESS', Math.min(percent, 99));

            // Persist checkpoint
            this.persistCheckpoint(taskId, context.completedPaths, context.failedFiles, relativePath);

          } catch (err: any) {
            // Per-file error — log and continue instead of throwing
            context.uploadedFiles++;
            const failEntry: FailedFileEntry = { path: relativePath, error: err.message || 'Unknown error' };
            context.failedFiles.push(failEntry);

            this.appendVerboseLog(taskId, {
              type: 'upload',
              message: `Failed: ${relativePath} — ${err.message || 'Unknown error'}`,
              file: relativePath,
              size: fileSize,
              status: 'error',
            });
            logger.error(`Failed to upload file ${fullPath}:`, err);

            // Persist checkpoint even on failure
            this.persistCheckpoint(taskId, context.completedPaths, context.failedFiles, relativePath);
          }
        }
      }
    }

    return results;
  }

  // ─── Download Task Processing ───

  private async processDownloadTask(task: TaskRecord) {
    if (!this.gdriveService) throw new Error('GDriveService not initialized');

    const payload = JSON.parse(task.payload);
    const { fileId, localPath, fileName } = payload;

    // Ensure target directory exists
    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true });
    }

    const destPath = path.join(localPath, fileName || 'downloaded-file');

    // Get file metadata for size info
    let totalBytes = 0;
    try {
      const meta = await this.gdriveService.getFileMetadata(fileId);
      if (meta) totalBytes = parseInt(meta.size, 10) || 0;
    } catch {
      // ignore — we'll still download
    }

    this.appendVerboseLog(task.id, {
      type: 'download',
      message: `Downloading: ${fileName}${totalBytes > 0 ? ` (${this.formatSize(totalBytes)})` : ''}`,
      file: fileName,
      size: totalBytes,
      status: 'downloading',
    });

    let lastProgressUpdate = Date.now();
    await this.gdriveService.downloadFile(fileId, destPath, (bytesDownloaded) => {
      const now = Date.now();
      if (now - lastProgressUpdate > 1000) {
        const percent = totalBytes > 0 ? Math.floor((bytesDownloaded / totalBytes) * 100) : 0;
        this.updateTaskStatus(task.id, 'IN_PROGRESS', percent);
        lastProgressUpdate = now;
      }
    });

    this.appendVerboseLog(task.id, {
      type: 'download',
      message: `Downloaded: ${fileName}`,
      file: fileName,
      size: totalBytes,
      status: 'done',
    });

    logger.info(`Downloaded from Drive: ${fileId} -> ${destPath}`);
    this.updateTaskStatus(task.id, 'IN_PROGRESS', 100, { path: destPath });
  }
}

// Singleton instance
export const taskService = new TaskService();
