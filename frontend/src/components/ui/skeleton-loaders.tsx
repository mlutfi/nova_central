'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// ─── Base Skeleton ────────────────────────────────────────────────────────────

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        'skeleton-shimmer rounded-md bg-muted/60',
        className
      )}
      style={style}
    />
  );
}

// ─── Page Loader ──────────────────────────────────────────────────────────────
// Full-page circular spinner shown during auth check / page transitions

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-5"
      >
        {/* Circular spinner with gradient ring */}
        <div className="relative w-14 h-14">
          <svg
            className="w-full h-full -rotate-90"
            viewBox="0 0 56 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Track ring */}
            <circle
              cx="28"
              cy="28"
              r="22"
              stroke="currentColor"
              strokeWidth="4"
              className="text-muted/40"
            />
            {/* Animated progress ring */}
            <motion.circle
              cx="28"
              cy="28"
              r="22"
              stroke="url(#spinnerGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="138.2"
              strokeDashoffset="100"
              animate={{ rotate: 360 }}
              transition={{
                duration: 1.1,
                ease: 'linear',
                repeat: Infinity,
              }}
              style={{ transformOrigin: 'center' }}
            />
            <defs>
              <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>
          {/* Inner logo dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-primary/90 shadow-lg shadow-primary/30" />
          </div>
        </div>

        {/* Brand text */}
        <div className="text-center space-y-1">
          <motion.p
            className="text-sm font-semibold text-foreground tracking-tight"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            Nova Central
          </motion.p>
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Inline Circular Spinner ──────────────────────────────────────────────────
// Smaller spinner for in-content loading areas

export function CircularSpinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  const strokes = { sm: '2.5', md: '2', lg: '2' };

  return (
    <motion.svg
      className={cn(sizes[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, ease: 'linear', repeat: Infinity }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={strokes[size]}
        className="text-muted/40"
      />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke="currentColor"
        strokeWidth={strokes[size]}
        strokeLinecap="round"
        className="text-primary"
      />
    </motion.svg>
  );
}

// ─── Stat Card Skeleton ───────────────────────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-16 mt-1" />
        </div>
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      </div>
      <Skeleton className="h-3 w-20 mt-3" />
    </div>
  );
}

// ─── Card Skeleton ────────────────────────────────────────────────────────────

export function CardSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      {/* Body */}
      <div className="p-5 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-3.5" style={{ width: `${48 + (i % 3) * 12}%` }} />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Table Row Skeleton ───────────────────────────────────────────────────────

export function TableRowSkeleton({ cols = 7, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-border/20">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <td key={colIdx} className="px-4 py-3">
              <Skeleton
                className="h-4"
                style={{ width: colIdx === 0 ? '40px' : colIdx === cols - 1 ? '100px' : `${50 + (colIdx * 15) % 40}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── File Browser List Skeleton ───────────────────────────────────────────────

export function FileBrowserListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/20">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <Skeleton className="w-5 h-5 rounded shrink-0" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-3.5" style={{ width: `${40 + (i * 13) % 45}%` }} />
          </div>
          <Skeleton className="h-3 w-14 shrink-0" />
          <Skeleton className="h-3 w-28 shrink-0 hidden lg:block" />
        </div>
      ))}
    </div>
  );
}

// ─── File Browser Grid Skeleton ───────────────────────────────────────────────

export function FileBrowserGridSkeleton({ items = 12 }: { items?: number }) {
  return (
    <div className="p-3 grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 p-3 rounded-xl">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      ))}
    </div>
  );
}

// ─── Audit Row Skeleton ───────────────────────────────────────────────────────

export function AuditRowSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/30">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3">
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      ))}
    </div>
  );
}

// ─── Settings Skeleton ────────────────────────────────────────────────────────

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl">
      {[4, 5, 2, 3].map((rows, i) => (
        <CardSkeleton key={i} rows={rows} />
      ))}
    </div>
  );
}
