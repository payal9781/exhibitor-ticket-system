// src/config/database.js
const mongoose = require('mongoose');
const { MONGODB_URI } = require('./env');

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`🍻 Cheers! Database connected.`);
  } catch (error) {
    console.log(`🚨 Connection Error: ${error}`);
    process.exit(1);
  }
};

module.exports = connectDB;