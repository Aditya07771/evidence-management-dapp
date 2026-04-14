/**
 * GET /api/evidence/[id] - Get evidence details with custody history
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
    findEvidenceById,
    getEvidenceCustodyHistory,
    getEvidenceVerifications,
} from '@/lib/db-helpers';
import { getEvidenceStatus as getBlockchainStatus } from '@/lib/contract';

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
            return errorResponse('Invalid evidence ID format', 400);
        }

        // Fetch evidence from database
        const evidence = await findEvidenceById(id);

        if (!evidence) {
            return errorResponse('Evidence not found', 404);
        }

        // Fetch custody history
        const custodyHistory = await getEvidenceCustodyHistory(id);

        // Fetch verifications
        const verifications = await getEvidenceVerifications(id);

        // Get blockchain status (if registered)
        let blockchainStatus = null;
        if (evidence.evidenceId && evidence.registeredOnChain) {
            try {
                const statusResult = await getBlockchainStatus(evidence.evidenceId);
                if (statusResult.success && statusResult.data) {
                    blockchainStatus = {
                        status: statusResult.data.status,
                        currentOwner: statusResult.data.currentOwner,
                        custodyCount: Number(statusResult.data.custodyCount),
                    };
                }
            } catch (error) {
                console.error('Failed to fetch blockchain status:', error);
            }
        }

        return successResponse({
            evidence: {
                id: evidence.id,
                evidenceId: evidence.evidenceId,
                title: evidence.title,
                description: evidence.description,
                evidenceType: evidence.evidenceType,
                status: evidence.status,
                fileHash: evidence.fileHash,
                fileURI: evidence.fileURI,
                fileName: evidence.fileName,
                fileSize: evidence.fileSize,
                locationText: evidence.locationText,
                isSensitive: evidence.isSensitive,
                collectedAt: evidence.collectedAt,
                registeredOnChain: evidence.registeredOnChain,
                txHash: evidence.txHash,
                blockNumber: evidence.blockNumber,
                createdAt: evidence.createdAt,
                updatedAt: evidence.updatedAt,
            },
            case: {
                id: evidence.case.id,
                caseNumber: evidence.case.caseNumber,
                title: evidence.case.title,
                status: evidence.case.status,
            },
            collectedBy: {
                id: evidence.collectedBy.id,
                name: evidence.collectedBy.name,
                badgeId: evidence.collectedBy.badgeId,
                walletAddress: evidence.collectedBy.walletAddress,
            },
            custodyHistory: custodyHistory.map((log) => ({
                id: log.id,
                action: log.action,
                reason: log.reason,
                txHash: log.txHash,
                createdAt: log.createdAt,
                from: log.fromUser
                    ? {
                        id: log.fromUser.id,
                        name: log.fromUser.name,
                        badgeId: log.fromUser.badgeId,
                    }
                    : null,
                to: {
                    id: log.toUser.id,
                    name: log.toUser.name,
                    badgeId: log.toUser.badgeId,
                },
            })),
            verifications: verifications.map((v) => ({
                id: v.id,
                fileHash: v.fileHash,
                isAuthentic: v.isAuthentic,
                txHash: v.txHash,
                createdAt: v.createdAt,
                verifiedBy: {
                    id: v.verifiedBy.id,
                    name: v.verifiedBy.name,
                    badgeId: v.verifiedBy.badgeId,
                },
            })),
            blockchainStatus,
        });
    }
);