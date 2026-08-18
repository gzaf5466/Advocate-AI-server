import { prisma } from '../config/db.js';

/**
 * @desc    Get all lawyers
 * @route   GET /api/lawyers
 * @access  Public
 */
export const getLawyers = async (req, res, next) => {
  try {
    const keyword = req.query.keyword ? String(req.query.keyword) : undefined;
    
    let whereClause = { available: true };

    if (keyword) {
      whereClause.OR = [
        { specialization: { has: keyword } },
        { location: { contains: keyword, mode: 'insensitive' } }
      ];
    }

    const lawyers = await prisma.lawyer.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });
    
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
    const lawyer = await prisma.lawyer.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

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

    const lawyer = await prisma.lawyer.findUnique({ where: { id: lawyerId } });
    if (!lawyer) {
      res.status(404);
      throw new Error('Lawyer not found');
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const consultationFee = lawyer.hourlyRate || 500.0;

    if (user.walletBalance < consultationFee) {
      res.status(400);
      throw new Error(`Insufficient wallet balance. Fee: ₹${consultationFee}, Current: ₹${user.walletBalance}`);
    }

    // Execute multiple operations in a transaction
    const [updatedUser, transaction, consultation] = await prisma.$transaction([
      // 1. Deduct balance
      prisma.user.update({
        where: { id: user.id },
        data: { walletBalance: { decrement: consultationFee } }
      }),
      // 2. Create debit transaction
      prisma.transaction.create({
        data: {
          userId: user.id,
          amount: consultationFee,
          currency: 'INR',
          status: 'paid',
          type: 'debit',
          orderId: `BOOK-${Math.floor(100000 + Math.random() * 900000)}`,
        }
      }),
      // 3. Create consultation
      prisma.consultation.create({
        data: {
          clientId: user.id,
          lawyerId: lawyer.id,
          scheduledTime: new Date(scheduledTime),
          notes,
          fee: consultationFee,
        }
      })
    ]);

    res.status(201).json(consultation);
  } catch (error) {
    next(error);
  }
};
