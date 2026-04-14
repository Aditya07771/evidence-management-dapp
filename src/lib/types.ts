/**
 * Shared TypeScript Types
 * Common interfaces and types used across the application
 */

import { Role, EvidenceStatus, EvidenceType } from '@prisma/client';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JWT PAYLOAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface JWTPayload {
    userId: string;
    email: string;
    name: string;
    role: Role;
    walletAddress?: string;
    iat?: number;
    exp?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API RESPONSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ApiSuccessResponse<T = any> {
    success: true;
    data: T;
    message?: string;
}

export interface ApiErrorResponse {
    success: false;
    error: string;
    details?: any;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOCKCHAIN TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ContractCallResult<T = any> {
    success: boolean;
    data?: T;
    txHash?: string;
    blockNumber?: number;
    error?: string;
}

export interface EvidenceOnChain {
    evidenceId: string;
    caseId: string;
    fileHash: string;
    fileURI: string;
    title: string;
    descriptionHash: string;
    evidenceType: number;
    locationHash: string;
    collectedBy: string;
    currentOwner: string;
    collectedAt: bigint;
    registeredAt: bigint;
    status: number;
    exists: boolean;
    isSensitive: boolean;
    custodyCount: bigint;
    verificationCount: number;
}

export interface CustodyRecordOnChain {
    fromAddress: string;
    toAddress: string;
    previousStatus: number;
    newStatus: number;
    actionHash: string;
    timestamp: bigint;
    txContext: string;
}

export interface TransferRequestOnChain {
    evidenceId: string;
    initiator: string;
    proposedOwner: string;
    reasonHash: string;
    createdAt: bigint;
    approvalCount: bigint;
    executed: boolean;
    cancelled: boolean;
    approvers: string[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROLE MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const RoleMapping: Record<Role, string> = {
    [Role.ADMIN]: 'ADMIN_ROLE',
    [Role.INVESTIGATOR]: 'INVESTIGATOR_ROLE',
    [Role.AUDITOR]: 'AUDITOR_ROLE',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATUS & TYPE LABELS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const EvidenceStatusLabels: Record<EvidenceStatus, string> = {
    [EvidenceStatus.COLLECTED]: 'Collected',
    [EvidenceStatus.SUBMITTED]: 'Submitted',
    [EvidenceStatus.UNDER_REVIEW]: 'Under Review',
    [EvidenceStatus.TRANSFERRED]: 'Transferred',
    [EvidenceStatus.ARCHIVED]: 'Archived',
    [EvidenceStatus.REJECTED]: 'Rejected',
};

export const EvidenceTypeLabels: Record<EvidenceType, string> = {
    [EvidenceType.DOCUMENT]: 'Document',
    [EvidenceType.IMAGE]: 'Image',
    [EvidenceType.VIDEO]: 'Video',
    [EvidenceType.AUDIO]: 'Audio',
    [EvidenceType.DIGITAL]: 'Digital',
    [EvidenceType.PHYSICAL]: 'Physical',
    [EvidenceType.OTHER]: 'Other',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENUM TO NUMBER MAPPING (for contract calls)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const EvidenceStatusToNumber: Record<EvidenceStatus, number> = {
    [EvidenceStatus.COLLECTED]: 0,
    [EvidenceStatus.SUBMITTED]: 1,
    [EvidenceStatus.UNDER_REVIEW]: 2,
    [EvidenceStatus.TRANSFERRED]: 3,
    [EvidenceStatus.ARCHIVED]: 4,
    [EvidenceStatus.REJECTED]: 5,
};

export const EvidenceTypeToNumber: Record<EvidenceType, number> = {
    [EvidenceType.DOCUMENT]: 0,
    [EvidenceType.IMAGE]: 1,
    [EvidenceType.VIDEO]: 2,
    [EvidenceType.AUDIO]: 3,
    [EvidenceType.DIGITAL]: 4,
    [EvidenceType.PHYSICAL]: 5,
    [EvidenceType.OTHER]: 6,
};

export const NumberToEvidenceStatus: Record<number, EvidenceStatus> = {
    0: EvidenceStatus.COLLECTED,
    1: EvidenceStatus.SUBMITTED,
    2: EvidenceStatus.UNDER_REVIEW,
    3: EvidenceStatus.TRANSFERRED,
    4: EvidenceStatus.ARCHIVED,
    5: EvidenceStatus.REJECTED,
};

export const NumberToEvidenceType: Record<number, EvidenceType> = {
    0: EvidenceType.DOCUMENT,
    1: EvidenceType.IMAGE,
    2: EvidenceType.VIDEO,
    3: EvidenceType.AUDIO,
    4: EvidenceType.DIGITAL,
    5: EvidenceType.PHYSICAL,
    6: EvidenceType.OTHER,
};