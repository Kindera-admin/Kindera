import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { normalizeEmail, isValidEmail } from '../lib/email.js';

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
    enum: ['ngo', 'admin', 'org_spoc', 'org_member', 'volunteer', 'employee'],
    default: 'volunteer'
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
  // Corporate users (SPOCs and employees) belong to exactly one company.
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    required: function () {
      return this.role === 'org_spoc' || this.role === 'org_member';
    },
  },
  // NGO login's organisation name (the old free-text field for role 'ngo').
  ngoName: { type: String, default: '', trim: true },
  // The NGO card this login was generated from (role 'ngo' only; set by staff).
  ngoPartnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NGOPartner',
    default: null,
  },
  // Optional free-text employer for individual volunteers (display only).
  employerName: { type: String, default: '', trim: true },
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
  // Optional; for event updates and notifications. Never stored as '' (the
  // setter turns blank into undefined). Uniqueness is the partial index below.
  email: {
    type: String,
    set: normalizeEmail,
    // Checked only when the email itself is set or changed: legacy values stored
    // before this rule (e.g. 'a@b') must not make unrelated saves fail.
    validate: {
      validator(value) {
        const doc = typeof this?.isModified === 'function' ? this : null;
        if (doc && !doc.isNew && !doc.isModified('email')) return true;
        return value == null || isValidEmail(value);
      },
      message: 'Invalid email address',
    },
  },
  age: { type: Number, default: null },
  photoUrl: { type: String, default: '' },
  eventRegistrations: [{
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    comment: { type: String, default: '' },
    volunteersCount: { type: Number, default: 1 },
    volunteerNames: { type: String, default: '' },
    appliedAt: { type: Date, default: Date.now }
  }],
  has12A: { type: Boolean, default: false },
  reg12A: { type: String, default: '' },
  has80G: { type: Boolean, default: false },
  reg80G: { type: String, default: '' },
  hasFCRA: { type: Boolean, default: false },
  regFCRA: { type: String, default: '' },

  // Which SPOC created this login. Record only: never used for access decisions.
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

userSchema.index({ companyId: 1 });
// Unique over real emails only. A partial index (not sparse) also ignores legacy
// accounts whose email is '' or missing, so they can never block the index build.
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } });

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