// USSD HTTP Transport Adapter Route
// Authoritative sources:
// - docs/specs/06-voice-and-ussd.md §1, §2, §10
// - docs/specs/05-api-contracts.md §1
// - docs/specs/07-trust-and-security.md §5
// - docs/specs/11-tasks.md T-15

import { reduceUssdSession } from '@/domain/ussd/session';
import { extractMsisdnPrefix } from '@/lib/msisdn';

interface ParsedUssdPayload {
  sessionId: string;
  phoneNumber: string;
  serviceCode?: string;
  text: string;
}

/**
 * Safely extracts and validates USSD payload fields from form-encoded or JSON requests.
 */
async function parseUssdRequest(req: Request): Promise<ParsedUssdPayload> {
  const contentType = req.headers.get('content-type') || '';

  let sessionId = '';
  let phoneNumber = '';
  let serviceCode: string | undefined;
  let text = '';

  if (contentType.includes('application/json')) {
    try {
      const json = await req.json();
      if (!json || typeof json !== 'object') {
        throw new Error('Malformed JSON body');
      }
      sessionId = typeof json.sessionId === 'string' ? json.sessionId.trim() : '';
      phoneNumber = typeof json.phoneNumber === 'string' ? json.phoneNumber.trim() : '';
      serviceCode = typeof json.serviceCode === 'string' ? json.serviceCode.trim() : undefined;
      text = typeof json.text === 'string' ? json.text : '';
    } catch {
      throw new Error('Failed to parse JSON payload');
    }
  } else {
    // Default to form-encoded (application/x-www-form-urlencoded or multipart/form-data)
    try {
      const formData = await req.formData();
      sessionId = (formData.get('sessionId')?.toString() || '').trim();
      phoneNumber = (formData.get('phoneNumber')?.toString() || '').trim();
      serviceCode = formData.get('serviceCode')?.toString()?.trim() || undefined;
      text = formData.get('text')?.toString() || '';
    } catch {
      // If formData fails, attempt manual URLSearchParams parsing from body text
      try {
        const rawText = await req.text();
        const searchParams = new URLSearchParams(rawText);
        sessionId = (searchParams.get('sessionId') || '').trim();
        phoneNumber = (searchParams.get('phoneNumber') || '').trim();
        serviceCode = searchParams.get('serviceCode')?.trim() || undefined;
        text = searchParams.get('text') || '';
      } catch {
        throw new Error('Failed to parse form-encoded payload');
      }
    }
  }

  if (!sessionId) {
    throw new Error('Missing required field: sessionId');
  }

  if (!phoneNumber) {
    throw new Error('Missing required field: phoneNumber');
  }

  return {
    sessionId,
    phoneNumber,
    serviceCode,
    text,
  };
}

/**
 * POST /api/ussd
 * Africa's Talking USSD webhook gateway contract.
 */
export async function POST(req: Request): Promise<Response> {
  let payload: ParsedUssdPayload;
  try {
    payload = await parseUssdRequest(req);
  } catch {
    return new Response('Invalid USSD request payload', {
      status: 400,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  try {
    // MSISDN Trust Boundary Check:
    // Validate phone number format and extract 6-digit prefix bucket.
    // Raw MSISDN is NOT passed into the domain core or logged.
    try {
      extractMsisdnPrefix(payload.phoneNumber, '251');
    } catch {
      return new Response('Invalid phone number format', {
        status: 400,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    // Pure deterministic replay via T-14 reducer.
    // Reducer output already includes the exact 'CON ' or 'END ' framing.
    const ussdResponse = reduceUssdSession(payload.text);

    return new Response(ussdResponse.text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch {
    // Return safe generic 500 error without exposing stack traces, DB details, or PII.
    return new Response('Internal error processing USSD session', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

/**
 * Rejection for unsupported HTTP methods per API contract.
 */
export async function GET(): Promise<Response> {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'POST',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export async function PUT(): Promise<Response> {
  return GET();
}

export async function DELETE(): Promise<Response> {
  return GET();
}

export async function PATCH(): Promise<Response> {
  return GET();
}
