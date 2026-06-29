import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  registrationLink: {
    type: String,
    required: true,
    trim: true
  },
  durationHours: {
    type: Number,
    default: 2,
    min: 0.5
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdByRole: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  organizationName: {
    type: String,
    trim: true,
    default: null
  },
  capacity: {
    type: Number,
    default: null
  },
  beneficiariesImpacted: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  }
}, {
  timestamps: true
});

// Prevent model overwrite error in development due to hot reloading
const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

export default Event;
