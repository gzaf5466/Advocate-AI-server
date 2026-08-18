import express from 'express';
import { getLawyers, getLawyerById, bookConsultation } from '../controllers/lawyer.controller.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.route('/').get(getLawyers);
router.route('/:id').get(getLawyerById);
router.route('/:id/book').post(protect, bookConsultation);

export default router;
