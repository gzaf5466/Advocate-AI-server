import { prisma } from '../config/db.js';

/**
 * @desc    Get user's consultations
 * @route   GET /api/consultations/my-consultations
 * @access  Private
 */
export const getMyConsultations = async (req, res, next) => {
  try {
    const consultations = await prisma.consultation.findMany({
      where: { clientId: req.user.id },
      include: {
        lawyer: {
          include: {
            user: {
              select: { name: true, email: true, phone: true }
            }
          }
        }
      },
      orderBy: { scheduledTime: 'desc' }
    });
    res.status(200).json(consultations);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Book a consultation
 * @route   POST /api/consultations/book
 * @access  Private
 */
export const bookConsultation = async (req, res, next) => {
  try {
    const { lawyerId, scheduledTime, notes, fee } = req.body;

    if (!lawyerId || !scheduledTime) {
      res.status(400);
      throw new Error('Lawyer and scheduled time are required');
    }

    const consultation = await prisma.consultation.create({
      data: {
        clientId: req.user.id,
        lawyerId,
        scheduledTime: new Date(scheduledTime),
        notes: notes || null,
        fee: fee ? parseFloat(fee) : 0,
        status: 'pending',
      }
    });

    res.status(201).json(consultation);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update consultation status
 * @route   PUT /api/consultations/:id/status
 * @access  Private
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const consultation = await prisma.consultation.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.status(200).json(consultation);
  } catch (error) {
    next(error);
  }
};
