import express from 'express';
import { getMyCases, createCase } from '../controllers/case.controller.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.get('/my-cases', getMyCases);
router.post('/', createCase);

export default router;
