import crypto from 'crypto';
import path from 'path';

/**
 * Strict Whitelist File Upload Security Module for Advocate AI Vault (ESM)
 * Only Allows PDF and Image formats. Completely blocks ZIP and all other files.
 */

// 1. Strict Allowed Extensions (Allowlist ONLY)
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif', 'heic', 'heif'
]);

const ALLOWED_DOC_EXTENSIONS = new Set([
  'pdf'
]);

const ALLOWED_EXTENSIONS = new Set([
  ...ALLOWED_IMAGE_EXTENSIONS,
  ...ALLOWED_DOC_EXTENSIONS
]);

// 2. Magic Byte Definitions (True File Signatures)
const MAGIC_SIGNATURES = {
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  jpeg: [0xFF, 0xD8, 0xFF],
  webp: [0x52, 0x49, 0x46, 0x46], // 'RIFF' header
  pdf: [0x25, 0x50, 0x44, 0x46],   // '%PDF'
  bmp: [0x42, 0x4D],               // 'BM'
  tiff_le: [0x49, 0x49, 0x2A, 0x00],
  tiff_be: [0x4D, 0x4D, 0x00, 0x2A]
};

// Configurable Security Caps
export const SECURITY_CONFIG = {
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024 // 25 MB max per file
};

export function verifyMagicBytes(buffer, format) {
  const signature = MAGIC_SIGNATURES[format];
  if (!signature) return false;
  if (buffer.length < signature.length) return false;

  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Validates declared extension and binary magic bytes using strict allowlisting.
 */
export function detectMimeType(buffer, declaredName) {
  const ext = path.extname(declaredName).toLowerCase().replace('.', '');
  
  // 1. Strict Allowlist check
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    if (ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'tar' || ext === 'gz') {
      throw new Error(`Security Violation: ZIP and compressed archives are strictly prohibited.`);
    }
    throw new Error(`Security Violation: File extension '.${ext}' is not allowed. Only PDF and Image formats (PNG, JPG, WEBP, BMP, TIFF) are permitted.`);
  }

  // 2. Strict Magic Byte Binary Verification
  if (verifyMagicBytes(buffer, 'png')) return { mime: 'image/png', ext: 'png' };
  if (verifyMagicBytes(buffer, 'jpeg')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (verifyMagicBytes(buffer, 'webp')) return { mime: 'image/webp', ext: 'webp' };
  if (verifyMagicBytes(buffer, 'pdf')) return { mime: 'application/pdf', ext: 'pdf' };
  if (verifyMagicBytes(buffer, 'bmp')) return { mime: 'image/bmp', ext: 'bmp' };
  if (verifyMagicBytes(buffer, 'tiff_le') || verifyMagicBytes(buffer, 'tiff_be')) {
    return { mime: 'image/tiff', ext: 'tiff' };
  }

  throw new Error(`Security Violation: Binary file signature does not match any allowed image or PDF signature.`);
}

export function sanitizeFilename(originalName) {
  if (!originalName || typeof originalName !== 'string') return 'unnamed_evidence';
  
  let cleanName = originalName
    .replace(/[\0\x00-\x1F\x7F]/g, '')
    .replace(/[\/\\]/g, '_')
    .replace(/\.\.+/g, '.')
    .trim();

  if (cleanName.length === 0) cleanName = 'evidence_file';
  if (cleanName.length > 128) cleanName = cleanName.substring(0, 128);

  return cleanName;
}

export function calculateSHA256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
