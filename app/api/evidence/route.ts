/**
 * GET  /api/evidence - List/search evidence
 * POST /api/evidence - Upload and register new evidence
 */

import { NextRequest } from 'next/server';
import { Role, EvidenceType, EvidenceStatus } from '@prisma/client';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    getAuthUserWithRole,
    parsePagination,
    getQueryParam,
} from '@/lib/api-helpers';
import {
    parseFormData,
    validateFileSize,
    getFileURI,
    deleteFile,
} from '@/lib/file-upload';
import {
    createEvidence,
    findCaseById,
    findEvidenceByFileHash,
    createCustodyLog,
    updateEvidenceBlockchainData,
    searchEvidence,
    createAuditLog,
} from '@/lib/db-helpers';
import { registerEvidence as registerEvidenceOnChain } from '@/lib/contract';
import { EvidenceTypeToNumber } from '@/lib/types';
import { executeInTransaction } from '@/lib/prisma';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/evidence - List/search evidence
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const GET = withErrorHandler(async (req: NextRequest) => {
    // Require authentication
    const user = getAuthUserWithRole(req, [
        Role.ADMIN,
        Role.INVESTIGATOR,
        Role.AUDITOR,
    ]);

    // Parse pagination
    const { page, limit, offset } = parsePagination(req);

    // Parse filters
    const caseId = getQueryParam(req, 'caseId');
    const statusParam = getQueryParam(req, 'status');
    const typeParam = getQueryParam(req, 'type');
    const searchTerm = getQueryParam(req, 'search');

    const status = statusParam ? (statusParam as EvidenceStatus) : undefined;
    const evidenceType = typeParam ? (typeParam as EvidenceType) : undefined;

    // Validate enum values
    if (status && !Object.values(EvidenceStatus).includes(status)) {
        return errorResponse('Invalid status value', 400);
    }
    if (evidenceType && !Object.values(EvidenceType).includes(evidenceType)) {
        return errorResponse('Invalid evidence type', 400);
    }

    // Search evidence
    const result = await searchEvidence({
        caseId: caseId || undefined,
        status,
        evidenceType,
        searchTerm: searchTerm || undefined,
        limit,
        offset,
    });

    return successResponse({
        evidences: result.evidences.map((ev) => ({
            id: ev.id,
            evidenceId: ev.evidenceId,
            title: ev.title,
            evidenceType: ev.evidenceType,
            status: ev.status,
            isSensitive: ev.isSensitive,
            fileHash: ev.fileHash,
            collectedAt: ev.collectedAt,
            registeredOnChain: ev.registeredOnChain,
            case: {
                id: ev.case.id,
                caseNumber: ev.case.caseNumber,
                title: ev.case.title,
            },
            collectedBy: {
                id: ev.collectedBy.id,
                name: ev.collectedBy.name,
                badgeId: ev.collectedBy.badgeId,
            },
        })),
        pagination: {
            page: result.page,
            limit,
            total: result.total,
            totalPages: result.totalPages,
        },
    });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/evidence - Upload and register evidence
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const POST = withErrorHandler(async (req: NextRequest) => {
    // Only admins and investigators can upload evidence
    const user = getAuthUserWithRole(req, [Role.ADMIN, Role.INVESTIGATOR]);

    // Parse multipart form data
    const { fields, files } = await parseFormData(req);

    // Validate required fields
    if (!files.file) {
        return errorResponse('No file uploaded', 400);
    }

    const uploadedFile = files.file;

    // Validate required form fields
    const requiredFields = ['caseId', 'title', 'evidenceType', 'collectedAt'];
    for (const field of requiredFields) {
        if (!fields[field]) {
            deleteFile(uploadedFile.filepath); // Clean up
            return errorResponse(`Missing required field: ${field}`, 400);
        }
    }

    // Parse fields
    const {
        caseId,
        title,
        description,
        evidenceType,
        location,
        collectedAt,
        isSensitive,
    } = fields;

    // Validate evidence type
    if (!Object.values(EvidenceType).includes(evidenceType as EvidenceType)) {
        deleteFile(uploadedFile.filepath);
        return errorResponse('Invalid evidence type', 400);
    }

    // Validate file size
    if (!validateFileSize(uploadedFile.size)) {
        deleteFile(uploadedFile.filepath);
        return errorResponse('File size exceeds maximum allowed', 400);
    }

    // Check case exists
    const caseData = await findCaseById(caseId);
    if (!caseData) {
        deleteFile(uploadedFile.filepath);
        return errorResponse('Case not found', 404);
    }

    // Check for duplicate file hash
    const existingEvidence = await findEvidenceByFileHash(uploadedFile.hash);
    if (existingEvidence) {
        deleteFile(uploadedFile.filepath);
        return errorResponse(
            'This file has already been registered as evidence',
            409,
            { evidenceId: existingEvidence.id }
        );
    }

    const fileURI = getFileURI(uploadedFile.filepath);
    const collectedAtDate = new Date(collectedAt);
    const isSensitiveFlag = isSensitive === 'true';

    // Use transaction for database + blockchain dual-write
    try {
        const result = await executeInTransaction(async (tx) => {
            // 1. Create evidence in database
            const evidence = await createEvidence(
                {
                    case: { connect: { id: caseId } },
                    title,
                    description: description || null,
                    evidenceType: evidenceType as EvidenceType,
                    fileHash: uploadedFile.hash,
                    fileURI,
                    fileName: uploadedFile.originalFilename,
                    fileSize: uploadedFile.size,
                    locationText: location || null,
                    collectedAt: collectedAtDate,
                    isSensitive: isSensitiveFlag,
                    collectedBy: { connect: { id: user.userId } },
                    currentOwnerId: user.userId,
                    status: EvidenceStatus.COLLECTED,
                    registeredOnChain: false, // Will update after blockchain registration
                },
                tx
            );

            // 2. Create initial custody log
            await createCustodyLog(
                {
                    evidenceId: evidence.id,
                    fromUserId: null, // Initial registration
                    toUserId: user.userId,
                    action: 'REGISTERED',
                    reason: 'Initial evidence registration',
                },
                tx
            );

            return evidence;
        });

        // 3. Register on blockchain (after DB commit)
        let blockchainSuccess = false;
        let evidenceIdOnChain = '';
        let txHash = '';
        let blockNumber = 0;

        try {
            const evidenceTypeNumber = EvidenceTypeToNumber[evidenceType as EvidenceType];
            const collectedAtTimestamp = Math.floor(collectedAtDate.getTime() / 1000);

            const blockchainResult = await registerEvidenceOnChain({
                caseId: caseData.caseNumber,
                fileHash: uploadedFile.hash,
                fileURI,
                title,
                description: description || '',
                evidenceType: evidenceTypeNumber,
                location: location || '',
                collectedAt: collectedAtTimestamp,
                isSensitive: isSensitiveFlag,
            });

            if (blockchainResult.success && blockchainResult.data) {
                blockchainSuccess = true;
                evidenceIdOnChain = blockchainResult.data.evidenceId;
                txHash = blockchainResult.txHash || '';
                blockNumber = blockchainResult.blockNumber || 0;

                // Update evidence with blockchain data
                await updateEvidenceBlockchainData(result.id, {
                    evidenceId: evidenceIdOnChain,
                    txHash,
                    blockNumber,
                    registeredOnChain: true,
                });

                console.log(`✅ Evidence registered on blockchain: ${txHash}`);
            } else {
                console.warn(
                    `⚠️  Blockchain registration failed: ${blockchainResult.error}`
                );
            }
        } catch (error: any) {
            console.error('Blockchain registration error:', error);
            // Continue - evidence is in DB, blockchain is supplementary
        }

        // 4. Create audit log
        await createAuditLog({
            userId: user.userId,
            action: 'EVIDENCE_REGISTERED',
            resource: 'EVIDENCE',
            resourceId: result.id,
            metadata: {
                caseId,
                caseNumber: caseData.caseNumber,
                title,
                evidenceType,
                fileHash: uploadedFile.hash,
                fileSize: uploadedFile.size,
                blockchainRegistered: blockchainSuccess,
                txHash: txHash || null,
            },
        });

        // Return success response
        return successResponse(
            {
                evidence: {
                    id: result.id,
                    evidenceId: evidenceIdOnChain || null,
                    caseId: result.caseId,
                    title: result.title,
                    evidenceType: result.evidenceType,
                    status: result.status,
                    fileHash: result.fileHash,
                    fileURI: result.fileURI,
                    fileName: result.fileName,
                    fileSize: result.fileSize,
                    isSensitive: result.isSensitive,
                    collectedAt: result.collectedAt,
                    registeredOnChain: blockchainSuccess,
                },
                blockchain: {
                    registered: blockchainSuccess,
                    evidenceId: evidenceIdOnChain || null,
                    txHash: txHash || null,
                    blockNumber: blockNumber || null,
                },
            },
            'Evidence uploaded and registered successfully',
            201
        );
    } catch (error: any) {
        // Rollback: delete uploaded file if database transaction fails
        deleteFile(uploadedFile.filepath);
        throw error;
    }
});

// Disable Next.js body parsing for file uploads
export const config = {
    api: {
        bodyParser: false,
    },
};