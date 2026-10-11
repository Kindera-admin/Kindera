// Create an admin user from ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_NAME
// in .env.local. Skips if that username already exists.
// Run with: npm run create-admin

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const USERNAME    = process.env.ADMIN_USERNAME;
const PASSWORD    = process.env.ADMIN_PASSWORD;
const NAME        = process.env.ADMIN_NAME || 'Administrator';

if (!MONGODB_URI || !USERNAME || !PASSWORD) {
  console.error('❌ MONGODB_URI, ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env.local');
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

const existing = await User.findOne({ username: USERNAME });
if (existing) {
  console.log(`⚠️  User "${USERNAME}" already exists. Skipping.`);
  await mongoose.disconnect();
  process.exit(0);
}

const admin = new User({
  username: USERNAME,
  password: PASSWORD,
  role:     'admin',
  name:     NAME,
  status:   'approved',
});
await admin.save();
console.log(`✅ Admin user "${USERNAME}" created successfully.`);
await mongoose.disconnect();
