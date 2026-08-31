import crypto from 'crypto';
import razorpayInstance from '../config/razorpay.js';
import { prisma } from '../config/db.js';

/**
 * @desc    Create Razorpay order
 * @route   POST /api/billing/create-order
 * @access  Private
 */
export const createOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', receipt = 'receipt#1' } = req.body;

    if (!amount) {
      res.status(400);
      throw new Error('Amount is required');
    }

    const options = {
      amount: amount * 100, // amount in smallest currency unit (paise for INR)
      currency,
      receipt,
    };

    const order = await razorpayInstance.orders.create(options);

    // Log transaction as created
    await prisma.transaction.create({
      data: {
        userId: req.user.id,
        orderId: order.id,
        amount,
        currency,
      }
    });

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify Razorpay payment
 * @route   POST /api/billing/verify
 * @access  Private
 */
export const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Find the transaction by orderId
      const transaction = await prisma.transaction.findFirst({
        where: { orderId: razorpay_order_id }
      });

      if (transaction) {
        // Run updates in transaction
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              paymentId: razorpay_payment_id,
              signature: razorpay_signature,
              status: 'paid',
            }
          }),
          prisma.user.update({
            where: { id: req.user.id },
            data: {
              walletBalance: { increment: transaction.amount }
            }
          })
        ]);
      }

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
      });
    } else {
      // Update transaction status to failed
      await prisma.transaction.updateMany({
        where: { orderId: razorpay_order_id },
        data: { status: 'failed' }
      });
      
      res.status(400);
      throw new Error('Payment verification failed');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user payment history
 * @route   GET /api/billing/history
 * @access  Private
 */
export const getHistory = async (req, res, next) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(transactions);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user wallet balance
 * @route   GET /api/billing/wallet
 * @access  Private
 */
export const getWalletBalance = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { walletBalance: true }
    });
    res.status(200).json({ walletBalance: user?.walletBalance || 0 });
  } catch (error) {
    next(error);
  }
};


