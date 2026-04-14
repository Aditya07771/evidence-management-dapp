/**
 * PATCH /api/admin/evidence/[id]/sensitive - Set evidence sensitive flag
 */

import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import { z } from 'zod';
import {
  withErrorHandler,
  successResponse,
  errorResponse,
  getAuthUserWithRole,
  parseBody,
} from '@/lib/api-helpers';
import { findEvidenceById, createAuditLog } from '@/lib/db-helpers';
import { setSensitiveFlag as setSensitiveOnChain } from '@/lib/contract';
import { prisma } from '@/lib/prisma';

const setSensitiveSchema = z.object({
  isSensitive: z.boolean(),
});

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    // Only admins can change sensitive flag
    const user = getAuthUserWithRole(req, [Role.ADMIN]);

    const { id } = params;

    // Check evidence exists
    const evidence = await findEvidenceById(id);
    if (!evidence) {
      return errorResponse('Evidence not found', 404);
    }

    // Validate body
    const body = await parseBody(req);
    const validation = setSensitiveSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.issues);
    }

    const { isSensitive } = validation.data;

    // Check if value is changing
    if (evidence.isSensitive === isSensitive) {
      return errorResponse(
        `Evidence is already ${isSensitive ? 'sensitive' : 'non-sensitive'}`,
        400
      );
    }

    // Update in database
    const updated = await prisma.evidence.update({
      where: { id },
      data: { isSensitive },
    });

    // Update on blockchain (if registered)
    let blockchainTxHash = '';
    if (evidence.evidenceId && evidence.registeredOnChain) {
      try {
        const blockchainResult = await setSensitiveOnChain(
          evidence.evidenceId,
          isSensitive
        );

        if (blockchainResult.success) {
          blockchainTxHash = blockchainResult.txHash || '';
          console.log(`✅ Sensitive flag updated on blockchain: ${blockchainTxHash}`);
        } else {
          console.warn(`⚠️  Blockchain update failed: ${blockchainResult.error}`);
        }
      } catch (error) {
        console.error('Blockchain sensitive flag update error:', error);
      }
    }

    // Create audit log
    await createAuditLog({
      userId: user.userId,
      action: 'EVIDENCE_SENSITIVE_FLAG_UPDATED',
      resource: 'EVIDENCE',
      resourceId: id,
      metadata: {
        previousValue: evidence.isSensitive,
        newValue: isSensitive,
        evidenceTitle: evidence.title,
        evidenceId: evidence.evidenceId,
        txHash: blockchainTxHash || null,
      },
    });

    return successResponse({
      evidence: updated,
      blockchain: {
        updated: !!blockchainTxHash,
        txHash: blockchainTxHash || null,
      },
    });
  }
);