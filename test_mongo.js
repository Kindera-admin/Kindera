const mongoose = require('mongoose');
const User = require('./src/models/User').default || require('./src/models/User');

async function test() {
  await mongoose.connect('mongodb+srv://manjulkumar8025_db_user:8025@kindera.2a5vud1.mongodb.net/kindera_staging?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });
  
  const corpDetailsAgg = await User.aggregate([
      { $unwind: '$eventRegistrations' },
      { $match: { 
          'eventRegistrations.status': 'approved',
          role: { $in: ['org_spoc', 'org_member'] }
        }
      },
      {
        $group: {
          _id: {
            eventId: '$eventRegistrations.eventId',
            orgName: '$organizationName'
          },
          expected: {
            $sum: { $cond: [{ $eq: ['$role', 'org_spoc'] }, '$eventRegistrations.volunteersCount', 0] }
          },
          actual: {
            $sum: { $cond: [{ $eq: ['$role', 'org_member'] }, 1, 0] }
          }
        }
      }
  ]);
  
  console.log(JSON.stringify(corpDetailsAgg, null, 2));
  process.exit(0);
}
test();
