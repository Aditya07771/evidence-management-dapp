/**
 * GET /api/admin/officers - List all officers/users
 */

import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import {
    withErrorHandler,
    successResponse,
    getAuthUserWithRole,
    parsePagination,
    getQueryParam,
} from '@/lib/api-helpers';
import { getAllActiveUsers } from '@/lib/db-helpers';
import { prisma } from '@/lib/prisma';

export const GET = withErrorHandler(async (req: NextRequest) => {
    // Only admins can view all officers
    const user = getAuthUserWithRole(req, [Role.ADMIN]);

    // Parse pagination
    const { page, limit, offset } = parsePagination(req);

    // Parse filters
    const roleParam = getQueryParam(req, 'role');
    const isActiveParam = getQueryParam(req, 'isActive');

    // Build where clause
    const where: any = {};
    if (roleParam && Object.values(Role).includes(roleParam as Role)) {
        where.role = roleParam as Role;
    }
    if (isActiveParam !== null) {
        where.isActive = isActiveParam === 'true';
    }

    // Fetch officers
    const [officers, total] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                name: true,
                badgeId: true,
                role: true,
                walletAddress: true,
                isActive: true,
                createdAt: true,
                _count: {
                    select: {
                        evidences: true,
                        custodyLogsFrom: true,
                        verifications: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        }),
        prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return successResponse({
        officers: officers.map((o) => ({
            id: o.id,
            email: o.email,
            name: o.name,
            badgeId: o.badgeId,
            role: o.role,
            walletAddress: o.walletAddress,
            isActive: o.isActive,
            createdAt: o.createdAt,
            stats: {
                evidenceCollected: o._count.evidences,
                custodyTransfers: o._count.custodyLogsFrom,
                verifications: o._count.verifications,
            },
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore: page < totalPages,
        },
    });
});