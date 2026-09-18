'use client';
// SiteNav — Modern Civic Header
// Authoritative sources: Ubuntu Ledger Visual North Star (Reference 2)
// Clean layout: Ubuntu Ledger Brand + Supporting line | Center Nav Links | OSF Hackathon badge + avatar

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/',                      label: 'Home' },
  { href: '/simulator',             label: 'Simulator' },
  { href: '/console',               label: 'Console' },
  { href: '/receipt/4412',          label: 'Receipts' },
  { href: '/services/ET-ID-REPLACE',label: 'Divergence' },
  { href: '/pwa',                   label: 'Field' },
] as const;

export function SiteNav() {
  const pathname = usePathname() || '/';

  return (
    <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Ubuntu Ledger Brand Identity */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg p-1"
            aria-label="Ubuntu Ledger — Evidence. Accountability. Better Public Services."
          >
            {/* Green organic double-leaf / sprout brand mark */}
            <div className="flex items-center justify-center shrink-0">
              <svg
                className="w-7 h-7 text-[#16A34A] group-hover:scale-105 transition-transform"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 3C8.5 3 5 6.5 5 11c0 3.5 2.5 6 6.5 6.8-.2-1.5-.2-3.1.2-4.5.8-2.8 2.8-5.2 5.5-6.5C15.8 4.6 13.9 3 12 3z" />
                <path d="M12.5 10c-1.8 1.5-2.8 3.8-2.5 6.2.2 1.8 1.2 3.4 2.8 4.2 1.6.8 3.5.7 4.9-.3 2.1-1.5 3.3-4 3.3-6.6 0-3.3-2.7-5.5-5.5-5.5-1.1 0-2.1.7-3 2z" opacity="0.85" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-[#0F172A] leading-tight font-sans">
                Ubuntu Ledger
              </span>
              <span className="text-[11px] text-slate-500 font-medium tracking-normal hidden sm:inline">
                Evidence. Accountability. Better Public Services.
              </span>
            </div>
          </Link>

          {/* Center: Desktop Navigation Links (Breathable, bold deep-blue active link with anchored underline) */}
          <nav
            aria-label="Main Navigation"
            className="hidden md:flex items-center gap-7 lg:gap-9"
          >
            {NAV_LINKS.map(({ href, label }) => {
              const isActive =
                href === '/'
                  ? pathname === '/'
                  : pathname === href || pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-5 text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm ${
                    isActive
                      ? 'text-blue-600 font-bold'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  {label}
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-blue-600 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Clean right-hand area (uncluttered, visually dominant navigation) */}
          <div className="hidden sm:flex items-center">
            <span className="text-xs font-mono text-slate-500 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200">
              Ward 09 // Genesis
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
