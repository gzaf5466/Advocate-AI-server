import crypto from 'crypto';
import { prisma } from '../config/db.js';
import generateToken from '../utils/generateToken.js';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

// In-memory OTP storage
const otpStore = new Map();

// Helper to hash password
const hashPassword = (password) => {
  if (!password) return null;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

// Helper to verify password
const verifyPassword = (password, storedPassword) => {
  if (!password || !storedPassword || !storedPassword.includes(':')) return false;
  const [salt, originalHash] = storedPassword.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
};

/**
 * @desc    Send OTP to Email for Registration / Login
 * @route   POST /api/auth/send-otp
 * @access  Public
 */
export const sendOtp = async (req, res, next) => {
  try {
    const { email, name, type = 'register' } = req.body;
    if (!email) {
      res.status(400);
      throw new Error('Email is required');
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists when registering
    if (type === 'register') {
      const existingUser = await prisma.user.findFirst({
        where: { email: cleanEmail }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists. Please log in instead.'
        });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(cleanEmail, { code: otp, expiresAt });
    console.log(`[AUTH-OTP] Generated OTP for ${cleanEmail}: ${otp}`);

    const resendApiKey = process.env.RESEND_API_KEY;

    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: 'Advocate AI <onboarding@advocateai.in>',
          to: [cleanEmail],
          subject: `${otp} is your Advocate AI Verification Code`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 30px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #1e293b; font-size: 24px; font-weight: 800; margin: 0;">Advocate AI</h1>
                <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Legal Intelligence Platform</p>
              </div>
              <p style="color: #334155; font-size: 15px;">Hello ${name || ''},</p>
              <p style="color: #334155; font-size: 15px;">Your verification code for Advocate AI is:</p>
              <div style="margin: 24px 0; padding: 18px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; text-align: center;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2563eb;">${otp}</span>
              </div>
              <p style="color: #64748b; font-size: 13px;">This code will expire in 10 minutes.</p>
            </div>
          `
        },
        {
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (emailErr) {
      console.warn('[AUTH-OTP] Resend notice:', emailErr.response?.data || emailErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent to email',
      devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP and Complete Registration with Password
 * @route   POST /api/auth/verify-otp-register
 * @access  Public
 */
export const verifyOtpRegister = async (req, res, next) => {
  try {
    const { email, otp, password, name, role = 'customer' } = req.body;

    if (!email || !otp) {
      res.status(400);
      throw new Error('Email and verification code are required');
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if account already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: cleanEmail }
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists. Please log in instead.'
      });
    }

    const stored = otpStore.get(cleanEmail);

    // Validate OTP (or master code 123456)
    const isValid = otp === '123456' || (stored && stored.code === otp.trim() && Date.now() <= stored.expiresAt);

    if (!isValid) {
      res.status(400);
      throw new Error('Invalid or expired verification code');
    }

    otpStore.delete(cleanEmail);

    // Hash password if provided
    const hashedPassword = password ? hashPassword(password) : null;

    // Create fresh unique user account
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        name: name || cleanEmail.split('@')[0],
        role: role || 'customer',
      }
    });

    res.status(201).json({
      success: true,
      token: generateToken(user.id),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Email & Password Login
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Email and password are required');
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: { email: cleanEmail }
    });

    if (!user) {
      res.status(401);
      throw new Error('No account found with this email. Please register first.');
    }

    // If user has a password set, verify it
    if (user.password) {
      const isMatch = verifyPassword(password, user.password);
      if (!isMatch) {
        res.status(401);
        throw new Error('Incorrect password. Please try again.');
      }
    }

    res.status(200).json({
      success: true,
      token: generateToken(user.id),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Set or Change Password (For Google accounts or existing users)
 * @route   POST /api/auth/set-password
 * @access  Private
 */
export const setPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters long');
    }

    const hashedPassword = hashPassword(password);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    res.status(200).json({
      success: true,
      message: 'Password set successfully. You can now also log in using your email and password.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (user) {
      res.json({
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        walletBalance: user.walletBalance,
        hasPassword: !!user.password,
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name !== undefined ? name : undefined,
        phone: phone !== undefined ? phone : undefined,
      }
    });

    res.status(200).json({
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      walletBalance: user.walletBalance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify Google Token and Login/Register
 * @route   POST /api/auth/google
 * @access  Public
 */
export const googleLogin = async (req, res, next) => {
  try {
    const { idToken, accessToken } = req.body;
    
    if (!idToken && !accessToken) {
      res.status(400);
      throw new Error('Google token is required');
    }

    let googleId, email, name;

    if (idToken) {
      const googleClientId = process.env.GOOGLE_CLIENT_ID || '669862193935-cr34le75a0oj81sh5rqsk13knel7uodq.apps.googleusercontent.com';
      const googleClient = new OAuth2Client(googleClientId);

      const allowedAudiences = [
        googleClientId,
        process.env.GOOGLE_ANDROID_CLIENT_ID || '669862193935-ut8gagdc632nck8cer5mdav65ervg7gb.apps.googleusercontent.com'
      ].filter(Boolean);

      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: allowedAudiences,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
    } else if (accessToken) {
      const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      googleId = response.data.sub;
      email = response.data.email;
      name = response.data.name;
    }

    const cleanEmail = email ? email.toLowerCase().trim() : null;

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId },
          ...(cleanEmail ? [{ email: cleanEmail }] : [])
        ]
      }
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          googleId,
          email: cleanEmail,
          name,
          role: req.body.role || 'customer'
        }
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId }
      });
    }

    res.status(200).json({
      success: true,
      token: generateToken(user.id),
      isNewUser,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasPassword: !!user.password,
      }
    });

  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401);
    next(new Error(`Invalid Google token: ${error.message}`));
  }
};
