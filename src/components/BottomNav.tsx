'use client';
// BottomNav — Modern Mobile Navigation Bar
// Authoritative sources: Ubuntu Ledger Visual North Star (Reference 2 §8)
// Displays on mobile (<md), pinned to the bottom with safe-area support.
// 5 Destinations: Simulator, Console, Receipt, Services, Field

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const MOBILE_NAV_ITEMS: NavItem[] = [
  {
    href: '/simulator',
    label: 'Simulator',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
        <rect x="5" y="2" width="14" height="20" rx="3" strokeWidth={1.75} />
        <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth={2.5} strokeLinecap="round" />
        <rect x="8" y="5" width="8" height="6" rx="1" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    href: '/console',
    label: 'Console',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/receipt/4412',
    label: 'Receipt',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5l-3-2-3 2-3-2-3 2-3-2V5a2 2 0 012-2h14a2 2 0 012 2v16l-3-2z" />
      </svg>
    ),
  },
  {
    href: '/services/ET-ID-REPLACE',
    label: 'Services',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    href: '/pwa',
    label: 'Field',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname() || '/';

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg no-print"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 12px))' }}
    >
      <div className="grid grid-cols-5 h-14 items-center px-1">
        {MOBILE_NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all min-h-[44px] ${
                isActive
                  ? 'text-blue-600 font-semibold scale-105'
                  : 'text-slate-500 hover:text-slate-900 active:scale-95'
              }`}
            >
              <div className="relative">
                {icon}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-600" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 leading-tight">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
