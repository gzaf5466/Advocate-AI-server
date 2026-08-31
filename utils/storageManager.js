import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { detectMimeType, sanitizeFilename, calculateSHA256, SECURITY_CONFIG } from './uploadSecurity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BASE_STORAGE_DIR = path.join(__dirname, '../storage/vault');

if (!fs.existsSync(BASE_STORAGE_DIR)) {
  fs.mkdirSync(BASE_STORAGE_DIR, { recursive: true });
}

export async function storeUploadedFileBuffer({ buffer, originalName, userId = 'usr_default' }) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Upload Error: Empty or missing file stream.');
  }

  if (buffer.length > SECURITY_CONFIG.MAX_FILE_SIZE_BYTES) {
    throw new Error(`Upload Error: File size (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed threshold of 25 MB.`);
  }

  // 1. Sanitize filename
  const cleanOriginalName = sanitizeFilename(originalName);

  // 2. Validate magic bytes & true MIME type (Allowlist check)
  const { mime, ext } = detectMimeType(buffer, cleanOriginalName);

  // 3. Calculate SHA-256 Hash
  const sha256Hash = calculateSHA256(buffer);

  // 4. Generate organized directory path: storage/vault/YYYY/MM/userId/
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const targetDir = path.join(BASE_STORAGE_DIR, year, month, userId);
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 5. Generate random UUID filename to prevent collisions & path attacks
  const fileUuid = crypto.randomUUID();
  const storedFilename = `${fileUuid}.${ext}`;
  const absoluteFilePath = path.join(targetDir, storedFilename);

  // 6. Write file to disk outside web root
  fs.writeFileSync(absoluteFilePath, buffer);

  return {
    cleanOriginalName,
    storedFilename,
    absoluteFilePath,
    relativePath: path.relative(path.join(__dirname, '..'), absoluteFilePath).replace(/\\/g, '/'),
    mime,
    sizeBytes: buffer.length,
    formattedSize: `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`,
    sha256Hash
  };
}
