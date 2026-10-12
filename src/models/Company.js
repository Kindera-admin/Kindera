import mongoose from 'mongoose';
import { toNameKey } from '@/lib/companyName.mjs';

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  // Unique, case- and spacing-insensitive form of `name`; blocks "Acme" vs "acme ".
  nameKey: { type: String, required: true, unique: true },
  logoUrl: { type: String, default: '' },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

companySchema.pre('validate', function setNameKey(next) {
  if (this.isModified('name') || !this.nameKey) this.nameKey = toNameKey(this.name);
  next();
});

const Company = mongoose.models.Company || mongoose.model('Company', companySchema);
export default Company;
