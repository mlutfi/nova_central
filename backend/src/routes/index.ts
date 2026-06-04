import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rate-limit.js';
import * as authController from '../controllers/auth.controller.js';
import * as backupController from '../controllers/backup.controller.js';
import * as logsController from '../controllers/logs.controller.js';
import * as settingsController from '../controllers/settings.controller.js';
import * as fileManagerController from '../controllers/filemanager.controller.js';
import * as taskController from '../controllers/task.controller.js';
import * as auditController from '../controllers/audit.controller.js';

export function createRouter(): Router {
  const router = Router();

  // ─── Auth Routes ───
  router.post('/auth/login', authLimiter, authController.loginValidation, authController.login);
  router.post('/auth/logout', authMiddleware, authController.logout);
  router.post('/auth/refresh', authController.refresh);
  router.get('/auth/me', authMiddleware, authController.me);
  router.post(
    '/auth/change-password',
    authMiddleware,
    authController.changePasswordValidation,
    authController.changePassword
  );

  // ─── Backup Routes (protected) ───
  router.post('/backup/start', authMiddleware, backupController.startBackup);
  router.post('/backup/stop', authMiddleware, backupController.stopBackup);
  router.get('/backup/status', authMiddleware, backupController.getStatus);
  router.get('/backup/jobs', authMiddleware, backupController.getJobs);
  router.get('/backup/jobs/:id', authMiddleware, backupController.getJob);

  // ─── Dashboard Routes (protected) ───
  router.get('/dashboard/stats', authMiddleware, backupController.getDashboardStats);

  // ─── Logs Routes (protected) ───
  router.get('/logs', authMiddleware, logsController.getLogs);

  // ─── Settings Routes (protected) ───
  router.get('/settings', authMiddleware, settingsController.getSettings);
  router.put(
    '/settings',
    authMiddleware,
    settingsController.settingsValidation,
    settingsController.updateSettings
  );
  router.post('/settings/drive/test', authMiddleware, settingsController.testDriveConnection);
  router.get('/settings/drive/auth-url', authMiddleware, settingsController.getDriveAuthUrl);
  router.post('/settings/drive/exchange-code', authMiddleware, settingsController.exchangeDriveCode);

  // ─── File Manager Routes (protected) ───
  // Local filesystem
  router.get('/files/local/list', authMiddleware, fileManagerController.listLocal);
  router.get('/files/local/info', authMiddleware, fileManagerController.getLocalInfo);
  router.post('/files/local/create-folder', authMiddleware, fileManagerController.createLocalFolder);
  router.post('/files/local/rename', authMiddleware, fileManagerController.renameLocal);
  router.post('/files/local/delete', authMiddleware, fileManagerController.deleteLocal);

  // Google Drive
  router.get('/files/drive/list', authMiddleware, fileManagerController.listDrive);
  router.post('/files/drive/create-folder', authMiddleware, fileManagerController.createDriveFolder);
  router.post('/files/drive/rename', authMiddleware, fileManagerController.renameDrive);
  router.post('/files/drive/delete', authMiddleware, fileManagerController.deleteDrive);

  // Cross-operations
  router.post('/files/upload-to-drive', authMiddleware, fileManagerController.uploadToDrive);
  router.post('/files/download-from-drive', authMiddleware, fileManagerController.downloadFromDrive);
  router.get('/files/transfers/:id', authMiddleware, fileManagerController.getTransferProgress);

  // ─── Task Routes (protected) ───
  router.get('/tasks', authMiddleware, taskController.getTasks);
  router.get('/tasks/:id', authMiddleware, taskController.getTask);

  // ─── Audit Log Routes (protected) ───
  router.get('/audit', authMiddleware, auditController.getAuditLogs);

  return router;
}

