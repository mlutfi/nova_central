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
import { logsApi } from '@/lib/api';
import {
  formatBytes,
  formatDuration,
  formatDate,
  getStatusColor,
  getTypeLabel,
} from '@/lib/format';
import { ScrollText, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/ui/motion';
import { TableRowSkeleton } from '@/components/ui/skeleton-loaders';
import type { LogEntry } from '@/types';

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async (page: number, type: string) => {
    setIsLoading(true);
    const typeParam = type === 'all' ? undefined : type;
    const { data, error } = await logsApi.getLogs(page, 20, typeParam);
    if (data && !error) {
      setLogs(data.logs);
      setPagination(data.pagination);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs(pagination.page, typeFilter);
  }, [fetchLogs, pagination.page, typeFilter]);

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
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
          </div>

          <Button
            id="refresh-logs"
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(pagination.page, typeFilter)}
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
        <Card className="border border-border/50 shadow-sm">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRowSkeleton cols={7} rows={7} />
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
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
                            <Badge variant="outline" className={`text-xs ${getStatusColor(log.status)}`}>
                              {log.status}
                            </Badge>
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
    </div>
  );
}
