/**
 * POST /api/verify/quick - Quick verify without blockchain write (read-only)
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
import { findEvidenceById } from '@/lib/db-helpers';
import { quickVerify as quickVerifyOnChain } from '@/lib/contract';
import { hashesMatch } from '@/lib/hash';

const quickVerifySchema = z.object({
    evidenceId: z.string().uuid('Invalid evidence ID'),
    fileHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid hash format'),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
    // Any authenticated user can quick verify
    const user = getAuthUserWithRole(req, [
        Role.ADMIN,
        Role.INVESTIGATOR,
        Role.AUDITOR,
    ]);

    // Validate body
    const body = await parseBody(req);
    const validation = quickVerifySchema.safeParse(body);
    if (!validation.success) {
        return errorResponse('Validation failed', 400, validation.error.issues);
    }

    const { evidenceId, fileHash } = validation.data;

    // Check evidence exists
    const evidence = await findEvidenceById(evidenceId);
    if (!evidence) {
        return errorResponse('Evidence not found', 404);
    }

    // Compare hashes (database)
    const dbAuthentic = hashesMatch(fileHash, evidence.fileHash);

    // Quick verify on blockchain (if registered) - no gas, view function
    let blockchainAuthentic: boolean | null = null;
    if (evidence.evidenceId && evidence.registeredOnChain) {
        try {
            const blockchainResult = await quickVerifyOnChain(
                evidence.evidenceId,
                fileHash
            );

            if (blockchainResult.success && blockchainResult.data !== undefined) {
                blockchainAuthentic = blockchainResult.data;
            }
        } catch (error) {
            console.error('Blockchain quick verify error:', error);
        }
    }

    return successResponse({
        isAuthentic: dbAuthentic,
        evidence: {
            id: evidence.id,
            evidenceId: evidence.evidenceId,
            title: evidence.title,
            expectedHash: evidence.fileHash,
        },
        verification: {
            submittedHash: fileHash,
            databaseMatch: dbAuthentic,
            blockchainMatch: blockchainAuthentic,
            bothMatch: dbAuthentic && (blockchainAuthentic === null || blockchainAuthentic),
        },
    });
});
