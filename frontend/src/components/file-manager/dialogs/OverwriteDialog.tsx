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

interface OverwriteDialogProps {
  target: {
    localFile: FileItem;
    existingDriveFile: FileItem;
    localSize: number;
    driveSize: number;
  } | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function OverwriteDialog({ target, onClose, onConfirm }: OverwriteDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-amber-500" />
            File Already Exists
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-3">
              <p>
                A file named{' '}
                <span className="font-semibold text-foreground">
                  {target?.localFile.name}
                </span>{' '}
                already exists in this Drive folder with a different size.
              </p>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Local file (new)</span>
                  <span className="font-medium text-foreground">
                    {formatBytes(target?.localSize ?? 0)}
                  </span>
                </div>
                <div className="h-px bg-border/40" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Drive file (existing)</span>
                  <span className="font-medium text-foreground">
                    {formatBytes(target?.driveSize ?? 0)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Do you want to overwrite the existing file on Google Drive?
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Overwrite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
