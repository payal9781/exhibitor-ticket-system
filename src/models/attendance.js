// src/models/Event.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizer', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, refPath: 'userModel', required: true },
    userModel: { type: String, enum: ['Visitor', 'Exhibitor'], required: true },
    attedndanceDetails: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
}, { timestamps: true });

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);