/**
 * POST /api/evidence/[id]/transfer - Transfer evidence custody (non-sensitive)
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
import {
    findEvidenceById,
    findUserById,
    updateEvidenceOwner,
    updateEvidenceStatus,
    createCustodyLog,
    createAuditLog,
} from '@/lib/db-helpers';
import { transferEvidence as transferOnChain } from '@/lib/contract';
import { executeInTransaction } from '@/lib/prisma';
import { EvidenceStatus } from '@prisma/client';

const transferSchema = z.object({
    toUserId: z.string().uuid('Invalid user ID'),
    reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

export const POST = withErrorHandler(
    async (req: NextRequest, { params }: { params: { id: string } }) => {
        // Only admins and investigators can transfer evidence
        const user = getAuthUserWithRole(req, [Role.ADMIN, Role.INVESTIGATOR]);

        const { id } = params;

        // Validate UUID
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return errorResponse('Invalid evidence ID format', 400);
        }

        // Check evidence exists
        const evidence = await findEvidenceById(id);
        if (!evidence) {
            return errorResponse('Evidence not found', 404);
        }

        // Only owner or admin can transfer
        if (
            evidence.currentOwnerId !== user.userId &&
            user.role !== Role.ADMIN
        ) {
            return errorResponse('Only the evidence owner or admin can transfer', 403);
        }

        // Check if evidence is sensitive (must use multi-sig flow)
        if (evidence.isSensitive) {
            return errorResponse(
                'This evidence is sensitive. Use /transfer-requests endpoint for multi-signature approval',
                400
            );
        }

        // Check terminal states
        if (
            evidence.status === EvidenceStatus.ARCHIVED ||
            evidence.status === EvidenceStatus.REJECTED
        ) {
            return errorResponse('Cannot transfer archived or rejected evidence', 400);
        }

        // Validate body
        const body = await parseBody(req);
        const validation = transferSchema.safeParse(body);
        if (!validation.success) {
            return errorResponse('Validation failed', 400, validation.error.errors);
        }

        const { toUserId, reason } = validation.data;

        // Cannot transfer to self
        if (toUserId === user.userId) {
            return errorResponse('Cannot transfer evidence to yourself', 400);
        }

        // Check recipient exists and is active
        const recipient = await findUserById(toUserId);
        if (!recipient) {
            return errorResponse('Recipient user not found', 404);
        }

        if (!recipient.isActive) {
            return errorResponse('Recipient account is inactive', 400);
        }

        // Recipient must be investigator or admin
        if (recipient.role !== Role.INVESTIGATOR && recipient.role !== Role.ADMIN) {
            return errorResponse(
                'Recipient must be an investigator or admin',
                400
            );
        }

        // Use transaction for dual-write
        const previousOwner = evidence.currentOwnerId || user.userId;

        const result = await executeInTransaction(async (tx) => {
            // Update owner in database
            const updated = await updateEvidenceOwner(id, toUserId, tx);

            // Update status to TRANSFERRED
            await updateEvidenceStatus(id, EvidenceStatus.TRANSFERRED, tx);

            // Create custody log
            await createCustodyLog(
                {
                    evidenceId: id,
                    fromUserId: previousOwner,
                    toUserId,
                    action: 'TRANSFERRED',
                    reason,
                },
                tx
            );

            return updated;
        });

        // Transfer on blockchain (if registered)
        let blockchainTxHash = '';
        if (evidence.evidenceId && evidence.registeredOnChain && recipient.walletAddress) {
            try {
                const blockchainResult = await transferOnChain(
                    evidence.evidenceId,
                    recipient.walletAddress,
                    reason
                );

                if (blockchainResult.success) {
                    blockchainTxHash = blockchainResult.txHash || '';
                    console.log(`✅ Evidence transferred on blockchain: ${blockchainTxHash}`);
                } else {
                    console.warn(`⚠️  Blockchain transfer failed: ${blockchainResult.error}`);
                }
            } catch (error) {
                console.error('Blockchain transfer error:', error);
            }
        }

        // Create audit log
        await createAuditLog({
            userId: user.userId,
            action: 'EVIDENCE_TRANSFERRED',
            resource: 'EVIDENCE',
            resourceId: id,
            metadata: {
                fromUserId: previousOwner,
                toUserId,
                reason,
                evidenceId: evidence.evidenceId,
                txHash: blockchainTxHash || null,
            },
        });

        return successResponse(
            {
                evidence: result,
                transfer: {
                    from: previousOwner,
                    to: toUserId,
                    reason,
                },
                blockchain: {
                    transferred: !!blockchainTxHash,
                    txHash: blockchainTxHash || null,
                },
            },
            'Evidence transferred successfully'
        );
    }
);