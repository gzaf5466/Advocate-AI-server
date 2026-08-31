import express from 'express';
import { createOrder, verifyPayment, getHistory, getWalletBalance } from '../controllers/billing.controller.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.get('/wallet', getWalletBalance);
router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.get('/history', getHistory);

export default router;
