import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import connectDB from './config/db.js';
import { errorHandler, notFound } from './middlewares/error.js';


// Connect to Database
connectDB();

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({ origin: '*' })); // Configure properly for production
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Basic Route for testing
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'API is running...' });
});

// Mount Routes
import authRoutes from './routes/auth.routes.js';
import lawyerRoutes from './routes/lawyer.routes.js';
import billingRoutes from './routes/billing.routes.js';
import otpRoutes from './routes/otp.routes.js';
import vaultRoutes from './routes/vault.routes.js';
import consultationRoutes from './routes/consultation.routes.js';
import caseRoutes from './routes/case.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/lawyers', lawyerRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/cases', caseRoutes);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
