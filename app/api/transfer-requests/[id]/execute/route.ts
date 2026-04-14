/**
 * POST /api/transfer-requests/[id]/execute - Execute approved transfer request
 */

import { NextRequest } from 'next/server';
import { Role, EvidenceStatus } from '@prisma/client';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    getAuthUserWithRole,
} from '@/lib/api-helpers';
import {
    findTransferRequestById,
    markTransferRequestExecuted,
    updateEvidenceOwner,
    updateEvidenceStatus,
    createCustodyLog,
    createAuditLog,
    findEvidenceById,
} from '@/lib/db-helpers';
import { executeTransfer as executeOnChain } from '@/lib/contract';
import { executeInTransaction } from '@/lib/prisma';

export const POST = withErrorHandler(
    async (req: NextRequest, { params }: { params: { id: string } }) => {
        // Any authenticated investigator or admin can execute
        const user = getAuthUserWithRole(req, [Role.ADMIN, Role.INVESTIGATOR]);

        const { id } = params;

        // Check request exists
        const request = await findTransferRequestById(id);
        if (!request) {
            return errorResponse('Transfer request not found', 404);
        }

        // Check if already executed
        if (request.executed) {
            return errorResponse('Transfer request already executed', 400);
        }

        // Check if cancelled
        if (request.cancelled) {
            return errorResponse('Transfer request has been cancelled', 400);
        }

        // Check if enough approvals
        const requiredApprovals = parseInt(
            process.env.REQUIRED_APPROVALS || '2'
        );

        if (request.approvalCount < requiredApprovals) {
            return errorResponse(
                `Insufficient approvals. Required: ${requiredApprovals}, Current: ${request.approvalCount}`,
                400
            );
        }

        // Get evidence details
        const evidence = await findEvidenceById(request.evidenceId);
        if (!evidence) {
            return errorResponse('Evidence not found', 404);
        }

        const previousOwner = evidence.currentOwnerId;

        // Execute in transaction
        const result = await executeInTransaction(async (tx) => {
            // Mark request as executed
            await markTransferRequestExecuted(id, tx);

            // Update evidence owner
            await updateEvidenceOwner(request.evidenceId, request.proposedOwnerId, tx);

            // Update status to TRANSFERRED
            await updateEvidenceStatus(request.evidenceId, EvidenceStatus.TRANSFERRED, tx);

            // Create custody log
            await createCustodyLog(
                {
                    evidenceId: request.evidenceId,
                    fromUserId: previousOwner || undefined,
                    toUserId: request.proposedOwnerId,
                    action: 'TRANSFERRED',
                    reason: request.reason || 'Multi-signature transfer executed',
                },
                tx
            );

            return request;
        });

        // Execute on blockchain (if request has blockchain ID)
        let blockchainTxHash = '';
        if (request.requestId) {
            try {
                const blockchainResult = await executeOnChain(request.requestId);

                if (blockchainResult.success) {
                    blockchainTxHash = blockchainResult.txHash || '';
                    console.log(`✅ Transfer executed on blockchain: ${blockchainTxHash}`);
                } else {
                    console.warn(`⚠️  Blockchain execution failed: ${blockchainResult.error}`);
                }
            } catch (error) {
                console.error('Blockchain execution error:', error);
            }
        }

        // Create audit log
        await createAuditLog({
            userId: user.userId,
            action: 'TRANSFER_REQUEST_EXECUTED',
            resource: 'TRANSFER_REQUEST',
            resourceId: id,
            metadata: {
                evidenceId: request.evidenceId,
                fromUserId: previousOwner,
                toUserId: request.proposedOwnerId,
                approvalCount: request.approvalCount,
                txHash: blockchainTxHash || null,
            },
        });

        return successResponse(
            {
                request: result,
                transfer: {
                    from: previousOwner,
                    to: request.proposedOwnerId,
                    reason: request.reason,
                },
                blockchain: {
                    executed: !!blockchainTxHash,
                    txHash: blockchainTxHash || null,
                },
            },
            'Transfer executed successfully'
        );
    }
);