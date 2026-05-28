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
  Otp: require('./Otp'),
  OtpSettings: require('./OtpSettings'),
  AdminNotificationLog: require('./AdminNotificationLog'),
  Notification: require('./notification'),
  RoomReferralRoom: require('./RoomReferralRoom'),
  RoomReferralRound: require('./RoomReferralRound'),
  RoomReferralEntry: require('./RoomReferralEntry'),
};

module.exports = { models };