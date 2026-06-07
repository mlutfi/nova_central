import express from 'express';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { initDatabase, closeDatabase } from './config/database.js';
import { setupSecurity } from './middleware/security.js';
import { generalLimiter } from './middleware/rate-limit.js';
import { createRouter } from './routes/index.js';
import { GDriveService } from './services/gdrive.service.js';
import { SyncService } from './services/sync.service.js';
import { WatcherService } from './services/watcher.service.js';
import { SchedulerService } from './services/scheduler.service.js';
import { setSyncService } from './controllers/backup.controller.js';
import { setGDriveService } from './controllers/filemanager.controller.js';
import { setBackgroundServices } from './controllers/settings.controller.js';
import { taskService } from './services/task.service.js';
import { SettingsModel } from './models/settings.model.js';
import { BackupModel } from './models/backup.model.js';
import { UserModel } from './models/user.model.js';
import { logger } from './utils/logger.js';

async function bootstrap(): Promise<void> {
  const app = express();

  // ─── Trust Proxy (for correct IP behind nginx/cloudflare) ───
  app.set('trust proxy', 1);

  // ─── Core Middleware ───
  setupSecurity(app);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(generalLimiter);

  // ─── Request Logging Middleware ───
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug';
      logger[level](`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // ─── Database Init (async for sql.js WASM loading) ───
  await initDatabase();
  SettingsModel.initDefaults();

  // Clean up stale "running" jobs from previous server crashes/restarts
  const staleCount = BackupModel.cleanupStaleJobs();
  if (staleCount > 0) {
    logger.info(`Cleaned up ${staleCount} stale backup job(s) from previous run`);
  }

  // ─── Seed Admin User ───
  if (UserModel.count() === 0) {
    await UserModel.create(env.ADMIN_USERNAME, env.ADMIN_PASSWORD, 'admin', true);
    logger.info(`Admin user created: ${env.ADMIN_USERNAME} (must change password on first login)`);
  }

  // ─── Services Init ───
  const gdriveService = new GDriveService();
  gdriveService.initialize();

  const syncService = new SyncService(gdriveService);
  const watcherService = new WatcherService(syncService);
  const schedulerService = new SchedulerService(syncService);

  // Inject sync service into backup controller
  setSyncService(syncService);
  setGDriveService(gdriveService);
  setBackgroundServices(schedulerService, watcherService);

  taskService.setGDriveService(gdriveService);
  // Resume any pending tasks
  taskService.processQueue();

  // Start auto-backup services if enabled
  if (SettingsModel.get('auto_backup_enabled') === 'true') {
    schedulerService.start();
  }
  if (SettingsModel.get('file_watcher_enabled') === 'true') {
    watcherService.start();
  }

  // ─── API Routes ───
  app.use('/api', createRouter());

  // ─── Health Check (public — minimal info only) ───
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── 404 Handler ───
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ─── Error Handler ───
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // ─── Start Server ───
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Nova Central Backend running on port ${env.PORT}`);
    logger.info(`   Environment: ${env.NODE_ENV}`);
    logger.info(`   Frontend URL: ${env.FRONTEND_URL}`);
    logger.info(`   Google Drive: ${gdriveService.isInitialized() ? 'Connected' : 'Not configured'}`);
  });

  // ─── Graceful Shutdown ───
  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully...`);

    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop background services
    watcherService.stop();
    schedulerService.stop();

    // Cancel ongoing sync
    if (syncService.running) {
      syncService.cancelSync();
    }

    // Save and close database
    closeDatabase();

    // Force exit after 10 seconds if something hangs
    const forceExit = setTimeout(() => {
      logger.error('Could not close gracefully, forcing exit');
      process.exit(1);
    }, 10000);
    forceExit.unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
