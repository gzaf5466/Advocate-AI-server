import express from 'express';
import {
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp
} from '../controllers/otp.controller.js';

const router = express.Router();

router.post('/send-email', sendEmailOtp);
router.post('/verify-email', verifyEmailOtp);
router.post('/send-phone', sendPhoneOtp);
router.post('/verify-phone', verifyPhoneOtp);

export default router;
