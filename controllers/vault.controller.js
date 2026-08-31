import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../config/db.js';
import { storeUploadedFileBuffer } from '../utils/storageManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @desc    Get user vault documents
 * @route   GET /api/vault
 * @access  Private
 */
export const getDocuments = async (req, res, next) => {
  try {
    const documents = await prisma.document.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(documents);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Save/Upload vault document with security verification & physical storage
 * @route   POST /api/vault
 * @access  Private
 */
export const uploadDocument = async (req, res, next) => {
  try {
    const { name, type, size, url, dataUrl } = req.body;
    let fileBuffer;
    let originalName = name || 'uploaded_evidence.png';

    const payload = dataUrl || url;
    if (payload && payload.startsWith('data:')) {
      const base64Data = payload.replace(/^data:[^;]+;base64,/, '');
      fileBuffer = Buffer.from(base64Data, 'base64');
    }

    if (fileBuffer && fileBuffer.length > 0) {
      // Process secure storage, magic bytes check, zip bomb inspection, SHA256
      const stored = await storeUploadedFileBuffer({
        buffer: fileBuffer,
        originalName,
        userId: req.user.id
      });

      const document = await prisma.document.create({
        data: {
          userId: req.user.id,
          name: stored.cleanOriginalName,
          type: stored.mime,
          size: stored.formattedSize,
          url: `/api/vault/file/${stored.storedFilename}`,
        }
      });

      return res.status(201).json(document);
    }

    // Fallback if no binary payload (metadata-only record)
    if (!name) {
      res.status(400);
      throw new Error('Document name is required');
    }

    const document = await prisma.document.create({
      data: {
        userId: req.user.id,
        name,
        type: type || 'Document Brief',
        size: size || '1.0 MB',
        url: url || null,
      }
    });

    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Securely download/stream vault document file with security headers
 * @route   GET /api/vault/file/:id
 * @access  Private
 */
export const getDocumentFile = async (req, res, next) => {
  try {
    const docId = req.params.id;
    const document = await prisma.document.findFirst({
      where: { OR: [{ id: docId }, { url: { contains: docId } }], userId: req.user.id }
    });

    if (!document) {
      res.status(404);
      throw new Error('Document not found');
    }

    // Search physical vault storage for matching file
    const vaultBaseDir = path.join(__dirname, '../storage/vault');
    let matchedPath = null;

    function findFileRecursive(dir) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findFileRecursive(full);
        } else if (entry.name === docId || full.endsWith(docId)) {
          matchedPath = full;
          return;
        }
      }
    }

    findFileRecursive(vaultBaseDir);

    if (!matchedPath || !fs.existsSync(matchedPath)) {
      res.status(404);
      throw new Error('Physical storage file not found');
    }

    res.setHeader('Content-Type', document.type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.name)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    const stream = fs.createReadStream(matchedPath);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Sign vault document
 * @route   PUT /api/vault/:id/sign
 * @access  Private
 */
export const signDocument = async (req, res, next) => {
  try {
    const document = await prisma.document.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { isSigned: true }
    });
    res.status(200).json(document);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete vault document
 * @route   DELETE /api/vault/:id
 * @access  Private
 */
export const deleteDocument = async (req, res, next) => {
  try {
    await prisma.document.delete({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.status(200).json({ success: true, message: 'Document removed' });
  } catch (error) {
    next(error);
  }
};
