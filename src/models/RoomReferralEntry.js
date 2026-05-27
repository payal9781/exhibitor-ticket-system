// src/models/RoomReferralEntry.js
const mongoose = require('mongoose');

const roomReferralEntrySchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomReferralRoom', required: true },
  roundId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomReferralRound', required: true },
  giverId: { type: mongoose.Schema.Types.ObjectId, refPath: 'giverModel', required: true },
  giverModel: { type: String, enum: ['Exhibitor', 'Visitor'], required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, refPath: 'receiverModel', required: true },
  receiverModel: { type: String, enum: ['Exhibitor', 'Visitor'], required: true },
  referredName: { type: String, required: true },
  referredEmail: { type: String, required: true },
  referredMobile: { type: String, required: true },
  comment: { type: String }
}, { timestamps: true });

module.exports = mongoose.models.RoomReferralEntry || mongoose.model('RoomReferralEntry', roomReferralEntrySchema);
