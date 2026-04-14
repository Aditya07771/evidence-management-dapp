/**
 * POST /api/admin/officers/[id]/reactivate - Reactivate an officer
 */

import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import {
  withErrorHandler,
  successResponse,
  errorResponse,
  getAuthUserWithRole,
} from '@/lib/api-helpers';
import { findUserById, reactivateUser, createAuditLog } from '@/lib/db-helpers';

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    // Only admins can reactivate officers
    const user = getAuthUserWithRole(req, [Role.ADMIN]);

    const { id } = params;

    // Check officer exists
    const officer = await findUserById(id);
    if (!officer) {
      return errorResponse('Officer not found', 404);
    }

    // Check if already active
    if (officer.isActive) {
      return errorResponse('Officer is already active', 400);
    }

    // Reactivate in database
    const reactivated = await reactivateUser(id);

    // Note: Contract doesn't have reactivateOfficer function
    // In production, you might need to add this to the contract

    // Create audit log
    await createAuditLog({
      userId: user.userId,
      action: 'OFFICER_REACTIVATED',
      resource: 'USER',
      resourceId: id,
      metadata: {
        officerName: officer.name,
        officerBadgeId: officer.badgeId,
        officerRole: officer.role,
      },
    });

    return successResponse({
      officer: {
        id: reactivated.id,
        name: reactivated.name,
        badgeId: reactivated.badgeId,
        isActive: reactivated.isActive,
      },
    });
  }
);