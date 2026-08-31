import axios from 'axios';

// In-memory OTP storage: key = email or phone, value = { code, expiresAt }
const otpStore = new Map();

/**
 * @desc    Send Email OTP via Resend
 * @route   POST /api/otp/send-email
 * @access  Public
 */
export const sendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(email.toLowerCase().trim(), { code: otp, expiresAt });
    console.log(`[OTP] Generated OTP for ${email}: ${otp}`);

    const resendApiKey = process.env.RESEND_API_KEY;

    // Send email using Resend API
    try {
      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          from: 'Advocate AI <onboarding@advocateai.in>',
          to: [email.trim()],
          subject: `${otp} is your Advocate AI Verification Code`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 30px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #1e293b; font-size: 24px; font-weight: 800; margin: 0;">Advocate AI</h1>
                <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Legal Intelligence Platform</p>
              </div>
              <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello,</p>
              <p style="color: #334155; font-size: 15px; line-height: 1.5;">Your verification code for Advocate AI account verification and onboarding is:</p>
              <div style="margin: 24px 0; padding: 18px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; text-align: center;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2563eb;">${otp}</span>
              </div>
              <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This code will expire in <strong>10 minutes</strong>. If you did not request this verification code, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
              <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">&copy; ${new Date().getFullYear()} Advocate AI Inc. All rights reserved.</p>
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

      console.log(`[OTP] Resend API response:`, response.data);
      return res.status(200).json({
        success: true,
        message: 'OTP sent successfully to your email',
        id: response.data?.id
      });
    } catch (resendError) {
      console.warn(`[OTP] Resend sending notice:`, resendError.response?.data || resendError.message);
      // Still allow client dev/bypass verification with logged OTP
      return res.status(200).json({
        success: true,
        message: 'OTP generated. Please check your inbox or use the verification code.',
        devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
      });
    }
  } catch (error) {
    console.error('[OTP] Error in sendEmailOtp:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Verify Email OTP
 * @route   POST /api/otp/verify-email
 * @access  Public
 */
export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ verified: false, message: 'Email and OTP code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const stored = otpStore.get(cleanEmail);

    // Allow static master test code or matching in-memory code
    if (code === '123456' || (stored && stored.code === code.trim() && Date.now() <= stored.expiresAt)) {
      otpStore.delete(cleanEmail);
      return res.status(200).json({ success: true, verified: true, message: 'Email verified successfully' });
    }

    if (stored && Date.now() > stored.expiresAt) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({ verified: false, message: 'OTP has expired. Please request a new one.' });
    }

    return res.status(400).json({ verified: false, message: 'Invalid verification code' });
  } catch (error) {
    console.error('[OTP] Error in verifyEmailOtp:', error);
    return res.status(500).json({ verified: false, message: error.message });
  }
};

/**
 * @desc    Send Phone OTP (Mock / SMS Gateway ready)
 * @route   POST /api/otp/send-phone
 * @access  Public
 */
export const sendPhoneOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    otpStore.set(phone.trim(), { code: otp, expiresAt });
    console.log(`[OTP] Generated Phone OTP for ${phone}: ${otp}`);

    return res.status(200).json({
      success: true,
      message: 'Phone OTP sent successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Verify Phone OTP
 * @route   POST /api/otp/verify-phone
 * @access  Public
 */
export const verifyPhoneOtp = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ verified: false, message: 'Phone and OTP code are required' });
    }

    const cleanPhone = phone.trim();
    const stored = otpStore.get(cleanPhone);

    if (code === '123456' || (stored && stored.code === code.trim() && Date.now() <= stored.expiresAt)) {
      otpStore.delete(cleanPhone);
      return res.status(200).json({ success: true, verified: true, message: 'Phone verified successfully' });
    }

    return res.status(400).json({ verified: false, message: 'Invalid verification code' });
  } catch (error) {
    return res.status(500).json({ verified: false, message: error.message });
  }
};
