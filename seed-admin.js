const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: '.env.local' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = mongoose.model('User', new mongoose.Schema({
    username: String, password: String, role: String, name: String, status: String
  }, { strict: false }));
  
  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash('kindera@1122KK', salt);
  
  await User.deleteMany({ username: 'kindera_admin' });
  await User.create({ 
    username: 'kindera_admin', 
    password, 
    role: 'admin', 
    name: 'Admin', 
    status: 'approved' 
  });
  
  console.log('User created!');
  mongoose.disconnect();
}
run();
