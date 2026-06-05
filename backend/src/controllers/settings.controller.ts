import { Response } from 'express';
import { google } from 'googleapis';
import { body, validationResult } from 'express-validator';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { SettingsModel } from '../models/settings.model.js';
import { createDriveClient } from '../config/google-drive.js';
import { logger } from '../utils/logger.js';
import { getGDriveService } from './filemanager.controller.js';
import { SchedulerService } from '../services/scheduler.service.js';
import { WatcherService } from '../services/watcher.service.js';

let schedulerService: SchedulerService | null = null;
let watcherService: WatcherService | null = null;

export function setBackgroundServices(scheduler: SchedulerService, watcher: WatcherService) {
  schedulerService = scheduler;
  watcherService = watcher;
}

export const settingsValidation = [
  body('source_path').optional().isString().trim().isLength({ min: 1 }),
  body('file_manager_path').optional().isString().trim(),
  body('drive_folder_id').optional().isString().trim(),
  body('backup_schedule').optional().isString().trim(),
  body('auto_backup_enabled').optional().isIn(['true', 'false']),
  body('file_watcher_enabled').optional().isIn(['true', 'false']),
  body('delete_on_drive_when_deleted').optional().isIn(['true', 'false']),
  body('max_concurrent_uploads').optional().isInt({ min: 1, max: 10 }),
  body('google_client_id').optional().isString().trim(),
  body('google_client_secret').optional().isString().trim(),
  body('google_redirect_uri').optional().isString().trim(),
  body('google_refresh_token').optional().isString().trim(),
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
      'file_manager_path',
      'drive_folder_id',
      'backup_schedule',
      'auto_backup_enabled',
      'file_watcher_enabled',
      'delete_on_drive_when_deleted',
      'max_concurrent_uploads',
      'app_name',
      'timezone',
      'google_client_id',
      'google_client_secret',
      'google_redirect_uri',
      'google_refresh_token',
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

    // Re-initialize GDriveService so it picks up new credentials immediately
    const gdriveService = getGDriveService();
    if (gdriveService) {
      gdriveService.initialize();
    }

    // Handle Scheduler and Watcher state changes
    if (updates.auto_backup_enabled || updates.backup_schedule || updates.source_path) {
      const autoEnabled = SettingsModel.get('auto_backup_enabled') === 'true';
      if (autoEnabled) {
        schedulerService?.restart();
      } else {
        schedulerService?.stop();
      }
    }

    if (updates.file_watcher_enabled || updates.source_path) {
      const watcherEnabled = SettingsModel.get('file_watcher_enabled') === 'true';
      if (watcherEnabled) {
        watcherService?.restart();
      } else {
        watcherService?.stop();
      }
    }

    const settings = SettingsModel.getAll();
    res.json({ message: 'Settings updated', settings });
  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function testDriveConnection(req: AuthRequest, res: Response): Promise<void> {
  try {
    const config = {
      clientId: req.body.google_client_id,
      clientSecret: req.body.google_client_secret,
      redirectUri: req.body.google_redirect_uri,
      refreshToken: req.body.google_refresh_token,
    };
    
    const drive = createDriveClient(config);
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

export async function getDriveAuthUrl(req: AuthRequest, res: Response): Promise<void> {
  try {
    const clientId = SettingsModel.get('google_client_id');
    const clientSecret = SettingsModel.get('google_client_secret');
    const redirectUri = SettingsModel.get('google_redirect_uri');

    if (!clientId || !clientSecret || !redirectUri) {
      res.status(400).json({ error: 'Google Client ID, Secret, and Redirect URI must be configured first.' });
      return;
    }

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive'],
      prompt: 'consent',
    });

    res.json({ authUrl });
  } catch (error: any) {
    logger.error('Failed to generate drive auth url:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function exchangeDriveCode(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Authorization code is required' });
      return;
    }

    const clientId = SettingsModel.get('google_client_id');
    const clientSecret = SettingsModel.get('google_client_secret');
    const redirectUri = SettingsModel.get('google_redirect_uri');

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oAuth2Client.getToken(code);

    if (tokens.refresh_token) {
      SettingsModel.set('google_refresh_token', tokens.refresh_token);
      logger.info('Google refresh token updated via UI');
      
      const gdriveService = getGDriveService();
      if (gdriveService) {
        gdriveService.initialize();
      }
      
      res.json({ message: 'Refresh token obtained successfully', settings: SettingsModel.getAll() });
    } else {
      res.status(400).json({ error: 'No refresh token received. You may need to disconnect the app from your Google account and try again to force a new consent screen.' });
    }
  } catch (error: any) {
    logger.error('Failed to exchange drive code:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
