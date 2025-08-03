const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Exhibitor', 'Visitor']
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  attendanceDate: {
    type: Date,
    required: true
  },
  scannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'scannedByModel'
  },
  scannedByModel: {
    type: String,
    required: true,
    enum: ['User', 'Exhibitor', 'Visitor'] // User for organizers/superadmins
  },
  scanTime: {
    type: Date,
    default: Date.now
  },
  qrData: {
    eventId: String,
    userId: String,
    userType: String,
    startDate: Date,
    endDate: Date
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate attendance for same user on same day
attendanceSchema.index({ userId: 1, eventId: 1, attendanceDate: 1 }, { unique: true });

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);