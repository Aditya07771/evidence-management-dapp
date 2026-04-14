/**
 * POST /api/transfer-requests/[id]/approve - Approve transfer request (admin only)
 */

import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    getAuthUserWithRole,
} from '@/lib/api-helpers';
import {
    findTransferRequestById,
    updateTransferRequestApproval,
    createAuditLog,
} from '@/lib/db-helpers';
import { approveTransfer as approveOnChain } from '@/lib/contract';
import { executeInTransaction } from '@/lib/prisma';

export const POST = withErrorHandler(
    async (req: NextRequest, { params }: { params: { id: string } }) => {
        // Only admins can approve
        const user = getAuthUserWithRole(req, [Role.ADMIN]);

        const { id } = params;

        // Check request exists
        const request = await findTransferRequestById(id);
        if (!request) {
            return errorResponse('Transfer request not found', 404);
        }

        // Check if already executed or cancelled
        if (request.executed) {
            return errorResponse('Transfer request already executed', 400);
        }

        if (request.cancelled) {
            return errorResponse('Transfer request has been cancelled', 400);
        }

        // Check if user already approved
        if (request.approvers.includes(user.userId)) {
            return errorResponse('You have already approved this request', 400);
        }

        // Update in database
        const updated = await executeInTransaction(async (tx) => {
            return await updateTransferRequestApproval(id, user.userId, tx);
        });

        // Approve on blockchain (if request has blockchain ID)
        let blockchainTxHash = '';
        if (request.requestId) {
            try {
                const blockchainResult = await approveOnChain(request.requestId);

                if (blockchainResult.success) {
                    blockchainTxHash = blockchainResult.txHash || '';
                    console.log(`✅ Transfer approved on blockchain: ${blockchainTxHash}`);
                } else {
                    console.warn(`⚠️  Blockchain approval failed: ${blockchainResult.error}`);
                }
            } catch (error) {
                console.error('Blockchain approval error:', error);
            }
        }

        // Create audit log
        await createAuditLog({
            userId: user.userId,
            action: 'TRANSFER_REQUEST_APPROVED',
            resource: 'TRANSFER_REQUEST',
            resourceId: id,
            metadata: {
                evidenceId: request.evidenceId,
                approvalCount: updated.approvalCount,
                txHash: blockchainTxHash || null,
            },
        });

        // Get required approvals from env (default 2)
        const requiredApprovals = parseInt(
            process.env.REQUIRED_APPROVALS || '2'
        );

        return successResponse({
            request: updated,
            approvalCount: updated.approvalCount,
            requiredApprovals,
            canExecute: updated.approvalCount >= requiredApprovals,
            blockchain: {
                approved: !!blockchainTxHash,
                txHash: blockchainTxHash || null,
            },
        });
    }
);