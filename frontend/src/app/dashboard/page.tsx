'use client';

import { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { usePolling } from '@/hooks/use-polling';
import { dashboardApi, backupApi } from '@/lib/api';
import { formatBytes, formatRelativeTime, getStatusColor, getTypeLabel } from '@/lib/format';
import {
  HardDrive,
  Cloud,
  Clock,
  FileCheck,
  AlertTriangle,
  Activity,
  Play,
  FolderSync,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { StaggerContainer, StaggerItem, FadeIn } from '@/components/ui/motion';
import { StatCardSkeleton, CardSkeleton } from '@/components/ui/skeleton-loaders';

export default function DashboardPage() {
  const router = useRouter();

  const fetchStats = useCallback(() => dashboardApi.getStats(), []);
  const fetchStatus = useCallback(() => backupApi.getStatus(), []);
  const fetchJobs = useCallback(() => backupApi.getJobs(1, 5), []);

  const { data: statsData, isLoading: statsLoading } = usePolling(fetchStats, 10000);
  const { data: statusData, isLoading: statusLoading } = usePolling(fetchStatus, 5000);
  const { data: jobsData, isLoading: jobsLoading } = usePolling(fetchJobs, 10000);

  const stats = statsData;
  const status = statusData;

  const handleManualBackup = async () => {
    const { data, error } = await backupApi.start();
    if (error) {
      toast.error('Failed to start backup', { description: error });
    } else {
      toast.success('Backup started', { description: `Job #${data?.job?.id}` });
    }
  };

  const sourcePathDisplay = stats?.settings?.sourcePath
    ? stats.settings.sourcePath.split('\n').filter(Boolean).length > 1
      ? `${stats.settings.sourcePath.split('\n').filter(Boolean).length} folders`
      : stats.settings.sourcePath
    : '—';

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <Card className="border border-border/50 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total Files Synced
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {stats?.fileStats?.synced?.toLocaleString() ?? '—'}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats?.fileStats?.pending ?? 0} pending
                </p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="border border-border/50 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Storage Synced
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {formatBytes(stats?.fileStats?.totalSyncedBytes ?? 0)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Cloud className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatBytes(stats?.backupStats?.totalBytesTransferred ?? 0)} total transferred
                </p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="border border-border/50 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Last Backup
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {formatRelativeTime(stats?.backupStats?.lastBackup?.completed_at ?? null)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats?.backupStats?.completed ?? 0} total completed
                </p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="border border-border/50 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Failed Jobs
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {stats?.backupStats?.failed ?? 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats?.fileStats?.errors ?? 0} file errors
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sync Status */}
        {statusLoading ? (
          <CardSkeleton rows={4} className="lg:col-span-1" />
        ) : (
          <FadeIn delay={0.1}>
            <Card className="lg:col-span-1 border border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Sync Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <div className="flex items-center gap-2">
                    <motion.div
                      className={`w-2 h-2 rounded-full ${
                        status?.isRunning ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                      }`}
                      animate={status?.isRunning ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-sm font-medium">
                      {status?.isRunning ? 'Syncing...' : 'Idle'}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Auto Backup</span>
                  <Badge variant={status?.autoBackupEnabled ? 'default' : 'secondary'} className="text-xs">
                    {status?.autoBackupEnabled ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">File Watcher</span>
                  <Badge variant={status?.fileWatcherEnabled ? 'default' : 'secondary'} className="text-xs">
                    {status?.fileWatcherEnabled ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Source Path</span>
                  <span
                    className="text-xs font-mono text-foreground/70 truncate max-w-[140px]"
                    title={stats?.settings?.sourcePath}
                  >
                    {sourcePathDisplay}
                  </span>
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    id="quick-backup"
                    className="w-full"
                    onClick={handleManualBackup}
                    disabled={status?.isRunning}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {status?.isRunning ? 'Backup Running...' : 'Start Manual Backup'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/dashboard/backup')}
                  >
                    <FolderSync className="w-4 h-4 mr-2" />
                    Manage Backup
                  </Button>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* Recent Backups */}
        {jobsLoading ? (
          <CardSkeleton rows={5} className="lg:col-span-2" />
        ) : (
          <FadeIn delay={0.15}>
            <Card className="lg:col-span-2 border border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-primary" />
                    Recent Backups
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-primary hover:text-primary/80"
                    onClick={() => router.push('/dashboard/logs')}
                  >
                    View all
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {jobsData?.jobs && jobsData.jobs.length > 0 ? (
                  <motion.div
                    className="space-y-3"
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
                  >
                    {jobsData.jobs.map((job: any) => (
                      <motion.div
                        key={job.id}
                        variants={{
                          hidden: { opacity: 0, y: 8 },
                          visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                        }}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <motion.div
                            className={`w-2 h-2 rounded-full ${
                              job.status === 'running'
                                ? 'bg-emerald-500'
                                : job.status === 'completed'
                                ? 'bg-emerald-500'
                                : job.status === 'failed'
                                ? 'bg-red-500'
                                : 'bg-amber-500'
                            }`}
                            animate={job.status === 'running' ? { scale: [1, 1.4, 1] } : {}}
                            transition={{ duration: 1.2, repeat: Infinity }}
                          />
                          <div>
                            <p className="text-sm font-medium">
                              {getTypeLabel(job.type)} Backup
                              <span className="text-muted-foreground font-normal"> #{job.id}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatRelativeTime(job.started_at)} · {job.files_synced}/{job.files_total} files
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(job.status)}`}>
                          {job.status}
                        </Badge>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="text-center py-8">
                    <HardDrive className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No backup history yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Start your first backup to see it here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
