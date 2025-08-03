const mongoose = require('mongoose');
const meetingSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, required: true },
  requesterType: { type: String, enum: ['Visitor', 'Exhibitor'], required: true },
  requesteeId: { type: mongoose.Schema.Types.ObjectId, required: true },
  requesteeType: { type: String, enum: ['Visitor', 'Exhibitor'], required: true },
  slotStart: { type: Date, required: true },
  slotEnd: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending' },
}, { timestamps: true });
module.exports = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);