// src/models/Scan.js
const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
  scanner: { type: mongoose.Schema.Types.ObjectId, refPath: 'userModel', required: true },
  userModel: { type: String, enum: ['Visitor', 'Exhibitor'], required: true },
  scannedUser: [{ type: mongoose.Schema.Types.ObjectId, refPath: 'userModel', required: true }],
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Scan', scanSchema);