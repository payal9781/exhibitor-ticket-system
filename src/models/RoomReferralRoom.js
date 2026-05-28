// src/models/RoomReferralRoom.js
const mongoose = require('mongoose');

const roomReferralRoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  details: { type: String },
  date: { type: Date, required: true },
  startTime: { type: String, required: true }, // Format: "HH:MM" or "HH:MM:SS"
  endTime: { type: String, required: true }, // Format: "HH:MM" or "HH:MM:SS"
  location: { type: String, required: true },
  mapURL: { type: String },
  banner: { type: String }, // Banner image path
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  eventName: { type: String }, // Cached name of the event
  chapter_name: { type: String }, // Chapter organizing the room
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByType', required: true },
  createdByType: { type: String, enum: ['Superadmin', 'Organizer'], required: true }
}, { timestamps: true });

module.exports = mongoose.models.RoomReferralRoom || mongoose.model('RoomReferralRoom', roomReferralRoomSchema);
