const Meeting = require('./Meeting');

const models = {
  Event: require('./Event'),
  Attendance: require('./Attendance'),
  Exhibitor: require('./Exhibitor'),
  Organizer: require('./Organizer'),
  Scan: require('./Scan'),
  Superadmin: require('./Superadmin'),
  Visitor: require('./Visitor'),
  Meeting: require('./Meeting'),
};

module.exports = { models };