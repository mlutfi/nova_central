'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { StaggerContainer, StaggerItem } from '@/components/ui/motion';
import { SettingsSkeleton } from '@/components/ui/skeleton-loaders';
import type { AppSettings } from '@/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [driveStatus, setDriveStatus] = useState<boolean | null>(null);

  // Password change state
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

  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      const exchangeToken = async () => {
        setIsSaving(true);
        const { data, error } = await settingsApi.exchangeDriveCode(code);
        if (error) {
          toast.error('Failed to get refresh token', { description: error });
        } else {
          toast.success('Refresh token obtained successfully');
          if (data?.settings) setSettings(data.settings);
        }
        setIsSaving(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      };
      exchangeToken();
    }
  }, [searchParams]);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await settingsApi.update(settings as Record<string, string>);
    if (error) toast.error('Failed to save settings', { description: error });
    else toast.success('Settings saved successfully');
    setIsSaving(false);
  };

  const handleTestDrive = async () => {
    setIsTesting(true);
    setDriveStatus(null);
    const { data, error } = await settingsApi.testDrive(settings as Record<string, string>);
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
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    const { error } = await authApi.changePassword(currentPassword, newPassword);
    if (error) {
      toast.error('Failed to change password', { description: error });
    } else {
      toast.success('Password changed successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <StaggerContainer className="space-y-6 max-w-3xl">
      {/* Source Configuration */}
      <StaggerItem>
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              Source Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source-path" className="text-sm">Source Folder Path</Label>
              <textarea
                id="source-path"
                className="w-full h-20 px-3 py-2 text-sm font-mono bg-background border border-input rounded-md outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
                placeholder={'/home/user/backup-source\n/home/user/another-folder'}
                value={settings.source_path ?? ''}
                onChange={(e) => updateSetting('source_path', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paths to backup folders on the server. Separate multiple paths with newlines.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-manager-path" className="text-sm">File Manager Root Path</Label>
              <Input
                id="file-manager-path"
                value={settings.file_manager_path ?? ''}
                onChange={(e) => updateSetting('file_manager_path', e.target.value)}
                placeholder="/home/user/file-manager"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Root folder accessible via the File Manager.
              </p>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Google Drive */}
      <StaggerItem>
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cloud className="w-4 h-4 text-primary" />
              Google Drive
              {driveStatus !== null && (
                <Badge
                  variant="outline"
                  className={`ml-2 text-xs ${
                    driveStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {driveStatus ? (
                    <><CheckCircle className="w-3 h-3 mr-1" />Connected</>
                  ) : (
                    <><XCircle className="w-3 h-3 mr-1" />Disconnected</>
                  )}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: 'google-client-id', label: 'Client ID', key: 'google_client_id', placeholder: 'Google Client ID' },
              { id: 'google-client-secret', label: 'Client Secret', key: 'google_client_secret', placeholder: 'Google Client Secret', type: 'password' },
              { id: 'google-redirect-uri', label: 'Redirect URI', key: 'google_redirect_uri', placeholder: 'http://localhost:4300/dashboard/settings' },
            ].map(({ id, label, key, placeholder, type }) => (
              <div key={id} className="space-y-2">
                <Label htmlFor={id} className="text-sm">{label}</Label>
                <Input
                  id={id}
                  type={type}
                  value={settings[key] ?? ''}
                  onChange={(e) => updateSetting(key, e.target.value)}
                  placeholder={placeholder}
                  className="font-mono text-sm"
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="google-refresh-token" className="text-sm">Refresh Token</Label>
              <div className="flex gap-2">
                <Input
                  id="google-refresh-token"
                  type="password"
                  value={settings.google_refresh_token ?? ''}
                  onChange={(e) => updateSetting('google_refresh_token', e.target.value)}
                  placeholder="Google Refresh Token"
                  className="font-mono text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const { data, error } = await settingsApi.getDriveAuthUrl();
                    if (data?.authUrl) window.location.href = data.authUrl;
                    else toast.error('Failed to get Auth URL', { description: error });
                  }}
                >
                  Sign in with Google
                </Button>
              </div>
            </div>

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
                The ID of the folder where backups will be stored (found in the folder&apos;s URL).
              </p>
            </div>

            <Button id="test-drive" variant="outline" onClick={handleTestDrive} disabled={isTesting}>
              <TestTube className={`w-4 h-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Schedule */}
      <StaggerItem>
        <Card className="border border-border/50">
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
              <Label htmlFor="timezone" className="text-sm">Timezone</Label>
              <select
                id="timezone"
                value={settings.timezone ?? 'UTC'}
                onChange={(e) => updateSetting('timezone', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md outline-none focus:ring-2 focus:ring-ring"
              >
                <optgroup label="Common">
                  <option value="UTC">UTC</option>
                  <option value="Asia/Jakarta">Asia/Jakarta (WIB, UTC+7)</option>
                  <option value="Asia/Makassar">Asia/Makassar (WITA, UTC+8)</option>
                  <option value="Asia/Jayapura">Asia/Jayapura (WIT, UTC+9)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
                  <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                  <option value="Europe/Moscow">Europe/Moscow (MSK, UTC+3)</option>
                </optgroup>
                <optgroup label="Americas">
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Denver">America/Denver (MST/MDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="America/Sao_Paulo">America/São Paulo (BRT, UTC-3)</option>
                </optgroup>
                <optgroup label="Pacific / Australia">
                  <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                  <option value="Australia/Perth">Australia/Perth (AWST, UTC+8)</option>
                  <option value="Pacific/Auckland">Pacific/Auckland (NZST/NZDT)</option>
                </optgroup>
              </select>
              <p className="text-xs text-muted-foreground">
                Timezone used for scheduled backups and server time display.
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
      </StaggerItem>

      {/* Sync & Deletion Options */}
      <StaggerItem>
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-primary" />
              Sync & Deletion Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/30 hover:bg-card/50 transition-colors">
                <div className="flex flex-col space-y-1 pr-4">
                  <Label htmlFor="watcher-delete-on-drive" className="text-sm font-medium cursor-pointer">
                    Watcher: Delete on Google Drive when deleted locally
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically delete corresponding files on Google Drive when you delete them locally on the server.
                  </p>
                </div>
                <Switch
                  id="watcher-delete-on-drive"
                  checked={settings.watcher_delete_on_drive === 'true'}
                  onCheckedChange={(checked) => updateSetting('watcher_delete_on_drive', checked ? 'true' : 'false')}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/30 hover:bg-card/50 transition-colors">
                <div className="flex flex-col space-y-1 pr-4">
                  <Label htmlFor="backup-delete-on-drive" className="text-sm font-medium cursor-pointer">
                    Backup: Delete on Google Drive when deleted locally
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    During manual/auto backup, delete files on Google Drive that are no longer present on the server.
                  </p>
                </div>
                <Switch
                  id="backup-delete-on-drive"
                  checked={settings.backup_delete_on_drive === 'true'}
                  onCheckedChange={(checked) => updateSetting('backup_delete_on_drive', checked ? 'true' : 'false')}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors">
                <div className="flex flex-col space-y-1 pr-4">
                  <Label htmlFor="backup-delete-local" className="text-sm font-medium text-destructive dark:text-red-400 cursor-pointer">
                    Backup: Delete locally when deleted on Google Drive
                  </Label>
                  <p className="text-xs text-red-600/80 dark:text-red-400/80">
                    Warning: During manual/auto backup, if a file is missing on Google Drive, it will also be permanently deleted from the local server.
                  </p>
                </div>
                <Switch
                  id="backup-delete-local"
                  checked={settings.backup_delete_local === 'true'}
                  onCheckedChange={(checked) => updateSetting('backup_delete_local', checked ? 'true' : 'false')}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Save Button */}
      <StaggerItem>
        <Button
          id="save-settings"
          className="w-full h-11 font-semibold"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </StaggerItem>

      <StaggerItem>
        <Separator />
      </StaggerItem>

      {/* File Exclusion Filters */}
      <StaggerItem>
        <Card className="border border-border/50">
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
                Glob patterns for files/folders to exclude from backup. One per line.
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
                Files larger than this will be skipped (0 = no limit).
              </p>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Security — Password Change */}
      <StaggerItem>
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: 'current-password', label: 'Current Password', value: currentPassword, setter: setCurrentPassword, autoComplete: 'current-password' },
              { id: 'new-password', label: 'New Password', value: newPassword, setter: setNewPassword, autoComplete: 'new-password' },
              { id: 'confirm-password', label: 'Confirm New Password', value: confirmPassword, setter: setConfirmPassword, autoComplete: 'new-password' },
            ].map(({ id, label, value, setter, autoComplete }) => (
              <div key={id} className="space-y-2">
                <Label htmlFor={id} className="text-sm">{label}</Label>
                <Input
                  id={id}
                  type="password"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  autoComplete={autoComplete}
                />
              </div>
            ))}
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
      </StaggerItem>
    </StaggerContainer>
  );
}
