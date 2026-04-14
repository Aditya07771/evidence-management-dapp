/**
 * POST /api/admin/officers/[id]/deactivate - Deactivate an officer
 */

import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    getAuthUserWithRole,
} from '@/lib/api-helpers';
import { findUserById, deactivateUser, createAuditLog } from '@/lib/db-helpers';
import { deactivateOfficer as deactivateOnChain } from '@/lib/contract';

export const POST = withErrorHandler(
    async (req: NextRequest, { params }: { params: { id: string } }) => {
        // Only admins can deactivate officers
        const user = getAuthUserWithRole(req, [Role.ADMIN]);

        const { id } = params;

        // Check officer exists
        const officer = await findUserById(id);
        if (!officer) {
            return errorResponse('Officer not found', 404);
        }

        // Cannot deactivate self
        if (officer.id === user.userId) {
            return errorResponse('Cannot deactivate your own account', 400);
        }

        // Check if already inactive
        if (!officer.isActive) {
            return errorResponse('Officer is already inactive', 400);
        }

        // Deactivate in database
        const deactivated = await deactivateUser(id);

        // Deactivate on blockchain (if has wallet)
        let blockchainTxHash = '';
        if (officer.walletAddress) {
            try {
                const blockchainResult = await deactivateOnChain(officer.walletAddress);

                if (blockchainResult.success) {
                    blockchainTxHash = blockchainResult.txHash || '';
                    console.log(`✅ Officer deactivated on blockchain: ${blockchainTxHash}`);
                } else {
                    console.warn(`⚠️  Blockchain deactivation failed: ${blockchainResult.error}`);
                }
            } catch (error) {
                console.error('Blockchain deactivation error:', error);
            }
        }

        // Create audit log
        await createAuditLog({
            userId: user.userId,
            action: 'OFFICER_DEACTIVATED',
            resource: 'USER',
            resourceId: id,
            metadata: {
                officerName: officer.name,
                officerBadgeId: officer.badgeId,
                officerRole: officer.role,
                walletAddress: officer.walletAddress,
                txHash: blockchainTxHash || null,
            },
        });

        return successResponse({
            officer: {
                id: deactivated.id,
                name: deactivated.name,
                badgeId: deactivated.badgeId,
                isActive: deactivated.isActive,
            },
            blockchain: {
                deactivated: !!blockchainTxHash,
                txHash: blockchainTxHash || null,
            },
        });
    }
);