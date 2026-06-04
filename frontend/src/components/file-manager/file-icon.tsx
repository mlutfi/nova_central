'use client';

import {
  File,
  Folder,
  Image,
  FileText,
  FileCode,
  Film,
  Music,
  Archive,
  FileSpreadsheet,
  Presentation,
  Database,
  FileJson,
  Settings,
  Lock,
  type LucideIcon,
} from 'lucide-react';

const extensionMap: Record<string, { icon: LucideIcon; color: string }> = {
  // Images
  '.jpg': { icon: Image, color: 'text-pink-500' },
  '.jpeg': { icon: Image, color: 'text-pink-500' },
  '.png': { icon: Image, color: 'text-pink-500' },
  '.gif': { icon: Image, color: 'text-pink-500' },
  '.svg': { icon: Image, color: 'text-pink-500' },
  '.webp': { icon: Image, color: 'text-pink-500' },
  '.ico': { icon: Image, color: 'text-pink-500' },
  '.bmp': { icon: Image, color: 'text-pink-500' },

  // Documents
  '.pdf': { icon: FileText, color: 'text-red-500' },
  '.doc': { icon: FileText, color: 'text-blue-600' },
  '.docx': { icon: FileText, color: 'text-blue-600' },
  '.txt': { icon: FileText, color: 'text-slate-500' },
  '.md': { icon: FileText, color: 'text-slate-600' },
  '.rtf': { icon: FileText, color: 'text-blue-500' },

  // Spreadsheets
  '.xls': { icon: FileSpreadsheet, color: 'text-emerald-600' },
  '.xlsx': { icon: FileSpreadsheet, color: 'text-emerald-600' },
  '.csv': { icon: FileSpreadsheet, color: 'text-emerald-500' },

  // Presentations
  '.ppt': { icon: Presentation, color: 'text-orange-500' },
  '.pptx': { icon: Presentation, color: 'text-orange-500' },

  // Code
  '.ts': { icon: FileCode, color: 'text-blue-500' },
  '.tsx': { icon: FileCode, color: 'text-blue-500' },
  '.js': { icon: FileCode, color: 'text-yellow-500' },
  '.jsx': { icon: FileCode, color: 'text-yellow-500' },
  '.py': { icon: FileCode, color: 'text-emerald-500' },
  '.java': { icon: FileCode, color: 'text-orange-600' },
  '.go': { icon: FileCode, color: 'text-cyan-500' },
  '.rs': { icon: FileCode, color: 'text-orange-500' },
  '.cpp': { icon: FileCode, color: 'text-blue-600' },
  '.c': { icon: FileCode, color: 'text-blue-500' },
  '.h': { icon: FileCode, color: 'text-purple-500' },
  '.cs': { icon: FileCode, color: 'text-violet-600' },
  '.php': { icon: FileCode, color: 'text-indigo-500' },
  '.rb': { icon: FileCode, color: 'text-red-600' },
  '.swift': { icon: FileCode, color: 'text-orange-500' },
  '.kt': { icon: FileCode, color: 'text-violet-500' },
  '.html': { icon: FileCode, color: 'text-orange-500' },
  '.css': { icon: FileCode, color: 'text-blue-500' },
  '.scss': { icon: FileCode, color: 'text-pink-500' },
  '.vue': { icon: FileCode, color: 'text-emerald-500' },
  '.sh': { icon: FileCode, color: 'text-slate-600' },
  '.bat': { icon: FileCode, color: 'text-slate-600' },

  // Data
  '.json': { icon: FileJson, color: 'text-yellow-600' },
  '.xml': { icon: FileCode, color: 'text-orange-400' },
  '.yaml': { icon: FileCode, color: 'text-red-400' },
  '.yml': { icon: FileCode, color: 'text-red-400' },
  '.toml': { icon: FileCode, color: 'text-slate-500' },
  '.sql': { icon: Database, color: 'text-blue-500' },
  '.db': { icon: Database, color: 'text-amber-600' },
  '.sqlite': { icon: Database, color: 'text-amber-600' },

  // Video
  '.mp4': { icon: Film, color: 'text-purple-500' },
  '.mov': { icon: Film, color: 'text-purple-500' },
  '.avi': { icon: Film, color: 'text-purple-500' },
  '.mkv': { icon: Film, color: 'text-purple-500' },
  '.webm': { icon: Film, color: 'text-purple-500' },

  // Audio
  '.mp3': { icon: Music, color: 'text-teal-500' },
  '.wav': { icon: Music, color: 'text-teal-500' },
  '.flac': { icon: Music, color: 'text-teal-500' },
  '.ogg': { icon: Music, color: 'text-teal-500' },
  '.m4a': { icon: Music, color: 'text-teal-500' },

  // Archives
  '.zip': { icon: Archive, color: 'text-amber-500' },
  '.rar': { icon: Archive, color: 'text-amber-500' },
  '.7z': { icon: Archive, color: 'text-amber-500' },
  '.tar': { icon: Archive, color: 'text-amber-500' },
  '.gz': { icon: Archive, color: 'text-amber-500' },
  '.bz2': { icon: Archive, color: 'text-amber-500' },

  // Config
  '.env': { icon: Lock, color: 'text-slate-500' },
  '.gitignore': { icon: Settings, color: 'text-slate-400' },
  '.eslintrc': { icon: Settings, color: 'text-purple-400' },
  '.prettierrc': { icon: Settings, color: 'text-pink-400' },
};

// Google Drive MIME type mapping
const mimeTypeMap: Record<string, { icon: LucideIcon; color: string }> = {
  'application/vnd.google-apps.folder': { icon: Folder, color: 'text-amber-400' },
  'application/vnd.google-apps.document': { icon: FileText, color: 'text-blue-600' },
  'application/vnd.google-apps.spreadsheet': { icon: FileSpreadsheet, color: 'text-emerald-600' },
  'application/vnd.google-apps.presentation': { icon: Presentation, color: 'text-orange-500' },
  'application/pdf': { icon: FileText, color: 'text-red-500' },
  'image/jpeg': { icon: Image, color: 'text-pink-500' },
  'image/png': { icon: Image, color: 'text-pink-500' },
  'image/gif': { icon: Image, color: 'text-pink-500' },
  'image/svg+xml': { icon: Image, color: 'text-pink-500' },
  'video/mp4': { icon: Film, color: 'text-purple-500' },
  'audio/mpeg': { icon: Music, color: 'text-teal-500' },
  'application/zip': { icon: Archive, color: 'text-amber-500' },
  'application/json': { icon: FileJson, color: 'text-yellow-600' },
  'text/plain': { icon: FileText, color: 'text-slate-500' },
  'text/html': { icon: FileCode, color: 'text-orange-500' },
  'text/css': { icon: FileCode, color: 'text-blue-500' },
  'application/javascript': { icon: FileCode, color: 'text-yellow-500' },
};

interface FileIconProps {
  name: string;
  isDirectory: boolean;
  extension?: string;
  mimeType?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function FileIcon({ name, isDirectory, extension, mimeType, size = 'md' }: FileIconProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  };

  if (isDirectory) {
    return <Folder className={`${sizeClasses[size]} text-amber-400`} />;
  }

  // Try MIME type first (for Google Drive files)
  if (mimeType && mimeTypeMap[mimeType]) {
    const { icon: Icon, color } = mimeTypeMap[mimeType];
    return <Icon className={`${sizeClasses[size]} ${color}`} />;
  }

  // Try extension
  const ext = extension || getExtension(name);
  if (ext && extensionMap[ext]) {
    const { icon: Icon, color } = extensionMap[ext];
    return <Icon className={`${sizeClasses[size]} ${color}`} />;
  }

  // Default
  return <File className={`${sizeClasses[size]} text-muted-foreground/60`} />;
}

function getExtension(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) return '';
  return name.substring(lastDot).toLowerCase();
}
