/**
 * GET /api/admin/audit-logs - Get system audit logs
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
import { getAuditLogs } from '@/lib/db-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  // Only admins can view audit logs
  const user = getAuthUserWithRole(req, [Role.ADMIN]);

  // Parse pagination
  const { page, limit, offset } = parsePagination(req);

  // Parse filters
  const userId = getQueryParam(req, 'userId');
  const action = getQueryParam(req, 'action');
  const resource = getQueryParam(req, 'resource');

  // Fetch audit logs
  const logs = await getAuditLogs({
    userId: userId || undefined,
    action: action || undefined,
    resource: resource || undefined,
    limit,
    offset,
  });

  return successResponse({
    logs: logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    })),
    pagination: {
      page,
      limit,
    },
  });
});