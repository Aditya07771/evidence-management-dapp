/**
 * GET   /api/cases/[id] - Get case details with evidence
 * PATCH /api/cases/[id] - Update case details
 */

import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import { z } from 'zod';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    validationErrorResponse,
    getAuthUserWithRole,
    parseBody,
} from '@/lib/api-helpers';
import { findCaseById, createAuditLog } from '@/lib/db-helpers';
import { prisma } from '@/lib/prisma';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/cases/[id] - Get case details
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const GET = withErrorHandler(
    async (req: NextRequest, { params }: { params: { id: string } }) => {
        // Require authentication
        const user = getAuthUserWithRole(req, [
            Role.ADMIN,
            Role.INVESTIGATOR,
            Role.AUDITOR,
        ]);

        const { id } = params;

        // Validate UUID format
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return errorResponse('Invalid case ID format', 400);
        }

        // Fetch case with evidence
        const caseData = await findCaseById(id);

        if (!caseData) {
            return errorResponse('Case not found', 404);
        }

        // Calculate statistics
        const evidenceStats = {
            total: caseData.evidences.length,
            byStatus: caseData.evidences.reduce((acc: any, ev) => {
                acc[ev.status] = (acc[ev.status] || 0) + 1;
                return acc;
            }, {}),
            byType: caseData.evidences.reduce((acc: any, ev) => {
                acc[ev.evidenceType] = (acc[ev.evidenceType] || 0) + 1;
                return acc;
            }, {}),
        };

        return successResponse({
            case: {
                id: caseData.id,
                caseNumber: caseData.caseNumber,
                title: caseData.title,
                description: caseData.description,
                status: caseData.status,
                createdAt: caseData.createdAt,
                updatedAt: caseData.updatedAt,
            },
            evidences: caseData.evidences.map((ev) => ({
                id: ev.id,
                evidenceId: ev.evidenceId,
                title: ev.title,
                evidenceType: ev.evidenceType,
                status: ev.status,
                isSensitive: ev.isSensitive,
                collectedAt: ev.collectedAt,
                collectedBy: {
                    id: ev.collectedBy.id,
                    name: ev.collectedBy.name,
                    badgeId: ev.collectedBy.badgeId,
                },
            })),
            stats: evidenceStats,
        });
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH /api/cases/[id] - Update case details
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const updateCaseSchema = z.object({
    title: z.string().min(5).optional(),
    description: z.string().optional(),
});

export const PATCH = withErrorHandler(
    async (req: NextRequest, { params }: { params: { id: string } }) => {
        // Only admins and investigators can update cases
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
        const validation = updateCaseSchema.safeParse(body);
        if (!validation.success) {
            return validationErrorResponse(validation.error);
        }

        const { title, description } = validation.data;

        // Nothing to update
        if (!title && description === undefined) {
            return errorResponse('No fields to update', 400);
        }

        // Update case
        const updatedCase = await prisma.case.update({
            where: { id },
            data: {
                ...(title && { title }),
                ...(description !== undefined && { description }),
            },
        });

        // Create audit log
        await createAuditLog({
            userId: user.userId,
            action: 'CASE_UPDATED',
            resource: 'CASE',
            resourceId: id,
            metadata: {
                updates: { title, description },
            },
        });

        return successResponse(
            {
                case: updatedCase,
            },
            'Case updated successfully'
        );
    }
);