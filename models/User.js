import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'is invalid']
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  azureId: {
    type: String,
    unique: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ['customer', 'lawyer', 'admin'],
    default: 'customer'
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  name: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

const User = mongoose.model('User', userSchema);
export default User;
