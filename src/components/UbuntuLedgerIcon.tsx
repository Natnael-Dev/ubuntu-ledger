import React from 'react';

interface UbuntuLedgerIconProps {
  className?: string;
  size?: number;
}

/**
 * Canonical Ubuntu Ledger Brand Mark
 * Authoritative source: src/app/icon.svg & public/favicon.svg
 * Institutional ink frame (#14150F) with civic green square mark (#1F5C3D) on paper ground (#FBFAF7)
 */
export function UbuntuLedgerIcon({ className = 'w-6 h-6', size }: UbuntuLedgerIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      {/* Paper background */}
      <rect width="32" height="32" rx="4" fill="#FBFAF7" />
      {/* Institutional ink frame */}
      <rect x="4" y="4" width="24" height="24" rx="2" stroke="#14150F" strokeWidth="2" fill="none" />
      {/* Institutional state-open confirmed green square mark */}
      <rect x="11" y="11" width="10" height="10" rx="1" fill="#1F5C3D" />
    </svg>
  );
}
