const mongoose = require('mongoose');
const userEventSlotSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userType: { type: String, enum: ['Visitor', 'Exhibitor'], required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    showSlots: { type: Boolean, default: false }, 
    slots: [{
        start: { type: Date, required: true },
        end: { type: Date, required: true },
        status: { type: String, enum: ['available', 'requested', 'booked'], default: 'available' },
        meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' } 
    }]
}, { timestamps: true });
module.exports = mongoose.model('UserEventSlot', userEventSlotSchema);