const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const adminNotificationLogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, default: '' },
    emailSubject: { type: String, default: '' },
    channel: {
      type: String,
      enum: ['email', 'push', 'both'],
      required: true,
    },
    audienceTypes: {
      type: [String],
      enum: ['exhibitor', 'visitor', 'organizer'],
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },
    eventTitle: { type: String, default: '' },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Superadmin',
      required: true,
    },
    sentByName: { type: String, default: '' },
    stats: {
      totalRecipients: { type: Number, default: 0 },
      emailSent: { type: Number, default: 0 },
      emailFailed: { type: Number, default: 0 },
      emailSkipped: { type: Number, default: 0 },
      pushSent: { type: Number, default: 0 },
      pushFailed: { type: Number, default: 0 },
      pushSkipped: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['completed', 'partial', 'failed'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

adminNotificationLogSchema.plugin(mongoosePaginate);

module.exports =
  mongoose.models.AdminNotificationLog ||
  mongoose.model('AdminNotificationLog', adminNotificationLogSchema);
