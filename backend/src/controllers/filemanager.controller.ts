import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { GDriveService } from '../services/gdrive.service.js';
import { SettingsModel } from '../models/settings.model.js';
import { taskService } from '../services/task.service.js';
import { logger } from '../utils/logger.js';

let gdriveService: GDriveService | null = null;

export function setGDriveService(service: GDriveService): void {
  gdriveService = service;
}

// ─── Transfer Progress Tracking ───
export interface TransferProgress {
  id: string;
  bytesTransferred: number;
  totalBytes: number;
}
export const activeTransfers = new Map<string, TransferProgress>();

export function getTransferProgress(req: AuthRequest, res: Response): void {
  const transferId = req.params.id as string;
  const progress = activeTransfers.get(transferId);
  if (progress) {
    res.json(progress);
  } else {
    res.json({ bytesTransferred: 0, totalBytes: 0 }); // Not found or already completed
  }
}

// ─── Helper: resolve & validate path — MUST stay within allowed roots ───
function resolveSafePath(requestedPath: string, allowedRoots?: string[]): string | null {
  try {
    const resolved = path.resolve(requestedPath);

    // If no allowed roots provided, use configured source path as boundary
    const roots = allowedRoots ?? (() => {
      const src = SettingsModel.get('source_path');
      return src ? [path.resolve(src)] : [];
    })();

    // If no roots configured, deny access
    if (roots.length === 0) return null;

    // Path must start with one of the allowed roots
    const isAllowed = roots.some((root) => {
      const normalizedRoot = path.resolve(root);
      return (
        resolved === normalizedRoot ||
        resolved.startsWith(normalizedRoot + path.sep)
      );
    });

    return isAllowed ? resolved : null;
  } catch {
    return null;
  }
}


interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  extension: string;
}

// ─── LOCAL: List files ───
export async function listLocal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dirPath = (req.query.path as string) || '';
    if (!dirPath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const resolved = resolveSafePath(dirPath);
    if (!resolved) {
      res.status(400).json({ error: 'Invalid path' });
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Directory not found' });
      return;
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'Path is not a directory' });
      return;
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const files: FileEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files and system files
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(resolved, entry.name);
      try {
        const fileStat = fs.statSync(fullPath);
        files.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: entry.isDirectory() ? 0 : fileStat.size,
          modifiedAt: fileStat.mtime.toISOString(),
          extension: entry.isDirectory() ? '' : path.extname(entry.name).toLowerCase(),
        });
      } catch {
        // Skip files we can't stat (permission errors, etc.)
        continue;
      }
    }

    // Sort: directories first, then by name
    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    // Get parent path
    const parentPath = path.dirname(resolved);

    res.json({
      currentPath: resolved,
      parentPath: parentPath !== resolved ? parentPath : null,
      files,
    });
  } catch (error: any) {
    logger.error('List local files error:', error);
    res.status(500).json({ error: error.message || 'Failed to list files' });
  }
}

// ─── LOCAL: Get file info ───
export async function getLocalInfo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const resolved = resolveSafePath(filePath);
    if (!resolved || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const stat = fs.statSync(resolved);
    res.json({
      name: path.basename(resolved),
      path: resolved,
      isDirectory: stat.isDirectory(),
      size: stat.size,
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
      extension: stat.isDirectory() ? '' : path.extname(resolved).toLowerCase(),
    });
  } catch (error: any) {
    logger.error('Get local info error:', error);
    res.status(500).json({ error: error.message || 'Failed to get file info' });
  }
}

// ─── LOCAL: Create folder ───
export async function createLocalFolder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { parentPath, name } = req.body;
    if (!parentPath || !name) {
      res.status(400).json({ error: 'parentPath and name are required' });
      return;
    }

    const resolved = resolveSafePath(path.join(parentPath, name));
    if (!resolved) {
      res.status(400).json({ error: 'Invalid path' });
      return;
    }

    if (fs.existsSync(resolved)) {
      res.status(409).json({ error: 'Folder already exists' });
      return;
    }

    fs.mkdirSync(resolved, { recursive: true });
    logger.info(`Created local folder: ${resolved}`);
    res.json({ message: 'Folder created', path: resolved });
  } catch (error: any) {
    logger.error('Create local folder error:', error);
    res.status(500).json({ error: error.message || 'Failed to create folder' });
  }
}

// ─── LOCAL: Rename ───
export async function renameLocal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { filePath, newName } = req.body;
    if (!filePath || !newName) {
      res.status(400).json({ error: 'filePath and newName are required' });
      return;
    }

    const resolved = resolveSafePath(filePath);
    if (!resolved || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const dir = path.dirname(resolved);
    const newPath = path.join(dir, newName);

    if (fs.existsSync(newPath)) {
      res.status(409).json({ error: 'A file with that name already exists' });
      return;
    }

    fs.renameSync(resolved, newPath);
    logger.info(`Renamed: ${resolved} -> ${newPath}`);
    res.json({ message: 'Renamed successfully', oldPath: resolved, newPath });
  } catch (error: any) {
    logger.error('Rename local error:', error);
    res.status(500).json({ error: error.message || 'Failed to rename' });
  }
}

// ─── LOCAL: Delete ───
export async function deleteLocal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      res.status(400).json({ error: 'filePath is required' });
      return;
    }

    const resolved = resolveSafePath(filePath);
    if (!resolved || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      fs.rmSync(resolved, { recursive: true, force: true });
    } else {
      fs.unlinkSync(resolved);
    }

    logger.info(`Deleted: ${resolved}`);
    res.json({ message: 'Deleted successfully', path: resolved });
  } catch (error: any) {
    logger.error('Delete local error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete' });
  }
}

// ─── DRIVE: List files ───
export async function listDrive(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!gdriveService || !gdriveService.isInitialized()) {
      res.status(503).json({ error: 'Google Drive is not configured' });
      return;
    }

    const folderId = (req.query.folderId as string) || '';
    const files = await gdriveService.listFiles(folderId || undefined);

    res.json({ files, folderId: folderId || 'root' });
  } catch (error: any) {
    logger.error('List drive files error:', error);
    res.status(500).json({ error: error.message || 'Failed to list Drive files' });
  }
}

// ─── DRIVE: Create folder ───
export async function createDriveFolder(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!gdriveService || !gdriveService.isInitialized()) {
      res.status(503).json({ error: 'Google Drive is not configured' });
      return;
    }

    const { parentId, name } = req.body;
    if (!parentId || !name) {
      res.status(400).json({ error: 'parentId and name are required' });
      return;
    }

    const folderId = await gdriveService.createFolder(name, parentId);
    logger.info(`Created Drive folder: ${name} in ${parentId}`);
    res.json({ message: 'Folder created', folderId });
  } catch (error: any) {
    logger.error('Create drive folder error:', error);
    res.status(500).json({ error: error.message || 'Failed to create Drive folder' });
  }
}

// ─── DRIVE: Rename ───
export async function renameDrive(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!gdriveService || !gdriveService.isInitialized()) {
      res.status(503).json({ error: 'Google Drive is not configured' });
      return;
    }

    const { fileId, newName } = req.body;
    if (!fileId || !newName) {
      res.status(400).json({ error: 'fileId and newName are required' });
      return;
    }

    await gdriveService.renameFile(fileId, newName);
    logger.info(`Renamed Drive file: ${fileId} -> ${newName}`);
    res.json({ message: 'Renamed successfully' });
  } catch (error: any) {
    logger.error('Rename drive error:', error);
    res.status(500).json({ error: error.message || 'Failed to rename Drive file' });
  }
}

// ─── DRIVE: Delete ───
export async function deleteDrive(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!gdriveService || !gdriveService.isInitialized()) {
      res.status(503).json({ error: 'Google Drive is not configured' });
      return;
    }

    const { fileId } = req.body;
    if (!fileId) {
      res.status(400).json({ error: 'fileId is required' });
      return;
    }

    await gdriveService.deleteFile(fileId);
    logger.info(`Deleted Drive file: ${fileId}`);
    res.json({ message: 'Deleted successfully' });
  } catch (error: any) {
    logger.error('Delete drive error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete Drive file' });
  }
}

// ─── CROSS: Upload local file to Google Drive ───
export async function uploadToDrive(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!gdriveService || !gdriveService.isInitialized()) {
      res.status(503).json({ error: 'Google Drive is not configured' });
      return;
    }

    const { localPath, driveFolderId, transferId } = req.body; // transferId is optional now, we'll return taskId
    if (!localPath || !driveFolderId) {
      res.status(400).json({ error: 'localPath and driveFolderId are required' });
      return;
    }

    const resolved = resolveSafePath(localPath);
    if (!resolved || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Local file not found' });
      return;
    }

    // Insert task into queue
    const taskId = taskService.createTask('UPLOAD', { localPath: resolved, driveFolderId });
    logger.info(`Enqueued upload task: ${taskId} for ${resolved}`);
    
    // We return taskId so the frontend can poll /api/tasks/:id
    res.json({ message: 'Upload started in background', taskId, transferId: taskId });

  } catch (error: any) {
    logger.error('Upload to drive error:', error);
    res.status(500).json({ error: error.message || 'Failed to start upload' });
  }
}

// ─── CROSS: Download from Google Drive to local ───
export async function downloadFromDrive(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!gdriveService || !gdriveService.isInitialized()) {
      res.status(503).json({ error: 'Google Drive is not configured' });
      return;
    }

    const { fileId, localPath, fileName, transferId } = req.body;
    if (!fileId || !localPath) {
      res.status(400).json({ error: 'fileId and localPath are required' });
      return;
    }

    const resolved = resolveSafePath(localPath);
    if (!resolved) {
      res.status(400).json({ error: 'Invalid local path' });
      return;
    }

    // Ensure target directory exists
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }

    const destPath = path.join(resolved, fileName || 'downloaded-file');

    if (transferId) {
      let totalBytes = 0;
      try {
        const meta = await gdriveService.getFileMetadata(fileId);
        if (meta) totalBytes = parseInt(meta.size, 10) || 0;
      } catch (e) {
        // ignore
      }
      activeTransfers.set(transferId, { id: transferId, bytesTransferred: 0, totalBytes });
    }

    try {
      await gdriveService.downloadFile(fileId, destPath, (bytesDownloaded) => {
        if (transferId) {
          const transfer = activeTransfers.get(transferId);
          if (transfer) {
            transfer.bytesTransferred = bytesDownloaded;
          }
        }
      });
      if (transferId) activeTransfers.delete(transferId);
      logger.info(`Downloaded from Drive: ${fileId} -> ${destPath}`);
      res.json({ message: 'File downloaded', path: destPath });
    } catch (err) {
      if (transferId) activeTransfers.delete(transferId);
      throw err;
    }
  } catch (error: any) {
    logger.error('Download from drive error:', error);
    res.status(500).json({ error: error.message || 'Failed to download from Drive' });
  }
}
