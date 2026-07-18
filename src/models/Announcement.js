import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    default: 'system', // e.g. 'event_wrap_up'
  },
  read: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

announcementSchema.index({ recipient: 1, createdAt: -1 });

const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);

export default Announcement;
