// GET /api/bulletins/[id]/export — Gated bulletin script export
// Authoritative sources:
// - docs/specs/05-api-contracts.md §9
// - docs/specs/11-tasks.md T-28
// INV-06: Returns 409 E_NOT_APPROVED if state != APPROVED_FOR_BROADCAST

import { NextResponse } from 'next/server';
import { getBulletinService } from '@/app-services/bulletin.service';
import { ServiceError } from '@/app-services/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, props: RouteContext): Promise<Response> {
  const { id } = await props.params;

  const url = new URL(request.url);
  const format = url.searchParams.get('format') ?? 'txt';

  try {
    const service = getBulletinService();
    const exportDto = await service.exportBulletin(id);

    if (format === 'print') {
      // Return as formatted plain text
      const printText = [
        `=== RADIO BULLETIN EXPORT ===`,
        `Ward: ${exportDto.wardId}`,
        `Period: ${exportDto.periodStart} to ${exportDto.periodEnd}`,
        `Locale: ${exportDto.locale}`,
        `Approved by: ${exportDto.moderatorInitials ?? 'N/A'} at ${exportDto.moderatedAt ?? 'N/A'}`,
        ``,
        exportDto.scriptText,
        ``,
        `=== END OF BULLETIN ===`,
      ].join('\n');

      return new Response(printText, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="bulletin-${id}.txt"`,
        },
      });
    }

    // Default: JSON export
    return NextResponse.json(exportDto);
  } catch (err: unknown) {
    if (err instanceof ServiceError) {
      return NextResponse.json(
        {
          type: `https://wardproofline.dev/errors/${err.code.toLowerCase().replace(/^e_/, '')}`,
          code: err.code,
          status: err.statusCode,
          detail: err.message,
        },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { code: 'E_INTERNAL', detail: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
