/**
 * POST /api/verify/batch - Batch verify multiple evidence items
 */

import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import { z } from 'zod';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    getAuthUserWithRole,
    parseBody,
} from '@/lib/api-helpers';
import { findEvidenceById, createAuditLog } from '@/lib/db-helpers';
import { hashesMatch } from '@/lib/hash';

const batchVerifySchema = z.object({
    items: z
        .array(
            z.object({
                evidenceId: z.string().uuid(),
                fileHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
            })
        )
        .max(50, 'Maximum 50 items per batch'),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
    // Any authenticated user can batch verify
    const user = getAuthUserWithRole(req, [
        Role.ADMIN,
        Role.INVESTIGATOR,
        Role.AUDITOR,
    ]);

    // Validate body
    const body = await parseBody(req);
    const validation = batchVerifySchema.safeParse(body);
    if (!validation.success) {
        return errorResponse('Validation failed', 400, validation.error.errors);
    }

    const { items } = validation.data;

    // Process each item
    const results = await Promise.all(
        items.map(async (item) => {
            try {
                const evidence = await findEvidenceById(item.evidenceId);

                if (!evidence) {
                    return {
                        evidenceId: item.evidenceId,
                        success: false,
                        error: 'Evidence not found',
                    };
                }

                const isAuthentic = hashesMatch(item.fileHash, evidence.fileHash);

                return {
                    evidenceId: item.evidenceId,
                    success: true,
                    isAuthentic,
                    title: evidence.title,
                    expectedHash: evidence.fileHash,
                    submittedHash: item.fileHash,
                };
            } catch (error: any) {
                return {
                    evidenceId: item.evidenceId,
                    success: false,
                    error: error.message,
                };
            }
        })
    );

    // Count results
    const summary = {
        total: results.length,
        verified: results.filter((r) => r.success).length,
        authentic: results.filter((r) => r.success && r.isAuthentic).length,
        tampered: results.filter((r) => r.success && !r.isAuthentic).length,
        errors: results.filter((r) => !r.success).length,
    };

    // Create audit log
    await createAuditLog({
        userId: user.userId,
        action: 'BATCH_VERIFICATION',
        metadata: {
            itemCount: items.length,
            summary,
        },
    });

    return successResponse({
        results,
        summary,
    });
});