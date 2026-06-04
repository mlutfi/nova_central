'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/* ─── Context Menu Primitives (Custom implementation) ─── */

interface Position {
  x: number;
  y: number;
}

interface ContextMenuContextType {
  isOpen: boolean;
  position: Position;
  open: (x: number, y: number) => void;
  close: () => void;
}

const ContextMenuContext = React.createContext<ContextMenuContextType>({
  isOpen: false,
  position: { x: 0, y: 0 },
  open: () => {},
  close: () => {},
});

export function ContextMenuProvider({
  children,
  onOpenChange,
}: {
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState<Position>({ x: 0, y: 0 });

  const open = React.useCallback(
    (x: number, y: number) => {
      setPosition({ x, y });
      setIsOpen(true);
      onOpenChange?.(true);
    },
    [onOpenChange]
  );

  const close = React.useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  return (
    <ContextMenuContext.Provider value={{ isOpen, position, open, close }}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  return React.useContext(ContextMenuContext);
}

export function ContextMenuTrigger({
  children,
  className,
  onContextMenu,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = useContextMenu();

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      open(e.clientX, e.clientY);
      onContextMenu?.(e);
    },
    [open, onContextMenu]
  );

  return (
    <div className={className} onContextMenu={handleContextMenu} {...props}>
      {children}
    </div>
  );
}

export function ContextMenuContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isOpen, position, close } = useContextMenu();
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = React.useState(position);

  // Adjust position to keep menu within viewport
  React.useEffect(() => {
    if (isOpen && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 8;
      }
      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 8;
      }

      setAdjustedPosition({ x: Math.max(8, x), y: Math.max(8, y) });
    }
  }, [isOpen, position]);

  // Close on click outside
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClick = () => close();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const handleScroll = () => close();

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, close]);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[100] min-w-[180px] overflow-hidden rounded-xl border border-border/60',
        'bg-popover/95 backdrop-blur-xl p-1.5 text-popover-foreground shadow-xl shadow-black/10',
        'animate-in fade-in-0 zoom-in-95 duration-150',
        className
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}


export function ContextMenuItem({
  children,
  className,
  onClick,
  disabled = false,
  destructive = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  destructive?: boolean;
}) {
  const { close } = useContextMenu();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    onClick?.(e);
    close();
  };

  return (
    <button
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium',
        'outline-none transition-colors duration-150',
        disabled
          ? 'opacity-40 pointer-events-none'
          : destructive
          ? 'text-destructive hover:bg-destructive/10 focus:bg-destructive/10'
          : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground focus:bg-accent',
        className
      )}
      onClick={handleClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function ContextMenuSeparator({ className }: { className?: string }) {
  return (
    <div
      className={cn('my-1 -mx-1 h-px bg-border/50', className)}
    />
  );
}

export function ContextMenuLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider',
        className
      )}
    >
      {children}
    </div>
  );
}
