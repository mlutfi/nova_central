'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  HardDrive,
  ScrollText,
  Settings,
  Shield,
  FolderOpen,
  ShieldCheck,
} from 'lucide-react';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'File Manager',
    href: '/dashboard/files',
    icon: FolderOpen,
  },
  {
    label: 'Backup',
    href: '/dashboard/backup',
    icon: HardDrive,
  },
  {
    label: 'Logs',
    href: '/dashboard/logs',
    icon: ScrollText,
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
  {
    label: 'Audit Log',
    href: '/dashboard/audit',
    icon: ShieldCheck,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[260px] bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center shadow-md shadow-sidebar-primary/25">
          <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">Nova Central</h1>
          <p className="text-[11px] text-sidebar-foreground/50">Backup Manager</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.label.toLowerCase()}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              <item.icon
                className={`w-[18px] h-[18px] transition-colors ${
                  isActive
                    ? 'text-sidebar-primary'
                    : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70'
                }`}
              />
              {item.label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <p className="text-[11px] text-sidebar-foreground/30">
          Nova Central v1.0.0
        </p>
      </div>
    </aside>
  );
}
