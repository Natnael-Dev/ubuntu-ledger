// GET /api/audio/manifest
// Authoritative sources: docs/specs/05-api-contracts.md §3, §10; docs/specs/16-i18n-and-content.md §2

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export async function GET() {
  try {
    const manifestPath = path.join(process.cwd(), 'content', 'audio', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return NextResponse.json(
        {
          type: 'https://wardproofline.dev/errors/not_found',
          title: 'Manifest Not Found',
          code: 'E_NOT_FOUND',
          status: 404,
          detail: 'Audio manifest file not found on server',
        },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(manifestPath, 'utf8');
    const data = JSON.parse(content);

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error reading manifest';
    return NextResponse.json(
      {
        type: 'https://wardproofline.dev/errors/internal_error',
        title: 'Internal Server Error',
        code: 'E_INTERNAL',
        status: 500,
        detail: msg,
      },
      { status: 500 }
    );
  }
}
