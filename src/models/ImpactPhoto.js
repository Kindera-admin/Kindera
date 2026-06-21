import mongoose from 'mongoose';

const impactPhotoSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.ImpactPhoto || mongoose.model('ImpactPhoto', impactPhotoSchema);
