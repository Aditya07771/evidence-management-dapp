/**
 * GET /api/admin/stats - Get system-wide statistics
 */

import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import {
  withErrorHandler,
  successResponse,
  getAuthUserWithRole,
} from '@/lib/api-helpers';
import { getSystemStats, getRecentActivity } from '@/lib/db-helpers';
import { getTotalEvidenceCount } from '@/lib/contract';

export const GET = withErrorHandler(async (req: NextRequest) => {
  // Only admins can view system stats
  const user = getAuthUserWithRole(req, [Role.ADMIN]);

  // Get database stats
  const dbStats = await getSystemStats();

  // Get recent activity
  const recentActivity = await getRecentActivity(10);

  // Get blockchain evidence count (if available)
  let blockchainEvidenceCount = 0;
  try {
    const blockchainResult = await getTotalEvidenceCount();
    if (blockchainResult.success && blockchainResult.data !== undefined) {
      blockchainEvidenceCount = blockchainResult.data;
    }
  } catch (error) {
    console.error('Failed to get blockchain evidence count:', error);
  }

  return successResponse({
    overview: {
      totalEvidence: dbStats.totalEvidence,
      totalCases: dbStats.totalCases,
      totalOfficers: dbStats.totalOfficers,
      pendingTransfers: dbStats.pendingTransfers,
      blockchainEvidenceCount,
    },
    evidenceByStatus: dbStats.evidenceByStatus.reduce((acc: any, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {}),
    evidenceByType: dbStats.evidenceByType.reduce((acc: any, item) => {
      acc[item.evidenceType] = item._count;
      return acc;
    }, {}),
    recentActivity: recentActivity.map((log) => ({
      id: log.id,
      action: log.action,
      reason: log.reason,
      createdAt: log.createdAt,
      evidence: log.evidence
        ? {
            id: log.evidence.id,
            title: log.evidence.title,
            evidenceId: log.evidence.evidenceId,
          }
        : null,
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
  });
});