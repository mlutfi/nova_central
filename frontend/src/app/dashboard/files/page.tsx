'use client';

import { useState, useCallback, useEffect } from 'react';
import { FileBrowser, type FileItem } from '@/components/file-manager/file-browser';
import { UploadProgress, type TransferItem } from '@/components/file-manager/upload-progress';
import { fileManagerApi, tasksApi, settingsApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';

// ─── Types ───
interface BreadcrumbItem {
  label: string;
  id: string;
}

export default function FileManagerPage() {
  // ─── Local State ───
  const [localFiles, setLocalFiles] = useState<FileItem[]>([]);
  const [localPath, setLocalPath] = useState('');
  const [localBreadcrumbs, setLocalBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localViewMode, setLocalViewMode] = useState<'grid' | 'list'>('list');
  const [selectedLocalFile, setSelectedLocalFile] = useState<FileItem | null>(null);

  // ─── Drive State ───
  const [driveFiles, setDriveFiles] = useState<FileItem[]>([]);
  const [driveFolderId, setDriveFolderId] = useState<string>('');
  const [driveBreadcrumbs, setDriveBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'My Drive', id: '' },
  ]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveViewMode, setDriveViewMode] = useState<'grid' | 'list'>('list');
  const [selectedDriveFile, setSelectedDriveFile] = useState<FileItem | null>(null);

  // ─── Transfer State ───
  const [transfers, setTransfers] = useState<TransferItem[]>([]);

  // ─── Delete Confirmation ───
  const [deleteTarget, setDeleteTarget] = useState<{
    file: FileItem;
    source: 'local' | 'drive';
  } | null>(null);

  // ─── Download Folder Picker ───
  const [downloadTarget, setDownloadTarget] = useState<FileItem | null>(null);
  const [downloadPath, setDownloadPath] = useState('C:\\Downloads');

  // ─── Fetch Local Files ───
  const fetchLocalFiles = useCallback(async (dirPath: string) => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const { data, error } = await fileManagerApi.listLocal(dirPath);
      if (error) {
        setLocalError(error);
        return;
      }
      setLocalFiles(
        (data.files || []).map((f: any) => ({ ...f, source: 'local' as const }))
      );
      setLocalPath(data.currentPath);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to load files');
    } finally {
      setLocalLoading(false);
    }
  }, []);

  // ─── Fetch Drive Files ───
  const fetchDriveFiles = useCallback(async (folderId?: string) => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const { data, error } = await fileManagerApi.listDrive(folderId);
      if (error) {
        setDriveError(error);
        return;
      }
      setDriveFiles(
        (data.files || []).map((f: any) => ({ ...f, source: 'drive' as const }))
      );
      setDriveFolderId(data.folderId || '');
    } catch (err: any) {
      setDriveError(err.message || 'Failed to load Drive files');
    } finally {
      setDriveLoading(false);
    }
  }, []);

  // ─── Initial Load ───
  useEffect(() => {
    async function initLocal() {
      try {
        const { data } = await settingsApi.get();
        const rootPath = data?.file_manager_path || 'C:\\';
        navigateLocal(rootPath);
      } catch (err) {
        navigateLocal('C:\\');
      }
    }
    initLocal();
    fetchDriveFiles();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Transfer Polling ───
  useEffect(() => {
    let isMounted = true;
    const pollAll = async () => {
      let updatedAny = false;
      const newTransfers = [...transfers];

      // Poll background tasks (Uploads)
      try {
        const { data: tasks } = await tasksApi.getTasks();
        if (tasks && Array.isArray(tasks)) {
          // Merge tasks into newTransfers
          tasks.forEach((task: any) => {
            const existingIdx = newTransfers.findIndex(t => t.id === task.id);
            const statusMap: Record<string, TransferItem['status']> = {
              'PENDING': 'pending',
              'IN_PROGRESS': 'in-progress',
              'COMPLETED': 'completed',
              'FAILED': 'error'
            };
            
            let fileName = 'Unknown';
            try {
              const payload = JSON.parse(task.payload);
              fileName = payload.localPath.split('\\').pop() || payload.localPath.split('/').pop() || 'Unknown';
            } catch (e) {}

            const transferObj: TransferItem = {
              id: task.id,
              fileName,
              type: task.type === 'UPLOAD' ? 'upload' : 'download',
              status: statusMap[task.status] || 'in-progress',
              error: task.error_message,
              bytesTransferred: task.progress,
              totalBytes: 100 // We use 0-100% for tasks now
            };

            if (existingIdx >= 0) {
              // Only update if changed
              if (
                newTransfers[existingIdx].status !== transferObj.status ||
                newTransfers[existingIdx].bytesTransferred !== transferObj.bytesTransferred
              ) {
                newTransfers[existingIdx] = transferObj;
                updatedAny = true;
              }
            } else {
              // New task found (e.g. after page reload)
              // Only add if it's not completed from ages ago (e.g. less than 1 hour ago)
              const taskDate = new Date(task.updated_at).getTime();
              const now = Date.now();
              if (now - taskDate < 3600000 || task.status === 'PENDING' || task.status === 'IN_PROGRESS') {
                newTransfers.push(transferObj);
                updatedAny = true;
              }
            }
          });
        }
      } catch (e) {}

      // Poll legacy transfers (Downloads)
      for (let i = 0; i < newTransfers.length; i++) {
        if (newTransfers[i].status === 'in-progress' && !newTransfers[i].id.includes('-')) {
           // UUIDs have hyphens, local transfers might not. Wait, both might use UUIDs.
           // Tasks are tracked via DB, so their progress is updated above. 
           // For non-DB transfers, we poll getTransferProgress
           if (newTransfers[i].type === 'download') {
             try {
               const { data } = await fileManagerApi.getTransferProgress(newTransfers[i].id);
               if (data && (data.bytesTransferred !== undefined)) {
                 if (newTransfers[i].bytesTransferred !== data.bytesTransferred || newTransfers[i].totalBytes !== data.totalBytes) {
                   newTransfers[i] = {
                     ...newTransfers[i],
                     bytesTransferred: data.bytesTransferred,
                     totalBytes: data.totalBytes,
                   };
                   updatedAny = true;
                 }
               }
             } catch (e) {
               // Ignore
             }
           }
        }
      }

      if (updatedAny && isMounted) {
        setTransfers(newTransfers);
      }
    };

    const interval = setInterval(pollAll, 1000);
    pollAll(); // Initial poll

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [transfers]);

  // ─── Local Navigation ───
  const navigateLocal = useCallback(
    (dirPath: string) => {
      if (!dirPath) return;
      const isUnixAbsolute = dirPath.startsWith('/');
      const parts = dirPath.replace(/\\/g, '/').split('/').filter(Boolean);
      const breadcrumbs: BreadcrumbItem[] = [];

      for (let i = 0; i < parts.length; i++) {
        let pathSoFar = parts.slice(0, i + 1).join(isUnixAbsolute ? '/' : '\\');
        
        if (isUnixAbsolute) {
          pathSoFar = '/' + pathSoFar;
        }

        const fullPath = (!isUnixAbsolute && pathSoFar.includes(':')) 
            ? (pathSoFar.endsWith('\\') ? pathSoFar : pathSoFar + '\\') 
            : pathSoFar;
            
        breadcrumbs.push({
          label: parts[i],
          id: fullPath,
        });
      }

      // Ensure at least root
      if (breadcrumbs.length === 0) {
        if (isUnixAbsolute) {
          breadcrumbs.push({ label: '/', id: '/' });
        } else {
          breadcrumbs.push({ label: 'C:', id: 'C:\\' });
        }
      }

      setLocalBreadcrumbs(breadcrumbs);
      fetchLocalFiles(dirPath);
    },
    [fetchLocalFiles]
  );

  const handleLocalBreadcrumbClick = useCallback(
    (index: number) => {
      const crumb = localBreadcrumbs[index];
      if (crumb) {
        const newBreadcrumbs = localBreadcrumbs.slice(0, index + 1);
        setLocalBreadcrumbs(newBreadcrumbs);
        fetchLocalFiles(crumb.id);
      }
    },
    [localBreadcrumbs, fetchLocalFiles]
  );

  const handleLocalGoUp = useCallback(() => {
    if (localBreadcrumbs.length > 1) {
      const parentCrumb = localBreadcrumbs[localBreadcrumbs.length - 2];
      handleLocalBreadcrumbClick(localBreadcrumbs.length - 2);
    }
  }, [localBreadcrumbs, handleLocalBreadcrumbClick]);

  // ─── Drive Navigation ───
  const navigateDrive = useCallback(
    (folderId: string) => {
      // Find the folder name from current files
      const folder = driveFiles.find(
        (f) => f.source === 'drive' && f.id === folderId
      );
      if (folder) {
        setDriveBreadcrumbs((prev) => [
          ...prev,
          { label: folder.name, id: folderId },
        ]);
      }
      fetchDriveFiles(folderId);
    },
    [driveFiles, fetchDriveFiles]
  );

  const handleDriveBreadcrumbClick = useCallback(
    (index: number) => {
      const crumb = driveBreadcrumbs[index];
      if (crumb) {
        setDriveBreadcrumbs(driveBreadcrumbs.slice(0, index + 1));
        fetchDriveFiles(crumb.id || undefined);
      }
    },
    [driveBreadcrumbs, fetchDriveFiles]
  );

  const handleDriveGoUp = useCallback(() => {
    if (driveBreadcrumbs.length > 1) {
      handleDriveBreadcrumbClick(driveBreadcrumbs.length - 2);
    }
  }, [driveBreadcrumbs, handleDriveBreadcrumbClick]);

  // ─── Upload to Drive ───
  const handleUploadToDrive = useCallback(
    async (file: FileItem) => {
      if (file.source !== 'local') return;

      try {
        const targetFolderId = driveFolderId || '';
        const { error, data } = await fileManagerApi.uploadToDrive(
          file.path,
          targetFolderId
        );

        if (error) {
          toast.error(`Failed to start upload for ${file.name}`, { description: error });
        } else {
          toast.success(`Upload started for ${file.name} in background`);
          // Polling will pick it up and show progress
        }
      } catch (err: any) {
        toast.error(`Error: ${err.message}`);
      }
    },
    [driveFolderId]
  );

  // ─── Download from Drive ───
  const handleDownloadFromDrive = useCallback(
    (file: FileItem) => {
      if (file.source !== 'drive') return;
      setDownloadTarget(file);
      // Default to current local path
      setDownloadPath(localPath);
    },
    [localPath]
  );

  const confirmDownload = useCallback(async () => {
    if (!downloadTarget || downloadTarget.source !== 'drive') return;

    const transferId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

    const transfer: TransferItem = {
      id: transferId,
      fileName: downloadTarget.name,
      type: 'download',
      status: 'in-progress',
    };

    setTransfers((prev) => [...prev, transfer]);
    setDownloadTarget(null);

    try {
      const { error } = await fileManagerApi.downloadFromDrive(
        downloadTarget.id,
        downloadPath,
        downloadTarget.name,
        transferId
      );

      if (error) {
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transferId ? { ...t, status: 'error', error } : t
          )
        );
        toast.error(`Failed to download ${downloadTarget.name}`, {
          description: error,
        });
      } else {
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transferId ? { ...t, status: 'completed' } : t
          )
        );
        toast.success(`Downloaded ${downloadTarget.name}`);
        fetchLocalFiles(localPath);
      }
    } catch (err: any) {
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === transferId
            ? { ...t, status: 'error', error: err.message }
            : t
        )
      );
    }
  }, [downloadTarget, downloadPath, localPath, fetchLocalFiles]);

  // ─── Rename ───
  const handleLocalRename = useCallback(
    async (file: FileItem, newName: string) => {
      if (file.source !== 'local') return;
      const { error } = await fileManagerApi.renameLocal(file.path, newName);
      if (error) {
        toast.error('Failed to rename', { description: error });
      } else {
        toast.success(`Renamed to ${newName}`);
        fetchLocalFiles(localPath);
      }
    },
    [localPath, fetchLocalFiles]
  );

  const handleDriveRename = useCallback(
    async (file: FileItem, newName: string) => {
      if (file.source !== 'drive') return;
      const { error } = await fileManagerApi.renameDrive(file.id, newName);
      if (error) {
        toast.error('Failed to rename', { description: error });
      } else {
        toast.success(`Renamed to ${newName}`);
        fetchDriveFiles(driveFolderId || undefined);
      }
    },
    [driveFolderId, fetchDriveFiles]
  );

  // ─── Delete ───
  const handleDeleteRequest = useCallback(
    (file: FileItem, source: 'local' | 'drive') => {
      setDeleteTarget({ file, source });
    },
    []
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { file, source } = deleteTarget;
    setDeleteTarget(null);

    if (source === 'local' && file.source === 'local') {
      const { error } = await fileManagerApi.deleteLocal(file.path);
      if (error) {
        toast.error('Failed to delete', { description: error });
      } else {
        toast.success(`Deleted ${file.name}`);
        fetchLocalFiles(localPath);
      }
    } else if (source === 'drive' && file.source === 'drive') {
      const { error } = await fileManagerApi.deleteDrive(file.id);
      if (error) {
        toast.error('Failed to delete', { description: error });
      } else {
        toast.success(`Deleted ${file.name} from Drive`);
        fetchDriveFiles(driveFolderId || undefined);
      }
    }
  }, [deleteTarget, localPath, driveFolderId, fetchLocalFiles, fetchDriveFiles]);

  // ─── Create Folder ───
  const handleLocalNewFolder = useCallback(
    async (name: string) => {
      const { error } = await fileManagerApi.createLocalFolder(localPath, name);
      if (error) {
        toast.error('Failed to create folder', { description: error });
      } else {
        toast.success(`Created folder: ${name}`);
        fetchLocalFiles(localPath);
      }
    },
    [localPath, fetchLocalFiles]
  );

  const handleDriveNewFolder = useCallback(
    async (name: string) => {
      const parentId = driveFolderId || 'root';
      const { error } = await fileManagerApi.createDriveFolder(parentId, name);
      if (error) {
        toast.error('Failed to create folder', { description: error });
      } else {
        toast.success(`Created folder: ${name}`);
        fetchDriveFiles(driveFolderId || undefined);
      }
    },
    [driveFolderId, fetchDriveFiles]
  );

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
          files={localFiles}
          breadcrumbs={localBreadcrumbs}
          isLoading={localLoading}
          error={localError}
          viewMode={localViewMode}
          selectedFile={selectedLocalFile}
          onNavigate={navigateLocal}
          onBreadcrumbClick={handleLocalBreadcrumbClick}
          onGoUp={handleLocalGoUp}
          onSelectFile={setSelectedLocalFile}
          onViewModeChange={setLocalViewMode}
          onUploadToDrive={handleUploadToDrive}
          onRename={handleLocalRename}
          onDelete={(file) => handleDeleteRequest(file, 'local')}
          onNewFolder={handleLocalNewFolder}
          onRefresh={() => fetchLocalFiles(localPath)}
          canGoUp={localBreadcrumbs.length > 1}
        />

        {/* Google Drive Panel */}
        <FileBrowser
          title="Google Drive"
          source="drive"
          icon="drive"
          files={driveFiles}
          breadcrumbs={driveBreadcrumbs}
          isLoading={driveLoading}
          error={driveError}
          viewMode={driveViewMode}
          selectedFile={selectedDriveFile}
          onNavigate={navigateDrive}
          onBreadcrumbClick={handleDriveBreadcrumbClick}
          onGoUp={handleDriveGoUp}
          onSelectFile={setSelectedDriveFile}
          onViewModeChange={setDriveViewMode}
          onDownloadFromDrive={handleDownloadFromDrive}
          onRename={handleDriveRename}
          onDelete={(file) => handleDeleteRequest(file, 'drive')}
          onNewFolder={handleDriveNewFolder}
          onRefresh={() => fetchDriveFiles(driveFolderId || undefined)}
          canGoUp={driveBreadcrumbs.length > 1}
        />
      </div>

      {/* Transfer Progress */}
      <UploadProgress
        transfers={transfers}
        onClose={() => setTransfers([])}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirm Delete
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-foreground">
                {deleteTarget?.file.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Path Dialog */}
      <Dialog open={!!downloadTarget} onOpenChange={() => setDownloadTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download to Local</DialogTitle>
            <DialogDescription>
              Choose the local directory to save{' '}
              <span className="font-semibold text-foreground">
                {downloadTarget?.name}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Destination Path
            </label>
            <Input
              value={downloadPath}
              onChange={(e) => setDownloadPath(e.target.value)}
              placeholder="e.g. C:\Downloads"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDownloadTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirmDownload}>
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
