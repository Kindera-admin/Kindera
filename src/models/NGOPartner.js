import mongoose from 'mongoose';

const ngoPartnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  logoUrl: {
    type: String,
    default: '',
  },
  focusAreas: {
    type: String,
    default: '',
  },
  programs: {
    type: [String],
    default: [],
  },
  impact: {
    type: String,
    default: '',
  },
  registeredOffice: {
    type: String,
    default: '',
  },
  location: {
    type: String,
    default: '',
  },
  website: {
    type: String,
    default: '',
    trim: true,
  },
  // Empty means a public partner. Non-empty means private to those companies.
  companyIds: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
    default: [],
  },
  // The NGO login linked to this card (at most one).
  loginUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

const NGOPartner = mongoose.models.NGOPartner || mongoose.model('NGOPartner', ngoPartnerSchema);

export default NGOPartner;
