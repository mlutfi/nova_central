'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePolling } from '@/hooks/use-polling';
import { auditApi } from '@/lib/api';
import {
  ShieldCheck,
  LogIn,
  LogOut,
  KeyRound,
  Settings,
  FolderSync,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/ui/motion';
import { AuditRowSkeleton } from '@/components/ui/skeleton-loaders';
import type { AuditLogEntry } from '@/types';

const ACTION_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  LOGIN: { icon: LogIn, color: 'text-emerald-500', label: 'Login' },
  LOGOUT: { icon: LogOut, color: 'text-blue-500', label: 'Logout' },
  PASSWORD_CHANGE: { icon: KeyRound, color: 'text-amber-500', label: 'Password Changed' },
  SETTINGS_UPDATE: { icon: Settings, color: 'text-purple-500', label: 'Settings Updated' },
  BACKUP_START: { icon: FolderSync, color: 'text-primary', label: 'Backup Started' },
  BACKUP_STOP: { icon: FolderSync, color: 'text-red-500', label: 'Backup Stopped' },
};

const ALL_ACTIONS = Object.keys(ACTION_ICONS);

function AuditBadge({ action }: { action: string }) {
  const meta = ACTION_ICONS[action];
  if (!meta) return <Badge variant="outline" className="text-xs font-mono">{action}</Badge>;
  const Icon = meta.icon;
  return (
    <div className={`flex items-center gap-1.5 ${meta.color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">{meta.label}</span>
    </div>
  );
}

function formatDateTime(dateStr: string) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);

  const fetcher = useCallback(
    () => auditApi.getLogs(page, 20, actionFilter),
    [page, actionFilter]
  );
  const { data, isLoading } = usePolling(fetcher, 15000);

  const logs: AuditLogEntry[] = data?.logs ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track all user actions and security events
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>{pagination?.total ?? 0} total events</span>
          </div>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.05}>
        <Card className="border border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground mr-1">Filter by action:</span>
              <Button
                variant={actionFilter === undefined ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setActionFilter(undefined); setPage(1); }}
              >
                All
              </Button>
              {ALL_ACTIONS.map((action) => {
                const meta = ACTION_ICONS[action];
                const Icon = meta.icon;
                return (
                  <Button
                    key={action}
                    variant={actionFilter === action ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setActionFilter(action); setPage(1); }}
                  >
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Logs Table */}
      <FadeIn delay={0.1}>
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Activity Events
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && logs.length === 0 ? (
              <AuditRowSkeleton rows={8} />
            ) : logs.length === 0 ? (
              <div className="p-12 text-center">
                <ShieldCheck className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No audit events found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Events will appear here as users interact with the system
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 bg-secondary/30">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">User</span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">IP Address</span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40">Time</span>
                </div>
                <AnimatePresence mode="wait">
                  {logs.map((log, idx) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 hover:bg-accent/20 transition-colors"
                    >
                      <div className="min-w-0">
                        <AuditBadge action={log.action} />
                        {log.details && (
                          <p className="text-xs text-muted-foreground/60 mt-1 truncate">{log.details}</p>
                        )}
                      </div>
                      <div className="w-24">
                        <span className="text-xs font-medium text-foreground">{log.username}</span>
                      </div>
                      <div className="w-24">
                        <span className="text-xs font-mono text-muted-foreground/70">
                          {log.ip_address || '—'}
                        </span>
                      </div>
                      <div className="w-40">
                        <span className="text-xs text-muted-foreground/70">
                          {formatDateTime(log.created_at)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
                <span className="text-xs text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} events
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
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
