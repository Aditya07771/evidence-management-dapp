/**
 * POST /api/evidence/[id]/verify - Verify evidence authenticity with file upload
 */

import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    getAuthUserWithRole,
} from '@/lib/api-helpers';
import { parseFormData, deleteFile } from '@/lib/file-upload';
import {
    findEvidenceById,
    createVerification,
    createAuditLog,
} from '@/lib/db-helpers';
import { verifyEvidence as verifyOnChain } from '@/lib/contract';
import { hashesMatch } from '@/lib/hash';

export const POST = withErrorHandler(
    async (req: NextRequest, { params }: { params: { id: string } }) => {
        // Any authenticated user can verify
        const user = getAuthUserWithRole(req, [
            Role.ADMIN,
            Role.INVESTIGATOR,
            Role.AUDITOR,
        ]);

        const { id } = params;

        // Check evidence exists
        const evidence = await findEvidenceById(id);
        if (!evidence) {
            return errorResponse('Evidence not found', 404);
        }

        // Parse uploaded file
        const { files } = await parseFormData(req);

        if (!files.file) {
            return errorResponse('No file uploaded for verification', 400);
        }

        const uploadedFile = files.file;
        const submittedHash = uploadedFile.hash;

        // Compare hashes
        const isAuthentic = hashesMatch(submittedHash, evidence.fileHash);

        // Clean up uploaded file (we don't need to keep it)
        deleteFile(uploadedFile.filepath);

        // Verify on blockchain (if registered) - writes verification log
        let blockchainTxHash = '';
        let blockchainVerified = false;
        let registeredAt: bigint | undefined;

        if (evidence.evidenceId && evidence.registeredOnChain) {
            try {
                const blockchainResult = await verifyOnChain(
                    evidence.evidenceId,
                    submittedHash
                );

                if (blockchainResult.success && blockchainResult.data) {
                    blockchainTxHash = blockchainResult.txHash || '';
                    blockchainVerified = true;
                    registeredAt = blockchainResult.data.registeredAt;
                    console.log(`✅ Evidence verified on blockchain: ${blockchainTxHash}`);
                }
            } catch (error) {
                console.error('Blockchain verification error:', error);
            }
        }

        // Save verification record to database
        const verification = await createVerification({
            evidenceId: id,
            verifiedById: user.userId,
            fileHash: submittedHash,
            isAuthentic,
            txHash: blockchainTxHash || undefined,
        });

        // Create audit log
        await createAuditLog({
            userId: user.userId,
            action: 'EVIDENCE_VERIFIED',
            resource: 'EVIDENCE',
            resourceId: id,
            metadata: {
                isAuthentic,
                submittedHash,
                expectedHash: evidence.fileHash,
                evidenceId: evidence.evidenceId,
                txHash: blockchainTxHash || null,
            },
        });

        return successResponse({
            verification: {
                id: verification.id,
                isAuthentic,
                submittedHash,
                expectedHash: evidence.fileHash,
                hashesMatch: isAuthentic,
                verifiedAt: verification.createdAt,
            },
            evidence: {
                id: evidence.id,
                title: evidence.title,
                registeredAt: evidence.createdAt,
                ...(registeredAt && {
                    blockchainRegisteredAt: new Date(Number(registeredAt) * 1000),
                }),
            },
            blockchain: {
                verified: blockchainVerified,
                txHash: blockchainTxHash || null,
            },
        });
    }
);