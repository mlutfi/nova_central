'use client';

import { useState, useCallback, useEffect } from 'react';
import { fileManagerApi, settingsApi, tasksApi } from '@/lib/api';
import { toast } from 'sonner';
import type { FileItem, BreadcrumbItem, TransferItem } from '@/types';
import { useTransferPolling } from './use-transfer-polling';

/**
 * Encapsulates ALL state and business logic for the File Manager page.
 * The page component becomes purely presentational after using this hook.
 */
export function useFileManager() {
  // ── Local Filesystem State ───────────────────────────────────────────────
  const [localFiles, setLocalFiles] = useState<FileItem[]>([]);
  const [localPath, setLocalPath] = useState('');
  const [localBreadcrumbs, setLocalBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localViewMode, setLocalViewMode] = useState<'grid' | 'list'>('list');
  const [selectedLocalFile, setSelectedLocalFile] = useState<FileItem | null>(null);

  // ── Google Drive State ───────────────────────────────────────────────────
  const [driveFiles, setDriveFiles] = useState<FileItem[]>([]);
  const [driveFolderId, setDriveFolderId] = useState<string>('');
  const [driveBreadcrumbs, setDriveBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'My Drive', id: '' },
  ]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveViewMode, setDriveViewMode] = useState<'grid' | 'list'>('list');
  const [selectedDriveFile, setSelectedDriveFile] = useState<FileItem | null>(null);

  // ── Dialog State ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{
    file: FileItem;
    source: 'local' | 'drive';
  } | null>(null);

  const [overwriteTarget, setOverwriteTarget] = useState<{
    localFile: FileItem;
    existingDriveFile: FileItem;
    localSize: number;
    driveSize: number;
  } | null>(null);

  const [folderOverwriteTarget, setFolderOverwriteTarget] = useState<{
    localFile: FileItem;
    conflicts: Array<{
      relativePath: string;
      localSize: number;
      driveSize: number;
      driveFileId: string;
    }>;
    skippable: Array<{ relativePath: string; size: number }>;
  } | null>(null);

  const [downloadTarget, setDownloadTarget] = useState<FileItem | null>(null);
  const [downloadPath, setDownloadPath] = useState('C:\\Downloads');

  // ── Transfer / Polling ───────────────────────────────────────────────────
  const { transfers, addTransfer, updateTransfer, clearTransfers } = useTransferPolling();

  // ── Fetch Functions ──────────────────────────────────────────────────────

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

  // ── Initial Load ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function initLocal() {
      try {
        const { data } = await settingsApi.get();
        const rootPath = data?.settings?.file_manager_path || 'C:\\';
        navigateLocal(rootPath);
      } catch {
        navigateLocal('C:\\');
      }
    }
    initLocal();
    fetchDriveFiles();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Local Navigation ─────────────────────────────────────────────────────

  const navigateLocal = useCallback(
    (dirPath: string) => {
      if (!dirPath) return;
      const isUnixAbsolute = dirPath.startsWith('/');
      const parts = dirPath.replace(/\\/g, '/').split('/').filter(Boolean);
      const breadcrumbs: BreadcrumbItem[] = [];

      for (let i = 0; i < parts.length; i++) {
        let pathSoFar = parts.slice(0, i + 1).join(isUnixAbsolute ? '/' : '\\');
        if (isUnixAbsolute) pathSoFar = '/' + pathSoFar;
        const fullPath =
          !isUnixAbsolute && pathSoFar.includes(':')
            ? pathSoFar.endsWith('\\')
              ? pathSoFar
              : pathSoFar + '\\'
            : pathSoFar;
        breadcrumbs.push({ label: parts[i], id: fullPath });
      }

      if (breadcrumbs.length === 0) {
        breadcrumbs.push(
          isUnixAbsolute ? { label: '/', id: '/' } : { label: 'C:', id: 'C:\\' }
        );
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
        setLocalBreadcrumbs(localBreadcrumbs.slice(0, index + 1));
        fetchLocalFiles(crumb.id);
      }
    },
    [localBreadcrumbs, fetchLocalFiles]
  );

  const handleLocalGoUp = useCallback(() => {
    if (localBreadcrumbs.length > 1) {
      handleLocalBreadcrumbClick(localBreadcrumbs.length - 2);
    }
  }, [localBreadcrumbs, handleLocalBreadcrumbClick]);

  // ── Drive Navigation ──────────────────────────────────────────────────────

  const navigateDrive = useCallback(
    (folderId: string) => {
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

  // ── Upload Logic ──────────────────────────────────────────────────────────

  const startUpload = useCallback(
    async (
      localFilePath: string,
      fileName: string,
      overwrite?: boolean,
      existingDriveFileId?: string,
      overwriteMap?: Record<string, string>,
      skipPaths?: string[]
    ) => {
      try {
        const targetFolderId = driveFolderId || '';
        const { error, data } = await fileManagerApi.uploadToDrive(
          localFilePath,
          targetFolderId,
          undefined,
          overwrite,
          existingDriveFileId,
          overwriteMap,
          skipPaths
        );
        if (error) {
          toast.error(`Failed to start upload for ${fileName}`, { description: error });
        } else {
          toast.success(`Upload started for ${fileName} in background`);
          if (data?.taskId) {
            addTransfer({
              id: data.taskId,
              fileName,
              type: 'upload',
              status: 'pending',
              bytesTransferred: 0,
              totalBytes: 100,
            });
          }
        }
      } catch (err: any) {
        toast.error(`Error: ${err.message}`);
      }
    },
    [driveFolderId, addTransfer]
  );

  const handleUploadToDrive = useCallback(
    async (file: FileItem) => {
      if (file.source !== 'local') return;

      if (file.isDirectory) {
        try {
          const targetFolderId = driveFolderId || '';
          const { error, data } = await fileManagerApi.compareWithDrive(
            file.path,
            targetFolderId
          );
          if (error) {
            toast.error(`Failed to scan folder ${file.name}`, { description: error });
            return;
          }
          const { conflicts, skippable } = data;
          if (conflicts.length > 0) {
            setFolderOverwriteTarget({ localFile: file, conflicts, skippable });
            return;
          } else if (skippable.length > 0) {
            toast.info(`Uploading ${file.name}`, {
              description: `${skippable.length} identical files will be skipped.`,
            });
            startUpload(
              file.path,
              file.name,
              false,
              undefined,
              undefined,
              skippable.map((s: any) => s.relativePath)
            );
            return;
          } else {
            startUpload(file.path, file.name);
            return;
          }
        } catch (err: any) {
          toast.error(`Error scanning folder: ${err.message}`);
          return;
        }
      }

      const existingFile = driveFiles.find(
        (df) => df.name === file.name && df.source === 'drive'
      );

      if (existingFile && existingFile.source === 'drive') {
        const localSize = file.size;
        const driveSize = parseInt(existingFile.size || '0', 10);
        if (!existingFile.isFolder) {
          if (localSize === driveSize) {
            toast.info(`Skipped: ${file.name}`, {
              description: 'File with same name and size already exists on Drive',
            });
            return;
          }
          setOverwriteTarget({ localFile: file, existingDriveFile: existingFile, localSize, driveSize });
          return;
        }
      }

      startUpload(file.path, file.name);
    },
    [driveFiles, driveFolderId, startUpload]
  );

  const confirmOverwrite = useCallback(async () => {
    if (!overwriteTarget) return;
    const { localFile, existingDriveFile } = overwriteTarget;
    if (localFile.source !== 'local' || existingDriveFile.source !== 'drive') return;
    setOverwriteTarget(null);
    startUpload(localFile.path, localFile.name, true, existingDriveFile.id);
  }, [overwriteTarget, startUpload]);

  const confirmFolderOverwrite = useCallback(async () => {
    if (!folderOverwriteTarget) return;
    const { localFile, conflicts, skippable } = folderOverwriteTarget;
    if (localFile.source !== 'local') return;
    const overwriteMap: Record<string, string> = {};
    conflicts.forEach((c) => {
      overwriteMap[c.relativePath] = c.driveFileId;
    });
    const skipPaths = skippable.map((s) => s.relativePath);
    setFolderOverwriteTarget(null);
    startUpload(localFile.path, localFile.name, false, undefined, overwriteMap, skipPaths);
  }, [folderOverwriteTarget, startUpload]);

  // ── Download Logic ────────────────────────────────────────────────────────

  const handleDownloadFromDrive = useCallback(
    (file: FileItem) => {
      if (file.source !== 'drive') return;
      setDownloadTarget(file);
      setDownloadPath(localPath);
    },
    [localPath]
  );

  const confirmDownload = useCallback(async () => {
    if (!downloadTarget || downloadTarget.source !== 'drive') return;

    setDownloadTarget(null);

    try {
      const { error, data } = await fileManagerApi.downloadFromDrive(
        downloadTarget.id,
        downloadPath,
        downloadTarget.name
      );
      if (error) {
        toast.error(`Failed to start download for ${downloadTarget.name}`, { description: error });
      } else {
        toast.success(`Download started for ${downloadTarget.name} in background`);
        if (data?.taskId) {
          addTransfer({
            id: data.taskId,
            fileName: downloadTarget.name,
            type: 'download',
            status: 'pending',
            bytesTransferred: 0,
            totalBytes: 100,
          });
        }
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  }, [downloadTarget, downloadPath, addTransfer]);

  // ── Rename ────────────────────────────────────────────────────────────────

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

  // ── Delete ────────────────────────────────────────────────────────────────

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

  // ── Create Folder ─────────────────────────────────────────────────────────

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

  // ── Resume Task ────────────────────────────────────────────────────────

  const handleResumeTask = useCallback(
    async (taskId: string) => {
      try {
        const { error } = await tasksApi.resumeTask(taskId);
        if (error) {
          toast.error('Failed to resume task', { description: error });
        } else {
          toast.success('Task resumed');
        }
      } catch (err: any) {
        toast.error(`Error: ${err.message}`);
      }
    },
    []
  );

  return {
    // Local state
    localFiles,
    localPath,
    localBreadcrumbs,
    localLoading,
    localError,
    localViewMode,
    setLocalViewMode,
    selectedLocalFile,
    setSelectedLocalFile,
    // Drive state
    driveFiles,
    driveFolderId,
    driveBreadcrumbs,
    driveLoading,
    driveError,
    driveViewMode,
    setDriveViewMode,
    selectedDriveFile,
    setSelectedDriveFile,
    // Transfers
    transfers,
    clearTransfers,
    // Navigation handlers
    navigateLocal,
    handleLocalBreadcrumbClick,
    handleLocalGoUp,
    navigateDrive,
    handleDriveBreadcrumbClick,
    handleDriveGoUp,
    // File operation handlers
    handleUploadToDrive,
    handleDownloadFromDrive,
    handleLocalRename,
    handleDriveRename,
    handleDeleteRequest,
    handleLocalNewFolder,
    handleDriveNewFolder,
    // Refresh
    fetchLocalFiles,
    fetchDriveFiles,
    // Dialog state + confirmations
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    overwriteTarget,
    setOverwriteTarget,
    confirmOverwrite,
    folderOverwriteTarget,
    setFolderOverwriteTarget,
    confirmFolderOverwrite,
    downloadTarget,
    setDownloadTarget,
    downloadPath,
    setDownloadPath,
    confirmDownload,
    // Resume
    handleResumeTask,
  };
}
