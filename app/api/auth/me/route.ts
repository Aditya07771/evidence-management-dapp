/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */

import { NextRequest } from 'next/server';
import { findUserById } from '@/lib/db-helpers';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    getAuthUser,
} from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
    // Get authenticated user from JWT
    const authUser = getAuthUser(req);

    // Fetch fresh user data from database
    const user = await findUserById(authUser.userId);

    if (!user) {
        return errorResponse('User not found', 404);
    }

    // Check if user is still active
    if (!user.isActive) {
        return errorResponse('Account has been deactivated', 403);
    }

    // Return user profile (exclude password hash)
    return successResponse({
        id: user.id,
        email: user.email,
        name: user.name,
        badgeId: user.badgeId,
        role: user.role,
        walletAddress: user.walletAddress,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    });
});