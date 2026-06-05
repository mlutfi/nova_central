import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { taskService, taskEvents } from '../services/task.service.js';
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

// ─── SSE: Stream real-time task updates ───

export async function streamTasks(req: AuthRequest, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial heartbeat
  res.write('event: connected\ndata: {"status":"connected"}\n\n');

  // Send all current tasks as initial state
  try {
    const tasks = taskService.getAllTasks();
    res.write(`event: init\ndata: ${JSON.stringify(tasks)}\n\n`);
  } catch {
    // Non-critical
  }

  // Listen for task updates
  const onTaskUpdate = (task: any) => {
    try {
      res.write(`event: task-update\ndata: ${JSON.stringify(task)}\n\n`);
    } catch {
      // Client disconnected — will be cleaned up below
    }
  };

  taskEvents.on('task-update', onTaskUpdate);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    taskEvents.off('task-update', onTaskUpdate);
    clearInterval(heartbeat);
    logger.debug('SSE client disconnected');
  });
}

// ─── Resume a failed/interrupted task ───

export async function resumeTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const taskId = req.params.id as string;
    const success = taskService.resumeTask(taskId);

    if (!success) {
      const task = taskService.getTask(taskId);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
      } else {
        res.status(400).json({ error: `Cannot resume task in status: ${task.status}` });
      }
      return;
    }

    res.json({ message: 'Task resumed', taskId });
  } catch (error: any) {
    logger.error('Failed to resume task:', error);
    res.status(500).json({ error: error.message || 'Failed to resume task' });
  }
}
