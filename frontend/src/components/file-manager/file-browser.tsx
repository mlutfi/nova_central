'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileIcon } from './file-icon';
import { FileContextMenu } from './file-context-menu';
import {
  ContextMenuProvider,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  ChevronRight,
  FolderPlus,
  RefreshCw,
  LayoutGrid,
  LayoutList,
  HardDrive,
  Cloud,
  ArrowUp,
  Search,
} from 'lucide-react';
import { formatBytes } from '@/lib/format';
import {
  FileBrowserListSkeleton,
  FileBrowserGridSkeleton,
} from '@/components/ui/skeleton-loaders';
import type { FileItem, BreadcrumbItem } from '@/types';

// ─── Re-export types for backward compatibility ───────────────────────────────

export type { FileItem };

export interface LocalFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  extension: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  isFolder: boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FileBrowserProps {
  title: string;
  source: 'local' | 'drive';
  icon: 'local' | 'drive';
  files: FileItem[];
  breadcrumbs: BreadcrumbItem[];
  isLoading: boolean;
  error?: string | null;
  viewMode: 'grid' | 'list';
  selectedFile: FileItem | null;
  onNavigate: (id: string) => void;
  onBreadcrumbClick: (index: number) => void;
  onGoUp: () => void;
  onSelectFile: (file: FileItem | null) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onUploadToDrive?: (file: FileItem) => void;
  onDownloadFromDrive?: (file: FileItem) => void;
  onRename: (file: FileItem, newName: string) => void;
  onDelete: (file: FileItem) => void;
  onNewFolder: (name: string) => void;
  onRefresh: () => void;
  canGoUp: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileBrowser({
  title,
  source,
  icon,
  files,
  breadcrumbs,
  isLoading,
  error,
  viewMode,
  selectedFile,
  onNavigate,
  onBreadcrumbClick,
  onGoUp,
  onSelectFile,
  onViewModeChange,
  onUploadToDrive,
  onDownloadFromDrive,
  onRename,
  onDelete,
  onNewFolder,
  onRefresh,
  canGoUp,
}: FileBrowserProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextFile, setContextFile] = useState<FileItem | null>(null);

  const filteredFiles = searchQuery
    ? files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  const handleDoubleClick = useCallback(
    (file: FileItem) => {
      const isDir = file.source === 'local' ? file.isDirectory : file.isFolder;
      if (isDir) {
        const id = file.source === 'local' ? file.path : file.id;
        onNavigate(id);
      }
    },
    [onNavigate]
  );

  const handleSelect = useCallback(
    (file: FileItem) => {
      onSelectFile(file);
      setContextFile(file);
    },
    [onSelectFile]
  );

  const startRename = useCallback((file: FileItem) => {
    const id = file.source === 'local' ? file.path : file.id;
    setRenaming(id);
    setRenameValue(file.name);
  }, []);

  const confirmRename = useCallback(() => {
    if (!renaming || !renameValue.trim()) {
      setRenaming(null);
      return;
    }
    const file = files.find((f) =>
      f.source === 'local' ? f.path === renaming : f.id === renaming
    );
    if (file && file.name !== renameValue.trim()) {
      onRename(file, renameValue.trim());
    }
    setRenaming(null);
  }, [renaming, renameValue, files, onRename]);

  const confirmNewFolder = useCallback(() => {
    if (newFolderName.trim()) {
      onNewFolder(newFolderName.trim());
    }
    setCreatingFolder(false);
    setNewFolderName('');
  }, [newFolderName, onNewFolder]);

  const handleCopyPath = useCallback(() => {
    if (contextFile && contextFile.source === 'local') {
      navigator.clipboard.writeText(contextFile.path);
    }
  }, [contextFile]);

  const getFileId = (file: FileItem): string =>
    file.source === 'local' ? file.path : file.id;

  const getFileSize = (file: FileItem): string => {
    if (file.source === 'local') {
      return file.isDirectory ? '—' : formatBytes(file.size);
    }
    return file.isFolder ? '—' : formatBytes(parseInt(file.size || '0'));
  };

  const getModifiedDate = (file: FileItem): string => {
    const dateStr = file.source === 'local' ? file.modifiedAt : file.modifiedTime;
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const isFileDirectory = (file: FileItem): boolean =>
    file.source === 'local' ? file.isDirectory : file.isFolder;

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
      {/* ── Header ── */}
      <div className="shrink-0 px-4 py-3 bg-gradient-to-r from-card to-secondary/20 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {icon === 'local' ? (
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <HardDrive className="w-4 h-4 text-blue-500" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Cloud className="w-4 h-4 text-emerald-500" />
              </div>
            )}
            <h3 className="text-sm font-bold text-foreground tracking-tight">{title}</h3>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onViewModeChange(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
            >
              {viewMode === 'grid' ? (
                <LayoutList className="w-4 h-4" />
              ) : (
                <LayoutGrid className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setCreatingFolder(true)}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              title="New folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <motion.button
              onClick={onRefresh}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              title="Refresh"
              animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
              transition={isLoading ? { duration: 0.8, ease: 'linear', repeat: Infinity } : { duration: 0.2 }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 mt-2 overflow-x-auto scrollbar-none">
          {canGoUp && (
            <button
              onClick={onGoUp}
              className="shrink-0 p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          )}
          {breadcrumbs.map((crumb, i) => (
            <div key={crumb.id} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
              <button
                onClick={() => onBreadcrumbClick(i)}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  i === breadcrumbs.length - 1
                    ? 'font-semibold text-foreground bg-accent/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                }`}
              >
                {crumb.label}
              </button>
            </div>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-background/50 border border-border/40 rounded-lg outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* ── File List ── */}
      <div
        className="flex-1 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelectFile(null);
        }}
      >
        {/* Error */}
        {error && (
          <div className="p-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Skeleton Loading */}
        {isLoading && !error && (
          viewMode === 'list'
            ? <FileBrowserListSkeleton rows={8} />
            : <FileBrowserGridSkeleton items={12} />
        )}

        {/* Empty state */}
        {!isLoading && !error && filteredFiles.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              {icon === 'local' ? (
                <HardDrive className="w-6 h-6 text-muted-foreground/30" />
              ) : (
                <Cloud className="w-6 h-6 text-muted-foreground/30" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No files match your search' : 'This folder is empty'}
            </p>
          </motion.div>
        )}

        {/* New folder input */}
        <AnimatePresence>
          {creatingFolder && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 py-2 border-b border-border/30 overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-amber-400 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmNewFolder();
                    if (e.key === 'Escape') {
                      setCreatingFolder(false);
                      setNewFolderName('');
                    }
                  }}
                  onBlur={confirmNewFolder}
                  className="flex-1 h-7 px-2 text-xs bg-background border border-primary/30 rounded-md outline-none focus:border-primary/60 transition-colors"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Files */}
        {!isLoading && !error && (
          viewMode === 'list' ? (
            /* ── List View ── */
            <motion.div
              className="divide-y divide-border/20"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
            >
              {filteredFiles.map((file) => {
                const id = getFileId(file);
                const isSelected = selectedFile && getFileId(selectedFile) === id;
                const isDir = isFileDirectory(file);

                return (
                  <motion.div
                    key={id}
                    variants={{
                      hidden: { opacity: 0, x: -6 },
                      visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
                    }}
                  >
                    <ContextMenuProvider>
                      <ContextMenuTrigger onContextMenu={() => handleSelect(file)}>
                        <div
                          className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-all duration-150 group ${
                            isSelected
                              ? 'bg-primary/8 border-l-2 border-l-primary'
                              : 'hover:bg-accent/30 border-l-2 border-l-transparent'
                          }`}
                          onClick={() => handleSelect(file)}
                          onDoubleClick={() => handleDoubleClick(file)}
                        >
                          <FileIcon
                            name={file.name}
                            isDirectory={isDir}
                            extension={file.source === 'local' ? file.extension : undefined}
                            mimeType={file.source === 'drive' ? file.mimeType : undefined}
                            size="md"
                          />

                          <div className="flex-1 min-w-0">
                            {renaming === id ? (
                              <input
                                type="text"
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') confirmRename();
                                  if (e.key === 'Escape') setRenaming(null);
                                }}
                                onBlur={confirmRename}
                                className="w-full h-6 px-1.5 text-xs bg-background border border-primary/40 rounded outline-none"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <p className="text-[13px] font-medium text-foreground truncate">
                                {file.name}
                              </p>
                            )}
                          </div>

                          <span className="text-[11px] text-muted-foreground/60 w-20 text-right shrink-0">
                            {getFileSize(file)}
                          </span>
                          <span className="text-[11px] text-muted-foreground/60 w-36 text-right shrink-0 hidden lg:block">
                            {getModifiedDate(file)}
                          </span>
                        </div>
                      </ContextMenuTrigger>

                      <FileContextMenu
                        source={source}
                        isDirectory={isDir}
                        hasSelection={true}
                        onUploadToDrive={() => onUploadToDrive?.(file)}
                        onDownloadFromDrive={() => onDownloadFromDrive?.(file)}
                        onRename={() => startRename(file)}
                        onDelete={() => onDelete(file)}
                        onNewFolder={() => setCreatingFolder(true)}
                        onCopyPath={handleCopyPath}
                        onRefresh={onRefresh}
                      />
                    </ContextMenuProvider>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            /* ── Grid View ── */
            <motion.div
              className="p-3 grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            >
              {filteredFiles.map((file) => {
                const id = getFileId(file);
                const isSelected = selectedFile && getFileId(selectedFile) === id;
                const isDir = isFileDirectory(file);

                return (
                  <motion.div
                    key={id}
                    variants={{
                      hidden: { opacity: 0, scale: 0.9 },
                      visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
                    }}
                  >
                    <ContextMenuProvider>
                      <ContextMenuTrigger onContextMenu={() => handleSelect(file)}>
                        <div
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer transition-all duration-150 group ${
                            isSelected
                              ? 'bg-primary/8 ring-1 ring-primary/20'
                              : 'hover:bg-accent/30'
                          }`}
                          onClick={() => handleSelect(file)}
                          onDoubleClick={() => handleDoubleClick(file)}
                        >
                          <div className="w-10 h-10 flex items-center justify-center">
                            <FileIcon
                              name={file.name}
                              isDirectory={isDir}
                              extension={file.source === 'local' ? file.extension : undefined}
                              mimeType={file.source === 'drive' ? file.mimeType : undefined}
                              size="lg"
                            />
                          </div>

                          {renaming === id ? (
                            <input
                              type="text"
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmRename();
                                if (e.key === 'Escape') setRenaming(null);
                              }}
                              onBlur={confirmRename}
                              className="w-full h-5 px-1 text-[11px] bg-background border border-primary/40 rounded outline-none text-center"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p className="text-[11px] font-medium text-foreground text-center leading-tight truncate w-full">
                              {file.name}
                            </p>
                          )}

                          <p className="text-[10px] text-muted-foreground/50">
                            {getFileSize(file)}
                          </p>
                        </div>
                      </ContextMenuTrigger>

                      <FileContextMenu
                        source={source}
                        isDirectory={isDir}
                        hasSelection={true}
                        onUploadToDrive={() => onUploadToDrive?.(file)}
                        onDownloadFromDrive={() => onDownloadFromDrive?.(file)}
                        onRename={() => startRename(file)}
                        onDelete={() => onDelete(file)}
                        onNewFolder={() => setCreatingFolder(true)}
                        onCopyPath={handleCopyPath}
                        onRefresh={onRefresh}
                      />
                    </ContextMenuProvider>
                  </motion.div>
                );
              })}
            </motion.div>
          )
        )}

        {/* Background context menu */}
        {!isLoading && !error && (
          <ContextMenuProvider>
            <ContextMenuTrigger
              className="min-h-[60px] flex-1"
              onContextMenu={() => onSelectFile(null)}
            >
              <div className="h-full" />
            </ContextMenuTrigger>
            <FileContextMenu
              source={source}
              isDirectory={false}
              hasSelection={false}
              onNewFolder={() => setCreatingFolder(true)}
              onRefresh={onRefresh}
            />
          </ContextMenuProvider>
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="shrink-0 px-4 py-2 bg-secondary/20 border-t border-border/30">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/60">
            {filteredFiles.length} item{filteredFiles.length !== 1 ? 's' : ''}
            {searchQuery && ` (filtered)`}
          </span>
          {selectedFile && (
            <motion.span
              key={getFileId(selectedFile)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[11px] text-primary font-medium truncate max-w-[200px]"
            >
              {selectedFile.name}
            </motion.span>
          )}
        </div>
      </div>
    </div>
  );
}
