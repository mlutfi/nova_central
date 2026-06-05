'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileWarning } from 'lucide-react';
import { formatBytes } from '@/lib/format';
import type { FileItem } from '@/types';

interface FolderOverwriteDialogProps {
  target: {
    localFile: FileItem;
    conflicts: Array<{
      relativePath: string;
      localSize: number;
      driveSize: number;
      driveFileId: string;
    }>;
    skippable: Array<{ relativePath: string; size: number }>;
  } | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function FolderOverwriteDialog({
  target,
  onClose,
  onConfirm,
}: FolderOverwriteDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-amber-500" />
            Folder Upload Conflicts
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-3">
              <p>
                Some files in{' '}
                <span className="font-semibold text-foreground">
                  {target?.localFile.name}
                </span>{' '}
                already exist in this Drive folder with different sizes.
              </p>

              <div className="rounded-lg border border-border/50 bg-muted/30 p-2 max-h-[300px] overflow-y-auto">
                <div className="space-y-3">
                  {target?.conflicts.map((conflict, i) => (
                    <div key={i} className="text-sm">
                      <div
                        className="font-medium text-foreground truncate"
                        title={conflict.relativePath}
                      >
                        {conflict.relativePath}
                      </div>
                      <div className="flex items-center gap-4 text-xs mt-1">
                        <span className="text-muted-foreground">
                          Local:{' '}
                          <span className="font-medium text-foreground">
                            {formatBytes(conflict.localSize)}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          Drive:{' '}
                          <span className="font-medium text-foreground">
                            {formatBytes(conflict.driveSize)}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {target?.skippable && target.skippable.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Plus {target.skippable.length} identical files that will be skipped
                  automatically.
                </p>
              )}

              <p className="text-xs text-amber-600 font-medium">
                Do you want to overwrite these {target?.conflicts.length} conflicting files
                on Google Drive?
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel Upload
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Overwrite &amp; Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
