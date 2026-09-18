'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UbuntuLedgerIcon } from '@/components/UbuntuLedgerIcon';

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
    <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">
          {/* Left: Ubuntu Ledger Canonical Brand Identity */}
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-xl p-1.5 -ml-1.5 transition-colors hover:bg-slate-50"
            aria-label="Ubuntu Ledger — Evidence. Accountability. Better Public Services."
          >
            {/* Authoritative Canonical Brand Icon */}
            <div className="flex items-center justify-center shrink-0 drop-shadow-xs group-hover:scale-105 transition-transform duration-150">
              <UbuntuLedgerIcon className="w-8 h-8 rounded-lg shadow-xs" size={32} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-[#0F172A] leading-tight font-sans">
                Ubuntu Ledger
              </span>
              <span className="text-xs text-slate-500 font-medium tracking-normal hidden sm:inline">
                Evidence. Accountability. Better Public Services.
              </span>
            </div>
          </Link>

          {/* Center: Desktop Navigation Links (Breathable, bold deep-blue active link with anchored underline) */}
          <nav
            aria-label="Main Navigation"
            className="hidden md:flex items-center gap-8 lg:gap-10"
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
                  className={`relative py-6 px-1 text-[15px] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md select-none ${
                    isActive
                      ? 'text-blue-700 font-bold'
                      : 'text-slate-600 hover:text-slate-950 font-medium hover:bg-slate-50/80'
                  }`}
                >
                  <span>{label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-0 h-[3px] bg-blue-600 rounded-full shadow-xs" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Ward identity pill */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-mono font-medium text-slate-600 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 shadow-2xs">
              Ward 09 // Genesis
            </span>
          </div>
        </div>

        {/* Mobile Horizontal Navigation Bar (under 768px) */}
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden flex items-center justify-between border-t border-slate-100 py-2.5 overflow-x-auto scrollbar-none gap-2 -mx-4 px-4"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors duration-150 shrink-0 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

