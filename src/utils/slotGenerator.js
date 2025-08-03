const moment = require('moment'); // Assume installed
const generateSlots = (fromDate, toDate, startTime, endTime) => {
  const slots = [];
  let currentDate = moment(fromDate);
  const eventEndDate = moment(toDate);
  
  while (currentDate.isSameOrBefore(eventEndDate)) {
    // Parse time strings (HH:MM:SS format) and combine with current date
    const [startHour, startMinute, startSecond = 0] = startTime.split(':').map(Number);
    const [endHour, endMinute, endSecond = 0] = endTime.split(':').map(Number);
    
    let currentTime = moment(currentDate)
      .hour(startHour)
      .minute(startMinute)
      .second(startSecond);
      
    const dayEndTime = moment(currentDate)
      .hour(endHour)
      .minute(endMinute)
      .second(endSecond);
    
    while (currentTime.isBefore(dayEndTime)) {
      const slotEnd = moment(currentTime).add(30, 'minutes');
      if (slotEnd.isAfter(dayEndTime)) break;
      slots.push({ start: currentTime.toDate(), end: slotEnd.toDate() });
      currentTime = slotEnd;
    }
    currentDate.add(1, 'day');
  }
  return slots;
};
module.exports = generateSlots;