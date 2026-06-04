import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { SettingsModel } from '../models/settings.model.js';
import { createDriveClient } from '../config/google-drive.js';
import { logger } from '../utils/logger.js';

export const settingsValidation = [
  body('source_path').optional().isString().trim().isLength({ min: 1 }),
  body('drive_folder_id').optional().isString().trim(),
  body('backup_schedule').optional().isString().trim(),
  body('auto_backup_enabled').optional().isIn(['true', 'false']),
  body('file_watcher_enabled').optional().isIn(['true', 'false']),
  body('delete_on_drive_when_deleted').optional().isIn(['true', 'false']),
  body('max_concurrent_uploads').optional().isInt({ min: 1, max: 10 }),
];

export async function getSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = SettingsModel.getAll();
    res.json({ settings });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateSettings(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return;
  }

  try {
    const allowedKeys = [
      'source_path',
      'drive_folder_id',
      'backup_schedule',
      'auto_backup_enabled',
      'file_watcher_enabled',
      'delete_on_drive_when_deleted',
      'max_concurrent_uploads',
      'app_name',
      'timezone',
    ];

    const updates: Record<string, string> = {};
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        updates[key] = String(req.body[key]);
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid settings provided' });
      return;
    }

    SettingsModel.setMultiple(updates);
    logger.info(`Settings updated: ${Object.keys(updates).join(', ')}`);

    const settings = SettingsModel.getAll();
    res.json({ message: 'Settings updated', settings });
  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function testDriveConnection(req: AuthRequest, res: Response): Promise<void> {
  try {
    const drive = createDriveClient();
    if (!drive) {
      res.status(400).json({
        connected: false,
        error: 'Google Drive credentials not configured',
      });
      return;
    }

    const folderId = SettingsModel.get('drive_folder_id');

    // Test by listing files in root or configured folder
    const response = await drive.files.list({
      q: folderId
        ? `'${folderId}' in parents and trashed = false`
        : "'root' in parents and trashed = false",
      pageSize: 1,
      fields: 'files(id, name)',
    });

    res.json({
      connected: true,
      message: 'Google Drive connection successful',
      folderConfigured: !!folderId,
      testResult: {
        filesFound: response.data.files?.length ?? 0,
      },
    });
  } catch (error: any) {
    logger.error('Drive connection test failed:', error);
    res.status(400).json({
      connected: false,
      error: error.message || 'Failed to connect to Google Drive',
    });
  }
}
