/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */

import { NextRequest } from 'next/server';
import { loginSchema } from '@/lib/validators';
import { comparePassword, signToken } from '@/lib/auth';
import { findUserByEmail } from '@/lib/db-helpers';
import { createAuditLog } from '@/lib/db-helpers';
import {
    withErrorHandler,
    successResponse,
    errorResponse,
    validateBody,
} from '@/lib/api-helpers';

export const POST = withErrorHandler(async (req: NextRequest) => {
    // Validate request body
    const body = await validateBody(req, loginSchema);
    const { email, password } = body;

    // Find user by email
    const user = await findUserByEmail(email);

    if (!user) {
        return errorResponse('Invalid email or password', 401);
    }

    // Check if user is active
    if (!user.isActive) {
        return errorResponse('Account is deactivated. Contact administrator.', 403);
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
        return errorResponse('Invalid email or password', 401);
    }

    // Get IP address for audit log
    const ipAddress =
        req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        'unknown';

    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Create audit log
    await createAuditLog({
        userId: user.id,
        action: 'USER_LOGIN',
        metadata: {
            loginMethod: 'password',
            success: true,
        },
        ipAddress,
        userAgent,
    });

    // Generate JWT token
    const token = signToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress || undefined,
    });

    // Return response
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
        },
        'Login successful'
    );
});