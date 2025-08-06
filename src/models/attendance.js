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
  // Support for multiple check-ins/check-outs
  attendanceDetails: [{
    date: {
      type: Date,
      default: Date.now
    },
    entryTime: {
      type: Date,
      default: Date.now
    },
    exitTime: {
      type: Date,
      default: null
    }
  }],
  // Current status for quick queries
  currentStatus: {
    type: String,
    enum: ['registered', 'checked-in', 'checked-out'],
    default: 'registered'
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