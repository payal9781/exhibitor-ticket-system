/** End of calendar day for event toDate (matches event list status logic). */
function getEventEndDate(toDate) {
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);
  return end;
}

function isEventRegistrationClosed(eventOrToDate) {
  const toDate =
    eventOrToDate && typeof eventOrToDate === 'object' && eventOrToDate.toDate
      ? eventOrToDate.toDate
      : eventOrToDate;
  return new Date() > getEventEndDate(toDate);
}

/** Public self-registration via registration link always requires approval first */
function requiresRegistrationApproval() {
  return true;
}

module.exports = { getEventEndDate, isEventRegistrationClosed, requiresRegistrationApproval };
