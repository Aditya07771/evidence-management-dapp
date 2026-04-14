/**
 * GET  /api/cases - List all cases with filtering
 * POST /api/cases - Create new case
 */

import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import { createCaseSchema } from '@/lib/validators';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    validateBody,
    getAuthUserWithRole,
    parsePagination,
    getQueryParam,
} from '@/lib/api-helpers';
import {
    createCase,
    getAllCases,
    findCaseByCaseNumber,
    createAuditLog,
} from '@/lib/db-helpers';
import { CaseStatus } from '@prisma/client';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/cases - List all cases
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const GET = withErrorHandler(async (req: NextRequest) => {
    // Require authentication
    const user = getAuthUserWithRole(req, [
        Role.ADMIN,
        Role.INVESTIGATOR,
        Role.AUDITOR,
    ]);

    // Parse pagination
    const { page, limit, offset } = parsePagination(req);

    // Parse filters
    const statusParam = getQueryParam(req, 'status');
    const status = statusParam ? (statusParam as CaseStatus) : undefined;

    // Validate status if provided
    if (status && !Object.values(CaseStatus).includes(status)) {
        return errorResponse('Invalid status value', 400);
    }

    // Fetch cases
    const cases = await getAllCases(status, limit, offset);

    // Get total count for pagination
    const prisma = (await import('@/lib/prisma')).prisma;
    const total = await prisma.case.count({
        where: status ? { status } : undefined,
    });

    const totalPages = Math.ceil(total / limit);

    return successResponse({
        cases,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore: page < totalPages,
        },
    });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/cases - Create new case
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const POST = withErrorHandler(async (req: NextRequest) => {
    // Only admins and investigators can create cases
    const user = getAuthUserWithRole(req, [Role.ADMIN, Role.INVESTIGATOR]);

    // Validate request body
    const body = await validateBody(req, createCaseSchema);
    const { caseNumber, title, description } = body;

    // Check if case number already exists
    const existingCase = await findCaseByCaseNumber(caseNumber);
    if (existingCase) {
        return errorResponse('Case number already exists', 409);
    }

    // Create case
    const newCase = await createCase({
        caseNumber,
        title,
        description,
    });

    // Create audit log
    await createAuditLog({
        userId: user.userId,
        action: 'CASE_CREATED',
        resource: 'CASE',
        resourceId: newCase.id,
        metadata: {
            caseNumber,
            title,
        },
    });

    return successResponse(
        {
            case: newCase,
        },
        'Case created successfully',
        201
    );
});