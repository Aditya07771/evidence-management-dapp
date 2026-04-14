/**
 * POST /api/admin/evidence/[id]/force-archive - Force archive evidence (super admin)
 */

import { NextRequest } from 'next/server';
import { Role, EvidenceStatus } from '@prisma/client';
import { z } from 'zod';
import {
  withErrorHandler,
  successResponse,
  errorResponse,
  getAuthUserWithRole,
  parseBody,
} from '@/lib/api-helpers';
import {
  findEvidenceById,
  updateEvidenceStatus,
  createCustodyLog,
  createAuditLog,
} from '@/lib/db-helpers';
import { forceArchive as forceArchiveOnChain } from '@/lib/contract';
import { executeInTransaction } from '@/lib/prisma';

const forceArchiveSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    // Only admins can force archive
    const user = getAuthUserWithRole(req, [Role.ADMIN]);

    const { id } = params;

    // Check evidence exists
    const evidence = await findEvidenceById(id);
    if (!evidence) {
      return errorResponse('Evidence not found', 404);
    }

    // Check if already archived
    if (evidence.status === EvidenceStatus.ARCHIVED) {
      return errorResponse('Evidence is already archived', 400);
    }

    // Validate body
    const body = await parseBody(req);
    const validation = forceArchiveSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.errors);
    }

    const { reason } = validation.data;

    const previousStatus = evidence.status;

    // Update in database
    const result = await executeInTransaction(async (tx) => {
      const updated = await updateEvidenceStatus(id, EvidenceStatus.ARCHIVED, tx);

      await createCustodyLog(
        {
          evidenceId: id,
          fromUserId: user.userId,
          toUserId: evidence.currentOwnerId || user.userId,
          action: 'FORCE_ARCHIVED',
          reason,
        },
        tx
      );

      return updated;
    });

    // Force archive on blockchain (if registered)
    let blockchainTxHash = '';
    if (evidence.evidenceId && evidence.registeredOnChain) {
      try {
        const blockchainResult = await forceArchiveOnChain(
          evidence.evidenceId,
          reason
        );

        if (blockchainResult.success) {
          blockchainTxHash = blockchainResult.txHash || '';
          console.log(`✅ Evidence force archived on blockchain: ${blockchainTxHash}`);
        } else {
          console.warn(`⚠️  Blockchain force archive failed: ${blockchainResult.error}`);
        }
      } catch (error) {
        console.error('Blockchain force archive error:', error);
      }
    }

    // Create audit log
    await createAuditLog({
      userId: user.userId,
      action: 'EVIDENCE_FORCE_ARCHIVED',
      resource: 'EVIDENCE',
      resourceId: id,
      metadata: {
        previousStatus,
        reason,
        evidenceTitle: evidence.title,
        evidenceId: evidence.evidenceId,
        txHash: blockchainTxHash || null,
      },
    });

    return successResponse({
      evidence: result,
      previousStatus,
      blockchain: {
        archived: !!blockchainTxHash,
        txHash: blockchainTxHash || null,
      },
    });
  }
);