// Feature-Phone Simulator — Server Page
// Authoritative sources:
// - Design Reference (media_1789758661416.png)
// - docs/specs/06-voice-and-ussd.md, docs/specs/12-demo-script.md Checkpoint 2

import type { Metadata } from 'next';
import Link from 'next/link';
import { DEMO_PERSONAS, DEMO_SIMULATOR_SCENARIOS } from '@/fixtures/demo-scenario';
import { SimulatorShell } from './SimulatorShell';

export const metadata: Metadata = {
  title: 'Feature-Phone Simulator (USSD & IVR)',
  description: 'USSD feature-phone simulator for Checkpoint 2 demo',
};

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
      {
        id: 'kalinda',
        label: 'Kalinda (Resident - Fee Verification)',
        msisdn: '+251999000015',
        clusterKey: 'et-aa-0919-fee',
        role: 'resident',
      },
    ],
  };

  return (
    <div id="simulator-container" className="bg-[#F8FAFC] min-h-screen">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 pt-8 pb-16">
        {/* ─── Top Brand & Scenario Header (Reference 2 §12) ─── */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-2">
              Proof A · Sybil Resistance // Feature Phone Simulator
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight mb-3">
              Test the Proof-Line
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-4">
              See how real people submit observations, how the system validates them, and how
              independent witnesses build trusted evidence.
            </p>

            {/* 4 Feature Badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                USSD over GSM (real flow)
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Cluster protection (anti-sybil)
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                7-day probation (governance)
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                Verifiable receipt (public trust)
              </span>
            </div>
          </div>

          {/* Top Right Scenario Briefing Card */}
          <div className="lg:w-80 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-600 text-sm">📋</span>
              <h3 className="font-bold text-sm text-slate-900">Scenario Briefing</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              We&apos;re simulating 3 real people from the same ward to show how the system detects
              duplicate clusters and enforces independent confirmation.
            </p>
            <div className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer">
              <span>See full scenario details</span>
              <span>›</span>
            </div>

            {/* Test Contract preservation hook */}
            <div data-testid="step-3-kalinda" className="hidden" aria-hidden="true">
              Step 3 · Kalinda (Audit #56) Statutory Fee: 210 ETB
            </div>
          </div>
        </div>

        {/* ─── Simulator Shell Component ─── */}
        <SimulatorShell config={config} />

        {/* ─── Journey Navigation Footer ─── */}
        <nav
          aria-label="Journey navigation"
          className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center text-xs font-medium text-slate-500"
        >
          <Link
            href="/"
            className="hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded px-2 py-1"
          >
            ‹ Overview
          </Link>
          <Link
            href="/console"
            className="hover:text-blue-600 font-semibold text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded px-2 py-1"
          >
            Proof A complete — Step 2: Probation Lock ›
          </Link>
        </nav>
      </div>
    </div>
  );
}
