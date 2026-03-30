import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['ngo', 'admin', 'org_spoc', 'org_member'],
    default: 'ngo'
  },
  ngoId: {
  type: String,
  required: function () {
    return this.role === 'ngo';
  },
  unique: true,
  sparse: true
}
,
  organizationName: {
    type: String,
    required: function() {
      return this.role === 'org_spoc' || this.role === 'org_member';
    }
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  mobile: { type: String, default: '' },
  has12A: { type: Boolean, default: false },
  reg12A: { type: String, default: '' },
  has80G: { type: Boolean, default: false },
  reg80G: { type: String, default: '' },
  hasFCRA: { type: Boolean, default: false },
  regFCRA: { type: String, default: '' }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Prevent model overwrite error in development due to hot reloading
const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;