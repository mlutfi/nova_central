'use client';

import { Upload, Download, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export interface TransferItem {
  id: string;
  fileName: string;
  type: 'upload' | 'download';
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  error?: string;
  bytesTransferred?: number;
  totalBytes?: number;
}

interface UploadProgressProps {
  transfers: TransferItem[];
  onClose: () => void;
}

export function UploadProgress({ transfers, onClose }: UploadProgressProps) {
  if (transfers.length === 0) return null;

  const completed = transfers.filter((t) => t.status === 'completed').length;
  const hasErrors = transfers.some((t) => t.status === 'error');
  const allDone = transfers.every((t) => t.status === 'completed' || t.status === 'error');

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/10 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {!allDone ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            ) : hasErrors ? (
              <XCircle className="w-4 h-4 text-destructive" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
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
        <div className="max-h-[240px] overflow-y-auto">
          {transfers.map((transfer) => (
            <div
              key={transfer.id}
              className="px-4 py-2.5 flex items-center gap-3 border-b border-border/20 last:border-0"
            >
              {/* Icon */}
              <div className="shrink-0">
                {transfer.status === 'in-progress' ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : transfer.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
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
                <div className="flex justify-between items-end mb-1">
                  <p className="text-[13px] font-medium text-foreground truncate max-w-[150px]">
                    {transfer.fileName}
                  </p>
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

                {transfer.error ? (
                  <p className="text-[11px] text-destructive truncate">{transfer.error}</p>
                ) : transfer.status === 'in-progress' && transfer.totalBytes ? (
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300 ease-out rounded-full" 
                        style={{ width: `${Math.min(100, Math.round((transfer.bytesTransferred || 0) / transfer.totalBytes * 100))}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-right font-medium">
                      {Math.min(100, Math.round((transfer.bytesTransferred || 0) / transfer.totalBytes * 100))}%
                    </span>
                  </div>
                ) : transfer.status === 'completed' ? (
                  <p className="text-[11px] text-muted-foreground">Completed</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Starting...</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {!allDone && (
          <div className="h-1 bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
              style={{ width: `${(completed / transfers.length) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
