import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { BackupModel } from '../models/backup.model.js';
import { FileRecordModel } from '../models/file-record.model.js';
import { SettingsModel } from '../models/settings.model.js';
import { SyncService } from '../services/sync.service.js';
import { logger } from '../utils/logger.js';

let syncService: SyncService | null = null;

export function setSyncService(service: SyncService): void {
  syncService = service;
}

export async function startBackup(req: AuthRequest, res: Response): Promise<void> {
  try {
    const running = BackupModel.getRunning();
    if (running) {
      res.status(409).json({ error: 'A backup is already running', job: running });
      return;
    }

    if (!syncService) {
      res.status(503).json({ error: 'Sync service is not initialized' });
      return;
    }

    const sourcePath = SettingsModel.get('source_path');
    if (!sourcePath) {
      res.status(400).json({ error: 'Source path is not configured' });
      return;
    }

    // Start backup asynchronously
    const job = BackupModel.create('manual', sourcePath);
    logger.info(`Manual backup started: Job #${job.id}`);

    // Run sync in background
    syncService.runSync(job.id, sourcePath).catch((err) => {
      logger.error(`Backup job #${job.id} failed:`, err);
    });

    res.json({ message: 'Backup started', job });
  } catch (error) {
    logger.error('Start backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function stopBackup(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (syncService) {
      syncService.cancelSync();
    }

    const running = BackupModel.getRunning();
    if (running) {
      BackupModel.cancel(running.id);
    }

    res.json({ message: 'Backup stopped' });
  } catch (error) {
    logger.error('Stop backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const running = BackupModel.getRunning();
    const fileStats = FileRecordModel.getStats();
    const backupStats = BackupModel.getStats();

    res.json({
      isRunning: !!running,
      currentJob: running || null,
      fileStats,
      backupStats,
      autoBackupEnabled: SettingsModel.get('auto_backup_enabled') === 'true',
      fileWatcherEnabled: SettingsModel.get('file_watcher_enabled') === 'true',
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const type = req.query.type as string | undefined;
    const offset = (page - 1) * limit;

    const jobs = BackupModel.findAll(limit, offset, type);
    const total = BackupModel.count(type);

    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const job = BackupModel.findById(id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({ job });
  } catch (error) {
    logger.error('Get job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const backupStats = BackupModel.getStats();
    const fileStats = FileRecordModel.getStats();
    const settings = SettingsModel.getAll();

    res.json({
      backupStats,
      fileStats,
      settings: {
        sourcePath: settings.source_path,
        autoBackupEnabled: settings.auto_backup_enabled === 'true',
        fileWatcherEnabled: settings.file_watcher_enabled === 'true',
        backupSchedule: settings.backup_schedule,
      },
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
