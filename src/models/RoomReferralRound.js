// src/models/RoomReferralRound.js
const mongoose = require('mongoose');

const roomReferralRoundSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomReferralRoom', required: true },
  name: { type: String, required: true }, // e.g. "Round 1 - Introduction"
  roundNumber: { type: Number, required: true }, // Sequence number (e.g. 1)
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, refPath: 'participants.userModel', required: true },
    userModel: { type: String, enum: ['Exhibitor', 'Visitor'], required: true }
  }]
}, { timestamps: true });

module.exports = mongoose.models.RoomReferralRound || mongoose.model('RoomReferralRound', roomReferralRoundSchema);
