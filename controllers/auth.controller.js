import { prisma } from '../config/db.js';
import generateToken from '../utils/generateToken.js';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


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
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
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

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId },
          { email }
        ]
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId,
          email,
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
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }
    });

  } catch (error) {
    res.status(401);
    next(new Error('Invalid Google token'));
  }
};

/**
 * @desc    Verify Microsoft/Azure Token and Login/Register
 * @route   POST /api/auth/azure
 * @access  Public
 */
export const azureLogin = async (req, res, next) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      res.status(400);
      throw new Error('Microsoft Access token is required');
    }

    // Verify token by calling Microsoft Graph API
    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const { id: azureId, userPrincipalName, displayName } = response.data;
    const email = userPrincipalName; // Usually the email

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { azureId },
          { email }
        ]
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          azureId,
          email,
          name: displayName,
          role: 'customer'
        }
      });
    } else if (!user.azureId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { azureId }
      });
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
    res.status(401);
    next(new Error('Invalid Microsoft token'));
  }
};
