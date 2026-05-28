const { resolveApprovalStatus } = require('../services/approvalService');
const { isEventRegistrationClosed } = require('../utils/eventDateUtils');

function buildDateFilter(startDate, endDate) {
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }
  return dateFilter;
}

function computeEventStatus(event) {
  const now = new Date();
  const start = new Date(event.fromDate);
  const end = new Date(event.toDate);
  end.setHours(23, 59, 59, 999);
  if (now > end) return 'ended';
  if (now >= start && now <= end) return 'ongoing';
  return 'upcoming';
}

function summarizeEvent(event) {
  const status = computeEventStatus(event);
  let pendingApprovals = 0;
  if (!isEventRegistrationClosed(event)) {
    (event.exhibitor || []).forEach((p) => {
      if (p.userId && resolveApprovalStatus(p) === 'pending') pendingApprovals++;
    });
    (event.visitor || []).forEach((p) => {
      if (p.userId && resolveApprovalStatus(p) === 'pending') pendingApprovals++;
    });
  }

  const organizer =
    event.organizerId?.organizationName ||
    event.organizerId?.name ||
    event.createdByAdminId?.name ||
    '';

  return {
    _id: event._id,
    title: event.title,
    fromDate: event.fromDate,
    toDate: event.toDate,
    location: event.location || '',
    status,
    exhibitorCount: (event.exhibitor || []).filter((p) => p.userId).length,
    visitorCount: (event.visitor || []).filter((p) => p.userId).length,
    pendingApprovals,
    organizerName: organizer,
  };
}

function countPendingRegistrations(events) {
  let count = 0;
  for (const event of events) {
    if (isEventRegistrationClosed(event)) continue;
    (event.exhibitor || []).forEach((p) => {
      if (p.userId && resolveApprovalStatus(p) === 'pending') count++;
    });
    (event.visitor || []).forEach((p) => {
      if (p.userId && resolveApprovalStatus(p) === 'pending') count++;
    });
  }
  return count;
}

function getRunningAndRecentEvents(events, { runningLimit = 6, recentLimit = 6 } = {}) {
  const summaries = events
    .filter((e) => e && !e.isDeleted && e.isActive !== false)
    .map((e) => summarizeEvent(e));

  const runningEvents = summaries
    .filter((e) => e.status === 'ongoing')
    .sort((a, b) => new Date(a.fromDate) - new Date(b.fromDate))
    .slice(0, runningLimit);

  const now = new Date();
  const recentCutoff = new Date(now);
  recentCutoff.setDate(recentCutoff.getDate() - 14);

  const recentEvents = summaries
    .filter((e) => {
      if (e.status === 'ongoing') return false;
      if (e.status === 'upcoming') return true;
      const end = new Date(e.toDate);
      end.setHours(23, 59, 59, 999);
      return e.status === 'ended' && end >= recentCutoff;
    })
    .sort((a, b) => {
      const order = { upcoming: 0, ended: 1 };
      const statusDiff = (order[a.status] ?? 2) - (order[b.status] ?? 2);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.fromDate) - new Date(a.fromDate);
    })
    .slice(0, recentLimit);

  return { runningEvents, recentEvents };
}

module.exports = {
  buildDateFilter,
  computeEventStatus,
  summarizeEvent,
  countPendingRegistrations,
  getRunningAndRecentEvents,
};
