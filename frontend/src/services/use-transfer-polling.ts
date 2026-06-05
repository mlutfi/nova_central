'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { tasksApi } from '@/lib/api';
import type { TransferItem } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4400/api';

/**
 * Maps backend task status strings to frontend TransferItem statuses.
 */
const STATUS_MAP: Record<string, TransferItem['status']> = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  FAILED: 'error',
  COMPLETED_WITH_ERRORS: 'completed-with-errors',
};

/**
 * Converts a raw backend TaskRecord into a frontend TransferItem.
 */
function taskToTransfer(task: any): TransferItem {
  // Extract fileName from task payload
  let fileName = 'Unknown';
  try {
    const payload = JSON.parse(task.payload);
    fileName =
      payload.fileName ||
      payload.localPath?.split('\\').pop() ||
      payload.localPath?.split('/').pop() ||
      'Unknown';
  } catch {}

  // Parse verbose log
  let verboseLog: any[] = [];
  try {
    verboseLog = task.verbose_log ? JSON.parse(task.verbose_log) : [];
  } catch {
    verboseLog = [];
  }

  // Parse failed files
  let failedFiles: Array<{ path: string; error: string }> = [];
  try {
    failedFiles = task.failed_files ? JSON.parse(task.failed_files) : [];
  } catch {
    failedFiles = [];
  }

  const isFolder = verboseLog.some(
    (l: any) => l.type === 'folder' || l.type === 'scan'
  );
  const infoEntry = verboseLog.find((l: any) => l.type === 'info');

  const uploadDoneEntries = verboseLog.filter(
    (l: any) => (l.type === 'upload' || l.type === 'download') && l.status === 'done'
  );
  const uploadErrorEntries = verboseLog.filter(
    (l: any) => (l.type === 'upload' || l.type === 'download') && l.status === 'error'
  );
  const uploadedFiles = uploadDoneEntries.length + uploadErrorEntries.length;

  let totalFiles = 0;
  let totalSize = 0;
  if (infoEntry) {
    const filesMatch = infoEntry.message.match(/Found (\d+) file/);
    if (filesMatch) totalFiles = parseInt(filesMatch[1], 10);
    const sizeMatch = infoEntry.message.match(
      /total: ([\d.]+)\s*(B|KB|MB|GB|TB)/i
    );
    if (sizeMatch) {
      const sizeVal = parseFloat(sizeMatch[1]);
      const unitMultipliers: Record<string, number> = {
        B: 1,
        KB: 1024,
        MB: 1024 ** 2,
        GB: 1024 ** 3,
        TB: 1024 ** 4,
      };
      totalSize = sizeVal * (unitMultipliers[sizeMatch[2].toUpperCase()] || 1);
    }
  }

  const uploadedSize = uploadDoneEntries.reduce(
    (sum: number, l: any) => sum + (l.size || 0),
    0
  );

  const currentUpload = verboseLog
    .filter((l: any) => (l.type === 'upload' || l.type === 'download') && (l.status === 'uploading' || l.status === 'downloading'))
    .pop();
  const currentFile = currentUpload?.file || undefined;

  const status = STATUS_MAP[task.status] || 'in-progress';
  const canResume = status === 'error' || status === 'completed-with-errors';

  return {
    id: task.id,
    fileName,
    type: task.type === 'UPLOAD' ? 'upload' : 'download',
    status,
    error: task.error_message,
    bytesTransferred: task.progress,
    totalBytes: 100,
    isFolder,
    totalFiles,
    uploadedFiles,
    totalSize,
    uploadedSize,
    currentFile,
    verboseLog,
    failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
    canResume,
  };
}

/**
 * Manages real-time task transfer tracking via SSE with REST polling fallback.
 * 
 * - Connects to /api/tasks/stream for real-time push updates
 * - Falls back to REST polling (every 5s) when SSE disconnects
 * - Hydrates state from REST on initial mount (handles browser reopen)
 * - Auto-reconnects SSE with exponential backoff
 */
const DISMISSED_STORAGE_KEY = 'nova_dismissed_task_ids';

function loadDismissedIds(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>) {
  try {
    if (typeof window === 'undefined') return;
    // Keep only the last 200 IDs to avoid localStorage bloat
    const arr = [...ids].slice(-200);
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(arr));
  } catch { /* ignore quota errors */ }
}

export function useTransferPolling(initialTransfers: TransferItem[] = []) {
  const [transfers, setTransfers] = useState<TransferItem[]>(initialTransfers);
  const transfersRef = useRef<TransferItem[]>(initialTransfers);
  const dismissedIdsRef = useRef<Set<string>>(loadDismissedIds());
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  // Keep ref in sync
  useEffect(() => {
    transfersRef.current = transfers;
  }, [transfers]);

  // Merge a single task update into transfers
  const mergeTaskUpdate = useCallback((task: any) => {
    if (dismissedIdsRef.current.has(task.id)) return;

    const transfer = taskToTransfer(task);

    setTransfers((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        // Only update if something changed
        const existing = prev[idx];
        if (
          existing.status === transfer.status &&
          existing.bytesTransferred === transfer.bytesTransferred &&
          existing.uploadedFiles === transfer.uploadedFiles &&
          (existing.verboseLog?.length || 0) === (transfer.verboseLog?.length || 0)
        ) {
          return prev; // No change
        }
        const updated = [...prev];
        updated[idx] = transfer;
        return updated;
      }

      // New task — only add if recent (<12 hours) or active
      const taskDate = new Date(task.updated_at + (task.updated_at.endsWith('Z') ? '' : 'Z')).getTime();
      if (
        Date.now() - taskDate < 43_200_000 ||
        task.status === 'PENDING' ||
        task.status === 'IN_PROGRESS'
      ) {
        return [...prev, transfer];
      }
      return prev;
    });
  }, []);

  // Bulk-merge all tasks (for init/fallback polling)
  const mergeAllTasks = useCallback((tasks: any[]) => {
    if (!Array.isArray(tasks)) return;

    setTransfers((prev) => {
      const updated = [...prev];
      let changed = false;

      tasks.forEach((task) => {
        if (dismissedIdsRef.current.has(task.id)) return;
        const transfer = taskToTransfer(task);
        const idx = updated.findIndex((t) => t.id === task.id);

        if (idx >= 0) {
          const existing = updated[idx];
          if (
            existing.status !== transfer.status ||
            existing.bytesTransferred !== transfer.bytesTransferred ||
            existing.uploadedFiles !== transfer.uploadedFiles ||
            (existing.verboseLog?.length || 0) !== (transfer.verboseLog?.length || 0)
          ) {
            updated[idx] = transfer;
            changed = true;
          }
        } else {
          const taskDate = new Date(task.updated_at + (task.updated_at.endsWith('Z') ? '' : 'Z')).getTime();
          if (
            Date.now() - taskDate < 43_200_000 ||
            task.status === 'PENDING' ||
            task.status === 'IN_PROGRESS'
          ) {
            updated.push(transfer);
            changed = true;
          }
        }
      });

      return changed ? updated : prev;
    });
  }, []);

  // SSE connection
  const connectSSE = useCallback(() => {
    // Close existing connection if any
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    try {
      const eventSource = new EventSource(`${API_BASE}/tasks/stream`, {
        withCredentials: true,
      });

      eventSource.addEventListener('connected', () => {
        reconnectAttemptRef.current = 0; // Reset backoff on successful connect
      });

      eventSource.addEventListener('init', (event) => {
        try {
          const tasks = JSON.parse(event.data);
          mergeAllTasks(tasks);
        } catch { /* ignore parse errors */ }
      });

      eventSource.addEventListener('task-update', (event) => {
        try {
          const task = JSON.parse(event.data);
          mergeTaskUpdate(task);
        } catch { /* ignore parse errors */ }
      });

      eventSource.onerror = () => {
        // SSE disconnected — close and schedule reconnect
        eventSource.close();
        sseRef.current = null;

        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // 1s, 2s, 4s, ..., max 30s
        reconnectAttemptRef.current = attempt + 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          connectSSE();
        }, delay);
      };

      sseRef.current = eventSource;
    } catch {
      // SSE not supported or connection failed — will rely on fallback polling
    }
  }, [mergeAllTasks, mergeTaskUpdate]);

  useEffect(() => {
    let isMounted = true;

    // 1. Initial hydration from REST
    const hydrate = async () => {
      try {
        const { data: tasks } = await tasksApi.getTasks();
        if (tasks && isMounted) {
          mergeAllTasks(tasks);
        }
      } catch { /* ignore */ }
    };
    hydrate();

    // 2. Connect SSE for real-time updates
    connectSSE();

    // 3. Fallback polling at 5s interval (covers SSE disconnects)
    const fallbackPoll = setInterval(async () => {
      // Only poll if SSE is not connected
      if (sseRef.current?.readyState === EventSource.OPEN) return;

      try {
        const { data: tasks } = await tasksApi.getTasks();
        if (tasks && isMounted) {
          mergeAllTasks(tasks);
        }
      } catch { /* ignore */ }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(fallbackPoll);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectSSE, mergeAllTasks]);

  const addTransfer = useCallback((transfer: TransferItem) => {
    setTransfers((prev) => [...prev, transfer]);
  }, []);

  const updateTransfer = useCallback((id: string, update: Partial<TransferItem>) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...update } : t))
    );
  }, []);

  const clearTransfers = useCallback(() => {
    transfersRef.current.forEach((t) => dismissedIdsRef.current.add(t.id));
    saveDismissedIds(dismissedIdsRef.current);
    setTransfers([]);
  }, []);

  return { transfers, addTransfer, updateTransfer, clearTransfers };
}
