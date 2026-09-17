import React from 'react';
import { MonitorPwaClient } from './MonitorPwaClient';

export const metadata = {
  title: 'Monitor Observation Outbox · Ward Proof-Line',
  description: 'Field monitor PWA with offline IndexedDB outbox and automatic synchronization.',
};

export default function PwaPage() {
  return <MonitorPwaClient />;
}
