/**
 * POST /api/auth/register
 * Register a new user and optionally create blockchain officer record
 */

import { NextRequest } from 'next/server';
import { registerUserSchema } from '@/lib/validators';
import { hashPassword, signToken } from '@/lib/auth';
import { createUser, findUserByEmail, findUserByBadgeId } from '@/lib/db-helpers';
import { registerOfficer } from '@/lib/contract';
import { RoleMapping } from '@/lib/types';
import { createAuditLog } from '@/lib/db-helpers';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    validateBody,
} from '@/lib/api-helpers';

export const POST = withErrorHandler(async (req: NextRequest) => {
    // Validate request body
    const body = await validateBody(req, registerUserSchema);
    const { email, password, name, badgeId, role, walletAddress } = body;

    // Check if user already exists
    const existingUserByEmail = await findUserByEmail(email);
    if (existingUserByEmail) {
        return errorResponse('Email already registered', 409);
    }

    const existingUserByBadge = await findUserByBadgeId(badgeId);
    if (existingUserByBadge) {
        return errorResponse('Badge ID already registered', 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user in database
    const user = await createUser({
        email,
        passwordHash,
        name,
        badgeId,
        role,
        walletAddress,
    });

    // Register on blockchain if wallet address provided
    let blockchainRegistered = false;
    let blockchainTxHash: string | undefined;

    if (walletAddress) {
        try {
            const roleKey = RoleMapping[role];
            const result = await registerOfficer(
                walletAddress,
                name,
                badgeId,
                roleKey
            );

            if (result.success) {
                blockchainRegistered = true;
                blockchainTxHash = result.txHash;
                console.log(`✅ Officer registered on blockchain: ${blockchainTxHash}`);
            } else {
                console.warn(
                    `⚠️  Blockchain registration failed: ${result.error}`
                );
                // Don't fail the request - blockchain registration is optional
            }
        } catch (error: any) {
            console.error('Blockchain registration error:', error);
            // Continue anyway - blockchain is supplementary
        }
    }

    // Create audit log
    await createAuditLog({
        userId: user.id,
        action: 'USER_REGISTERED',
        resource: 'USER',
        resourceId: user.id,
        metadata: {
            role,
            blockchainRegistered,
            hasWallet: !!walletAddress,
        },
    });

    // Generate JWT token
    const token = signToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress || undefined,
    });

    // Return response (exclude password hash)
    return successResponse(
        {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                badgeId: user.badgeId,
                role: user.role,
                walletAddress: user.walletAddress,
                isActive: user.isActive,
                createdAt: user.createdAt,
            },
            token,
            blockchainRegistered,
            ...(blockchainTxHash && { txHash: blockchainTxHash }),
        },
        'User registered successfully',
        201
    );
});