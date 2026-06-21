// One-time script: create a second admin user
// Run with: node scripts/create-admin.mjs

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env.local');
  process.exit(1);
}

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role:     String,
  name:     String,
  status:   String,
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

await mongoose.connect(MONGODB_URI);
console.log('✅ Connected to MongoDB');

const existing = await User.findOne({ username: 'rajput' });
if (existing) {
  console.log('⚠️  User "rajput" already exists. Skipping.');
  await mongoose.disconnect();
  process.exit(0);
}

const admin = new User({
  username: 'rajput',
  password: 'rajput',
  role:     'admin',
  name:     'Rajput',
  status:   'approved',
});
await admin.save();
console.log('✅ Admin user "rajput" created successfully.');
await mongoose.disconnect();
