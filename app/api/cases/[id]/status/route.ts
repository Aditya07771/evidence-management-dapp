/**
 * PATCH /api/cases/[id]/status - Update case status
 */

import { NextRequest } from 'next/server';
import { Role, CaseStatus } from '@prisma/client';
import { z } from 'zod';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    validationErrorResponse,
    getAuthUserWithRole,
    parseBody,
} from '@/lib/api-helpers';
import { findCaseById, updateCaseStatus, createAuditLog } from '@/lib/db-helpers';

const updateCaseStatusSchema = z.object({
    status: z.nativeEnum(CaseStatus),
    reason: z.string().min(5).optional(),
});

export const PATCH = withErrorHandler(
    async (req: NextRequest, { params }: { params: { id: string } }) => {
        // Only admins and investigators can update case status
        const user = getAuthUserWithRole(req, [Role.ADMIN, Role.INVESTIGATOR]);

        const { id } = params;

        // Validate UUID
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return errorResponse('Invalid case ID format', 400);
        }

        // Check case exists
        const existingCase = await findCaseById(id);
        if (!existingCase) {
            return errorResponse('Case not found', 404);
        }

        // Validate body
        const body = await parseBody(req);
        const validation = updateCaseStatusSchema.safeParse(body);
        if (!validation.success) {
            return validationErrorResponse(validation.error);
        }

        const { status, reason } = validation.data;

        // Check if status is actually changing
        if (existingCase.status === status) {
            return errorResponse('Case already has this status', 400);
        }

        // Validate status transitions
        const validTransitions: Record<CaseStatus, CaseStatus[]> = {
            [CaseStatus.OPEN]: [CaseStatus.CLOSED, CaseStatus.ARCHIVED],
            [CaseStatus.CLOSED]: [CaseStatus.OPEN, CaseStatus.ARCHIVED],
            [CaseStatus.ARCHIVED]: [], // Terminal state
        };

        if (!validTransitions[existingCase.status].includes(status)) {
            return errorResponse(
                `Invalid status transition from ${existingCase.status} to ${status}`,
                400
            );
        }

        // Update status
        const updatedCase = await updateCaseStatus(id, status);

        // Create audit log
        await createAuditLog({
            userId: user.userId,
            action: 'CASE_STATUS_UPDATED',
            resource: 'CASE',
            resourceId: id,
            metadata: {
                previousStatus: existingCase.status,
                newStatus: status,
                reason,
                caseNumber: existingCase.caseNumber,
            },
        });

        return successResponse(
            {
                case: updatedCase,
                previousStatus: existingCase.status,
            },
            `Case status updated to ${status}`
        );
    }
);