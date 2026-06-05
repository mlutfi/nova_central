'use client';

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '@/components/ui/context-menu';
import {
  Upload,
  Download,
  Pencil,
  Trash2,
  FolderPlus,
  Info,
  Copy,
  RefreshCw,
} from 'lucide-react';

interface FileContextMenuProps {
  source: 'local' | 'drive';
  isDirectory: boolean;
  hasSelection: boolean;
  onUploadToDrive?: () => void;
  onDownloadFromDrive?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onNewFolder?: () => void;
  onCopyPath?: () => void;
  onRefresh?: () => void;
  onInfo?: () => void;
}

export function FileContextMenu({
  source,
  isDirectory,
  hasSelection,
  onUploadToDrive,
  onDownloadFromDrive,
  onRename,
  onDelete,
  onNewFolder,
  onCopyPath,
  onRefresh,
  onInfo,
}: FileContextMenuProps) {
  return (
    <ContextMenuContent>
      {hasSelection && (
        <>
          {/* Cross-operations */}
          {source === 'local' && (
            <ContextMenuItem onClick={onUploadToDrive}>
              <Upload className="w-4 h-4 text-blue-500" />
              Upload to Google Drive
            </ContextMenuItem>
          )}

          {source === 'drive' && !isDirectory && (
            <ContextMenuItem onClick={onDownloadFromDrive}>
              <Download className="w-4 h-4 text-emerald-500" />
              Download to Local
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {/* Edit operations */}
          <ContextMenuItem onClick={onRename}>
            <Pencil className="w-4 h-4 text-amber-500" />
            Rename
          </ContextMenuItem>

          {source === 'local' && (
            <ContextMenuItem onClick={onCopyPath}>
              <Copy className="w-4 h-4 text-slate-400" />
              Copy Path
            </ContextMenuItem>
          )}

          <ContextMenuItem onClick={onInfo}>
            <Info className="w-4 h-4 text-blue-400" />
            Properties
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem destructive onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
            Delete
          </ContextMenuItem>
        </>
      )}

      {!hasSelection && (
        <>
          <ContextMenuLabel>Actions</ContextMenuLabel>
          <ContextMenuItem onClick={onNewFolder}>
            <FolderPlus className="w-4 h-4 text-amber-400" />
            New Folder
          </ContextMenuItem>

          <ContextMenuItem onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 text-blue-400" />
            Refresh
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
