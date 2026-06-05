'use client';

import { useState, useEffect, useRef } from 'react';
import { tasksApi, fileManagerApi } from '@/lib/api';
import type { TransferItem } from '@/types';

/**
 * Manages polling of background task transfers (uploads + legacy downloads).
 * Extracted from the monolithic files/page.tsx to maintain single responsibility.
 */
export function useTransferPolling(initialTransfers: TransferItem[] = []) {
  const [transfers, setTransfers] = useState<TransferItem[]>(initialTransfers);
  const transfersRef = useRef<TransferItem[]>(initialTransfers);

  // Keep ref in sync so the interval closure always reads fresh state
  useEffect(() => {
    transfersRef.current = transfers;
  }, [transfers]);

  useEffect(() => {
    let isMounted = true;

    const pollAll = async () => {
      let updatedAny = false;
      const newTransfers = [...transfersRef.current];

      // ── Poll background tasks (Uploads via tasksApi) ──────────────────────
      try {
        const { data: tasks } = await tasksApi.getTasks();
        if (tasks && Array.isArray(tasks)) {
          tasks.forEach((task: any) => {
            const existingIdx = newTransfers.findIndex((t) => t.id === task.id);

            const statusMap: Record<string, TransferItem['status']> = {
              PENDING: 'pending',
              IN_PROGRESS: 'in-progress',
              COMPLETED: 'completed',
              FAILED: 'error',
            };

            // Extract fileName from task payload
            let fileName = 'Unknown';
            try {
              const payload = JSON.parse(task.payload);
              fileName =
                payload.localPath.split('\\').pop() ||
                payload.localPath.split('/').pop() ||
                'Unknown';
            } catch {}

            // Parse verbose log
            let verboseLog: any[] = [];
            try {
              verboseLog = task.verbose_log ? JSON.parse(task.verbose_log) : [];
            } catch {
              verboseLog = [];
            }

            const isFolder = verboseLog.some(
              (l: any) => l.type === 'folder' || l.type === 'scan'
            );
            const infoEntry = verboseLog.find((l: any) => l.type === 'info');

            const uploadDoneEntries = verboseLog.filter(
              (l: any) => l.type === 'upload' && l.status === 'done'
            );
            const uploadErrorEntries = verboseLog.filter(
              (l: any) => l.type === 'upload' && l.status === 'error'
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
              .filter((l: any) => l.type === 'upload' && l.status === 'uploading')
              .pop();
            const currentFile = currentUpload?.file || undefined;

            const transferObj: TransferItem = {
              id: task.id,
              fileName,
              type: task.type === 'UPLOAD' ? 'upload' : 'download',
              status: statusMap[task.status] || 'in-progress',
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
            };

            if (existingIdx >= 0) {
              const prev = newTransfers[existingIdx];
              if (
                prev.status !== transferObj.status ||
                prev.bytesTransferred !== transferObj.bytesTransferred ||
                prev.uploadedFiles !== transferObj.uploadedFiles ||
                (prev.verboseLog?.length || 0) !== (transferObj.verboseLog?.length || 0)
              ) {
                newTransfers[existingIdx] = transferObj;
                updatedAny = true;
              }
            } else {
              // Only add recent tasks (< 1 hour old) or active ones
              const taskDate = new Date(task.updated_at).getTime();
              if (
                Date.now() - taskDate < 3_600_000 ||
                task.status === 'PENDING' ||
                task.status === 'IN_PROGRESS'
              ) {
                newTransfers.push(transferObj);
                updatedAny = true;
              }
            }
          });
        }
      } catch {}

      // ── Poll legacy download transfers ────────────────────────────────────
      for (let i = 0; i < newTransfers.length; i++) {
        if (
          newTransfers[i].status === 'in-progress' &&
          newTransfers[i].type === 'download'
        ) {
          try {
            const { data } = await fileManagerApi.getTransferProgress(newTransfers[i].id);
            if (data && data.bytesTransferred !== undefined) {
              if (
                newTransfers[i].bytesTransferred !== data.bytesTransferred ||
                newTransfers[i].totalBytes !== data.totalBytes
              ) {
                newTransfers[i] = {
                  ...newTransfers[i],
                  bytesTransferred: data.bytesTransferred,
                  totalBytes: data.totalBytes,
                };
                updatedAny = true;
              }
            }
          } catch {}
        }
      }

      if (updatedAny && isMounted) {
        setTransfers(newTransfers);
      }
    };

    const interval = setInterval(pollAll, 1000);
    pollAll(); // Immediate first poll

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addTransfer = (transfer: TransferItem) => {
    setTransfers((prev) => [...prev, transfer]);
  };

  const updateTransfer = (id: string, update: Partial<TransferItem>) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...update } : t))
    );
  };

  const clearTransfers = () => setTransfers([]);

  return { transfers, addTransfer, updateTransfer, clearTransfers };
}
