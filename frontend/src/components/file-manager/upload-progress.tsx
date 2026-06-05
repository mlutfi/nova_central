'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  FolderUp,
  FileText,
  FolderPlus,
  Search,
  Info,
  AlertCircle,
} from 'lucide-react';
import type { TransferItem, VerboseLogEntry } from '@/types';

// ─── Re-exports for backward compatibility ────────────────────────────────────

export type { TransferItem, VerboseLogEntry };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function getLogIcon(entry: VerboseLogEntry) {
  switch (entry.type) {
    case 'scan':
      return <Search className="w-3 h-3 text-blue-400 shrink-0" />;
    case 'info':
      return <Info className="w-3 h-3 text-sky-400 shrink-0" />;
    case 'folder':
      return <FolderPlus className="w-3 h-3 text-amber-400 shrink-0" />;
    case 'upload':
      if (entry.status === 'done') return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />;
      if (entry.status === 'error') return <XCircle className="w-3 h-3 text-red-400 shrink-0" />;
      if (entry.status === 'uploading') return <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />;
      return <Upload className="w-3 h-3 text-muted-foreground shrink-0" />;
    case 'done':
      return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />;
    case 'error':
      return <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />;
    case 'skip':
      return <FileText className="w-3 h-3 text-muted-foreground/50 shrink-0" />;
    default:
      return <FileText className="w-3 h-3 text-muted-foreground shrink-0" />;
  }
}

function getLogTextClass(entry: VerboseLogEntry): string {
  if (entry.type === 'error' || entry.status === 'error') return 'text-red-400';
  if (entry.type === 'done' || entry.status === 'done') return 'text-emerald-400/80';
  if (entry.status === 'uploading') return 'text-foreground';
  if (entry.type === 'info') return 'text-sky-400/80';
  if (entry.type === 'folder') return 'text-amber-400/80';
  if (entry.type === 'scan') return 'text-blue-400/80';
  return 'text-muted-foreground';
}

// ─── Verbose Log Panel ────────────────────────────────────────────────────────

function VerboseLogPanel({ logs }: { logs: VerboseLogEntry[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="max-h-[180px] overflow-y-auto scrollbar-thin bg-black/20 rounded-lg mx-3 mb-3">
        <div className="p-2 space-y-0.5">
          {logs.map((entry, i) => (
            <div
              key={i}
              className={`flex items-start gap-1.5 py-0.5 px-1.5 rounded text-[11px] leading-[16px] font-mono transition-colors ${
                i === logs.length - 1 &&
                (entry.status === 'uploading' || entry.type === 'scan')
                  ? 'bg-primary/5'
                  : ''
              }`}
            >
              <span className="mt-[1px]">{getLogIcon(entry)}</span>
              <span className={`${getLogTextClass(entry)} break-all`}>
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Transfer Row ─────────────────────────────────────────────────────────────

function TransferRow({ transfer }: { transfer: TransferItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasVerboseLog = transfer.verboseLog && transfer.verboseLog.length > 0;
  const isFolder =
    transfer.isFolder ||
    (hasVerboseLog && transfer.verboseLog!.some((l) => l.type === 'folder'));

  const uploadedFiles = transfer.uploadedFiles ?? 0;
  const totalFiles = transfer.totalFiles ?? 0;
  const progressPercent =
    transfer.totalBytes && transfer.totalBytes > 0
      ? Math.min(100, Math.round(((transfer.bytesTransferred || 0) / transfer.totalBytes) * 100))
      : 0;

  const currentFile =
    transfer.currentFile ||
    transfer.verboseLog?.filter((l) => l.type === 'upload' && l.status === 'uploading').pop()?.file;

  return (
    <div className="border-b border-border/20 last:border-0">
      {/* Main row */}
      <div className="px-4 py-2.5 flex items-center gap-3">
        {/* Status icon */}
        <div className="shrink-0">
          {transfer.status === 'in-progress' ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, ease: 'linear', repeat: Infinity }}>
              <Loader2 className="w-4 h-4 text-primary" />
            </motion.div>
          ) : transfer.status === 'completed' ? (
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </motion.div>
          ) : transfer.status === 'error' ? (
            <XCircle className="w-4 h-4 text-destructive" />
          ) : transfer.type === 'upload' ? (
            <Upload className="w-4 h-4 text-muted-foreground/50" />
          ) : (
            <Download className="w-4 h-4 text-muted-foreground/50" />
          )}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {isFolder && <FolderUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              <p className="text-[13px] font-medium text-foreground truncate max-w-[140px]">
                {transfer.fileName}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              {transfer.type === 'upload' ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                  UPLOAD
                </span>
              ) : (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                  DOWNLOAD
                </span>
              )}
            </div>
          </div>

          {/* Progress */}
          {transfer.error ? (
            <p className="text-[11px] text-destructive truncate">{transfer.error}</p>
          ) : transfer.status === 'in-progress' ? (
            <div className="space-y-1">
              {isFolder && totalFiles > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-right font-medium tabular-nums">
                      {progressPercent}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">
                      {uploadedFiles} of {totalFiles} file{totalFiles !== 1 ? 's' : ''}
                      {transfer.totalSize
                        ? ` • ${formatSize(transfer.uploadedSize || 0)} / ${formatSize(transfer.totalSize)}`
                        : ''}
                    </p>
                  </div>
                  {currentFile && (
                    <p className="text-[10px] text-primary/70 truncate">↗ {currentFile}</p>
                  )}
                </>
              ) : transfer.totalBytes ? (
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right font-medium">
                    {progressPercent}%
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Starting...</p>
              )}
            </div>
          ) : transfer.status === 'completed' ? (
            <p className="text-[11px] text-muted-foreground">
              Completed
              {isFolder && totalFiles > 0
                ? ` — ${totalFiles} file${totalFiles !== 1 ? 's' : ''}`
                : ''}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Starting...</p>
          )}
        </div>

        {/* Expand toggle */}
        {hasVerboseLog && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 p-1 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
            title={expanded ? 'Hide details' : 'Show details'}
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Verbose log */}
      <AnimatePresence>
        {expanded && hasVerboseLog && (
          <VerboseLogPanel logs={transfer.verboseLog!} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface UploadProgressProps {
  transfers: TransferItem[];
  onClose: () => void;
}

export function UploadProgress({ transfers, onClose }: UploadProgressProps) {
  if (transfers.length === 0) return null;

  const completed = transfers.filter((t) => t.status === 'completed').length;
  const hasErrors = transfers.some((t) => t.status === 'error');
  const allDone = transfers.every(
    (t) => t.status === 'completed' || t.status === 'error'
  );

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-6 right-6 z-50 w-[400px]"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/10 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {!allDone ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, ease: 'linear', repeat: Infinity }}
                >
                  <Loader2 className="w-4 h-4 text-primary" />
                </motion.div>
              ) : hasErrors ? (
                <XCircle className="w-4 h-4 text-destructive" />
              ) : (
                <motion.div
                  initial={{ scale: 0.5, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </motion.div>
              )}
              <span className="text-sm font-semibold text-foreground">
                {allDone
                  ? hasErrors
                    ? 'Transfer completed with errors'
                    : 'Transfer complete!'
                  : `Transferring... (${completed}/${transfers.length})`}
              </span>
            </div>
            {allDone && (
              <button
                onClick={onClose}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>

          {/* Transfer list */}
          <div className="max-h-[360px] overflow-y-auto">
            <AnimatePresence initial={false}>
              {transfers.map((transfer) => (
                <motion.div
                  key={transfer.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <TransferRow transfer={transfer} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Overall progress bar */}
          {!allDone && (
            <div className="h-1 bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-primary/70"
                initial={{ width: 0 }}
                animate={{ width: `${(completed / transfers.length) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
