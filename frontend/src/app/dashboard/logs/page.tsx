'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { logsApi } from '@/lib/api';
import {
  formatBytes,
  formatDuration,
  formatDate,
  getStatusColor,
  getTypeLabel,
} from '@/lib/format';
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  Clock,
  FolderSync,
  FileCheck2,
  FileWarning,
  HardDrive,
  Timer,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Ban,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/ui/motion';
import { TableRowSkeleton } from '@/components/ui/skeleton-loaders';
import type { LogEntry } from '@/types';

// ─── Status Icon Map ───
function StatusIcon({ status, className }: { status: string; className?: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className={className || 'w-4 h-4 text-emerald-600'} />;
    case 'running':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className={className || 'w-4 h-4 text-blue-600'} />
        </motion.div>
      );
    case 'failed':
      return <XCircle className={className || 'w-4 h-4 text-red-600'} />;
    case 'cancelled':
      return <Ban className={className || 'w-4 h-4 text-amber-600'} />;
    default:
      return <Clock className={className || 'w-4 h-4 text-muted-foreground'} />;
  }
}

// ─── Detail Row Component ───
function DetailRow({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary/60 shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium mt-0.5 ${valueClassName || 'text-foreground'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const fetchLogs = useCallback(async (page: number, type: string, status: string) => {
    setIsLoading(true);
    const typeParam = type === 'all' ? undefined : type;
    const statusParam = status === 'all' ? undefined : status;
    const { data, error } = await logsApi.getLogs(page, 20, typeParam, statusParam);
    if (data && !error) {
      setLogs(data.logs);
      setPagination(data.pagination);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs(pagination.page, typeFilter, statusFilter);
  }, [fetchLogs, pagination.page, typeFilter, statusFilter]);

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  // Calculate file progress percentage
  const getProgress = (log: LogEntry) => {
    if (!log.filesTotal || log.filesTotal === 0) return 0;
    return Math.round((log.filesSynced / log.filesTotal) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                if (v) {
                  setTypeFilter(v);
                  setPagination((p) => ({ ...p, page: 1 }));
                }
              }}
            >
              <SelectTrigger id="filter-type" className="w-[160px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="watcher">Auto Sync</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                if (v) {
                  setStatusFilter(v);
                  setPagination((p) => ({ ...p, page: 1 }));
                }
              }}
            >
              <SelectTrigger id="filter-status" className="w-[160px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            id="refresh-logs"
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(pagination.page, typeFilter, statusFilter)}
            disabled={isLoading}
          >
            <motion.div
              animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
              transition={isLoading ? { duration: 0.8, ease: 'linear', repeat: Infinity } : {}}
              className="mr-2"
            >
              <RefreshCw className="w-4 h-4" />
            </motion.div>
            Refresh
          </Button>
        </div>
      </FadeIn>

      {/* Logs Table */}
      <FadeIn delay={0.05}>
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-primary" />
              Backup History
              <Badge variant="secondary" className="ml-2 text-xs">
                {pagination.total} entries
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead className="w-[60px]">ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="w-[80px] text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRowSkeleton cols={8} rows={7} />
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <ScrollText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No logs found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <AnimatePresence mode="wait">
                      {logs.map((log, idx) => (
                        <motion.tr
                          key={log.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                          className="border-b border-border/20 hover:bg-secondary/20 transition-colors"
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            #{log.id}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {getTypeLabel(log.type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <StatusIcon status={log.status} className="w-3.5 h-3.5" />
                              <Badge variant="outline" className={`text-xs ${getStatusColor(log.status)}`}>
                                {log.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="text-emerald-600 font-medium">{log.filesSynced}</span>
                            <span className="text-muted-foreground">/{log.filesTotal}</span>
                            {log.filesFailed > 0 && (
                              <span className="text-red-500 ml-1">({log.filesFailed} ✗)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatBytes(log.bytesTransferred)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDuration(log.duration)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(log.startedAt)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              id={`view-log-${log.id}`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* ─── Log Detail Dialog ─── */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderSync className="w-5 h-5 text-primary" />
              Backup Log Detail
              {selectedLog && (
                <Badge variant="outline" className="ml-1 text-xs font-mono">
                  #{selectedLog.id}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Complete details for this backup operation.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Status + Type Header */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border/50">
                <StatusIcon status={selectedLog.status} className="w-5 h-5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${getStatusColor(selectedLog.status)}`}>
                      {selectedLog.status.charAt(0).toUpperCase() + selectedLog.status.slice(1)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {getTypeLabel(selectedLog.type)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* File Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">File Progress</span>
                  <span className="font-semibold">{getProgress(selectedLog)}%</span>
                </div>
                <Progress value={getProgress(selectedLog)} className="h-2" />
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="text-center p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
                    <p className="text-lg font-bold text-emerald-600">{selectedLog.filesSynced}</p>
                    <p className="text-[10px] text-emerald-600/70 uppercase tracking-wider font-medium">Synced</p>
                  </div>
                  <div className="text-center p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/30">
                    <p className="text-lg font-bold text-blue-600">{selectedLog.filesTotal}</p>
                    <p className="text-[10px] text-blue-600/70 uppercase tracking-wider font-medium">Total</p>
                  </div>
                  <div className="text-center p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/30">
                    <p className="text-lg font-bold text-red-600">{selectedLog.filesFailed}</p>
                    <p className="text-[10px] text-red-600/70 uppercase tracking-wider font-medium">Failed</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Detail Rows */}
              <div className="space-y-0.5">
                <DetailRow
                  icon={HardDrive}
                  label="Data Transferred"
                  value={formatBytes(selectedLog.bytesTransferred)}
                />
                <DetailRow
                  icon={FolderSync}
                  label="Source Path"
                  value={
                    <code className="text-xs font-mono bg-secondary/60 px-2 py-1 rounded break-all">
                      {selectedLog.sourcePath || 'N/A'}
                    </code>
                  }
                />
                <DetailRow
                  icon={Timer}
                  label="Duration"
                  value={formatDuration(selectedLog.duration)}
                />
                <DetailRow
                  icon={CalendarDays}
                  label="Started At"
                  value={formatDate(selectedLog.startedAt)}
                />
                <DetailRow
                  icon={CalendarDays}
                  label="Completed At"
                  value={selectedLog.completedAt ? formatDate(selectedLog.completedAt) : 'In progress...'}
                  valueClassName={selectedLog.completedAt ? 'text-foreground' : 'text-muted-foreground italic'}
                />
              </div>

              {/* Error Message */}
              {selectedLog.errorMessage && (
                <>
                  <Separator />
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/30">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Error Message</span>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-400 font-mono break-all">
                      {selectedLog.errorMessage}
                    </p>
                  </div>
                </>
              )}

              {/* Summary Badge */}
              {selectedLog.status === 'completed' && selectedLog.filesFailed === 0 && (
                <>
                  <Separator />
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        Backup completed successfully with no errors.
                      </span>
                    </div>
                  </div>
                </>
              )}

              {selectedLog.status === 'completed' && selectedLog.filesFailed > 0 && (
                <>
                  <Separator />
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30">
                    <div className="flex items-center gap-2">
                      <FileWarning className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Backup completed with {selectedLog.filesFailed} file(s) that failed to sync.
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter showCloseButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
