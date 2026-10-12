import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Company of the attendee at the time of marking; null for individual volunteers.
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
  },
  attended: {
    type: Boolean,
    default: false,
  },
  hoursContributed: {
    type: Number,
    default: 0,
    min: 0,
  },
  feedbackScore: {
    type: Number,
    min: 1,
    max: 5,
    default: null,
  },
  markedAt: {
    type: Date,
    default: null,
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

// Each user can only have one attendance record per event
attendanceSchema.index({ eventId: 1, userId: 1 }, { unique: true });
// Fast lookup by company
attendanceSchema.index({ companyId: 1 });
// Fast lookup by event
attendanceSchema.index({ eventId: 1 });

const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

export default Attendance;
