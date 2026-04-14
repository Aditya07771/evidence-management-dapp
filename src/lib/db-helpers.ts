/**
 * Database Helper Functions
 * Common queries and utilities for the Evidence Management System
 */

import { prisma } from './prisma';
import {
  Role,
  EvidenceStatus,
  EvidenceType,
  CaseStatus,
  Prisma,
} from '@prisma/client';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function findUserByWallet(walletAddress: string) {
  return prisma.user.findUnique({
    where: { walletAddress },
  });
}

export async function findUserByBadgeId(badgeId: string) {
  return prisma.user.findUnique({
    where: { badgeId },
  });
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  name: string;
  badgeId: string;
  role: Role;
  walletAddress?: string;
}) {
  return prisma.user.create({
    data,
  });
}

export async function getAllActiveUsers(role?: Role) {
  return prisma.user.findMany({
    where: {
      isActive: true,
      ...(role && { role }),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deactivateUser(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });
}

export async function reactivateUser(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CASE QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createCase(data: {
  caseNumber: string;
  title: string;
  description?: string;
}) {
  return prisma.case.create({
    data,
  });
}

export async function findCaseById(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: {
      evidences: {
        orderBy: { createdAt: 'desc' },
        include: {
          collectedBy: {
            select: {
              id: true,
              name: true,
              badgeId: true,
            },
          },
        },
      },
    },
  });
}

export async function findCaseByCaseNumber(caseNumber: string) {
  return prisma.case.findUnique({
    where: { caseNumber },
    include: {
      evidences: true,
    },
  });
}

export async function getAllCases(
  status?: CaseStatus,
  limit: number = 50,
  offset: number = 0
) {
  return prisma.case.findMany({
    where: status ? { status } : undefined,
    include: {
      _count: {
        select: { evidences: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function updateCaseStatus(id: string, status: CaseStatus) {
  return prisma.case.update({
    where: { id },
    data: { status },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVIDENCE QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createEvidence(
  data: Prisma.EvidenceCreateInput,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.evidence.create({
    data,
    include: {
      case: true,
      collectedBy: {
        select: {
          id: true,
          name: true,
          badgeId: true,
          walletAddress: true,
        },
      },
    },
  });
}

export async function findEvidenceById(id: string) {
  return prisma.evidence.findUnique({
    where: { id },
    include: {
      case: true,
      collectedBy: {
        select: {
          id: true,
          name: true,
          badgeId: true,
          walletAddress: true,
        },
      },
      custodyLogs: {
        orderBy: { createdAt: 'asc' },
        include: {
          fromUser: {
            select: { id: true, name: true, badgeId: true },
          },
          toUser: {
            select: { id: true, name: true, badgeId: true },
          },
        },
      },
      verifications: {
        orderBy: { createdAt: 'desc' },
        include: {
          verifiedBy: {
            select: { id: true, name: true, badgeId: true },
          },
        },
      },
    },
  });
}

export async function findEvidenceByEvidenceId(evidenceId: string) {
  return prisma.evidence.findUnique({
    where: { evidenceId },
    include: {
      case: true,
      collectedBy: true,
    },
  });
}

export async function findEvidenceByFileHash(fileHash: string) {
  return prisma.evidence.findUnique({
    where: { fileHash },
  });
}

export async function searchEvidence(filters: {
  caseId?: string;
  status?: EvidenceStatus;
  evidenceType?: EvidenceType;
  collectedById?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}) {
  const {
    caseId,
    status,
    evidenceType,
    collectedById,
    searchTerm,
    limit = 50,
    offset = 0,
  } = filters;

  const where: Prisma.EvidenceWhereInput = {
    ...(caseId && { caseId }),
    ...(status && { status }),
    ...(evidenceType && { evidenceType }),
    ...(collectedById && { collectedById }),
    ...(searchTerm && {
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ],
    }),
  };

  const [evidences, total] = await Promise.all([
    prisma.evidence.findMany({
      where,
      include: {
        case: {
          select: { id: true, caseNumber: true, title: true },
        },
        collectedBy: {
          select: { id: true, name: true, badgeId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.evidence.count({ where }),
  ]);

  return {
    evidences,
    total,
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(total / limit),
  };
}

export async function updateEvidenceStatus(
  id: string,
  status: EvidenceStatus,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.evidence.update({
    where: { id },
    data: { status },
  });
}

export async function updateEvidenceOwner(
  id: string,
  currentOwnerId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.evidence.update({
    where: { id },
    data: { currentOwnerId },
  });
}

export async function updateEvidenceBlockchainData(
  id: string,
  data: {
    evidenceId: string;
    txHash: string;
    blockNumber: number;
    registeredOnChain: boolean;
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.evidence.update({
    where: { id },
    data,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTODY LOG QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createCustodyLog(
  data: {
    evidenceId: string;
    fromUserId?: string | null;
    toUserId: string;
    action: string;
    reason?: string;
    txHash?: string;
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.custodyLog.create({
    data,
  });
}

export async function getEvidenceCustodyHistory(evidenceId: string) {
  return prisma.custodyLog.findMany({
    where: { evidenceId },
    include: {
      fromUser: {
        select: { id: true, name: true, badgeId: true },
      },
      toUser: {
        select: { id: true, name: true, badgeId: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VERIFICATION QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createVerification(
  data: {
    evidenceId: string;
    verifiedById: string;
    fileHash: string;
    isAuthentic: boolean;
    txHash?: string;
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.verification.create({
    data,
    include: {
      evidence: true,
      verifiedBy: {
        select: { id: true, name: true, badgeId: true },
      },
    },
  });
}

export async function getEvidenceVerifications(evidenceId: string) {
  return prisma.verification.findMany({
    where: { evidenceId },
    include: {
      verifiedBy: {
        select: { id: true, name: true, badgeId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRANSFER REQUEST QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createTransferRequest(data: {
  evidenceId: string;
  initiatorId: string;
  proposedOwnerId: string;
  reason?: string;
  requestId?: string;
}) {
  return prisma.transferRequest.create({
    data,
    include: {
      initiator: {
        select: { id: true, name: true, badgeId: true },
      },
    },
  });
}

export async function findTransferRequestById(id: string) {
  return prisma.transferRequest.findUnique({
    where: { id },
    include: {
      initiator: {
        select: { id: true, name: true, badgeId: true },
      },
    },
  });
}

export async function findTransferRequestByRequestId(requestId: string) {
  return prisma.transferRequest.findUnique({
    where: { requestId },
  });
}

export async function getPendingTransferRequests() {
  return prisma.transferRequest.findMany({
    where: {
      executed: false,
      cancelled: false,
    },
    include: {
      initiator: {
        select: { id: true, name: true, badgeId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateTransferRequestApproval(
  id: string,
  approverId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  const request = await client.transferRequest.findUnique({
    where: { id },
  });

  if (!request) {
    throw new Error('Transfer request not found');
  }

  return client.transferRequest.update({
    where: { id },
    data: {
      approvalCount: { increment: 1 },
      approvers: [...request.approvers, approverId],
    },
  });
}

export async function markTransferRequestExecuted(
  id: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.transferRequest.update({
    where: { id },
    data: { executed: true },
  });
}

export async function markTransferRequestCancelled(
  id: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.transferRequest.update({
    where: { id },
    data: { cancelled: true },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATISTICS & ANALYTICS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getSystemStats() {
  const [
    totalEvidence,
    totalCases,
    totalOfficers,
    pendingTransfers,
    evidenceByStatus,
    evidenceByType,
  ] = await Promise.all([
    prisma.evidence.count(),
    prisma.case.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.transferRequest.count({
      where: { executed: false, cancelled: false },
    }),
    prisma.evidence.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.evidence.groupBy({
      by: ['evidenceType'],
      _count: true,
    }),
  ]);

  return {
    totalEvidence,
    totalCases,
    totalOfficers,
    pendingTransfers,
    evidenceByStatus,
    evidenceByType,
  };
}

export async function getRecentActivity(limit: number = 10) {
  return prisma.custodyLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      evidence: {
        select: { id: true, title: true, evidenceId: true },
      },
      fromUser: {
        select: { id: true, name: true, badgeId: true },
      },
      toUser: {
        select: { id: true, name: true, badgeId: true },
      },
    },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUDIT LOG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createAuditLog(data: {
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}) {
  return prisma.auditLog.create({
    data: {
      ...data,
      metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function getAuditLogs(
  filters: {
    userId?: string;
    action?: string;
    resource?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { userId, action, resource, limit = 50, offset = 0 } = filters;

  return prisma.auditLog.findMany({
    where: {
      ...(userId && { userId }),
      ...(action && { action }),
      ...(resource && { resource }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}