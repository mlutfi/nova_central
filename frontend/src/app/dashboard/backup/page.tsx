'use client';

import { useCallback, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePolling } from '@/hooks/use-polling';
import { backupApi, settingsApi } from '@/lib/api';
import { formatBytes, formatRelativeTime, getStatusColor } from '@/lib/format';
import {
  Play,
  Square,
  FolderSync,
  Timer,
  Eye,
  RefreshCw,
  Clock,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

export default function BackupPage() {
  const fetchStatus = useCallback(() => backupApi.getStatus(), []);
  const fetchSettings = useCallback(() => settingsApi.get(), []);

  const { data: statusData, refresh: refreshStatus } = usePolling(fetchStatus, 3000);
  const { data: settingsData } = usePolling(fetchSettings, 30000);

  const status = statusData;
  const settings = settingsData?.settings;

  const [scheduleTime, setScheduleTime] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  useEffect(() => {
    if (settings?.backup_schedule) {
      const match = settings.backup_schedule.match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$/);
      if (match) {
        const [_, minute, hour] = match;
        setScheduleTime(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
      }
    }
  }, [settings?.backup_schedule]);

  const handleSaveSchedule = async () => {
    if (!scheduleTime) return;
    setIsSavingSchedule(true);
    try {
      const [hour, minute] = scheduleTime.split(':');
      const cronExpression = `${parseInt(minute)} ${parseInt(hour)} * * *`;
      const { error } = await settingsApi.update({
        backup_schedule: cronExpression,
      });
      if (error) {
        toast.error('Failed to update schedule');
      } else {
        toast.success('Backup schedule updated');
      }
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleStartBackup = async () => {
    const { error } = await backupApi.start();
    if (error) {
      toast.error('Failed to start backup', { description: error });
    } else {
      toast.success('Backup started');
      refreshStatus();
    }
  };

  const handleStopBackup = async () => {
    const { error } = await backupApi.stop();
    if (error) {
      toast.error('Failed to stop backup', { description: error });
    } else {
      toast.info('Backup stopped');
      refreshStatus();
    }
  };

  const toggleAutoBackup = async () => {
    const current = settings?.auto_backup_enabled === 'true';
    const { error } = await settingsApi.update({
      auto_backup_enabled: current ? 'false' : 'true',
    });
    if (error) {
      toast.error('Failed to update setting');
    } else {
      toast.success(current ? 'Auto backup disabled' : 'Auto backup enabled');
    }
  };

  const toggleFileWatcher = async () => {
    const current = settings?.file_watcher_enabled === 'true';
    const { error } = await settingsApi.update({
      file_watcher_enabled: current ? 'false' : 'true',
    });
    if (error) {
      toast.error('Failed to update setting');
    } else {
      toast.success(current ? 'File watcher disabled' : 'File watcher enabled');
    }
  };

  const currentJob = status?.currentJob;
  const progress = currentJob
    ? currentJob.files_total > 0
      ? Math.round((currentJob.files_synced / currentJob.files_total) * 100)
      : 0
    : 0;

  return (
    <div className="space-y-6">
      {/* Server Time Display */}
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>
          Server Time:{' '}
          <strong className="text-foreground">
            {status?.serverTime ? (
              `${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(status.serverTime))}, ${new Date(status.serverTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`
            ) : 'Loading...'}
          </strong>
        </span>
      </div>

      {/* Manual Backup Control */}
      <Card className="border border-primary/20 shadow-sm overflow-hidden bg-primary/5">
        <div>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FolderSync className="w-5 h-5 text-primary" />
              Manual Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Source:</span>
              <code className="text-xs font-mono bg-secondary/60 px-2 py-1 rounded">
                {settings?.source_path ?? 'Not configured'}
              </code>
            </div>

            {status?.isRunning && currentJob ? (
              <div className="space-y-3 p-4 bg-card rounded-lg border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-sm font-medium">Syncing in progress...</span>
                  </div>
                  <Badge variant="outline" className={getStatusColor('running')}>
                    {progress}%
                  </Badge>
                </div>

                <Progress value={progress} className="h-2" />

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-foreground">{currentJob.files_synced}</p>
                    <p className="text-xs text-muted-foreground">Synced</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{currentJob.files_total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{formatBytes(currentJob.bytes_transferred)}</p>
                    <p className="text-xs text-muted-foreground">Transferred</p>
                  </div>
                </div>

                <Button
                  id="stop-backup"
                  variant="destructive"
                  className="w-full"
                  onClick={handleStopBackup}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Backup
                </Button>
              </div>
            ) : (
              <Button
                id="start-backup"
                className="w-full h-12 text-base font-semibold shadow-md shadow-primary/20"
                onClick={handleStartBackup}
              >
                <Play className="w-5 h-5 mr-2" />
                Start Manual Backup
              </Button>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Auto Backup Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              Scheduled Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={status?.autoBackupEnabled ? 'default' : 'secondary'}>
                {status?.autoBackupEnabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-3">
              <Label htmlFor="backup-time">Backup Time (Daily)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="backup-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveSchedule} disabled={isSavingSchedule}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
            <Separator />
            <Button
              id="toggle-auto-backup"
              variant={status?.autoBackupEnabled ? 'outline' : 'default'}
              className="w-full"
              onClick={toggleAutoBackup}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {status?.autoBackupEnabled ? 'Disable Auto Backup' : 'Enable Auto Backup'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              File Watcher
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={status?.fileWatcherEnabled ? 'default' : 'secondary'}>
                {status?.fileWatcherEnabled ? 'Monitoring' : 'Inactive'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mode</span>
              <span className="text-sm text-foreground">Real-time sync</span>
            </div>
            <Button
              id="toggle-file-watcher"
              variant={status?.fileWatcherEnabled ? 'outline' : 'default'}
              className="w-full"
              onClick={toggleFileWatcher}
            >
              <Eye className="w-4 h-4 mr-2" />
              {status?.fileWatcherEnabled ? 'Disable File Watcher' : 'Enable File Watcher'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* File Stats */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">File Sync Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">
                {status?.fileStats?.total?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total Tracked</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-600">
                {status?.fileStats?.synced?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Synced</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-600">
                {status?.fileStats?.pending?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">
                {status?.fileStats?.errors?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Errors</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
