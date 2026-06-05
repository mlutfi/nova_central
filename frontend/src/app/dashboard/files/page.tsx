'use client';

import { FileBrowser } from '@/components/file-manager/file-browser';
import { UploadProgress } from '@/components/file-manager/upload-progress';
import { DeleteDialog } from '@/components/file-manager/dialogs/DeleteDialog';
import { OverwriteDialog } from '@/components/file-manager/dialogs/OverwriteDialog';
import { FolderOverwriteDialog } from '@/components/file-manager/dialogs/FolderOverwriteDialog';
import { DownloadDialog } from '@/components/file-manager/dialogs/DownloadDialog';
import { useFileManager } from '@/services/use-file-manager';

export default function FileManagerPage() {
  const fm = useFileManager();

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">File Manager</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage files between your local computer and Google Drive
          </p>
        </div>
      </div>

      {/* Dual Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Local Files Panel */}
        <FileBrowser
          title="Local Files"
          source="local"
          icon="local"
          files={fm.localFiles}
          breadcrumbs={fm.localBreadcrumbs}
          isLoading={fm.localLoading}
          error={fm.localError}
          viewMode={fm.localViewMode}
          selectedFile={fm.selectedLocalFile}
          onNavigate={fm.navigateLocal}
          onBreadcrumbClick={fm.handleLocalBreadcrumbClick}
          onGoUp={fm.handleLocalGoUp}
          onSelectFile={fm.setSelectedLocalFile}
          onViewModeChange={fm.setLocalViewMode}
          onUploadToDrive={fm.handleUploadToDrive}
          onRename={fm.handleLocalRename}
          onDelete={(file) => fm.handleDeleteRequest(file, 'local')}
          onNewFolder={fm.handleLocalNewFolder}
          onRefresh={() => fm.fetchLocalFiles(fm.localPath)}
          canGoUp={fm.localBreadcrumbs.length > 1}
        />

        {/* Google Drive Panel */}
        <FileBrowser
          title="Google Drive"
          source="drive"
          icon="drive"
          files={fm.driveFiles}
          breadcrumbs={fm.driveBreadcrumbs}
          isLoading={fm.driveLoading}
          error={fm.driveError}
          viewMode={fm.driveViewMode}
          selectedFile={fm.selectedDriveFile}
          onNavigate={fm.navigateDrive}
          onBreadcrumbClick={fm.handleDriveBreadcrumbClick}
          onGoUp={fm.handleDriveGoUp}
          onSelectFile={fm.setSelectedDriveFile}
          onViewModeChange={fm.setDriveViewMode}
          onDownloadFromDrive={fm.handleDownloadFromDrive}
          onRename={fm.handleDriveRename}
          onDelete={(file) => fm.handleDeleteRequest(file, 'drive')}
          onNewFolder={fm.handleDriveNewFolder}
          onRefresh={() => fm.fetchDriveFiles(fm.driveFolderId || undefined)}
          canGoUp={fm.driveBreadcrumbs.length > 1}
        />
      </div>

      {/* Transfer Progress */}
      <UploadProgress transfers={fm.transfers} onClose={fm.clearTransfers} />

      {/* ── Dialogs ── */}
      <DeleteDialog
        target={fm.deleteTarget}
        onClose={() => fm.setDeleteTarget(null)}
        onConfirm={fm.confirmDelete}
      />
      <OverwriteDialog
        target={fm.overwriteTarget}
        onClose={() => fm.setOverwriteTarget(null)}
        onConfirm={fm.confirmOverwrite}
      />
      <FolderOverwriteDialog
        target={fm.folderOverwriteTarget}
        onClose={() => fm.setFolderOverwriteTarget(null)}
        onConfirm={fm.confirmFolderOverwrite}
      />
      <DownloadDialog
        target={fm.downloadTarget}
        downloadPath={fm.downloadPath}
        onPathChange={fm.setDownloadPath}
        onClose={() => fm.setDownloadTarget(null)}
        onConfirm={fm.confirmDownload}
      />
    </div>
  );
}
