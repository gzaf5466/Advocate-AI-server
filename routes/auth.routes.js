import express from 'express';
import {
  sendOtp,
  verifyOtpRegister,
  login,
  googleLogin,
  getUserProfile,
  updateProfile,
  setPassword
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp-register', verifyOtpRegister);
router.post('/login', login);
router.post('/google', googleLogin);

router.post('/set-password', protect, setPassword);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateProfile);

export default router;
