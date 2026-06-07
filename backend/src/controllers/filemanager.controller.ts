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

export function getGDriveService(): GDriveService | null {
  return gdriveService;
}

// ─── Helper: resolve & validate path — MUST stay within allowed roots ───
function resolveSafePath(requestedPath: string, allowedRoots?: string[]): string | null {
  try {
    const resolved = path.resolve(requestedPath);

    // If no allowed roots provided, use configured file_manager_path as boundary
    const roots = allowedRoots ?? (() => {
      const src = SettingsModel.get('file_manager_path');
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
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      const requestedPath = (req.query.path as string) || '';
      logger.warn(`Permission denied listing local files for path ${requestedPath}: ${error.message || error}`);
      res.status(403).json({ error: 'Permission denied' });
      return;
    }
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

// ─── CROSS: Compare local folder with Drive folder ───
interface FileConflict {
  relativePath: string;
  localSize: number;
  driveSize: number;
  driveFileId: string;
}

interface SkippableFile {
  relativePath: string;
  size: number;
}

async function compareRecursive(
  service: GDriveService,
  localDir: string,
  driveFolderId: string,
  basePath: string,
  conflicts: FileConflict[],
  skippable: SkippableFile[],
  counters: { newFiles: number; totalFiles: number }
): Promise<void> {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(localDir, { withFileTypes: true });
  } catch (err: any) {
    logger.warn(`Skipping compare in directory ${localDir} due to error: ${err.message || err}`);
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(localDir, entry.name);
    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

    try {
      if (entry.isDirectory()) {
        // Check if folder exists on Drive
        const existingFolderId = await service.findFolder(entry.name, driveFolderId);
        if (existingFolderId) {
          // Folder exists — recurse into it to compare contents
          await compareRecursive(service, fullPath, existingFolderId, basePath, conflicts, skippable, counters);
        } else {
          // Folder doesn't exist on Drive — all files inside are new
          const countLocal = (dir: string) => {
            let subs: fs.Dirent[] = [];
            try {
              subs = fs.readdirSync(dir, { withFileTypes: true });
            } catch (err: any) {
              logger.warn(`Skipping count in directory ${dir} due to error: ${err.message || err}`);
              return;
            }
            for (const s of subs) {
              if (s.name.startsWith('.')) continue;
              const sp = path.join(dir, s.name);
              if (s.isDirectory()) {
                countLocal(sp);
              } else {
                counters.newFiles++;
                counters.totalFiles++;
              }
            }
          };
          countLocal(fullPath);
        }
      } else {
        counters.totalFiles++;
        let localSize = 0;
        try { localSize = fs.statSync(fullPath).size; } catch { /* skip */ }

        // Check if file with same name exists in this Drive folder
        const driveFiles = await service.listFiles(driveFolderId);
        const existing = driveFiles.find(
          (f) => f.name === entry.name && !f.isFolder
        );

        if (existing) {
          const driveSize = parseInt(existing.size || '0', 10);
          if (localSize === driveSize) {
            skippable.push({ relativePath, size: localSize });
          } else {
            conflicts.push({
              relativePath,
              localSize,
              driveSize,
              driveFileId: existing.id,
            });
          }
        } else {
          counters.newFiles++;
        }
      }
    } catch (err: any) {
      logger.warn(`Skipping compare entry ${fullPath} due to error: ${err.message || err}`);
    }
  }
}

export async function compareWithDrive(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!gdriveService || !gdriveService.isInitialized()) {
      res.status(503).json({ error: 'Google Drive is not configured' });
      return;
    }

    const { localPath: rawPath, driveFolderId } = req.body;
    if (!rawPath || !driveFolderId) {
      res.status(400).json({ error: 'localPath and driveFolderId are required' });
      return;
    }

    const resolved = resolveSafePath(rawPath);
    if (!resolved || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Local path not found' });
      return;
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'Path is not a directory' });
      return;
    }

    // Check if the root folder itself exists on Drive
    const folderName = path.basename(resolved);
    const existingRootId = await gdriveService.findFolder(folderName, driveFolderId || 'root');

    if (!existingRootId) {
      // Folder doesn't exist on Drive at all — no conflicts
      res.json({ conflicts: [], skippable: [], newFiles: -1, totalFiles: 0 });
      return;
    }

    const conflicts: FileConflict[] = [];
    const skippable: SkippableFile[] = [];
    const counters = { newFiles: 0, totalFiles: 0 };

    await compareRecursive(
      gdriveService,
      resolved,
      existingRootId,
      path.dirname(resolved), // basePath = parent of root folder, so relativePath includes folder name
      conflicts,
      skippable,
      counters
    );

    logger.info(`Compare result for ${resolved}: ${conflicts.length} conflicts, ${skippable.length} skippable, ${counters.newFiles} new`);
    res.json({
      conflicts,
      skippable,
      newFiles: counters.newFiles,
      totalFiles: counters.totalFiles,
    });
  } catch (error: any) {
    logger.error('Compare with drive error:', error);
    res.status(500).json({ error: error.message || 'Failed to compare' });
  }
}

// ─── CROSS: Upload local file to Google Drive (background task) ───
export async function uploadToDrive(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!gdriveService || !gdriveService.isInitialized()) {
      res.status(503).json({ error: 'Google Drive is not configured' });
      return;
    }

    const { localPath, driveFolderId, overwrite, existingDriveFileId, overwriteMap, skipPaths } = req.body;
    if (!localPath || !driveFolderId) {
      res.status(400).json({ error: 'localPath and driveFolderId are required' });
      return;
    }

    const resolved = resolveSafePath(localPath);
    if (!resolved || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Local file not found' });
      return;
    }

    // Insert task into queue, including overwrite/skip info if present
    const taskPayload: any = { localPath: resolved, driveFolderId };
    if (overwrite && existingDriveFileId) {
      taskPayload.overwrite = true;
      taskPayload.existingDriveFileId = existingDriveFileId;
    }
    if (overwriteMap && Object.keys(overwriteMap).length > 0) {
      taskPayload.overwriteMap = overwriteMap;
    }
    if (skipPaths && skipPaths.length > 0) {
      taskPayload.skipPaths = skipPaths;
    }

    const taskId = taskService.createTask('UPLOAD', taskPayload);
    logger.info(`Enqueued upload task: ${taskId} for ${resolved}${overwrite ? ' (overwrite)' : ''}`);
    
    // We return taskId so the frontend can track via SSE
    res.json({ message: 'Upload started in background', taskId, transferId: taskId });

  } catch (error: any) {
    logger.error('Upload to drive error:', error);
    res.status(500).json({ error: error.message || 'Failed to start upload' });
  }
}

// ─── CROSS: Download from Google Drive to local (background task) ───
export async function downloadFromDrive(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!gdriveService || !gdriveService.isInitialized()) {
      res.status(503).json({ error: 'Google Drive is not configured' });
      return;
    }

    const { fileId, localPath, fileName } = req.body;
    if (!fileId || !localPath) {
      res.status(400).json({ error: 'fileId and localPath are required' });
      return;
    }

    const resolved = resolveSafePath(localPath);
    if (!resolved) {
      res.status(400).json({ error: 'Invalid local path' });
      return;
    }

    // Enqueue as background task — survives browser close
    const taskPayload = { fileId, localPath: resolved, fileName: fileName || 'downloaded-file' };
    const taskId = taskService.createTask('DOWNLOAD', taskPayload);
    logger.info(`Enqueued download task: ${taskId} for ${fileId} -> ${resolved}`);

    res.json({ message: 'Download started in background', taskId, transferId: taskId });

  } catch (error: any) {
    logger.error('Download from drive error:', error);
    res.status(500).json({ error: error.message || 'Failed to start download' });
  }
}
