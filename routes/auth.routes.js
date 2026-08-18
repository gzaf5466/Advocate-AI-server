import express from 'express';
import { getUserProfile, googleLogin, azureLogin } from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/google', googleLogin);
router.post('/azure', azureLogin);
router.get('/profile', protect, getUserProfile);

export default router;
