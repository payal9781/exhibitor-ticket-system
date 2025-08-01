// src/models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    slot: { type: String },
    slotMakerId: { type: Schema.Types.ObjectId, ref: 'userModel' },
    userId: { type: Schema.Types.ObjectId, refPath: 'userModel', required: true },
    userModel: { type: String, enum: ['Visitor', 'Exhibitor'], required: true },
    date: { type: String },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);