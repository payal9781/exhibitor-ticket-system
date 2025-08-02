const moment = require('moment'); // Assume installed
const generateSlots = (fromDate, toDate, startTime, endTime) => {
  const slots = [];
  let currentDate = moment(fromDate);
  const eventEndDate = moment(toDate);
  while (currentDate.isSameOrBefore(eventEndDate)) {
    let currentTime = moment(startTime).set('date', currentDate.date()).set('month', currentDate.month()).set('year', currentDate.year());
    const dayEndTime = moment(endTime).set('date', currentDate.date()).set('month', currentDate.month()).set('year', currentDate.year());
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