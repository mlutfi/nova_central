import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { GDriveService } from './gdrive.service.js';
import fs from 'fs';
import path from 'path';

export interface TaskRecord {
  id: string;
  type: 'UPLOAD' | 'DOWNLOAD'; // Add download if needed later
  payload: string; // JSON string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  progress: number; // 0 to 100 percentage or raw bytes depending on usage
  result: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export class TaskService {
  private gdriveService: GDriveService | null = null;
  private isProcessing = false;

  setGDriveService(service: GDriveService) {
    this.gdriveService = service;
  }

  // Add a task to queue
  createTask(type: TaskRecord['type'], payload: any): string {
    const db = getDatabase();
    const taskId = uuidv4();
    const payloadStr = JSON.stringify(payload);
    
    db.prepare(`
      INSERT INTO tasks (id, type, payload, status, progress) 
      VALUES (?, ?, ?, 'PENDING', 0)
    `).run(taskId, type, payloadStr);
    
    logger.info(`Task created: ${taskId} (${type})`);
    
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

  private updateTaskStatus(taskId: string, status: TaskRecord['status'], progress?: number, result?: any, error_message?: string) {
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
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (true) {
        const db = getDatabase();
        // Pick oldest PENDING task
        const task = db.prepare('SELECT * FROM tasks WHERE status = "PENDING" ORDER BY created_at ASC LIMIT 1').get() as TaskRecord | undefined;
        
        if (!task) {
          break; // Queue is empty
        }

        // Mark as in progress
        this.updateTaskStatus(task.id, 'IN_PROGRESS', 0);
        
        try {
          if (task.type === 'UPLOAD') {
            await this.processUploadTask(task);
          } else {
             throw new Error(`Unknown task type: ${task.type}`);
          }
          this.updateTaskStatus(task.id, 'COMPLETED', 100);
          logger.info(`Task completed successfully: ${task.id}`);
        } catch (error: any) {
          logger.error(`Task failed: ${task.id}`, error);
          this.updateTaskStatus(task.id, 'FAILED', task.progress, undefined, error.message || 'Unknown error');
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processUploadTask(task: TaskRecord) {
    if (!this.gdriveService) throw new Error('GDriveService not initialized');
    
    const payload = JSON.parse(task.payload);
    const { localPath, driveFolderId } = payload;

    if (!fs.existsSync(localPath)) {
      throw new Error('Local file or directory not found');
    }

    const stat = fs.statSync(localPath);
    
    if (stat.isDirectory()) {
      // Calculate total files for progress tracking? Or just size? 
      // For simplicity, let's just do file counts or simple progress based on recursion count.
      // But this function uploadDirectoryRecursive is a bit tricky to track exact progress.
      // We'll update progress based on files uploaded.
      const result = await this.uploadDirectoryRecursive(localPath, driveFolderId, task.id);
      this.updateTaskStatus(task.id, 'IN_PROGRESS', 100, result);
    } else {
      let lastProgressUpdate = Date.now();
      const result = await this.gdriveService.uploadFile(localPath, driveFolderId, undefined, (bytesRead) => {
        const now = Date.now();
        if (now - lastProgressUpdate > 1000) { // throttle DB updates to 1s
          const percent = Math.floor((bytesRead / stat.size) * 100);
          this.updateTaskStatus(task.id, 'IN_PROGRESS', percent);
          lastProgressUpdate = now;
        }
      });
      this.updateTaskStatus(task.id, 'IN_PROGRESS', 100, result);
    }
  }

  private async uploadDirectoryRecursive(
    dirPath: string,
    parentDriveId: string,
    taskId: string
  ): Promise<Array<{ name: string; id: string }>> {
    if (!this.gdriveService) throw new Error('Drive not initialized');

    const results: Array<{ name: string; id: string }> = [];
    const folderName = path.basename(dirPath);
    const folderId = await this.gdriveService.createFolder(folderName, parentDriveId);

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subResults = await this.uploadDirectoryRecursive(fullPath, folderId, taskId);
        results.push(...subResults);
      } else {
        const result = await this.gdriveService.uploadFile(fullPath, folderId);
        if (result) results.push(result);
        
        // Very rough progress for directory - just update that it is running
        this.updateTaskStatus(taskId, 'IN_PROGRESS'); 
      }
    }

    return results;
  }
}

// Singleton instance
export const taskService = new TaskService();
