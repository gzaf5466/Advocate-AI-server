import { prisma } from '../config/db.js';

/**
 * @desc    Get user's cases
 * @route   GET /api/cases/my-cases
 * @access  Private
 */
export const getMyCases = async (req, res, next) => {
  try {
    const cases = await prisma.case.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(cases);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new case
 * @route   POST /api/cases
 * @access  Private
 */
export const createCase = async (req, res, next) => {
  try {
    const { title, caseNumber, court, status = 'active', description } = req.body;

    if (!title) {
      res.status(400);
      throw new Error('Case title is required');
    }

    const newCase = await prisma.case.create({
      data: {
        userId: req.user.id,
        title,
        caseNumber,
        court,
        status,
        description,
      }
    });

    res.status(201).json(newCase);
  } catch (error) {
    next(error);
  }
};
