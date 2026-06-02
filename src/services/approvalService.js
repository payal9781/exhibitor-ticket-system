const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const Organizer = require('../models/Organizer');
const Superadmin = require('../models/Superadmin');
const ApprovalLog = require('../models/ApprovalLog');
const emailService = require('./emailService');
const { isEventRegistrationClosed } = require('../utils/eventDateUtils');

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

const isSuperAdmin = (user) =>
  user?.type === 'superAdmin' || user?.type === 'superadmin';

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    const id = value._id ?? value.id;
    return id ? String(id) : null;
  }
  return String(value);
};

const getAuthUserId = (user) => normalizeId(user?.id ?? user?._id);

/** Resolve status for legacy records without approvalStatus */
const resolveApprovalStatus = (participant) => {
  if (participant.approvalStatus && APPROVAL_STATUSES.includes(participant.approvalStatus)) {
    return participant.approvalStatus;
  }
  if (participant.isVerified === true) return 'approved';
  if (participant.rejectedAt || participant.rejectedBy) return 'rejected';
  return 'pending';
};

const canManageEvent = (user, event) => {
  if (isSuperAdmin(user)) return true;

  const userId = getAuthUserId(user);
  if (!userId) return false;

  const organizerId = normalizeId(event?.organizerId);
  const adminCreatorId = normalizeId(event?.createdByAdminId);

  return organizerId === userId || adminCreatorId === userId;
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatTime = (time) => {
  if (!time) return '—';
  if (typeof time === 'string' && time.includes('T')) {
    return new Date(time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  return String(time).slice(0, 5);
};

const buildEventDetailsHtml = (event, organizer, adminCreator) => {
  const orgName =
    organizer?.organizationName ||
    organizer?.name ||
    adminCreator?.name ||
    'Event organizer';
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px 0;color:#64748b;width:120px;">Event</td><td style="padding:8px 0;font-weight:600;">${event.title}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Date</td><td style="padding:8px 0;">${formatDate(event.fromDate)} – ${formatDate(event.toDate)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Time</td><td style="padding:8px 0;">${formatTime(event.startTime)} – ${formatTime(event.endTime)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Venue</td><td style="padding:8px 0;">${event.location || '—'}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Organizer</td><td style="padding:8px 0;">${orgName}</td></tr>
    </table>
  `;
};

const getApproverProfile = async (user) => {
  if (isSuperAdmin(user)) {
    const admin = await Superadmin.findById(user.id).select('name email');
    return {
      type: 'superAdmin',
      name: admin?.name || 'Admin',
      email: admin?.email || '',
    };
  }
  const organizer = await Organizer.findById(user.id).select('name email organizationName');
  return {
    type: 'organizer',
    name: organizer?.name || 'Organizer',
    email: organizer?.email || '',
  };
};

const getParticipantProfile = async (userId, userType) => {
  if (userType === 'exhibitor') {
    const ex = await Exhibitor.findById(userId).lean();
    return {
      name: ex?.companyName || 'Exhibitor',
      email: ex?.email || '',
      phone: ex?.phone || '',
      companyName: ex?.companyName || '',
    };
  }
  const vis = await Visitor.findById(userId).lean();
  return {
    name: vis?.name || 'Visitor',
    email: vis?.email || '',
    phone: vis?.phone || '',
    companyName: vis?.companyName || '',
  };
};

const sendParticipantConfirmationEmail = async (event, organizer, participant, userType) => {
  if (!participant.email) {
    return { success: false, message: 'No participant email' };
  }

  const adminCreator = event.createdByAdminId;
  const roleLabel = userType === 'exhibitor' ? 'Exhibitor' : 'Visitor';
  const subject = `Registration confirmed — ${event.title}`;
  const html = `
    <p>Your <strong>${roleLabel}</strong> registration for <strong>${event.title}</strong> has been approved.</p>
    <p>Please find the full event details below:</p>
    ${buildEventDetailsHtml(event, organizer, adminCreator)}
    <p style="margin-top:20px;">We look forward to seeing you at the event. Save this email for your records.</p>
  `;

  return emailService.sendCustomEmail(participant.email, subject, html, participant.name);
};

const notifyOrganizerOfAdminApproval = async (event, organizer, participant, userType, approver) => {
  if (!organizer?.email) {
    if (event.createdByAdminId) {
      return { success: false, message: 'Admin-managed event — no organizer to notify' };
    }
    return { success: false, message: 'No organizer email' };
  }

  const roleLabel = userType === 'exhibitor' ? 'Exhibitor' : 'Visitor';
  const subject = `Admin approved ${roleLabel.toLowerCase()} — ${event.title}`;
  const html = `
    <p>Hello ${organizer.name || 'Organizer'},</p>
    <p><strong>${approver.name}</strong> (Admin) has approved a pending ${roleLabel.toLowerCase()} registration for your event <strong>${event.title}</strong>.</p>
    <p><strong>Participant:</strong> ${participant.name}<br/>
    <strong>Email:</strong> ${participant.email || '—'}<br/>
    <strong>Phone:</strong> ${participant.phone || '—'}</p>
    ${buildEventDetailsHtml(event, organizer)}
    <p style="margin-top:16px;">No action is required — this is for your information.</p>
  `;

  return emailService.sendCustomEmail(organizer.email, subject, html, organizer.name);
};

const notifyAdminsOfOrganizerApproval = async (event, participant, userType, approver) => {
  const admins = await Superadmin.find({ isDeleted: false, isActive: true }).select('email name');
  const emails = admins.map((a) => a.email).filter(Boolean);
  if (!emails.length) return { success: false, message: 'No admin emails' };

  const roleLabel = userType === 'exhibitor' ? 'Exhibitor' : 'Visitor';
  const subject = `Organizer approved ${roleLabel.toLowerCase()} — ${event.title}`;
  const html = `
    <p><strong>${approver.name}</strong> (Organizer) approved a pending ${roleLabel.toLowerCase()} registration.</p>
    <p><strong>Event:</strong> ${event.title}<br/>
    <strong>Participant:</strong> ${participant.name}<br/>
    <strong>Email:</strong> ${participant.email || '—'}</p>
    ${buildEventDetailsHtml(event, null)}
    <p style="margin-top:16px;">This notification is sent to all super admins for visibility.</p>
  `;

  const results = await Promise.all(
    emails.map((email) => emailService.sendCustomEmail(email, subject, html, 'Admin'))
  );
  return { success: results.some((r) => r.success), count: results.filter((r) => r.success).length };
};

const enrichParticipantRows = async (rows) => {
  const exhibitorIds = [...new Set(rows.filter((r) => r.userType === 'exhibitor').map((r) => String(r.userId)))];
  const visitorIds = [...new Set(rows.filter((r) => r.userType === 'visitor').map((r) => String(r.userId)))];

  const [exhibitors, visitors] = await Promise.all([
    exhibitorIds.length ? Exhibitor.find({ _id: { $in: exhibitorIds } }).lean() : [],
    visitorIds.length ? Visitor.find({ _id: { $in: visitorIds } }).lean() : [],
  ]);

  const exMap = Object.fromEntries(exhibitors.map((e) => [String(e._id), e]));
  const visMap = Object.fromEntries(visitors.map((v) => [String(v._id), v]));

  return rows.map((r) => {
    const profile = r.userType === 'exhibitor' ? exMap[String(r.userId)] : visMap[String(r.userId)];
    return {
      ...r,
      approvalStatus: r.approvalStatus,
      name: r.userType === 'exhibitor' ? profile?.companyName || 'Exhibitor' : profile?.name || 'Visitor',
      email: profile?.email || '',
      phone: profile?.phone || '',
      companyName: profile?.companyName || '',
    };
  });
};

const paginateRows = (enriched, page, limit) => {
  const totalItems = enriched.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const start = (page - 1) * limit;
  return {
    items: enriched.slice(start, start + limit),
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    },
    summary: {
      total: totalItems,
      visitor: enriched.filter((r) => r.userType === 'visitor').length,
      exhibitor: enriched.filter((r) => r.userType === 'exhibitor').length,
    },
  };
};

const listRegistrationsByStatus = async (user, status, { eventId, userType, page = 1, limit = 20 } = {}) => {
  if (!APPROVAL_STATUSES.includes(status)) {
    throw Object.assign(new Error('Invalid approval status filter'), { status: 400 });
  }

  const eventQuery = { isDeleted: false };
  if (eventId) eventQuery._id = eventId;
  if (!isSuperAdmin(user)) {
    const userId = getAuthUserId(user);
    if (!userId) {
      throw Object.assign(new Error('Invalid user session'), { status: 401 });
    }
    eventQuery.$or = [{ organizerId: userId }, { createdByAdminId: userId }];
  }

  const events = await Event.find(eventQuery)
    .select(
      'title fromDate toDate startTime endTime location organizerId createdByAdminId exhibitor visitor'
    )
    .populate('organizerId', 'name email organizationName')
    .populate('createdByAdminId', 'name email')
    .lean();

  const rows = [];
  for (const event of events) {
    if (isEventRegistrationClosed(event)) continue;

    const collect = (participants, type) => {
      (participants || []).forEach((p) => {
        if (!p.userId) return;
        if (userType && userType !== type) return;
        const resolved = resolveApprovalStatus(p);
        if (resolved !== status) return;

        rows.push({
          eventId: event._id,
          eventTitle: event.title,
          eventFromDate: event.fromDate,
          eventToDate: event.toDate,
          eventLocation: event.location,
          organizerName:
            event.organizerId?.organizationName ||
            event.organizerId?.name ||
            event.createdByAdminId?.name ||
            'Admin',
          userId: p.userId,
          userType: type,
          participantId: p._id,
          registeredAt: p.registeredAt,
          approvalStatus: resolved,
          rejectedAt: p.rejectedAt,
          rejectedByName: p.rejectedByName,
          approvedAt: resolved === 'approved' ? p.registeredAt : undefined,
        });
      });
    };
    collect(event.exhibitor, 'exhibitor');
    collect(event.visitor, 'visitor');
  }

  rows.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
  const enriched = await enrichParticipantRows(rows);
  const { items, pagination, summary } = paginateRows(enriched, page, limit);

  return { items, summary, pagination };
};

const getPendingApprovals = async (user, filters) => {
  const { items, summary, pagination } = await listRegistrationsByStatus(user, 'pending', filters);
  return { pending: items, summary, pagination };
};

const getApprovedRegistrations = async (user, filters) => {
  const { items, summary, pagination } = await listRegistrationsByStatus(user, 'approved', filters);
  return { approved: items, summary, pagination };
};

const getRejectedRegistrations = async (user, filters) => {
  const { items, summary, pagination } = await listRegistrationsByStatus(user, 'rejected', filters);
  return { rejected: items, summary, pagination };
};

const processApproval = async (user, { eventId, userId, userType }) => {
  if (!['exhibitor', 'visitor'].includes(userType)) {
    throw Object.assign(new Error('Invalid user type'), { status: 400 });
  }

  const event = await Event.findById(eventId)
    .populate('organizerId', 'name email organizationName')
    .populate('createdByAdminId', 'name email');
  if (!event || event.isDeleted) {
    throw Object.assign(new Error('Event not found'), { status: 404 });
  }

  if (!canManageEvent(user, event)) {
    throw Object.assign(new Error('Unauthorized to approve participants for this event'), { status: 403 });
  }

  if (isEventRegistrationClosed(event)) {
    throw Object.assign(new Error('Cannot approve registrations for an ended event'), { status: 400 });
  }

  const participantArray = userType === 'exhibitor' ? event.exhibitor : event.visitor;
  const participant = participantArray.find((p) => p.userId.toString() === userId);
  if (!participant) {
    throw Object.assign(new Error(`${userType} not found in event`), { status: 404 });
  }

  const currentStatus = resolveApprovalStatus(participant);
  if (currentStatus === 'approved') {
    throw Object.assign(
      new Error(`${userType.charAt(0).toUpperCase() + userType.slice(1)} is already approved`),
      { status: 400 }
    );
  }
  if (currentStatus !== 'pending' && currentStatus !== 'rejected') {
    throw Object.assign(new Error('Only pending or rejected registrations can be approved'), {
      status: 400,
    });
  }

  participant.isVerified = true;
  participant.approvalStatus = 'approved';
  participant.rejectedAt = null;
  participant.rejectedBy = null;
  participant.rejectedByType = null;
  participant.rejectedByName = '';
  await event.save();

  const approver = await getApproverProfile(user);
  const profile = await getParticipantProfile(userId, userType);
  const organizer = event.organizerId;

  const confirmationResult = await sendParticipantConfirmationEmail(event, organizer, profile, userType);

  let organizerNotified = false;
  let adminsNotified = false;

  if (approver.type === 'superAdmin') {
    const orgNotify = await notifyOrganizerOfAdminApproval(event, organizer, profile, userType, approver);
    organizerNotified = orgNotify.success;
  } else {
    const adminNotify = await notifyAdminsOfOrganizerApproval(event, profile, userType, approver);
    adminsNotified = adminNotify.success;
  }

  await ApprovalLog.create({
    eventId: event._id,
    eventTitle: event.title,
    participantUserId: userId,
    participantType: userType,
    participantName: profile.name,
    participantEmail: profile.email,
    action: 'approved',
    approvedBy: user.id,
    approvedByType: approver.type,
    approvedByName: approver.name,
    approvedByEmail: approver.email,
    confirmationEmailSent: confirmationResult.success,
    organizerNotified,
    adminsNotified,
  });

  return {
    message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} approved successfully`,
    participant: {
      userId: participant.userId,
      isVerified: participant.isVerified,
      registeredAt: participant.registeredAt,
      qrCode: participant.qrCode,
    },
    notifications: {
      confirmationEmailSent: confirmationResult.success,
      organizerNotified,
      adminsNotified,
    },
  };
};

const sendParticipantRejectionEmail = async (event, participant, userType) => {
  if (!participant.email) {
    return { success: false, message: 'No participant email' };
  }
  const roleLabel = userType === 'exhibitor' ? 'Exhibitor' : 'Visitor';
  const subject = `Registration update — ${event.title}`;
  const html = `
    <p>Your <strong>${roleLabel}</strong> registration for <strong>${event.title}</strong> was not approved at this time.</p>
    <p>If you believe this was a mistake, please contact the event organizer.</p>
  `;
  return emailService.sendCustomEmail(participant.email, subject, html, participant.name);
};

const processRejection = async (user, { eventId, userId, userType, reason } = {}) => {
  if (!['exhibitor', 'visitor'].includes(userType)) {
    throw Object.assign(new Error('Invalid user type'), { status: 400 });
  }

  const event = await Event.findById(eventId);
  if (!event || event.isDeleted) {
    throw Object.assign(new Error('Event not found'), { status: 404 });
  }

  if (!canManageEvent(user, event)) {
    throw Object.assign(new Error('Unauthorized to reject participants for this event'), { status: 403 });
  }

  if (isEventRegistrationClosed(event)) {
    throw Object.assign(new Error('Cannot reject registrations for an ended event'), { status: 400 });
  }

  const participantArray = userType === 'exhibitor' ? event.exhibitor : event.visitor;
  const participant = participantArray.find((p) => p.userId.toString() === userId);
  if (!participant) {
    throw Object.assign(new Error(`${userType} not found in event`), { status: 404 });
  }

  const currentStatus = resolveApprovalStatus(participant);
  if (currentStatus === 'rejected') {
    throw Object.assign(
      new Error(`${userType.charAt(0).toUpperCase() + userType.slice(1)} is already rejected`),
      { status: 400 }
    );
  }
  if (currentStatus !== 'pending' && currentStatus !== 'approved') {
    throw Object.assign(new Error('Only pending or approved registrations can be rejected'), {
      status: 400,
    });
  }

  const rejector = await getApproverProfile(user);

  participant.isVerified = false;
  participant.approvalStatus = 'rejected';
  participant.rejectedAt = new Date();
  participant.rejectedBy = user.id;
  participant.rejectedByType = rejector.type;
  participant.rejectedByName = rejector.name;
  await event.save();

  const profile = await getParticipantProfile(userId, userType);
  const emailResult = await sendParticipantRejectionEmail(event, profile, userType);

  await ApprovalLog.create({
    eventId: event._id,
    eventTitle: event.title,
    participantUserId: userId,
    participantType: userType,
    participantName: profile.name,
    participantEmail: profile.email,
    action: 'rejected',
    approvedBy: user.id,
    approvedByType: rejector.type,
    approvedByName: rejector.name,
    approvedByEmail: rejector.email,
    rejectionReason: reason?.trim() || '',
    confirmationEmailSent: emailResult.success,
    organizerNotified: false,
    adminsNotified: false,
  });

  return {
    message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} rejected successfully`,
    participant: {
      userId: participant.userId,
      isVerified: participant.isVerified,
      approvalStatus: participant.approvalStatus,
      rejectedAt: participant.rejectedAt,
    },
    notifications: {
      rejectionEmailSent: emailResult.success,
    },
  };
};

const getApprovalHistory = async (user, { page = 1, limit = 10, eventId } = {}) => {
  const query = {};
  if (eventId) query.eventId = eventId;

  if (!isSuperAdmin(user)) {
    const events = await Event.find({
      isDeleted: false,
      $or: [{ organizerId: user.id }, { createdByAdminId: user.id }],
    }).select('_id');
    const eventIds = events.map((e) => e._id);
    query.eventId = eventId ? eventId : { $in: eventIds };
    if (eventId && !eventIds.some((id) => id.toString() === eventId)) {
      query.eventId = { $in: [] };
    }
  }

  const result = await ApprovalLog.paginate(query, {
    page,
    limit,
    sort: { createdAt: -1 },
    lean: true,
  });

  return {
    history: result.docs,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      totalItems: result.totalDocs,
      itemsPerPage: result.limit,
    },
  };
};

module.exports = {
  isSuperAdmin,
  resolveApprovalStatus,
  getPendingApprovals,
  getApprovedRegistrations,
  getRejectedRegistrations,
  processApproval,
  processRejection,
  getApprovalHistory,
};
