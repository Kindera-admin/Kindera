const mongoose = require('mongoose');
const User = require('./src/models/User').default || require('./src/models/User');

async function test() {
  await mongoose.connect('mongodb+srv://manjulkumar8025_db_user:8025@kindera.2a5vud1.mongodb.net/kindera_staging?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });
  
  const spocs = await User.find({ role: 'org_spoc' }, 'name role organizationName eventRegistrations').lean();
  console.log("SPOCS:");
  spocs.forEach(s => console.log(JSON.stringify(s)));
  process.exit(0);
}
test();
