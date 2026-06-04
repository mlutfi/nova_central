import chokidar, { type FSWatcher } from 'chokidar';
import path from 'path';
import { SyncService } from './sync.service.js';
import { SettingsModel } from '../models/settings.model.js';
import { BackupModel } from '../models/backup.model.js';
import { logger } from '../utils/logger.js';

export class WatcherService {
  private watcher: FSWatcher | null = null;
  private syncService: SyncService;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private isActive = false;

  constructor(syncService: SyncService) {
    this.syncService = syncService;
  }

  get active(): boolean {
    return this.isActive;
  }

  start(): void {
    const sourcePath = SettingsModel.get('source_path');
    if (!sourcePath) {
      logger.warn('File watcher: source path not configured');
      return;
    }

    const normalizedPath = path.resolve(sourcePath);
    logger.info(`File watcher starting on: ${normalizedPath}`);

    this.watcher = chokidar.watch(normalizedPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
      ignored: [
        /(^|[\/\\])\../, // Hidden files
        '**/node_modules/**',
      ],
    });

    this.watcher
      .on('add', (filePath: string) => this.debouncedSync(filePath, 'add'))
      .on('change', (filePath: string) => this.debouncedSync(filePath, 'change'))
      .on('unlink', (filePath: string) => this.handleDelete(filePath))
      .on('error', (error: unknown) => logger.error('File watcher error:', error))
      .on('ready', () => {
        this.isActive = true;
        logger.info('File watcher is ready and monitoring changes');
      });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.isActive = false;

      // Clear all pending debounce timers
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();

      logger.info('File watcher stopped');
    }
  }

  restart(): void {
    this.stop();
    this.start();
  }

  private debouncedSync(filePath: string, event: string): void {
    // Clear existing timer for this file
    const existing = this.debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new timer (500ms debounce)
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(filePath);
      try {
        logger.debug(`File ${event}: ${filePath}`);

        // Create a watcher-type backup job for tracking
        const job = BackupModel.create('watcher', filePath);
        await this.syncService.syncSingleFile(filePath);
        BackupModel.updateProgress(job.id, 1, 0, 0, 1);
        BackupModel.complete(job.id);
      } catch (error: any) {
        logger.error(`Watcher sync failed for ${filePath}:`, error.message);
      }
    }, 500);

    this.debounceTimers.set(filePath, timer);
  }

  private async handleDelete(filePath: string): Promise<void> {
    try {
      logger.debug(`File deleted: ${filePath}`);
      await this.syncService.handleFileDeletion(filePath);
    } catch (error: any) {
      logger.error(`Watcher delete handling failed for ${filePath}:`, error.message);
    }
  }
}
