import Lawyer from '../models/Lawyer.js';
import Consultation from '../models/Consultation.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

/**
 * @desc    Get all lawyers
 * @route   GET /api/lawyers
 * @access  Public
 */
export const getLawyers = async (req, res, next) => {
  try {
    const keyword = req.query.keyword
      ? {
          $or: [
            { specialization: { $regex: req.query.keyword, $options: 'i' } },
            { location: { $regex: req.query.keyword, $options: 'i' } }
          ]
        }
      : {};

    // In a real scenario, you'd populate user details like name/profile pic
    const lawyers = await Lawyer.find({ ...keyword, available: true }).populate('user', 'name email phone');
    
    res.json(lawyers);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get lawyer by ID
 * @route   GET /api/lawyers/:id
 * @access  Public
 */
export const getLawyerById = async (req, res, next) => {
  try {
    const lawyer = await Lawyer.findById(req.params.id).populate('user', 'name email phone');

    if (lawyer) {
      res.json(lawyer);
    } else {
      res.status(404);
      throw new Error('Lawyer not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Book a consultation
 * @route   POST /api/lawyers/:id/book
 * @access  Private
 */
export const bookConsultation = async (req, res, next) => {
  try {
    const { scheduledTime, notes } = req.body;
    const lawyerId = req.params.id;

    if (!scheduledTime) {
      res.status(400);
      throw new Error('Scheduled time is required');
    }

    const lawyer = await Lawyer.findById(lawyerId);
    if (!lawyer) {
      res.status(404);
      throw new Error('Lawyer not found');
    }

    const user = await User.findById(req.user._id);
    const consultationFee = lawyer.hourlyRate || 500; // Default fee if not specified

    if (user.walletBalance < consultationFee) {
      res.status(400);
      throw new Error(`Insufficient wallet balance. Fee: ₹${consultationFee}, Current: ₹${user.walletBalance}`);
    }

    // Deduct balance
    user.walletBalance -= consultationFee;
    await user.save();

    // Create a debit transaction record
    await Transaction.create({
      user: req.user._id,
      amount: consultationFee,
      currency: 'INR',
      status: 'paid',
      type: 'debit', // I should check if Transaction model supports 'type'
      orderId: `BOOK-${Math.floor(100000 + Math.random() * 900000)}`,
    });

    const consultation = await Consultation.create({
      client: req.user._id,
      lawyer: lawyerId,
      scheduledTime,
      notes,
      fee: consultationFee,
    });

    res.status(201).json(consultation);
  } catch (error) {
    next(error);
  }
};
