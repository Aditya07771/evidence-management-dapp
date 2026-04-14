/**
 * Hashing Utilities
 * Provides SHA-256 file hashing and keccak256 text hashing for blockchain
 */

import * as crypto from 'crypto';
import { ethers } from 'ethers';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE HASHING (SHA-256)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Hash a file buffer using SHA-256
 * Returns 0x-prefixed hex string (bytes32 compatible)
 * 
 * @param buffer - File buffer to hash
 * @returns 0x-prefixed SHA-256 hash (66 characters: 0x + 64 hex)
 */
export function hashFile(buffer: Buffer): string {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    return '0x' + hash;
}

/**
 * Hash a file from file path (sync)
 * 
 * @param filePath - Path to file
 * @returns 0x-prefixed SHA-256 hash
 */
export function hashFileSync(filePath: string): string {
    const fs = require('fs');
    const buffer = fs.readFileSync(filePath);
    return hashFile(buffer);
}

/**
 * Hash a file from file path (async)
 * 
 * @param filePath - Path to file
 * @returns Promise resolving to 0x-prefixed SHA-256 hash
 */
export async function hashFileAsync(filePath: string): Promise<string> {
    const fs = require('fs').promises;
    const buffer = await fs.readFile(filePath);
    return hashFile(buffer);
}

/**
 * Stream-based file hashing for large files
 * 
 * @param filePath - Path to file
 * @returns Promise resolving to 0x-prefixed SHA-256 hash
 */
export async function hashLargeFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const fs = require('fs');
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (chunk: Buffer) => hash.update(chunk));
        stream.on('end', () => resolve('0x' + hash.digest('hex')));
        stream.on('error', reject);
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEXT HASHING (Keccak256 for blockchain bytes32)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Hash text using keccak256 (Ethereum standard)
 * This is what the contract expects for bytes32 parameters
 * 
 * @param text - String to hash
 * @returns 0x-prefixed keccak256 hash (bytes32)
 */
export function hashText(text: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(text));
}

/**
 * Alias for hashText - converts string to bytes32
 * 
 * @param text - String to convert
 * @returns bytes32 hex string
 */
export function toBytes32(text: string): string {
    return hashText(text);
}

/**
 * Hash multiple strings and combine
 * Useful for generating unique composite IDs
 * 
 * @param texts - Array of strings to hash together
 * @returns bytes32 hash of concatenated inputs
 */
export function hashMultiple(...texts: string[]): string {
    const combined = texts.join('|');
    return hashText(combined);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if a string is a valid bytes32 hash
 * 
 * @param hash - Hash to validate
 * @returns true if valid bytes32 format
 */
export function isValidBytes32(hash: string): boolean {
    return /^0x[0-9a-fA-F]{64}$/.test(hash);
}

/**
 * Check if a string is a valid hex hash (with or without 0x)
 * 
 * @param hash - Hash to validate
 * @returns true if valid hex format
 */
export function isValidHash(hash: string): boolean {
    return /^(0x)?[0-9a-fA-F]{64}$/.test(hash);
}

/**
 * Ensure hash has 0x prefix
 * 
 * @param hash - Hash with or without 0x
 * @returns Hash with 0x prefix
 */
export function ensureHexPrefix(hash: string): string {
    return hash.startsWith('0x') ? hash : '0x' + hash;
}

/**
 * Remove 0x prefix from hash
 * 
 * @param hash - Hash with 0x prefix
 * @returns Hash without prefix
 */
export function removeHexPrefix(hash: string): string {
    return hash.startsWith('0x') ? hash.slice(2) : hash;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPARISON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Compare two hashes (case-insensitive, prefix-agnostic)
 * 
 * @param hash1 - First hash
 * @param hash2 - Second hash
 * @returns true if hashes match
 */
export function hashesMatch(hash1: string, hash2: string): boolean {
    const normalized1 = removeHexPrefix(hash1).toLowerCase();
    const normalized2 = removeHexPrefix(hash2).toLowerCase();
    return normalized1 === normalized2;
}

/**
 * Verify file matches expected hash
 * 
 * @param buffer - File buffer
 * @param expectedHash - Expected hash to compare
 * @returns true if file hash matches expected
 */
export function verifyFileHash(buffer: Buffer, expectedHash: string): boolean {
    const actualHash = hashFile(buffer);
    return hashesMatch(actualHash, expectedHash);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RANDOM GENERATION (for testing)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a random bytes32 hash (for testing)
 * 
 * @returns Random 0x-prefixed bytes32 hash
 */
export function randomBytes32(): string {
    return '0x' + crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a random file hash (for testing)
 * 
 * @returns Random 0x-prefixed SHA-256 style hash
 */
export function randomFileHash(): string {
    return randomBytes32();
}