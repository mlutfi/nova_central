import { Response, Request } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { getDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

/**
 * Write an audit log entry.
 */
export function writeAuditLog(params: {
  userId: number | null;
  username: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
}): void {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.userId ?? null,
      params.username,
      params.action,
      params.entityType ?? null,
      params.entityId ?? null,
      params.details ?? null,
      params.ipAddress ?? null,
    );
  } catch (error) {
    // Non-fatal — log but don't crash
    logger.error('Failed to write audit log:', error);
  }
}

/**
 * GET /api/audit — paginated audit log list (admin only)
 */
export async function getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const action = req.query.action as string | undefined;

    const db = getDatabase();

    let logs: AuditLog[];
    let total: number;

    if (action) {
      logs = db.prepare(
        'SELECT * FROM audit_logs WHERE action = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).all(action, limit, offset) as AuditLog[];
      const countResult = db.prepare('SELECT COUNT(*) as count FROM audit_logs WHERE action = ?').get(action) as { count: number };
      total = countResult.count;
    } else {
      logs = db.prepare(
        'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).all(limit, offset) as AuditLog[];
      const countResult = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number };
      total = countResult.count;
    }

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
