import express from 'express';
import { createOrder, verifyPayment, getHistory } from '../controllers/billing.controller.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.get('/history', protect, getHistory);

export default router;
