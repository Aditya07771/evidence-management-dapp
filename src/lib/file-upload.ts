/**
 * File Upload Utilities
 * Handle multipart file uploads and storage
 */

import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { hashFile } from './hash';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800'); // 50MB default

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface UploadedFile {
    filepath: string;
    originalFilename: string;
    mimetype: string;
    size: number;
    hash: string; // SHA-256 hash
}

export interface ParsedFormData {
    fields: Record<string, string>;
    files: Record<string, UploadedFile>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PARSE MULTIPART FORM DATA (Next.js 14 compatible)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse multipart form data from Next.js request
 * Works with Next.js 14 App Router
 */
export async function parseFormData(req: NextRequest): Promise<ParsedFormData> {
    // Next.js 14 doesn't expose Node.js IncomingMessage directly
    // We need to use formData() API or convert the request

    // Get the raw request body as buffer
    const formData = await req.formData();

    const fields: Record<string, string> = {};
    const files: Record<string, UploadedFile> = {};

    for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
            // Handle file upload
            const fileBuffer = Buffer.from(await value.arrayBuffer());
            const fileHash = hashFile(fileBuffer);

            // Generate unique filename
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(7);
            const ext = path.extname(value.name);
            const filename = `${timestamp}-${randomStr}${ext}`;
            const filepath = path.join(UPLOAD_DIR, filename);

            // Save file
            fs.writeFileSync(filepath, fileBuffer);

            files[key] = {
                filepath,
                originalFilename: value.name,
                mimetype: value.type,
                size: value.size,
                hash: fileHash,
            };
        } else {
            // Handle text field
            fields[key] = value.toString();
        }
    }

    return { fields, files };
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxSize: number = MAX_FILE_SIZE): boolean {
    return size <= maxSize;
}

/**
 * Validate file type (basic MIME type check)
 */
export function validateFileType(mimetype: string, allowedTypes?: string[]): boolean {
    if (!allowedTypes) return true;
    return allowedTypes.some(type => {
        if (type.endsWith('/*')) {
            const prefix = type.slice(0, -2);
            return mimetype.startsWith(prefix);
        }
        return mimetype === type;
    });
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimetype: string): string {
    const mimeMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'audio/mpeg': '.mp3',
        'audio/wav': '.wav',
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'application/zip': '.zip',
        'text/plain': '.txt',
        'text/csv': '.csv',
    };

    return mimeMap[mimetype] || '';
}

/**
 * Delete uploaded file
 */
export function deleteFile(filepath: string): void {
    try {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}

/**
 * Get file URI (relative path for storage)
 */
export function getFileURI(filepath: string): string {
    const relativePath = path.relative(path.join(process.cwd(), 'public'), filepath);
    return '/' + relativePath.replace(/\\/g, '/'); // Normalize path separators
}

/**
 * Get absolute path from URI
 */
export function getAbsolutePath(fileURI: string): string {
    return path.join(process.cwd(), 'public', fileURI.replace(/^\//, ''));
}

/**
 * Check if file exists
 */
export function fileExists(filepath: string): boolean {
    return fs.existsSync(filepath);
}

/**
 * Get file stats
 */
export function getFileStats(filepath: string) {
    if (!fs.existsSync(filepath)) {
        return null;
    }

    const stats = fs.statSync(filepath);
    return {
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
    };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}