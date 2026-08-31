import express from 'express';
import { getDocuments, uploadDocument, getDocumentFile, signDocument, deleteDocument } from '../controllers/vault.controller.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getDocuments);
router.post('/', uploadDocument);
router.get('/file/:id', getDocumentFile);
router.put('/:id/sign', signDocument);
router.delete('/:id', deleteDocument);

export default router;
