/**
 * Authentication Utilities
 * JWT token management and password hashing with bcrypt
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { JWTPayload } from './types';
import { Role } from '@prisma/client';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_in_production';
const JWT_EXPIRES_IN = '24h'; // 1 day
const BCRYPT_ROUNDS = 10;

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  WARNING: JWT_SECRET not set in production environment!');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JWT TOKEN MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Sign a JWT token with user payload
 * 
 * @param payload - User data to encode in token
 * @returns Signed JWT token string
 */
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
}

/**
 * Verify and decode a JWT token
 * 
 * @param token - JWT token to verify
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            console.warn('Token expired:', error.expiredAt);
        } else if (error instanceof jwt.JsonWebTokenError) {
            console.warn('Invalid token:', error.message);
        }
        return null;
    }
}

/**
 * Decode token without verification (for debugging)
 * 
 * @param token - JWT token to decode
 * @returns Decoded payload (unverified)
 */
export function decodeToken(token: string): JWTPayload | null {
    try {
        return jwt.decode(token) as JWTPayload;
    } catch {
        return null;
    }
}

/**
 * Extract token from Authorization header
 * 
 * @param authHeader - Authorization header value
 * @returns Extracted token or null
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;

    // Support both "Bearer <token>" and raw token
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    return authHeader;
}

/**
 * Create a refresh token (longer expiry)
 * 
 * @param payload - User data
 * @returns Refresh token (7 days expiry)
 */
export function signRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '7d',
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PASSWORD HASHING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Hash a plaintext password with bcrypt
 * 
 * @param plainPassword - Password to hash
 * @returns Promise resolving to hashed password
 */
export async function hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

/**
 * Compare plaintext password with hashed password
 * 
 * @param plainPassword - Password to verify
 * @param hashedPassword - Stored hash
 * @returns Promise resolving to true if match
 */
export async function comparePassword(
    plainPassword: string,
    hashedPassword: string
): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Synchronous password hashing (use only when necessary)
 * 
 * @param plainPassword - Password to hash
 * @returns Hashed password
 */
export function hashPasswordSync(plainPassword: string): string {
    return bcrypt.hashSync(plainPassword, BCRYPT_ROUNDS);
}

/**
 * Synchronous password comparison
 * 
 * @param plainPassword - Password to verify
 * @param hashedPassword - Stored hash
 * @returns true if passwords match
 */
export function comparePasswordSync(
    plainPassword: string,
    hashedPassword: string
): boolean {
    return bcrypt.compareSync(plainPassword, hashedPassword);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MIDDLEWARE HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Authentication error class
 */
export class AuthError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number = 401) {
        super(message);
        this.name = 'AuthError';
        this.statusCode = statusCode;
    }
}

/**
 * Extract and verify token from request headers
 * Throws AuthError if invalid
 * 
 * @param authHeader - Authorization header
 * @returns Verified JWT payload
 * @throws AuthError if token invalid or missing
 */
export function requireAuth(authHeader?: string): JWTPayload {
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
        throw new AuthError('No authentication token provided', 401);
    }

    const payload = verifyToken(token);

    if (!payload) {
        throw new AuthError('Invalid or expired token', 401);
    }

    return payload;
}

/**
 * Verify user has required role
 * 
 * @param payload - JWT payload
 * @param allowedRoles - Array of allowed roles
 * @throws AuthError if user doesn't have required role
 */
export function requireRole(payload: JWTPayload, allowedRoles: Role[]): void {
    if (!allowedRoles.includes(payload.role)) {
        throw new AuthError(
            `Access denied. Required role: ${allowedRoles.join(' or ')}`,
            403
        );
    }
}

/**
 * Combined auth + role check
 * 
 * @param authHeader - Authorization header
 * @param allowedRoles - Array of allowed roles
 * @returns Verified JWT payload
 * @throws AuthError if unauthorized or forbidden
 */
export function requireAuthWithRole(
    authHeader: string | undefined,
    allowedRoles: Role[]
): JWTPayload {
    const payload = requireAuth(authHeader);
    requireRole(payload, allowedRoles);
    return payload;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PASSWORD VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validate password strength
 * 
 * @param password - Password to validate
 * @returns Object with isValid flag and error messages
 */
export function validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Simple password validation (for development)
 * Only checks minimum length
 * 
 * @param password - Password to validate
 * @returns true if valid
 */
export function isValidPasswordSimple(password: string): boolean {
    return password.length >= 8;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOKEN UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get remaining time until token expires
 * 
 * @param token - JWT token
 * @returns Milliseconds until expiration, or null if invalid
 */
export function getTokenExpiryTime(token: string): number | null {
    const payload = decodeToken(token);
    if (!payload || !payload.exp) return null;

    const expiryMs = payload.exp * 1000;
    const remainingMs = expiryMs - Date.now();

    return remainingMs > 0 ? remainingMs : 0;
}

/**
 * Check if token will expire soon
 * 
 * @param token - JWT token
 * @param thresholdMinutes - Minutes before expiry to consider "soon" (default: 30)
 * @returns true if token expires within threshold
 */
export function isTokenExpiringSoon(
    token: string,
    thresholdMinutes: number = 30
): boolean {
    const remaining = getTokenExpiryTime(token);
    if (remaining === null) return true;

    const thresholdMs = thresholdMinutes * 60 * 1000;
    return remaining < thresholdMs;
}