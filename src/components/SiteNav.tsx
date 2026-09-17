// SiteNav — Shared site navigation (08-ui-ux-design.md §7: deliberately plain)
// Design principle: navigation must not compete with page content.
// The civic receipt metaphor requires restraint — this is a tool, not a product.

import Link from 'next/link';

interface NavProps {
  currentPath?: string;
}

const NAV_LINKS = [
  { href: '/simulator', label: 'Simulator', abbr: 'SIM' },
  { href: '/receipt/4412', label: 'Receipt', abbr: 'RCT' },
  { href: '/console', label: 'Console', abbr: 'CON' },
  { href: '/services/ET-ID-REPLACE', label: 'Divergence', abbr: 'DIV' },
  { href: '/pwa', label: 'PWA', abbr: 'PWA' },
] as const;

export function SiteNav({ currentPath = '/' }: NavProps) {
  return (
    <nav
      aria-label="Ward Proof-Line site navigation"
      className="border-b border-[var(--rule)] bg-[var(--paper)]"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-11 gap-4">
        {/* Product identity */}
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 group focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 rounded"
          aria-label="Ward Proof-Line — Ubuntu Ledger home"
        >
          <span className="font-mono text-xs font-bold tracking-widest text-[var(--ink)] uppercase">
            Proof-Line
          </span>
          <span
            aria-hidden="true"
            className="hidden sm:inline text-[var(--rule)] select-none"
          >
            /
          </span>
          <span className="hidden sm:inline font-sans text-xs text-[var(--ink-soft)]">
            Ubuntu Ledger
          </span>
        </Link>

        {/* Route links */}
        <div
          className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none -mr-2 pr-2"
          role="list"
        >
          {NAV_LINKS.map(({ href, label, abbr }) => {
            const isActive = currentPath === href || currentPath.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                role="listitem"
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'px-2.5 sm:px-3 py-1.5 font-mono text-[11px] sm:text-xs tracking-wider transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 rounded',
                  isActive
                    ? 'text-[var(--ink)] font-bold border-b-2 border-[var(--ink)] bg-neutral-100/50'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-neutral-50',
                ].join(' ')}
              >
                <span className="sm:hidden font-semibold">{abbr}</span>
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Hackathon badge — visible on sm+ */}
        <span
          className="hidden md:flex shrink-0 items-center gap-1.5 border border-[var(--rule)] px-2 py-1 font-mono text-[10px] text-[var(--ink-soft)]"
          aria-label="OSF Hackathon submission — Transparency and Accountability track"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--state-open)]"
            aria-hidden="true"
          />
          OSF Hackathon · T&amp;A
        </span>
      </div>
    </nav>
  );
}
