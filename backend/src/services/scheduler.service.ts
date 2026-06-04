import cron from 'node-cron';
import { SyncService } from './sync.service.js';
import { BackupModel } from '../models/backup.model.js';
import { SettingsModel } from '../models/settings.model.js';
import { logger } from '../utils/logger.js';

export class SchedulerService {
  private syncService: SyncService;
  private cronJob: cron.ScheduledTask | null = null;
  private isActive = false;

  constructor(syncService: SyncService) {
    this.syncService = syncService;
  }

  get active(): boolean {
    return this.isActive;
  }

  start(): void {
    const schedule = SettingsModel.get('backup_schedule');
    if (!schedule || !cron.validate(schedule)) {
      logger.warn(`Invalid cron schedule: ${schedule}`);
      return;
    }

    this.cronJob = cron.schedule(
      schedule,
      async () => {
        try {
          // Skip if a sync is already running
          if (this.syncService.running) {
            logger.info('Scheduled backup skipped: sync already running');
            return;
          }

          const sourcePath = SettingsModel.get('source_path');
          if (!sourcePath) {
            logger.warn('Scheduled backup skipped: source path not configured');
            return;
          }

          logger.info('Scheduled backup starting...');
          const job = BackupModel.create('scheduled', sourcePath);
          await this.syncService.runSync(job.id, sourcePath);
        } catch (error) {
          logger.error('Scheduled backup error:', error);
        }
      },
      {
        scheduled: true,
        timezone: SettingsModel.get('timezone') || 'UTC',
      }
    );

    this.isActive = true;
    logger.info(`Backup scheduler started with schedule: ${schedule}`);
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.isActive = false;
      logger.info('Backup scheduler stopped');
    }
  }

  restart(): void {
    this.stop();
    this.start();
  }
}
