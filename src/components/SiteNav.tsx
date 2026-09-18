'use client';
// SiteNav — Shared site navigation (08-ui-ux-design.md A 7: deliberately plain)
// Design principle: navigation must not compete with page content.
// The civic receipt metaphor requires restraint — this is a tool, not a product.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/simulator',             label: 'Simulator',  step: '1', abbr: 'Sim' },
  { href: '/console',               label: 'Console',    step: '2', abbr: 'Con' },
  { href: '/receipt/4412',          label: 'Receipt',    step: '3', abbr: 'Rct' },
  { href: '/services/ET-ID-REPLACE',label: 'Divergence', step: '4', abbr: 'Div' },
  { href: '/pwa',                   label: 'PWA',        step: '5', abbr: 'PWA' },
] as const;

export function SiteNav() {
  const pathname = usePathname() || '/';

  return (
    <nav
      aria-label="Ward Proof-Line site navigation"
      className="no-print border-b border-[var(--rule)] bg-[var(--paper)]"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-11 gap-4">
        {/* Product identity */}
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0 group focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 rounded"
          aria-label="Ward Proof-Line — Ubuntu Ledger home"
        >
          {/* Logo mark */}
          <div className="w-4 h-4 border border-[var(--ink)] flex items-center justify-center flex-shrink-0">
            <div className="w-1.5 h-1.5 bg-[var(--state-open)]" />
          </div>
          <span className="font-mono text-xs font-bold tracking-widest text-[var(--ink)] uppercase">
            Proof-Line
          </span>
          <span
            aria-hidden="true"
            className="hidden sm:inline text-[var(--rule)] select-none"
          >
            /
          </span>
          <span className="hidden sm:inline font-mono text-[11px] text-[var(--ink-soft)] uppercase tracking-wider">
            Ubuntu Ledger
          </span>
        </Link>

        {/* Route links — canonical evaluator journey: Simulator → Console → Receipt → Divergence → PWA */}
        <div
          className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none -mr-2 pr-2"
          role="list"
        >
          {NAV_LINKS.map(({ href, label, step, abbr }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                role="listitem"
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'px-2.5 sm:px-3 py-1 font-mono text-[11px] sm:text-xs tracking-wider transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 rounded',
                  isActive
                    ? 'text-[var(--ink)] font-bold border-b-2 border-[var(--ink)] bg-neutral-200/40'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-neutral-100/50',
                ].join(' ')}
              >
                <span className="sm:hidden font-semibold">{`${step}·${abbr}`}</span>
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Hackathon badge — visible on sm+ */}
        <span
          className="hidden md:flex shrink-0 items-center gap-1.5 border border-[var(--rule)] px-2 py-0.5 font-mono text-[10px] text-[var(--ink-soft)]"
          aria-label="OSF Hackathon submission — Transparency and Accountability track"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--state-open)]"
            aria-hidden="true"
          />
          OSF Hackathon ↗ T&amp;A
        </span>
      </div>
    </nav>
  );
}
