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
import { Input } from '@/components/ui/input';
import type { FileItem } from '@/types';

interface DownloadDialogProps {
  target: FileItem | null;
  downloadPath: string;
  onPathChange: (path: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function DownloadDialog({
  target,
  downloadPath,
  onPathChange,
  onClose,
  onConfirm,
}: DownloadDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download to Local</DialogTitle>
          <DialogDescription>
            Choose the local directory to save{' '}
            <span className="font-semibold text-foreground">{target?.name}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <label className="text-sm font-medium text-foreground mb-2 block">
            Destination Path
          </label>
          <Input
            value={downloadPath}
            onChange={(e) => onPathChange(e.target.value)}
            placeholder="e.g. C:\Downloads"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Download</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
