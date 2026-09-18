// Feature-Phone Simulator — Server Page
// Authoritative sources: docs/specs/06-voice-and-ussd.md §1, §2, §10
//                        docs/specs/08-ui-ux-design.md §3
//                        docs/specs/11-tasks.md T-17
//                        docs/specs/12-demo-script.md §5 (Checkpoint 2)
//
// Architecture boundary: persona metadata is derived server-side from the canonical fixture
// and passed as plain props to the client component.  The client never imports domain code.
import type { Metadata } from 'next';
import Link from 'next/link';
import { DEMO_PERSONAS, DEMO_SIMULATOR_SCENARIOS } from '@/fixtures/demo-scenario';
import { SimulatorShell } from './SimulatorShell';

export const metadata: Metadata = {
  title: 'Feature-Phone Simulator (USSD & IVR)',
  description: 'USSD feature-phone simulator for Checkpoint 2 demo',
};

// Plain serializable type passed to the client component
export interface PersonaOption {
  id: string;
  label: string;
  msisdn: string;
  clusterKey: string;
  role: string;
}

export interface SimulatorConfig {
  targetProjectCode: string;
  personas: PersonaOption[];
}

export default function SimulatorPage() {
  const scenario = DEMO_SIMULATOR_SCENARIOS.heroScenario;

  const config: SimulatorConfig = {
    targetProjectCode: scenario.targetProjectCode,
    personas: [
      {
        id: DEMO_PERSONAS.AMINA.id,
        label: DEMO_PERSONAS.AMINA.label,
        msisdn: DEMO_PERSONAS.AMINA.msisdn,
        clusterKey: DEMO_PERSONAS.AMINA.clusterKey,
        role: 'primary',
      },
      {
        id: DEMO_PERSONAS.COLLIDING_NEIGHBOR.id,
        label: DEMO_PERSONAS.COLLIDING_NEIGHBOR.label,
        msisdn: DEMO_PERSONAS.COLLIDING_NEIGHBOR.msisdn,
        clusterKey: DEMO_PERSONAS.COLLIDING_NEIGHBOR.clusterKey,
        role: 'duplicate',
      },
      {
        id: DEMO_PERSONAS.ORIGINAL_REPORTER_1.id,
        label: DEMO_PERSONAS.ORIGINAL_REPORTER_1.label,
        msisdn: DEMO_PERSONAS.ORIGINAL_REPORTER_1.msisdn,
        clusterKey: DEMO_PERSONAS.ORIGINAL_REPORTER_1.clusterKey,
        role: 'witness',
      },
      {
        id: DEMO_PERSONAS.ORIGINAL_REPORTER_2.id,
        label: DEMO_PERSONAS.ORIGINAL_REPORTER_2.label,
        msisdn: DEMO_PERSONAS.ORIGINAL_REPORTER_2.msisdn,
        clusterKey: DEMO_PERSONAS.ORIGINAL_REPORTER_2.clusterKey,
        role: 'witness',
      },
    ],
  };

  return (
    <div className="bg-[var(--paper)] min-h-screen">
      <div className="max-w-7xl mx-auto p-4 md:p-8 pb-0">
        {/* USSD Orientation Banner */}
        <div className="bg-[var(--paper-warm)] border border-[var(--rule)] p-4 mb-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)] mb-2 font-bold">
            Proof A · Sybil Resistance · Demo Context
          </p>
          <p className="text-sm text-[var(--ink)] leading-relaxed mb-2">
            <strong className="font-semibold">USSD (*890#)</strong> is a GSM protocol that works on any feature phone without internet or a data plan — a $10 handset, no smartphone required. It is the primary citizen interface across rural Kenya and Ethiopia.
          </p>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
            <strong className="font-semibold">Amina</strong> is a resident of Woreda 9, Kebele 08. She is dialling to check whether AfroTech Infra actually repaired the health post generator (Contract #4412 · ETB 320,000). Switching to <strong className="font-semibold">Girma</strong> (same cell tower cluster) demonstrates Proof A: a second phone from the same geographic cluster cannot inflate the witness count.
          </p>
        </div>

        {/* Demo Checkpoint Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="border border-[var(--rule)] p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--state-hold)] font-bold mb-1">Step 1 · Amina</p>
            <p className="font-mono text-xs text-[var(--ink)]">Witness quorum: 2 of 3 → <strong>3 of 3</strong></p>
            <p className="text-xs text-[var(--ink-soft)] mt-1">Dial *890#, enter 4412, answer No to all 3 questions.</p>
          </div>
          <div className="border border-[var(--rule)] p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--state-break)] font-bold mb-1">Step 2 · Girma (same cluster)</p>
            <p className="font-mono text-xs text-[var(--ink)]">Witness quorum stays at <strong>3 of 3</strong> — suppressed</p>
            <p className="text-xs text-[var(--ink-soft)] mt-1">Switch to Girma, repeat. Backend rejects duplicate cluster.</p>
          </div>
        </div>
      </div>

      <SimulatorShell config={config} />

      <div className="max-w-7xl mx-auto p-4 md:p-8 pt-0">
        {/* Journey navigation */}
        <div className="mt-8 pt-4 border-t border-[var(--rule)] flex justify-between items-center font-mono text-[11px] text-[var(--ink-soft)]">
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">
            ‹ Overview
          </Link>
          <Link href="/console" className="hover:text-[var(--ink)] transition-colors font-semibold text-[var(--ink)]">
            Proof A complete — Step 2: Probation Lock ›
          </Link>
        </div>
      </div>
    </div>
  );
}
