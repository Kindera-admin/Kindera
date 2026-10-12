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
    trim: true,
    default: ''
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
  // Set means a private event for this company; null means public.
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true,
  },
  capacity: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  wrapUpSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Prevent model overwrite error in development due to hot reloading
const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

export default Event;
