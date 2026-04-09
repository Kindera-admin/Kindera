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
}, {
  timestamps: true,
});

const NGOPartner = mongoose.models.NGOPartner || mongoose.model('NGOPartner', ngoPartnerSchema);

export default NGOPartner;
