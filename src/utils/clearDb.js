const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const clearDatabase = async () => {
  try {
    console.log('Connecting to database...');
    if (!process.env.DB_URI) {
      throw new Error('DB_URI is not defined in the environment variables!');
    }
    
    await mongoose.connect(process.env.DB_URI);
    console.log('Connected to MongoDB. Clearing all collections...');

    const collections = mongoose.connection.collections;
    const clearedCollections = [];
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
      clearedCollections.push(key);
      console.log(`Cleared collection: ${key}`);
    }

    console.log('\n=====================================');
    console.log(`SUCCESS: Cleared ${clearedCollections.length} collections!`);
    console.log('=====================================');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  }
};

clearDatabase();
