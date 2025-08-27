const moment = require('moment'); // Assume installed
const generateSlots = (fromDate, toDate, meetingStartTime, meetingEndTime, timeInterval) => {
  const slots = [];
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);

  // Default to event startTime/endTime if meeting times are not provided
  const startTime = meetingStartTime || '09:00:00';
  const endTime = meetingEndTime || '17:00:00';
  const interval = timeInterval || 30; // Default to 30 minutes

  // Iterate through each day from fromDate to toDate
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    let currentTime = new Date(`${dateStr}T${startTime}`);
    const endTimeDate = new Date(`${dateStr}T${endTime}`);

    // Generate slots for the day
    while (currentTime < endTimeDate) {
      const slotEnd = new Date(currentTime.getTime() + interval * 60 * 1000);
      if (slotEnd <= endTimeDate) {
        slots.push({
          start: new Date(currentTime),
          end: slotEnd
        });
      }
      currentTime = slotEnd;
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
};
module.exports = generateSlots;