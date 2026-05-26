const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const Organizer = require('../models/Organizer');
const Superadmin = require('../models/Superadmin');
const ApprovalLog = require('../models/ApprovalLog');
const emailService = require('./emailService');

const isSuperAdmin = (user) =>
  user?.type === 'superAdmin' || user?.type === 'superadmin';

const canManageEvent = (user, event) =>
  isSuperAdmin(user) ||
  event.organizerId?.toString() === user?.id?.toString() ||
  event.createdByAdminId?.toString() === user?.id?.toString();

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

const getPendingApprovals = async (user, { eventId, userType, page = 1, limit = 20 } = {}) => {
  const eventQuery = { isDeleted: false };
  if (eventId) eventQuery._id = eventId;
  if (!isSuperAdmin(user)) {
    eventQuery.$or = [
      { organizerId: user.id },
      { createdByAdminId: user.id },
    ];
  }

  const events = await Event.find(eventQuery)
    .select('title fromDate toDate startTime endTime location organizerId createdByAdminId exhibitor visitor')
    .populate('organizerId', 'name email organizationName')
    .populate('createdByAdminId', 'name email')
    .lean();

  const rows = [];
  for (const event of events) {
    const pushPending = (participants, type) => {
      (participants || [])
        .filter((p) => p.isVerified !== true && p.userId)
        .forEach((p) => {
          if (userType && userType !== type) return;
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
          });
        });
    };
    pushPending(event.exhibitor, 'exhibitor');
    pushPending(event.visitor, 'visitor');
  }

  rows.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

  const exhibitorIds = [...new Set(rows.filter((r) => r.userType === 'exhibitor').map((r) => String(r.userId)))];
  const visitorIds = [...new Set(rows.filter((r) => r.userType === 'visitor').map((r) => String(r.userId)))];

  const [exhibitors, visitors] = await Promise.all([
    exhibitorIds.length ? Exhibitor.find({ _id: { $in: exhibitorIds } }).lean() : [],
    visitorIds.length ? Visitor.find({ _id: { $in: visitorIds } }).lean() : [],
  ]);

  const exMap = Object.fromEntries(exhibitors.map((e) => [String(e._id), e]));
  const visMap = Object.fromEntries(visitors.map((v) => [String(v._id), v]));

  const enriched = rows.map((r) => {
    const profile = r.userType === 'exhibitor' ? exMap[String(r.userId)] : visMap[String(r.userId)];
    return {
      ...r,
      name: r.userType === 'exhibitor' ? profile?.companyName || 'Exhibitor' : profile?.name || 'Visitor',
      email: profile?.email || '',
      phone: profile?.phone || '',
      companyName: profile?.companyName || '',
    };
  });

  const totalItems = enriched.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const start = (page - 1) * limit;
  const pending = enriched.slice(start, start + limit);

  const visitorCount = enriched.filter((r) => r.userType === 'visitor').length;
  const exhibitorCount = enriched.filter((r) => r.userType === 'exhibitor').length;

  return {
    pending,
    summary: { total: totalItems, visitor: visitorCount, exhibitor: exhibitorCount },
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    },
  };
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

  const participantArray = userType === 'exhibitor' ? event.exhibitor : event.visitor;
  const participant = participantArray.find((p) => p.userId.toString() === userId);
  if (!participant) {
    throw Object.assign(new Error(`${userType} not found in event`), { status: 404 });
  }

  if (participant.isVerified) {
    return {
      message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} is already verified`,
      alreadyVerified: true,
    };
  }

  participant.isVerified = true;
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
  getPendingApprovals,
  processApproval,
  getApprovalHistory,
};
