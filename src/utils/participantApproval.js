const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

/** Resolve approval status for event exhibitor/visitor subdocuments (incl. legacy rows). */
const resolveApprovalStatus = (participant) => {
  if (!participant) return 'pending';

  if (participant.approvalStatus && APPROVAL_STATUSES.includes(participant.approvalStatus)) {
    return participant.approvalStatus;
  }
  if (participant.isVerified === true) return 'approved';
  if (participant.rejectedAt || participant.rejectedBy) return 'rejected';
  return 'pending';
};

const isEventParticipantAddedByStaff = (participant) => {
  const addedByType = participant?.addedBy?.userType;
  return addedByType === 'Organizer' || addedByType === 'Superadmin';
};

/** Bookings / attendance lists: approved registrations + staff-added (auto-approved). */
const shouldShowInEventBookings = (participant) => {
  if (!participant?.userId) return false;

  const status = resolveApprovalStatus(participant);
  if (status === 'rejected') return false;
  if (status === 'approved') return true;
  if (isEventParticipantAddedByStaff(participant)) return true;

  return false;
};

module.exports = {
  APPROVAL_STATUSES,
  resolveApprovalStatus,
  isEventParticipantAddedByStaff,
  shouldShowInEventBookings,
};
