// Actor Authentication & Authorization Helpers
// Authoritative sources: docs/specs/05-api-contracts.md §7, §9, docs/specs/07-trust-and-security.md §9

import { NextResponse } from 'next/server';
import type { ActorRole } from '@/domain/types';
import { verifyJwtToken } from './jwt';

export interface ActorIdentity {
  role: ActorRole;
  actorRef: string;
}

export type AuthorizationResult =
  | { authorized: true; role: ActorRole; actorRef: string }
  | { authorized: false; response: Response };

/**
 * Extracts and verifies actor identity from the request.
 * In production (NODE_ENV === 'production'), strictly requires a verified JWT token.
 * In development/test, allows x-actor-role fallback if verified JWT is absent.
 */
export function getActorIdentity(
  request: Request,
  body?: Record<string, unknown>
): { identity?: ActorIdentity; error?: string } {
  // 1. Check Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const result = verifyJwtToken(token);
    if (result.valid && result.claims) {
      return {
        identity: {
          role: result.claims.role,
          actorRef: result.claims.actorRef,
        },
      };
    }
    return { error: result.error || 'Invalid or expired authentication token' };
  }

  // 2. Determine if development/test header bypass is allowed
  const isDevOrTest =
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development' ||
    process.env.ALLOW_DEV_ACTOR_HEADERS === 'true' ||
    !process.env.NODE_ENV;

  const isProduction = process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_ACTOR_HEADERS !== 'true';

  if (isProduction) {
    return { error: 'Authentication required: bearer session token missing in production' };
  }

  // 3. Dev/Test fallback using x-actor-role / x-actor-ref / body
  if (isDevOrTest) {
    const headerRole = request.headers.get('x-actor-role');
    const headerRef = request.headers.get('x-actor-ref') || request.headers.get('x-actor-id');

    if (headerRole && headerRole.trim()) {
      const role = headerRole.trim() as ActorRole;
      const actorRef = headerRef ? headerRef.trim() : `user-${role.toLowerCase()}`;
      return { identity: { role, actorRef } };
    }

    if (body && typeof body.actorRole === 'string' && body.actorRole.trim()) {
      const role = body.actorRole.trim() as ActorRole;
      const actorRef = typeof body.actorRef === 'string' && body.actorRef.trim()
        ? body.actorRef.trim()
        : `user-${role.toLowerCase()}`;
      return { identity: { role, actorRef } };
    }

    if (body && typeof body.actor === 'string' && body.actor.trim()) {
      const role = body.actor.trim() as ActorRole;
      return { identity: { role, actorRef: `user-${role.toLowerCase()}` } };
    }
  }

  return { error: 'Authentication required: actor identity is missing' };
}

export function getActorRole(
  request: Request,
  body?: Record<string, unknown>
): ActorRole | null {
  const { identity } = getActorIdentity(request, body);
  return identity ? identity.role : null;
}

export function authorizeActor(
  request: Request,
  allowedRoles: ActorRole[],
  body?: Record<string, unknown>
): AuthorizationResult {
  const { identity, error } = getActorIdentity(request, body);

  if (!identity) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          type: 'https://wardproofline.dev/errors/unauthorized',
          title: 'Unauthorized',
          code: 'E_UNAUTHORIZED',
          status: 401,
          detail: error || 'Authentication required: actor role is missing',
        },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(identity.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          type: 'https://wardproofline.dev/errors/forbidden_role',
          title: 'Forbidden',
          code: 'E_FORBIDDEN_ROLE',
          status: 403,
          detail: `Role '${identity.role}' is not authorized. Allowed roles: ${allowedRoles.join(', ')}`,
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, role: identity.role, actorRef: identity.actorRef };
}
