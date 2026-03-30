const { mongoose } = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable');
  process.exit(1);
}

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  name: String
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

async function seedAdmin() {
  try {
    // Connect to the database
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Create User model
    const User = mongoose.models.User || mongoose.model('User', userSchema);
    
    const adminExists = await User.findOne({ username: 'admin' });
    
    if (adminExists) {
      console.log('Admin user already exists');
      await mongoose.disconnect();
      return;
    }
    
    await User.create({
      username: 'admin',
      password: 'admin123', // Will be hashed by pre-save hook
      role: 'admin',
      name: 'System Administrator'
    });
    
    console.log('Admin user created successfully');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error creating admin user:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedAdmin();