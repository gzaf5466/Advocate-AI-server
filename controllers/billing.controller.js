import crypto from 'crypto';
import razorpayInstance from '../config/razorpay.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

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
    await Transaction.create({
      user: req.user._id,
      orderId: order.id,
      amount,
      currency,
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
      // Update transaction status
      const transaction = await Transaction.findOneAndUpdate(
        { orderId: razorpay_order_id },
        {
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          status: 'paid',
        },
        { new: true }
      );

      if (transaction) {
        // Increment user's wallet balance
        await User.findByIdAndUpdate(req.user._id, {
          $inc: { walletBalance: transaction.amount }
        });
      }

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
      });
    } else {
      await Transaction.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: 'failed' }
      );
      
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
    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    next(error);
  }
};
