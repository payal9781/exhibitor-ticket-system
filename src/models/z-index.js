const Meeting = require('./meeting');

const models = {
  Event: require('./Event'),
  Attendance: require('./attendance'),
  Exhibitor: require('./Exhibitor'),
  Organizer: require('./Organizer'),
  Scan: require('./Scan'),
  Superadmin: require('./Superadmin'),
  Visitor: require('./Visitor'),
  Meeting: require('./meeting'),
  ScannedCards: require('./ScannedCards'),
  Leads : require('./leads'),
};

module.exports = { models };