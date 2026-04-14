/**
 * Input Validation Schemas
 * Using Zod for runtime type checking and validation
 */

import { z } from 'zod';
import { Role, EvidenceType, EvidenceStatus } from '@prisma/client';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const registerUserSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    badgeId: z.string().min(3, 'Badge ID required'),
    role: z.nativeEnum(Role),
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address').optional(),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password required'),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CASE VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createCaseSchema = z.object({
    caseNumber: z.string().min(5, 'Case number must be at least 5 characters'),
    title: z.string().min(5, 'Title must be at least 5 characters'),
    description: z.string().optional(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVIDENCE VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const registerEvidenceSchema = z.object({
    caseId: z.string().uuid('Invalid case ID'),
    title: z.string().min(5, 'Title must be at least 5 characters'),
    description: z.string().optional(),
    evidenceType: z.nativeEnum(EvidenceType),
    location: z.string().optional(),
    collectedAt: z.string().datetime().or(z.date()),
    isSensitive: z.boolean().default(false),
});

export const updateEvidenceStatusSchema = z.object({
    newStatus: z.nativeEnum(EvidenceStatus),
    reason: z.string().min(5, 'Reason required (min 5 characters)'),
});

export const transferEvidenceSchema = z.object({
    toUserId: z.string().uuid('Invalid user ID'),
    reason: z.string().min(5, 'Reason required (min 5 characters)'),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const paginationSchema = z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({
    id: z.string().uuid('Invalid ID format'),
});

/**
 * Validate data against schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean;
    data?: T;
    errors?: z.ZodError;
} {
    try {
        const validated = schema.parse(data);
        return { success: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, errors: error };
        }
        throw error;
    }
}

// ... existing imports ...

export const updateCaseSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters').optional(),
    description: z.string().optional(),
});

export const updateCaseStatusSchema = z.object({
    status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']),
    reason: z.string().min(5, 'Reason must be at least 5 characters').optional(),
});