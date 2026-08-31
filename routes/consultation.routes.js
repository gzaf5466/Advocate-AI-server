import express from 'express';
import { getMyConsultations, bookConsultation, updateStatus } from '../controllers/consultation.controller.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.get('/my-consultations', getMyConsultations);
router.post('/book', bookConsultation);
router.put('/:id/status', updateStatus);

export default router;
