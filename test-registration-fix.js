require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('./src/models/Event');
const Organizer = require('./src/models/Organizer');

async function testRegistrationFix() {
  try {
    // Connect to database
    await mongoose.connect(process.env.DB_URI);
    console.log('Connected to database');

    // Find an event with a registration link
    const event = await Event.findOne({ 
      registrationLink: { $exists: true, $ne: null },
      isDeleted: false 
    }).populate('organizerId', 'name email organizationName');

    if (!event) {
      console.log('No events found with registration links');
      
      // Create a test organizer and event
      const testOrganizer = new Organizer({
        name: 'Test Organizer',
        email: 'test@example.com',
        password: 'password123',
        organizationName: 'Test Organization'
      });
      await testOrganizer.save();
      console.log('Created test organizer');

      const testEvent = new Event({
        organizerId: testOrganizer._id,
        title: 'Test Event',
        description: 'Test event for registration fix',
        fromDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        toDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
        startTime: '09:00:00',
        endTime: '17:00:00',
        location: 'Test Location',
        registrationLink: 'test-event-' + Date.now()
      });
      await testEvent.save();
      console.log('Created test event with registration link:', testEvent.registrationLink);

      // Now populate and test
      const populatedEvent = await Event.findById(testEvent._id)
        .populate('organizerId', 'name email organizationName');
      
      console.log('Event organizer data:', {
        organizerId: populatedEvent.organizerId,
        hasOrganizerId: !!populatedEvent.organizerId,
        organizerName: populatedEvent.organizerId?.name,
        organizationName: populatedEvent.organizerId?.organizationName
      });

      // Test the template logic
      const organizerDisplay = populatedEvent.organizerId ? 
        (populatedEvent.organizerId.organizationName || populatedEvent.organizerId.name) : 
        'Unknown Organizer';
      
      console.log('Template would display:', organizerDisplay);
      
    } else {
      console.log('Found event:', event.title);
      console.log('Event organizer data:', {
        organizerId: event.organizerId,
        hasOrganizerId: !!event.organizerId,
        organizerName: event.organizerId?.name,
        organizationName: event.organizerId?.organizationName
      });

      // Test the template logic
      const organizerDisplay = event.organizerId ? 
        (event.organizerId.organizationName || event.organizerId.name) : 
        'Unknown Organizer';
      
      console.log('Template would display:', organizerDisplay);
      console.log('Registration link:', event.registrationLink);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

testRegistrationFix();