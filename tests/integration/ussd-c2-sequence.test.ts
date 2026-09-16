// Checkpoint 2 (C2) Integration Test: Genuine USSD Trust Engine & Same-Cluster Suppression
// Authoritative sources:
// - docs/specs/12-demo-script.md §5 (Checkpoint 2)
// - docs/specs/06-voice-and-ussd.md §1, §2, §10
// - docs/specs/07-trust-and-security.md §3, §4, §5
// - docs/specs/04-state-machine.md §2, §7 (INV-02, INV-08)

import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/ussd/route';
import { resetServiceContainer, getServiceContainer } from '@/infra/db/container';
import { DEMO_IDS } from '@/fixtures/demo-scenario';

describe('Checkpoint 2 — Genuine USSD Trust Engine & Same-Cluster Suppression', () => {
  beforeEach(() => {
    resetServiceContainer();
  });

  const aminaPhone = '+251999000003';   // Cluster Gamma (Demo Phone 1)
  const girmaPhone = '+251999000004';   // Cluster Gamma (Colliding Neighbor, Same Area)

  function createUssdRequest(sessionId: string, phoneNumber: string, text: string): Request {
    return new Request('https://wardproofline.local/api/ussd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        phoneNumber,
        text,
      }),
    });
  }

  it('proves Checkpoint 2: Amina counts as Witness 3/3, then Girma receives duplicate suppression', async () => {
    const container = getServiceContainer();

    // 0. Verify initial baseline: Task 4412 has exactly 2 witnesses pre-seeded
    const initialTask = await container.taskRepo.getTaskForUpdate(DEMO_IDS.TASK_4412);
    expect(initialTask).toBeDefined();
    expect(initialTask?.witnessCount).toBe(2);
    expect(initialTask?.witnessTarget).toBe(3);

    // 1. Amina dials *890#, checks project 4412, and answers questions
    // Sequence: 1 (Check project) * 4412 (Project code) * 1 (Check project) * 1 (Q1 Yes) * 1 (Q2 Yes) * 1 (Q3 Yes)
    const aminaSessionId = 'session-c2-amina-001';
    const aminaReq = createUssdRequest(aminaSessionId, aminaPhone, '1*4412*1*1*1*1');
    const aminaRes = await POST(aminaReq);

    expect(aminaRes.status).toBe(200);
    const aminaText = await aminaRes.text();

    // Terminal response
    expect(aminaText.startsWith('END ')).toBe(true);
    // Amina's observation is counted: witness count advances 2 -> 3
    expect(aminaText).toContain('Thank you. 3 of 3 neighbours have checked.');

    // Verify task state in database
    const taskAfterAmina = await container.taskRepo.getTaskForUpdate(DEMO_IDS.TASK_4412);
    expect(taskAfterAmina?.witnessCount).toBe(3);

    // 2. Girma (same cell 'et-aa-0919', same prefix '251993' -> same Cluster Gamma) dials *890#
    // Girma inspects the same project 4412 and answers questions
    const girmaSessionId = 'session-c2-girma-002';
    const girmaReq = createUssdRequest(girmaSessionId, girmaPhone, '1*4412*1*1*1*1');
    const girmaRes = await POST(girmaReq);

    expect(girmaRes.status).toBe(200);
    const girmaText = await girmaRes.text();

    // Terminal response
    expect(girmaText.startsWith('END ')).toBe(true);

    // CRITICAL C2 ASSERTION: Girma MUST NOT be counted!
    // He MUST receive the duplicate suppression message:
    // "Thank you. This area has already been counted, so the total stays at 3."
    expect(girmaText).toContain('Thank you. This area has already been counted, so the total stays at 3.');
    expect(girmaText).not.toContain('4 of 3');

    // Verify task state in database: witness count remains strictly 3 (INV-02)
    const taskAfterGirma = await container.taskRepo.getTaskForUpdate(DEMO_IDS.TASK_4412);
    expect(taskAfterGirma?.witnessCount).toBe(3);

    // Verify persisted observations: Girma's observation is stored with weight 0
    const allObs = await container.taskRepo.getObservationsForTask(DEMO_IDS.TASK_4412);
    expect(allObs.length).toBe(4); // 2 pre-seeded + Amina + Girma

    const aminaObs = allObs.find((o) => o.idempotencyKey.includes(aminaSessionId));
    expect(aminaObs).toBeDefined();
    expect(aminaObs?.weight).toBe(1);

    const girmaObs = allObs.find((o) => o.idempotencyKey.includes(girmaSessionId));
    expect(girmaObs).toBeDefined();
    expect(girmaObs?.weight).toBe(0);
    expect(girmaObs?.clusterKey).toBe(aminaObs?.clusterKey);
  });
});
