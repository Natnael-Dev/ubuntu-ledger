// Feature-Phone Simulator — Server Page
// Authoritative sources: docs/specs/06-voice-and-ussd.md §1, §2, §10
//                        docs/specs/08-ui-ux-design.md §3
//                        docs/specs/11-tasks.md T-17
//                        docs/specs/12-demo-script.md §5 (Checkpoint 2)
//
// Architecture boundary: persona metadata is derived server-side from the canonical fixture
// and passed as plain props to the client component.  The client never imports domain code.
import type { Metadata } from 'next';
import { DEMO_PERSONAS, DEMO_SIMULATOR_SCENARIOS } from '@/fixtures/demo-scenario';
import { SimulatorShell } from './SimulatorShell';

export const metadata: Metadata = {
  title: 'Feature-Phone Simulator — Ward Proof-Line',
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

  return <SimulatorShell config={config} />;
}
