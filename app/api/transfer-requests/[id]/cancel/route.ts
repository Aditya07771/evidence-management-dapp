/**
 * POST /api/transfer-requests/[id]/cancel - Cancel transfer request
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
    markTransferRequestCancelled,
    createAuditLog,
} from '@/lib/db-helpers';
import { cancelTransferRequest as cancelOnChain } from '@/lib/contract';
import { executeInTransaction } from '@/lib/prisma';

export const POST = withErrorHandler(
    async (req: NextRequest, { params }: { params: { id: string } }) => {
        // Initiator or admin can cancel
        const user = getAuthUserWithRole(req, [Role.ADMIN, Role.INVESTIGATOR]);

        const { id } = params;

        // Check request exists
        const request = await findTransferRequestById(id);
        if (!request) {
            return errorResponse('Transfer request not found', 404);
        }

        // Check if already executed
        if (request.executed) {
            return errorResponse('Cannot cancel executed request', 400);
        }

        // Check if already cancelled
        if (request.cancelled) {
            return errorResponse('Request already cancelled', 400);
        }

        // Only initiator or admin can cancel
        if (request.initiatorId !== user.userId && user.role !== Role.ADMIN) {
            return errorResponse('Only the initiator or admin can cancel', 403);
        }

        // Cancel in database
        await executeInTransaction(async (tx) => {
            await markTransferRequestCancelled(id, tx);
        });

        // Cancel on blockchain (if request has blockchain ID)
        let blockchainTxHash = '';
        if (request.requestId) {
            try {
                const blockchainResult = await cancelOnChain(request.requestId);

                if (blockchainResult.success) {
                    blockchainTxHash = blockchainResult.txHash || '';
                    console.log(`✅ Transfer cancelled on blockchain: ${blockchainTxHash}`);
                } else {
                    console.warn(`⚠️  Blockchain cancellation failed: ${blockchainResult.error}`);
                }
            } catch (error) {
                console.error('Blockchain cancellation error:', error);
            }
        }

        // Create audit log
        await createAuditLog({
            userId: user.userId,
            action: 'TRANSFER_REQUEST_CANCELLED',
            resource: 'TRANSFER_REQUEST',
            resourceId: id,
            metadata: {
                evidenceId: request.evidenceId,
                txHash: blockchainTxHash || null,
            },
        });

        return successResponse(
            {
                request,
                blockchain: {
                    cancelled: !!blockchainTxHash,
                    txHash: blockchainTxHash || null,
                },
            },
            'Transfer request cancelled'
        );
    }
);