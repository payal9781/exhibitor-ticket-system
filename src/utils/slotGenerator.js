const moment = require('moment'); // Assume installed

const generateSlots = (fromDate, toDate, meetingStartTime, meetingEndTime, timeInterval) => {
  const slots = [];
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);

  // Default to event startTime/endTime if meeting times are not provided
  let startTime = meetingStartTime || '09:00:00';
  let endTime = meetingEndTime || '17:00:00';
  const interval = timeInterval || 30; // Default to 30 minutes

  // Normalize time format - remove extra colons if present (e.g., "02:00:00:00" -> "02:00:00")
  startTime = startTime.split(':').slice(0, 3).join(':');
  endTime = endTime.split(':').slice(0, 3).join(':');

  console.log(`[generateSlots] Normalized times - start: ${startTime}, end: ${endTime}, interval: ${interval}`);

  // Validate time format (HH:MM:SS)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
  if (!timeRegex.test(startTime)) {
    console.error(`[generateSlots] Invalid startTime format: ${startTime}`);
    return slots;
  }
  if (!timeRegex.test(endTime)) {
    console.error(`[generateSlots] Invalid endTime format: ${endTime}`);
    return slots;
  }

  // Iterate through each day from fromDate to toDate
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    let currentTime = new Date(`${dateStr}T${startTime}`);
    const endTimeDate = new Date(`${dateStr}T${endTime}`);

    console.log(`[generateSlots] Processing date: ${dateStr}, start: ${currentTime}, end: ${endTimeDate}`);

    // Check if times are valid
    if (isNaN(currentTime.getTime()) || isNaN(endTimeDate.getTime())) {
      console.error(`[generateSlots] Invalid date parsing for ${dateStr}`);
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Check if end time is after start time
    if (endTimeDate <= currentTime) {
      console.error(`[generateSlots] End time (${endTime}) must be after start time (${startTime})`);
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Generate slots for the day
    let slotCount = 0;
    while (currentTime < endTimeDate) {
      const slotEnd = new Date(currentTime.getTime() + interval * 60 * 1000);
      if (slotEnd <= endTimeDate) {
        slots.push({
          start: new Date(currentTime),
          end: slotEnd
        });
        slotCount++;
      }
      currentTime = slotEnd;
    }

    console.log(`[generateSlots] Generated ${slotCount} slots for ${dateStr}`);

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`[generateSlots] Total slots generated: ${slots.length}`);
  return slots;
};

module.exports = generateSlots;