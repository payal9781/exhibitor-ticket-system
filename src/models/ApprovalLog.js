const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const approvalLogSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    eventTitle: { type: String, required: true },
    participantUserId: { type: mongoose.Schema.Types.ObjectId, required: true },
    participantType: { type: String, enum: ['exhibitor', 'visitor'], required: true },
    participantName: { type: String, default: '' },
    participantEmail: { type: String, default: '' },
    action: { type: String, enum: ['approved', 'rejected'], default: 'approved' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    approvedByType: { type: String, enum: ['organizer', 'superAdmin'], required: true },
    approvedByName: { type: String, default: '' },
    approvedByEmail: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    confirmationEmailSent: { type: Boolean, default: false },
    organizerNotified: { type: Boolean, default: false },
    adminsNotified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

approvalLogSchema.plugin(mongoosePaginate);

module.exports =
  mongoose.models.ApprovalLog || mongoose.model('ApprovalLog', approvalLogSchema);
