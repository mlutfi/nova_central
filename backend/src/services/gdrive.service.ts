import { drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { createDriveClient } from '../config/google-drive.js';
import { logger } from '../utils/logger.js';

export class GDriveService {
  private drive: drive_v3.Drive | null = null;

  initialize(): boolean {
    this.drive = createDriveClient();
    return this.drive !== null;
  }

  isInitialized(): boolean {
    if (!this.drive) {
      this.initialize();
    }
    return this.drive !== null;
  }

  /**
   * Upload a file to Google Drive.
   */
  async uploadFile(
    localPath: string,
    parentId: string,
    mimeType?: string,
    onProgress?: (bytesRead: number) => void,
    _retryCount = 0
  ): Promise<{ id: string; name: string } | null> {
    if (!this.isInitialized()) throw new Error('Drive client not initialized');
    const MAX_RETRIES = 3;

    try {
      const fileName = path.basename(localPath);
      const fileMetadata: drive_v3.Schema$File = {
        name: fileName,
        parents: [parentId],
      };

      const media = {
        mimeType: mimeType || 'application/octet-stream',
        body: fs.createReadStream(localPath),
      };

      const response = await this.drive!.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name',
      }, {
        onUploadProgress: (evt) => {
          if (onProgress && evt.bytesRead) {
            onProgress(evt.bytesRead);
          }
        }
      });

      logger.debug(`Uploaded file: ${fileName} -> ${response.data.id}`);
      return { id: response.data.id!, name: response.data.name! };
    } catch (error: any) {
      const isRateLimit =
        error.code === 429 ||
        (error.code === 403 &&
          error.errors &&
          error.errors.some((e: any) => e.reason && e.reason.toLowerCase().includes('ratelimit')));

      if (isRateLimit && _retryCount < MAX_RETRIES) {
        const delayMs = 5000 * Math.pow(2, _retryCount); // 5s, 10s, 20s
        logger.warn(`Rate limited uploading ${localPath}, retry ${_retryCount + 1}/${MAX_RETRIES} in ${delayMs / 1000}s...`);
        await this.sleep(delayMs);
        return this.uploadFile(localPath, parentId, mimeType, onProgress, _retryCount + 1);
      }
      logger.error(`Failed to upload ${localPath}:`, error.message, error.errors);
      throw error;
    }
  }

  /**
   * Update an existing file on Google Drive.
   */
  async updateFile(
    driveFileId: string,
    localPath: string,
    mimeType?: string,
    onProgress?: (bytesRead: number) => void,
    _retryCount = 0
  ): Promise<{ id: string; name: string } | null> {
    if (!this.isInitialized()) throw new Error('Drive client not initialized');
    const MAX_RETRIES = 3;

    try {
      const media = {
        mimeType: mimeType || 'application/octet-stream',
        body: fs.createReadStream(localPath),
      };

      const response = await this.drive!.files.update({
        fileId: driveFileId,
        media,
        fields: 'id, name',
      }, {
        onUploadProgress: (evt) => {
          if (onProgress && evt.bytesRead) {
            onProgress(evt.bytesRead);
          }
        }
      });

      logger.debug(`Updated file: ${response.data.name} (${driveFileId})`);
      return { id: response.data.id!, name: response.data.name! };
    } catch (error: any) {
      if (error.code === 404) {
        logger.warn(`File not found on Drive: ${driveFileId}, will re-upload`);
        return null; // Signal to caller to re-upload
      }

      const isRateLimit =
        error.code === 429 ||
        (error.code === 403 &&
          error.errors &&
          error.errors.some((e: any) => e.reason && e.reason.toLowerCase().includes('ratelimit')));

      if (isRateLimit && _retryCount < MAX_RETRIES) {
        const delayMs = 5000 * Math.pow(2, _retryCount); // 5s, 10s, 20s
        logger.warn(`Rate limited updating ${driveFileId}, retry ${_retryCount + 1}/${MAX_RETRIES} in ${delayMs / 1000}s...`);
        await this.sleep(delayMs);
        return this.updateFile(driveFileId, localPath, mimeType, onProgress, _retryCount + 1);
      }
      logger.error(`Failed to update ${driveFileId}:`, error.message, error.errors);
      throw error;
    }
  }

  /**
   * Create a folder on Google Drive.
   */
  async createFolder(name: string, parentId: string): Promise<string> {
    if (!this.isInitialized()) throw new Error('Drive client not initialized');

    // Check if folder already exists
    const existing = await this.findFolder(name, parentId);
    if (existing) return existing;

    const fileMetadata: drive_v3.Schema$File = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    };

    const response = await this.drive!.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    logger.debug(`Created folder: ${name} -> ${response.data.id}`);
    return response.data.id!;
  }

  /**
   * Find a folder by name within a parent.
   */
  async findFolder(name: string, parentId: string): Promise<string | null> {
    if (!this.isInitialized()) throw new Error('Drive client not initialized');

    const response = await this.drive!.files.list({
      q: `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
      pageSize: 1,
    });

    return response.data.files?.[0]?.id ?? null;
  }

  /**
   * Delete a file from Google Drive.
   */
  async deleteFile(driveFileId: string): Promise<void> {
    if (!this.isInitialized()) throw new Error('Drive client not initialized');

    try {
      await this.drive!.files.delete({ fileId: driveFileId });
      logger.debug(`Deleted file from Drive: ${driveFileId}`);
    } catch (error: any) {
      if (error.code === 404) {
        logger.warn(`File already deleted from Drive: ${driveFileId}`);
        return;
      }
      throw error;
    }
  }

  /**
   * List files in a Google Drive folder.
   */
  async listFiles(folderId?: string): Promise<Array<{
    id: string;
    name: string;
    mimeType: string;
    size: string;
    modifiedTime: string;
    isFolder: boolean;
  }>> {
    if (!this.isInitialized()) throw new Error('Drive client not initialized');

    const parentId = folderId || 'root';
    const response = await this.drive!.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, modifiedTime)',
      orderBy: 'folder,name',
      pageSize: 1000,
    });

    return (response.data.files || []).map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType || 'application/octet-stream',
      size: file.size || '0',
      modifiedTime: file.modifiedTime || new Date().toISOString(),
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    }));
  }

  /**
   * Rename a file on Google Drive.
   */
  async renameFile(fileId: string, newName: string): Promise<void> {
    if (!this.isInitialized()) throw new Error('Drive client not initialized');

    await this.drive!.files.update({
      fileId,
      requestBody: { name: newName },
    });

    logger.debug(`Renamed Drive file: ${fileId} -> ${newName}`);
  }

  /**
   * Download a file from Google Drive to a local path.
   */
  async downloadFile(fileId: string, destPath: string, onProgress?: (bytesDownloaded: number) => void): Promise<void> {
    if (!this.isInitialized()) throw new Error('Drive client not initialized');

    const response = await this.drive!.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const dest = fs.createWriteStream(destPath);
    await new Promise<void>((resolve, reject) => {
      let downloadedBytes = 0;
      (response.data as any)
        .on('data', (chunk: any) => {
          downloadedBytes += chunk.length;
          if (onProgress) onProgress(downloadedBytes);
        })
        .on('end', () => {
          logger.debug(`Downloaded file: ${fileId} -> ${destPath}`);
          resolve();
        })
        .on('error', (err: Error) => {
          reject(err);
        })
        .pipe(dest);
    });
  }

  /**
   * Get metadata for a file on Google Drive.
   */
  async getFileMetadata(fileId: string): Promise<{
    id: string;
    name: string;
    mimeType: string;
    size: string;
    modifiedTime: string;
    parents: string[];
  } | null> {
    if (!this.isInitialized()) throw new Error('Drive client not initialized');

    try {
      const response = await this.drive!.files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime, parents',
      });

      return {
        id: response.data.id!,
        name: response.data.name!,
        mimeType: response.data.mimeType || 'application/octet-stream',
        size: response.data.size || '0',
        modifiedTime: response.data.modifiedTime || new Date().toISOString(),
        parents: response.data.parents || [],
      };
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  /**
   * Test connection to Google Drive.
   */
  async testConnection(): Promise<boolean> {
    if (!this.isInitialized()) return false;

    try {
      await this.drive!.files.list({ pageSize: 1, fields: 'files(id)' });
      return true;
    } catch {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
