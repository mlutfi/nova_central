'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  AlertTriangle,
  RotateCcw,
  Minus,
  Maximize2,
  Clock,
  RefreshCw,
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

function formatElapsed(startTs: string | undefined): string {
  if (!startTs) return '';
  const elapsed = Date.now() - new Date(startTs).getTime();
  if (elapsed < 0) return '';
  const secs = Math.floor(elapsed / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function getLogIcon(entry: VerboseLogEntry) {
  switch (entry.type) {
    case 'scan':
      return <Search className="w-3 h-3 text-blue-400 shrink-0" />;
    case 'info':
      return <Info className="w-3 h-3 text-sky-400 shrink-0" />;
    case 'folder':
      return <FolderPlus className="w-3 h-3 text-amber-400 shrink-0" />;
    case 'resume':
      return <RefreshCw className="w-3 h-3 text-violet-400 shrink-0" />;
    case 'upload':
      if (entry.status === 'done') return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />;
      if (entry.status === 'error') return <XCircle className="w-3 h-3 text-red-400 shrink-0" />;
      if (entry.status === 'uploading') return <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />;
      return <Upload className="w-3 h-3 text-muted-foreground shrink-0" />;
    case 'download':
      if (entry.status === 'done') return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />;
      if (entry.status === 'error') return <XCircle className="w-3 h-3 text-red-400 shrink-0" />;
      if (entry.status === 'downloading') return <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />;
      return <Download className="w-3 h-3 text-muted-foreground shrink-0" />;
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
  if (entry.type === 'done' || entry.status === 'done') return 'text-emerald-400';
  if (entry.status === 'uploading' || entry.status === 'downloading') return 'text-gray-300';
  if (entry.type === 'resume' || entry.status === 'resumed') return 'text-violet-400';
  if (entry.type === 'info') return 'text-sky-400';
  if (entry.type === 'folder') return 'text-amber-400';
  if (entry.type === 'scan') return 'text-blue-400';
  return 'text-gray-400';
}

function getLogTimestamp(entry: VerboseLogEntry): string {
  if (!entry.ts) return '';
  try {
    const d = new Date(entry.ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

// ─── Verbose Log Panel ────────────────────────────────────────────────────────

function VerboseLogPanel({ logs, autoScroll }: { logs: VerboseLogEntry[]; autoScroll: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div 
        ref={scrollRef}
        className="max-h-[200px] overflow-y-auto scrollbar-thin bg-[#0D1117] border border-[#30363D] rounded-lg mx-3 mb-3"
      >
        <div className="p-2 space-y-0.5">
          {logs.map((entry, i) => (
            <div
              key={i}
              className={`flex items-start gap-1.5 py-0.5 px-1.5 rounded text-[11px] leading-[16px] font-mono transition-colors ${
                i === logs.length - 1 &&
                (entry.status === 'uploading' || entry.status === 'downloading' || entry.type === 'scan')
                  ? 'bg-white/5'
                  : ''
              }`}
            >
              <span className="text-[10px] text-muted-foreground/40 shrink-0 w-[52px] tabular-nums">
                {getLogTimestamp(entry)}
              </span>
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

// ─── Failed Files Panel ──────────────────────────────────────────────────────

function FailedFilesPanel({ failedFiles }: { failedFiles: Array<{ path: string; error: string }> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mx-3 mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 transition-colors cursor-pointer"
      >
        <AlertTriangle className="w-3 h-3" />
        <span>{failedFiles.length} file{failedFiles.length !== 1 ? 's' : ''} failed</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 max-h-[120px] overflow-y-auto bg-red-500/5 border border-red-500/20 rounded-lg p-2 space-y-1">
              {failedFiles.map((f, i) => (
                <div key={i} className="text-[10px] font-mono">
                  <span className="text-red-400 truncate block">{f.path}</span>
                  <span className="text-red-400/60 truncate block pl-2">↳ {f.error}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Transfer Row ─────────────────────────────────────────────────────────────

function TransferRow({
  transfer,
  onResume,
}: {
  transfer: TransferItem;
  onResume?: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
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
    transfer.verboseLog?.filter((l) => (l.type === 'upload' || l.type === 'download') && (l.status === 'uploading' || l.status === 'downloading')).pop()?.file;

  // Get the first log entry timestamp for elapsed time
  const firstLogTs = transfer.verboseLog?.[0]?.ts;
  const isActive = transfer.status === 'in-progress';

  // Elapsed time — update every second for active transfers
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!isActive || !firstLogTs) {
      setElapsed(firstLogTs ? formatElapsed(firstLogTs) : '');
      return;
    }
    const tick = () => setElapsed(formatElapsed(firstLogTs));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isActive, firstLogTs]);

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
          ) : transfer.status === 'completed-with-errors' ? (
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
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
              <p className="text-[13px] font-medium text-foreground truncate max-w-[160px]">
                {transfer.fileName}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              {/* Elapsed time */}
              {elapsed && (
                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5 tabular-nums">
                  <Clock className="w-2.5 h-2.5" />
                  {elapsed}
                </span>
              )}
              {/* Type badge */}
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
          {transfer.error && transfer.status === 'error' ? (
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
              {elapsed ? ` • ${elapsed}` : ''}
            </p>
          ) : transfer.status === 'completed-with-errors' ? (
            <p className="text-[11px] text-amber-500">
              Completed with {transfer.failedFiles?.length || 0} error{(transfer.failedFiles?.length || 0) !== 1 ? 's' : ''}
              {elapsed ? ` • ${elapsed}` : ''}
            </p>
          ) : transfer.status === 'pending' ? (
            <p className="text-[11px] text-muted-foreground">Queued...</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Starting...</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="shrink-0 flex items-center gap-0.5">
          {/* Resume button */}
          {transfer.canResume && onResume && (
            <button
              onClick={() => onResume(transfer.id)}
              className="p-1 rounded-md hover:bg-muted/50 transition-colors text-primary hover:text-primary/80 cursor-pointer"
              title="Resume task"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Auto-scroll toggle (when expanded) */}
          {expanded && hasVerboseLog && (
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                autoScroll
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          )}

          {/* Expand toggle */}
          {hasVerboseLog && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
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
      </div>

      {/* Verbose log */}
      <AnimatePresence>
        {expanded && hasVerboseLog && (
          <VerboseLogPanel logs={transfer.verboseLog!} autoScroll={autoScroll} />
        )}
      </AnimatePresence>

      {/* Failed files panel */}
      {transfer.failedFiles && transfer.failedFiles.length > 0 && (
        <FailedFilesPanel failedFiles={transfer.failedFiles} />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface UploadProgressProps {
  transfers: TransferItem[];
  onClose: () => void;
  onResume?: (taskId: string) => void;
}

export function UploadProgress({ transfers, onClose, onResume }: UploadProgressProps) {
  const [minimized, setMinimized] = useState(false);

  if (transfers.length === 0) return null;

  const completed = transfers.filter((t) => t.status === 'completed').length;
  const withErrors = transfers.filter((t) => t.status === 'completed-with-errors').length;
  const errors = transfers.filter((t) => t.status === 'error').length;
  const active = transfers.filter(
    (t) => t.status === 'in-progress' || t.status === 'pending'
  ).length;
  const allDone = transfers.every(
    (t) => t.status === 'completed' || t.status === 'error' || t.status === 'completed-with-errors'
  );
  const hasErrors = errors > 0 || withErrors > 0;

  // Minimized view — small floating badge
  if (minimized) {
    return (
      <motion.button
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-full border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/10 cursor-pointer hover:scale-105 transition-transform"
        onClick={() => setMinimized(false)}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
      >
        {active > 0 ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <span className="text-xs font-medium text-foreground">{active} active</span>
          </>
        ) : hasErrors ? (
          <>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium text-foreground">Done with errors</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-foreground">All done</span>
          </>
        )}
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-6 right-6 z-50 w-[460px]"
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
                <AlertTriangle className="w-4 h-4 text-amber-500" />
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
                    ? `Completed with ${errors + withErrors} issue${errors + withErrors !== 1 ? 's' : ''}`
                    : 'Transfer complete!'
                  : `Transferring... (${completed}/${transfers.length})`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Minimize button */}
              <button
                onClick={() => setMinimized(true)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-md hover:bg-muted/50"
                title="Minimize"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              {/* Close/Dismiss */}
              {allDone && (
                <button
                  onClick={onClose}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-muted/50"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>

          {/* Transfer list */}
          <div className="max-h-[400px] overflow-y-auto">
            <AnimatePresence initial={false}>
              {transfers.map((transfer) => (
                <motion.div
                  key={transfer.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <TransferRow transfer={transfer} onResume={onResume} />
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
