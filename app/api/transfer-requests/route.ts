/**
 * GET  /api/transfer-requests - List pending transfer requests
 * POST /api/transfer-requests - Create new transfer request (sensitive evidence)
 */

import { NextRequest } from 'next/server';
import { Role, EvidenceStatus } from '@prisma/client';
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
    getPendingTransferRequests,
    createTransferRequest as createRequestInDB,
    createAuditLog,
} from '@/lib/db-helpers';
import { requestTransfer as requestTransferOnChain } from '@/lib/contract';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/transfer-requests - List pending requests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const GET = withErrorHandler(async (req: NextRequest) => {
    // Only admins can view all transfer requests
    const user = getAuthUserWithRole(req, [Role.ADMIN]);

    const requests = await getPendingTransferRequests();

    return successResponse({
        requests: requests.map((r) => ({
            id: r.id,
            requestId: r.requestId,
            evidenceId: r.evidenceId,
            proposedOwnerId: r.proposedOwnerId,
            reason: r.reason,
            approvalCount: r.approvalCount,
            approvers: r.approvers,
            executed: r.executed,
            cancelled: r.cancelled,
            createdAt: r.createdAt,
            initiator: {
                id: r.initiator.id,
                name: r.initiator.name,
                badgeId: r.initiator.badgeId,
            },
        })),
        total: requests.length,
    });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/transfer-requests - Create transfer request
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const createRequestSchema = z.object({
    evidenceId: z.string().uuid('Invalid evidence ID'),
    proposedOwnerId: z.string().uuid('Invalid user ID'),
    reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
    // Only admins and investigators can create transfer requests
    const user = getAuthUserWithRole(req, [Role.ADMIN, Role.INVESTIGATOR]);

    // Validate body
    const body = await parseBody(req);
    const validation = createRequestSchema.safeParse(body);
    if (!validation.success) {
        return errorResponse('Validation failed', 400, validation.error.errors);
    }

    const { evidenceId, proposedOwnerId, reason } = validation.data;

    // Check evidence exists
    const evidence = await findEvidenceById(evidenceId);
    if (!evidence) {
        return errorResponse('Evidence not found', 404);
    }

    // Only owner or admin can request transfer
    if (
        evidence.currentOwnerId !== user.userId &&
        user.role !== Role.ADMIN
    ) {
        return errorResponse('Only the evidence owner or admin can request transfer', 403);
    }

    // Must be sensitive evidence
    if (!evidence.isSensitive) {
        return errorResponse(
            'This evidence is not sensitive. Use /evidence/:id/transfer for direct transfer',
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

    // Cannot transfer to self
    if (proposedOwnerId === user.userId) {
        return errorResponse('Cannot transfer evidence to yourself', 400);
    }

    // Check recipient exists
    const recipient = await findUserById(proposedOwnerId);
    if (!recipient) {
        return errorResponse('Proposed recipient not found', 404);
    }

    if (!recipient.isActive) {
        return errorResponse('Recipient account is inactive', 400);
    }

    if (recipient.role !== Role.INVESTIGATOR && recipient.role !== Role.ADMIN) {
        return errorResponse('Recipient must be an investigator or admin', 400);
    }

    // Create request on blockchain first (if registered)
    let requestIdOnChain = '';
    let blockchainTxHash = '';

    if (evidence.evidenceId && evidence.registeredOnChain && recipient.walletAddress) {
        try {
            const blockchainResult = await requestTransferOnChain(
                evidence.evidenceId,
                recipient.walletAddress,
                reason
            );

            if (blockchainResult.success && blockchainResult.data) {
                requestIdOnChain = blockchainResult.data.requestId;
                blockchainTxHash = blockchainResult.txHash || '';
                console.log(`✅ Transfer request created on blockchain: ${blockchainTxHash}`);
            } else {
                console.warn(`⚠️  Blockchain request failed: ${blockchainResult.error}`);
            }
        } catch (error) {
            console.error('Blockchain request creation error:', error);
        }
    }

    // Create request in database
    const request = await createRequestInDB({
        evidenceId,
        initiatorId: user.userId,
        proposedOwnerId,
        reason,
        requestId: requestIdOnChain || undefined,
    });

    // Create audit log
    await createAuditLog({
        userId: user.userId,
        action: 'TRANSFER_REQUEST_CREATED',
        resource: 'TRANSFER_REQUEST',
        resourceId: request.id,
        metadata: {
            evidenceId,
            proposedOwnerId,
            requestIdOnChain: requestIdOnChain || null,
            txHash: blockchainTxHash || null,
        },
    });

    return successResponse(
        {
            request: {
                id: request.id,
                requestId: request.requestId,
                evidenceId: request.evidenceId,
                proposedOwnerId: request.proposedOwnerId,
                reason: request.reason,
                approvalCount: request.approvalCount,
                createdAt: request.createdAt,
            },
            blockchain: {
                created: !!requestIdOnChain,
                requestId: requestIdOnChain || null,
                txHash: blockchainTxHash || null,
            },
        },
        'Transfer request created. Awaiting admin approvals.',
        201
    );
});