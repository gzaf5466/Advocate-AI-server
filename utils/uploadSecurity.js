import crypto from 'crypto';
import path from 'path';

/**
 * Enterprise File Upload Security Module for Advocate AI Vault (ESM)
 */

// 1. Magic Byte Definitions (True File Signatures)
const MAGIC_SIGNATURES = {
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  jpeg: [0xFF, 0xD8, 0xFF],
  webp: [0x52, 0x49, 0x46, 0x46], // 'RIFF' header
  pdf: [0x25, 0x50, 0x44, 0x46],   // '%PDF'
  zip: [0x50, 0x4B, 0x03, 0x04],   // 'PK..'
  docx: [0x50, 0x4B, 0x03, 0x04]   // Office OpenXML is a ZIP container
};

// Disallowed extensions (Script Bombing & Executable prevention)
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'js', 'py', 'pl', 'jar', 'vbs',
  'cgi', 'asp', 'aspx', 'jsp', 'dll', 'so', 'com', 'scr', 'hta', 'ps1', 'html', 'htm'
]);

// Configurable Security Caps
export const SECURITY_CONFIG = {
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB max per file
  MAX_ZIP_EXPANDED_BYTES: 100 * 1024 * 1024, // 100 MB max uncompressed ZIP contents
  MAX_ZIP_RATIO: 10, // Max 10:1 compression ratio (Zip Bomb threshold)
  MAX_ZIP_FILE_COUNT: 100 // Max files inside single archive
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

export function detectMimeType(buffer, declaredName) {
  const ext = path.extname(declaredName).toLowerCase().replace('.', '');
  
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error(`Security Violation: Extension '.${ext}' is prohibited due to script execution risks.`);
  }

  if (verifyMagicBytes(buffer, 'png')) return { mime: 'image/png', ext: 'png' };
  if (verifyMagicBytes(buffer, 'jpeg')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (verifyMagicBytes(buffer, 'webp')) return { mime: 'image/webp', ext: 'webp' };
  if (verifyMagicBytes(buffer, 'pdf')) return { mime: 'application/pdf', ext: 'pdf' };
  if (verifyMagicBytes(buffer, 'zip')) {
    if (ext === 'docx') return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' };
    return { mime: 'application/zip', ext: 'zip' };
  }

  throw new Error(`Security Violation: File content does not match a verified, allowed file signature (PNG, JPEG, WEBP, PDF, DOCX, ZIP).`);
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

export function inspectZipBomb(zipBuffer) {
  let offset = 0;
  let totalUncompressedSize = 0;
  let fileCount = 0;

  while (offset + 30 <= zipBuffer.length) {
    if (zipBuffer[offset] === 0x50 && zipBuffer[offset + 1] === 0x4B &&
        zipBuffer[offset + 2] === 0x03 && zipBuffer[offset + 3] === 0x04) {
      
      fileCount++;
      if (fileCount > SECURITY_CONFIG.MAX_ZIP_FILE_COUNT) {
        throw new Error(`Zip Bomb Protection: Archive contains more than ${SECURITY_CONFIG.MAX_ZIP_FILE_COUNT} files.`);
      }

      const compressedSize = zipBuffer.readUInt32LE(offset + 18);
      const uncompressedSize = zipBuffer.readUInt32LE(offset + 22);
      const filenameLen = zipBuffer.readUInt16LE(offset + 26);
      const extraLen = zipBuffer.readUInt16LE(offset + 28);

      totalUncompressedSize += uncompressedSize;

      if (totalUncompressedSize > SECURITY_CONFIG.MAX_ZIP_EXPANDED_BYTES) {
        throw new Error(`Zip Bomb Protection: Uncompressed archive size exceeds limit of ${SECURITY_CONFIG.MAX_ZIP_EXPANDED_BYTES / 1024 / 1024} MB.`);
      }

      if (compressedSize > 0) {
        const ratio = uncompressedSize / compressedSize;
        if (ratio > SECURITY_CONFIG.MAX_ZIP_RATIO && uncompressedSize > 5 * 1024 * 1024) {
          throw new Error(`Zip Bomb Protection: Excessive compression ratio detected (${ratio.toFixed(1)}:1). Upload rejected.`);
        }
      }

      offset += 30 + filenameLen + extraLen + compressedSize;
    } else {
      offset++;
    }
  }
}

export function calculateSHA256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
