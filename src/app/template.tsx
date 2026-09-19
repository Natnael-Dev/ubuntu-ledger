'use client';

import React from 'react';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-route-enter flex-1 flex flex-col w-full">
      {children}
    </div>
  );
}
