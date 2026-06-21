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
    enum: ['ngo', 'admin', 'org_spoc', 'org_member', 'volunteer'],
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
  email: { type: String, default: '' },
  age: { type: Number, default: null },
  photoUrl: { type: String, default: '' },
  eventRegistrations: [{
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    comment: { type: String, default: '' },
    appliedAt: { type: Date, default: Date.now }
  }],
  has12A: { type: Boolean, default: false },
  reg12A: { type: String, default: '' },
  has80G: { type: Boolean, default: false },
  reg80G: { type: String, default: '' },
  hasFCRA: { type: Boolean, default: false },
  regFCRA: { type: String, default: '' },

  // Corporate team: links org_member back to their SPOC
  spocId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  // Cached total volunteer hours (updated when attendance is marked)
  totalVolunteerHours: {
    type: Number,
    default: 0,
  },

  // Flag for auto-generated org members to update their name on first login
  requiresNameUpdate: {
    type: Boolean,
    default: false,
  },

  // NGO Document Vault — stores uploaded certificate URLs and verification status
  documents: [{
    docType:   { type: String, enum: ['12A', '80G', 'FCRA', 'registration', 'other'], required: true },
    label:     { type: String, required: true },
    url:       { type: String, required: true },
    uploadedAt:{ type: Date, default: Date.now },
    status:    { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    adminNote: { type: String, default: '' },
  }],

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