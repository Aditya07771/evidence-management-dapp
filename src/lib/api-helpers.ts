/**
 * API Helper Utilities
 * Common functions for API route handlers
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiErrorResponse, ApiSuccessResponse, JWTPayload } from './types';
import { requireAuth, requireRole, AuthError } from './auth';
import { Role } from '@prisma/client';
import { ZodError } from 'zod';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESPONSE BUILDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Success response helper
 */
export function successResponse<T>(
    data: T,
    message?: string,
    status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
    return NextResponse.json(
        {
            success: true,
            data,
            ...(message && { message }),
        },
        { status }
    );
}

/**
 * Error response helper
 */
export function errorResponse(
    error: string,
    status: number = 400,
    details?: any
): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
        {
            success: false,
            error,
            ...(details && { details }),
        },
        { status }
    );
}

/**
 * Validation error response (Zod)
 */
export function validationErrorResponse(
    zodError: ZodError
): NextResponse<ApiErrorResponse> {
    const errors = zodError.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
    }));

    return errorResponse('Validation failed', 400, errors);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REQUEST HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse JSON body from request
 */
export async function parseBody<T = any>(req: NextRequest): Promise<T> {
    try {
        return await req.json();
    } catch {
        throw new Error('Invalid JSON body');
    }
}

/**
 * Get query parameter
 */
export function getQueryParam(
    req: NextRequest,
    key: string
): string | null {
    return req.nextUrl.searchParams.get(key);
}

/**
 * Get multiple query parameters
 */
export function getQueryParams(
    req: NextRequest,
    keys: string[]
): Record<string, string | null> {
    const result: Record<string, string | null> = {};
    keys.forEach((key) => {
        result[key] = getQueryParam(req, key);
    });
    return result;
}

/**
 * Parse pagination from query params
 */
export function parsePagination(req: NextRequest): {
    page: number;
    limit: number;
    offset: number;
} {
    const page = Math.max(1, parseInt(getQueryParam(req, 'page') || '1'));
    const limit = Math.min(
        100,
        Math.max(1, parseInt(getQueryParam(req, 'limit') || '20'))
    );
    const offset = (page - 1) * limit;

    return { page, limit, offset };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTHENTICATION MIDDLEWARE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get authenticated user from request
 * Throws AuthError if not authenticated
 */
export function getAuthUser(req: NextRequest): JWTPayload {
    const authHeader = req.headers.get('authorization');
    return requireAuth(authHeader || undefined);
}

/**
 * Get authenticated user with role check
 */
export function getAuthUserWithRole(
    req: NextRequest,
    allowedRoles: Role[]
): JWTPayload {
    const user = getAuthUser(req);
    requireRole(user, allowedRoles);
    return user;
}

/**
 * Try to get authenticated user (doesn't throw)
 */
export function tryGetAuthUser(req: NextRequest): JWTPayload | null {
    try {
        return getAuthUser(req);
    } catch {
        return null;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ERROR HANDLER WRAPPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Wrap API handler with error handling
 */
export function withErrorHandler(
    handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
    return async (req: NextRequest, context?: any): Promise<NextResponse> => {
        try {
            return await handler(req, context);
        } catch (error: any) {
            console.error('API Error:', error);

            // Handle specific error types
            if (error instanceof AuthError) {
                return errorResponse(error.message, error.statusCode);
            }

            if (error instanceof ZodError) {
                return validationErrorResponse(error);
            }

            if (error.code === 'P2002') {
                // Prisma unique constraint violation
                return errorResponse('Duplicate record', 409);
            }

            if (error.code === 'P2025') {
                // Prisma record not found
                return errorResponse('Record not found', 404);
            }

            // Generic error
            return errorResponse(
                error.message || 'Internal server error',
                error.statusCode || 500
            );
        }
    };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORS HEADERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Add CORS headers to response (for development)
 */
export function withCORS(response: NextResponse): NextResponse {
    if (process.env.NODE_ENV === 'development') {
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    return response;
}

/**
 * Handle OPTIONS request (preflight)
 */
export function handleOPTIONS(): NextResponse {
    return withCORS(new NextResponse(null, { status: 204 }));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validate request body against Zod schema
 */
export async function validateBody<T>(
    req: NextRequest,
    schema: any
): Promise<T> {
    const body = await parseBody(req);
    return schema.parse(body);
}

/**
 * Check if user is admin
 */
export function isAdmin(user: JWTPayload): boolean {
    return user.role === Role.ADMIN;
}

/**
 * Check if user is investigator or admin
 */
export function canInvestigate(user: JWTPayload): boolean {
    return user.role === Role.ADMIN || user.role === Role.INVESTIGATOR;
}

/**
 * Check if user owns evidence or is admin
 */
export function canModifyEvidence(
    user: JWTPayload,
    evidenceOwnerId: string
): boolean {
    return user.role === Role.ADMIN || user.userId === evidenceOwnerId;
}