import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { BackupModel } from '../models/backup.model.js';
import { logger } from '../utils/logger.js';

export async function getLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    // Validate status value to prevent injection
    const validStatuses = ['running', 'completed', 'failed', 'cancelled'];
    const safeStatus = status && validStatuses.includes(status) ? status : undefined;

    const jobs = BackupModel.findAll(limit, offset, type, safeStatus);
    const total = BackupModel.count(type, safeStatus);

    res.json({
      logs: jobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        sourcePath: job.source_path,
        filesTotal: job.files_total,
        filesSynced: job.files_synced,
        filesFailed: job.files_failed,
        bytesTransferred: job.bytes_transferred,
        errorMessage: job.error_message,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        duration: job.completed_at
          ? Math.round(
              (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000
            )
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
