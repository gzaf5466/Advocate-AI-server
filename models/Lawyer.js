import mongoose from 'mongoose';

const lawyerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  specialization: {
    type: [String],
    required: true,
  },
  experience: {
    type: Number, // Years of experience
    required: true,
  },
  rating: {
    type: Number,
    default: 0,
  },
  reviews: {
    type: Number,
    default: 0,
  },
  hourlyRate: {
    type: Number,
    required: true,
  },
  bio: {
    type: String,
  },
  location: {
    type: String,
  },
  available: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true,
});

const Lawyer = mongoose.model('Lawyer', lawyerSchema);
export default Lawyer;
