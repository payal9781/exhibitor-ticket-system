const mongoose = require('mongoose');
const Event = require('../models/Event');
require('dotenv').config();

const migrateEventTimes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DB_URI);
    console.log('Connected to MongoDB');

    // Find all events
    const events = await Event.find({});
    console.log(`Found ${events.length} events to migrate`);

    let migratedCount = 0;

    for (const event of events) {
      console.log(`\nChecking event: ${event.title} (${event._id})`);
      console.log(`  Current startTime: ${event.startTime} (type: ${typeof event.startTime})`);
      console.log(`  Current endTime: ${event.endTime} (type: ${typeof event.endTime})`);
      
      let needsUpdate = false;
      const updateData = {};

      // Check if startTime is a Date object and convert to string
      if (event.startTime instanceof Date) {
        const hours = event.startTime.getHours().toString().padStart(2, '0');
        const minutes = event.startTime.getMinutes().toString().padStart(2, '0');
        const seconds = event.startTime.getSeconds().toString().padStart(2, '0');
        updateData.startTime = `${hours}:${minutes}:${seconds}`;
        needsUpdate = true;
        console.log(`  Will update startTime to: ${updateData.startTime}`);
      }

      // Check if endTime is a Date object and convert to string
      if (event.endTime instanceof Date) {
        const hours = event.endTime.getHours().toString().padStart(2, '0');
        const minutes = event.endTime.getMinutes().toString().padStart(2, '0');
        const seconds = event.endTime.getSeconds().toString().padStart(2, '0');
        updateData.endTime = `${hours}:${minutes}:${seconds}`;
        needsUpdate = true;
        console.log(`  Will update endTime to: ${updateData.endTime}`);
      }

      if (needsUpdate) {
        await Event.findByIdAndUpdate(event._id, updateData);
        console.log(`✅ Migrated event: ${event.title}`);
        migratedCount++;
      } else {
        console.log(`⏭️  Skipped event: ${event.title} (already in correct format)`);
      }
    }

    console.log(`\nMigration completed! ${migratedCount} events updated.`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the migration
migrateEventTimes();