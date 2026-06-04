'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { settingsApi, authApi } from '@/lib/api';
import {
  Settings as SettingsIcon,
  FolderOpen,
  Cloud,
  Clock,
  Shield,
  Save,
  TestTube,
  CheckCircle,
  XCircle,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [driveStatus, setDriveStatus] = useState<boolean | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchSettings = useCallback(async () => {
    const { data, error } = await settingsApi.get();
    if (data && !error) {
      setSettings(data.settings);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await settingsApi.update(settings);
    if (error) {
      toast.error('Failed to save settings', { description: error });
    } else {
      toast.success('Settings saved successfully');
    }
    setIsSaving(false);
  };

  const handleTestDrive = async () => {
    setIsTesting(true);
    setDriveStatus(null);
    const { data, error } = await settingsApi.testDrive();
    if (data?.connected) {
      setDriveStatus(true);
      toast.success('Google Drive connected successfully');
    } else {
      setDriveStatus(false);
      toast.error('Drive connection failed', { description: error || data?.error });
    }
    setIsTesting(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    const { error } = await authApi.changePassword(currentPassword, newPassword);
    if (error) {
      toast.error('Failed to change password', { description: error });
    } else {
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Source Configuration */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            Source Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source-path" className="text-sm">Source Folder Path</Label>
            <Input
              id="source-path"
              value={settings.source_path ?? ''}
              onChange={(e) => updateSetting('source_path', e.target.value)}
              placeholder="/home/user/backup-source"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Path to the folder on the server that will be backed up to Google Drive.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Google Drive */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Cloud className="w-4 h-4 text-primary" />
            Google Drive
            {driveStatus !== null && (
              <Badge variant="outline" className={`ml-2 text-xs ${driveStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {driveStatus ? <><CheckCircle className="w-3 h-3 mr-1" /> Connected</> : <><XCircle className="w-3 h-3 mr-1" /> Disconnected</>}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="drive-folder-id" className="text-sm">Target Folder ID</Label>
            <Input
              id="drive-folder-id"
              value={settings.drive_folder_id ?? ''}
              onChange={(e) => updateSetting('drive_folder_id', e.target.value)}
              placeholder="Enter Google Drive folder ID"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The ID of the Google Drive folder where backups will be stored. You can find this in the folder&apos;s URL.
            </p>
          </div>

          <Button
            id="test-drive"
            variant="outline"
            onClick={handleTestDrive}
            disabled={isTesting}
          >
            <TestTube className={`w-4 h-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Backup Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backup-schedule" className="text-sm">Cron Expression</Label>
            <Input
              id="backup-schedule"
              value={settings.backup_schedule ?? ''}
              onChange={(e) => updateSetting('backup_schedule', e.target.value)}
              placeholder="0 */6 * * *"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Schedule for automatic backups. Default: every 6 hours. Use{' '}
              <a href="https://crontab.guru" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                crontab.guru
              </a>{' '}
              to build expressions.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-uploads" className="text-sm">Max Concurrent Uploads</Label>
            <Input
              id="max-uploads"
              type="number"
              min={1}
              max={10}
              value={settings.max_concurrent_uploads ?? '3'}
              onChange={(e) => updateSetting('max_concurrent_uploads', e.target.value)}
              className="w-24"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        id="save-settings"
        className="w-full h-11 font-semibold shadow-md shadow-primary/20"
        onClick={handleSave}
        disabled={isSaving}
      >
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? 'Saving...' : 'Save Settings'}
      </Button>

      <Separator />

      {/* File Exclusion Filters */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            File Exclusion Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exclude-patterns" className="text-sm">Excluded Patterns (one per line)</Label>
            <textarea
              id="exclude-patterns"
              className="w-full h-28 px-3 py-2 text-sm font-mono bg-background border border-input rounded-md outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
              placeholder={'*.log\n*.tmp\n*.cache\n.DS_Store\nnode_modules/**'}
              value={settings.exclude_patterns ?? ''}
              onChange={(e) => updateSetting('exclude_patterns', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Glob patterns for files and folders to exclude from backup. Each pattern on a new line.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-file-size" className="text-sm">Max File Size to Sync (MB)</Label>
            <Input
              id="max-file-size"
              type="number"
              min={1}
              max={10000}
              placeholder="500"
              value={settings.max_file_size_mb ?? ''}
              onChange={(e) => updateSetting('max_file_size_mb', e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Files larger than this will be skipped during backup (0 = no limit).
            </p>
          </div>
        </CardContent>
      </Card>


      {/* Security — Password Change */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-sm">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            id="change-password"
            variant="outline"
            onClick={handleChangePassword}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            <Shield className="w-4 h-4 mr-2" />
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
