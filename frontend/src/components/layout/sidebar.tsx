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
import { motion } from 'framer-motion';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'File Manager', href: '/dashboard/files', icon: FolderOpen },
  { label: 'Backup', href: '/dashboard/backup', icon: HardDrive },
  { label: 'Logs', href: '/dashboard/logs', icon: ScrollText },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  { label: 'Audit Log', href: '/dashboard/audit', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[260px] bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border shrink-0">
      {/* Logo */}
      <motion.div
        className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
        </motion.div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">Nova Central</h1>
          <p className="text-[11px] text-sidebar-foreground/50">Backup Manager</p>
        </div>
      </motion.div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item, idx) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href={item.href}
                id={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                {/* Active background indicator */}
                {isActive && (
                  <motion.div
                    layoutId="active-nav-bg"
                    className="absolute inset-0 rounded-lg bg-sidebar-accent"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}

                <item.icon
                  className={`relative z-10 w-[18px] h-[18px] transition-colors ${
                    isActive
                      ? 'text-sidebar-primary'
                      : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70'
                  }`}
                />
                <span className="relative z-10">{item.label}</span>

                {/* Active dot indicator */}
                {isActive && (
                  <motion.div
                    layoutId="active-nav-dot"
                    className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <p className="text-[11px] text-sidebar-foreground/30">Nova Central v1.0.0</p>
      </div>
    </aside>
  );
}
