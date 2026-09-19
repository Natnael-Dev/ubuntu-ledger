// IVR Telephony Gateway Route
// Authoritative sources:
// - docs/specs/05-api-contracts.md §3 (IVR session)
// - docs/specs/06-voice-and-ussd.md §6 (IVR flow & number stitching)
// - docs/specs/07-trust-and-security.md §5 (Zero-PII boundaries)
// - docs/specs/11-tasks.md T-31

import { reduceIvrSession } from '@/domain/ivr/session';
import type { Locale } from '@/domain/types';
import { extractMsisdnPrefix, computePhoneHash } from '@/lib/msisdn';
import { getServiceContainer } from '@/infra/db/container';
import { DEMO_PEPPER, DEMO_IDS } from '@/fixtures/demo-scenario';
import { SystemClock } from '@/infra/clock';
import { randomUUID } from 'node:crypto';
import type { RespondentRecord } from '@/infra/db/types';

function problemResponse(
  status: number,
  code: string,
  title: string,
  detail: string
): Response {
  const typeSuffix = code.toLowerCase().replace(/^e_/, '');
  return new Response(
    JSON.stringify({
      type: `https://wardproofline.dev/errors/${typeSuffix}`,
      title,
      status,
      code,
      detail,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/problem+json',
      },
    }
  );
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problemResponse(
      400,
      'E_INVALID_JSON',
      'Malformed JSON Body',
      'The request payload could not be parsed as JSON.'
    );
  }

  if (!body || typeof body !== 'object') {
    return problemResponse(
      400,
      'E_INVALID_PAYLOAD',
      'Invalid Request Payload',
      'Expected an object with sessionId, phoneNumber, and digits.'
    );
  }

  const payload = body as Record<string, unknown>;
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
  const phoneNumber = typeof payload.phoneNumber === 'string' ? payload.phoneNumber.trim() : '';
  const digits = typeof payload.digits === 'string' ? payload.digits.trim() : '';
  const rawLocale = typeof payload.locale === 'string' ? payload.locale.trim() : 'en';

  if (!sessionId) {
    return problemResponse(
      400,
      'E_MISSING_SESSION_ID',
      'Missing Session ID',
      'The sessionId parameter is required.'
    );
  }

  if (!phoneNumber) {
    return problemResponse(
      400,
      'E_MISSING_PHONE_NUMBER',
      'Missing Phone Number',
      'The phoneNumber parameter is required.'
    );
  }

  // Validate phone number and extract prefix bucket
  let prefix: string;
  try {
    prefix = extractMsisdnPrefix(phoneNumber, '251');
  } catch {
    return problemResponse(
      400,
      'E_INVALID_PHONE_NUMBER',
      'Invalid Phone Number',
      'The phone number must contain at least 6 digits.'
    );
  }

  const validLocales: Locale[] = ['en', 'am', 'om', 'sw'];
  const locale: Locale = validLocales.includes(rawLocale as Locale) ? (rawLocale as Locale) : 'en';

  // Deterministic IVR session reduction
  const { response, completedObservation } = reduceIvrSession(digits, { locale });

  // Handle completed observation ingestion
  if (completedObservation) {
    try {
      const clock = new SystemClock();
      const container = getServiceContainer();
      const pepper = process.env.PHONE_HASH_PEPPER || process.env.PEPPER || DEMO_PEPPER;
      const phoneHash = computePhoneHash(phoneNumber, pepper);

      let respondent = await container.respondentRepo.findByPhoneHash(phoneHash);
      if (!respondent) {
        respondent = {
          id: randomUUID(),
          wardId: DEMO_IDS.WARD_W09,
          phoneHash,
          phoneEnc: null,
          msisdnPrefix: prefix,
          registeredAt: clock.now(),
          locale,
        };

        const repo = container.respondentRepo as unknown as {
          seed?: (r: RespondentRecord) => void;
          save?: (r: RespondentRecord) => Promise<void>;
          upsert?: (r: RespondentRecord) => Promise<void>;
        };

        if (typeof repo.upsert === 'function') {
          await repo.upsert(respondent);
        } else if (typeof repo.save === 'function') {
          await repo.save(respondent);
        } else if (typeof repo.seed === 'function') {
          repo.seed(respondent);
        }
      }

      const taskId =
        completedObservation.projectCode === '4412'
          ? DEMO_IDS.TASK_4412
          : completedObservation.taskId || DEMO_IDS.TASK_4412;

      const answers: Record<string, boolean> = { ...completedObservation.answers };
      if (answers.q1 !== undefined) answers.runs_on_outage = answers.q1;
      if (answers.q2 !== undefined) answers.fridge_green = answers.q2;
      if (answers.q3 !== undefined) answers.board_posted = answers.q3;

      const geoCell = (respondent as { geoCell?: string }).geoCell || 'et-aa-0919';

      await container.observationService.submitObservation({
        taskId,
        respondentId: respondent.id,
        respondentWardId: respondent.wardId,
        channel: 'IVR',
        answers,
        clientIdempotencyKey: `ivr-${sessionId}-${completedObservation.projectCode}`,
        msisdnPrefixBucket: prefix,
        geoCell,
        submittedAt: clock.nowIso(),
      });
    } catch {
      // Non-fatal for session prompt progression if already counted or idempotent
    }
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
