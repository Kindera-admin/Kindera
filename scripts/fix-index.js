const { mongoose } = require('mongoose');
const path = require('path');

// Load .env.local file
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable');
  process.exit(1);
}

async function fixNgoIdIndex() {
  try {
    // Connect to the database
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Get all indexes
    const indexes = await usersCollection.indexes();
    console.log('Current indexes:', indexes);
    
    // Check if ngoId_1 index exists and if it's not sparse
    const ngoIdIndex = indexes.find(idx => idx.name === 'ngoId_1');
    
    if (ngoIdIndex) {
      console.log('Found ngoId_1 index:', ngoIdIndex);
      
      if (!ngoIdIndex.sparse) {
        console.log('Index is not sparse, dropping it...');
        await usersCollection.dropIndex('ngoId_1');
        console.log('Old index dropped successfully');
        
        console.log('Creating new sparse index...');
        await usersCollection.createIndex({ ngoId: 1 }, { unique: true, sparse: true });
        console.log('New sparse index created successfully');
      } else {
        console.log('Index is already sparse, no action needed');
      }
    } else {
      console.log('ngoId_1 index does not exist, creating sparse index...');
      await usersCollection.createIndex({ ngoId: 1 }, { unique: true, sparse: true });
      console.log('Sparse index created successfully');
    }
    
    console.log('\n✅ Index fix completed successfully!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error fixing index:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixNgoIdIndex();
