import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { taskService } from '../services/task.service.js';
import { logger } from '../utils/logger.js';

export async function getTasks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tasks = taskService.getAllTasks();
    res.json(tasks);
  } catch (error: any) {
    logger.error('Failed to get tasks:', error);
    res.status(500).json({ error: error.message || 'Failed to get tasks' });
  }
}

export async function getTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const taskId = req.params.id as string;
    const task = taskService.getTask(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (error: any) {
    logger.error('Failed to get task:', error);
    res.status(500).json({ error: error.message || 'Failed to get task' });
  }
}
