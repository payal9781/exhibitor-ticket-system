const { models } = require('../models/z-index');
const emailService = require('./emailService');
const firebase = require('../config/firebase');

const VALID_AUDIENCE = ['exhibitor', 'visitor', 'organizer'];
const VALID_CHANNELS = ['email', 'push', 'both'];

const getDisplayName = (user, type) => {
  if (type === 'exhibitor') return user.companyName || user.email || user.phone || 'Exhibitor';
  if (type === 'visitor') return user.name || user.email || user.phone || 'Visitor';
  return user.name || user.email || 'Organizer';
};

const isValidFcmToken = (token) =>
  token && typeof token === 'string' && token.trim() && token !== 'undefined';

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value._id) return value._id;
  return value;
};

const buildSearchQuery = (search, fields) => {
  const term = search?.trim();
  if (!term) return {};
  const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
};

class NotificationBroadcastService {
  async resolveSelectedRecipients({ selectedRecipients = [] }) {
    if (!Array.isArray(selectedRecipients) || !selectedRecipients.length) {
      return {
        recipients: [],
        counts: { exhibitor: 0, visitor: 0, organizer: 0, total: 0 },
        withEmail: 0,
        withFcm: 0,
        eventTitle: null,
      };
    }

    const grouped = { exhibitor: [], visitor: [], organizer: [] };
    selectedRecipients.forEach((entry) => {
      const userType = entry?.userType;
      const id = normalizeId(entry?.id || entry?._id);
      if (!id || !VALID_AUDIENCE.includes(userType)) return;
      if (!grouped[userType].some((existing) => String(existing) === String(id))) {
        grouped[userType].push(id);
      }
    });

    const recipients = [];
    const counts = { exhibitor: 0, visitor: 0, organizer: 0, total: 0 };

    const fetchType = async (userType, Model) => {
      const ids = grouped[userType];
      if (!ids.length) return;
      const users = await Model.find({
        _id: { $in: ids },
        isDeleted: false,
        isActive: true,
      });
      counts[userType] = users.length;
      users.forEach((user) => {
        recipients.push({
          _id: user._id,
          userType,
          name: getDisplayName(user, userType),
          email: user.email || '',
          fcmToken: user.fcmToken || '',
        });
      });
    };

    await fetchType('exhibitor', models.Exhibitor);
    await fetchType('visitor', models.Visitor);
    await fetchType('organizer', models.Organizer);

    counts.total = recipients.length;
    const withEmail = recipients.filter((r) => r.email?.trim()).length;
    const withFcm = recipients.filter((r) => isValidFcmToken(r.fcmToken)).length;

    return { recipients, counts, withEmail, withFcm, eventTitle: null };
  }

  async searchRecipients({
    userType,
    search = '',
    eventId = null,
    page = 1,
    limit = 20,
  }) {
    if (!VALID_AUDIENCE.includes(userType)) {
      throw new Error('Invalid user type');
    }

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const skip = (parsedPage - 1) * parsedLimit;

    let query = { isDeleted: false, isActive: true };
    let Model = models.Exhibitor;
    let nameFields = ['companyName', 'email', 'phone'];

    if (userType === 'visitor') {
      Model = models.Visitor;
      nameFields = ['name', 'email', 'phone', 'companyName'];
    } else if (userType === 'organizer') {
      Model = models.Organizer;
      nameFields = ['name', 'email', 'organizationName', 'phone'];
    }

    Object.assign(query, buildSearchQuery(search, nameFields));

    if (eventId && userType !== 'organizer') {
      const event = await models.Event.findById(eventId).select('title exhibitor visitor organizerId');
      if (!event) {
        throw new Error('Event not found');
      }
      if (userType === 'exhibitor') {
        const ids = event.exhibitor.map((e) => normalizeId(e.userId)).filter(Boolean);
        query._id = { $in: ids };
      } else {
        const ids = event.visitor.map((v) => normalizeId(v.userId)).filter(Boolean);
        query._id = { $in: ids };
      }
    } else if (eventId && userType === 'organizer') {
      const event = await models.Event.findById(eventId).select('organizerId');
      if (!event) {
        throw new Error('Event not found');
      }
      query._id = normalizeId(event.organizerId);
    }

    const [users, total] = await Promise.all([
      Model.find(query)
        .select('name companyName email phone fcmToken organizationName')
        .sort(userType === 'exhibitor' ? { companyName: 1 } : { name: 1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      Model.countDocuments(query),
    ]);

    return {
      users: users.map((user) => ({
        _id: user._id,
        userType,
        name: getDisplayName(user, userType),
        email: user.email || '',
        hasEmail: Boolean(user.email?.trim()),
        hasFcm: isValidFcmToken(user.fcmToken),
      })),
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit) || 1,
      },
    };
  }

  async resolveRecipients({ audienceTypes = [], eventId = null, recipientMode, selectedRecipients }) {
    if (recipientMode === 'selected') {
      return this.resolveSelectedRecipients({ selectedRecipients });
    }
    const types = audienceTypes.filter((t) => VALID_AUDIENCE.includes(t));
    const recipients = [];

    if (!types.length) {
      return { recipients: [], counts: { exhibitor: 0, visitor: 0, organizer: 0, total: 0 } };
    }

    let event = null;
    if (eventId) {
      event = await models.Event.findById(eventId).select('title organizerId exhibitor visitor');
      if (!event) {
        throw new Error('Event not found');
      }
    }

    const addUsers = (users, userType) => {
      users.forEach((user) => {
        recipients.push({
          _id: user._id,
          userType,
          name: getDisplayName(user, userType),
          email: user.email || '',
          fcmToken: user.fcmToken || '',
        });
      });
    };

    const counts = { exhibitor: 0, visitor: 0, organizer: 0, total: 0 };

    if (types.includes('exhibitor')) {
      let exhibitors;
      if (event) {
        const ids = event.exhibitor.map((e) => normalizeId(e.userId)).filter(Boolean);
        exhibitors = await models.Exhibitor.find({
          _id: { $in: ids },
          isDeleted: false,
          isActive: true,
        });
      } else {
        exhibitors = await models.Exhibitor.find({ isDeleted: false, isActive: true });
      }
      counts.exhibitor = exhibitors.length;
      addUsers(exhibitors, 'exhibitor');
    }

    if (types.includes('visitor')) {
      let visitors;
      if (event) {
        const ids = event.visitor.map((v) => normalizeId(v.userId)).filter(Boolean);
        visitors = await models.Visitor.find({
          _id: { $in: ids },
          isDeleted: false,
          isActive: true,
        });
      } else {
        visitors = await models.Visitor.find({ isDeleted: false, isActive: true });
      }
      counts.visitor = visitors.length;
      addUsers(visitors, 'visitor');
    }

    if (types.includes('organizer')) {
      let organizers;
      if (event) {
        organizers = await models.Organizer.find({
          _id: event.organizerId,
          isDeleted: false,
          isActive: true,
        });
      } else {
        organizers = await models.Organizer.find({ isDeleted: false, isActive: true });
      }
      counts.organizer = organizers.length;
      addUsers(organizers, 'organizer');
    }

    counts.total = recipients.length;

    const withEmail = recipients.filter((r) => r.email && r.email.trim()).length;
    const withFcm = recipients.filter((r) => isValidFcmToken(r.fcmToken)).length;

    return {
      recipients,
      counts,
      withEmail,
      withFcm,
      eventTitle: event?.title || null,
    };
  }

  async previewRecipients(payload) {
    const result = await this.resolveRecipients(payload);
    return {
      counts: result.counts,
      withEmail: result.withEmail,
      withFcm: result.withFcm,
      eventTitle: result.eventTitle,
      targetMode: payload.recipientMode === 'selected' ? 'selected' : 'broadcast',
    };
  }

  async sendPushBatch(tokens, title, body, data = {}) {
    const app = firebase.notification();
    if (!app) {
      return { sent: 0, failed: tokens.length, error: 'Firebase not initialized' };
    }

    if (!tokens.length) {
      return { sent: 0, failed: 0 };
    }

    const stringData = Object.keys(data).reduce((acc, key) => {
      acc[key] = String(data[key]);
      return acc;
    }, {});

    stringData.type = 'admin_broadcast';

    try {
      const response = await app.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: stringData,
      });

      return {
        sent: response.successCount,
        failed: response.failureCount,
      };
    } catch (error) {
      console.error('[Broadcast] FCM batch error:', error);
      return { sent: 0, failed: tokens.length, error: error.message };
    }
  }

  async sendBroadcast({
    channel,
    audienceTypes,
    eventId,
    recipientMode,
    selectedRecipients,
    title,
    body,
    emailSubject,
    emailBody,
    sentBy,
    sentByName,
  }) {
    if (!VALID_CHANNELS.includes(channel)) {
      throw new Error('Invalid notification channel');
    }

    if (!title?.trim()) {
      throw new Error('Title is required');
    }

    const needsEmail = channel === 'email' || channel === 'both';
    const needsPush = channel === 'push' || channel === 'both';

    if (needsEmail && !emailSubject?.trim()) {
      throw new Error('Email subject is required for email notifications');
    }

    const isSelectedMode = recipientMode === 'selected';

    if (isSelectedMode) {
      if (!Array.isArray(selectedRecipients) || !selectedRecipients.length) {
        throw new Error('Select at least one recipient');
      }
    } else if (!Array.isArray(audienceTypes) || !audienceTypes.length) {
      throw new Error('Select at least one audience type');
    }

    const { recipients, eventTitle } = await this.resolveRecipients({
      audienceTypes,
      eventId,
      recipientMode,
      selectedRecipients,
    });

    if (!recipients.length) {
      throw new Error(
        isSelectedMode
          ? 'No valid recipients found for your selection'
          : 'No recipients found for the selected audience'
      );
    }

    const loggedAudienceTypes = isSelectedMode
      ? [...new Set(recipients.map((r) => r.userType))]
      : audienceTypes;

    const stats = {
      totalRecipients: recipients.length,
      emailSent: 0,
      emailFailed: 0,
      emailSkipped: 0,
      pushSent: 0,
      pushFailed: 0,
      pushSkipped: 0,
    };

    const emailHtml =
      emailBody?.trim() ||
      `<p>${(body || title).replace(/\n/g, '<br>')}</p>`;

    if (needsEmail) {
      for (const recipient of recipients) {
        if (!recipient.email?.trim()) {
          stats.emailSkipped += 1;
          continue;
        }

        const result = await emailService.sendCustomEmail(
          recipient.email,
          emailSubject,
          emailHtml,
          recipient.name
        );

        if (result.success) {
          stats.emailSent += 1;
        } else {
          stats.emailFailed += 1;
        }
      }
    }

    if (needsPush) {
      const pushRecipients = recipients.filter((r) => {
        if (r.userType === 'organizer') {
          stats.pushSkipped += 1;
          return false;
        }
        if (!isValidFcmToken(r.fcmToken)) {
          stats.pushSkipped += 1;
          return false;
        }
        return true;
      });

      const tokens = [...new Set(pushRecipients.map((r) => r.fcmToken.trim()))];
      const batchSize = 500;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        const result = await this.sendPushBatch(batch, title, body || title, {
          eventId: eventId ? String(eventId) : '',
        });
        stats.pushSent += result.sent || 0;
        stats.pushFailed += result.failed || 0;
      }

      for (const recipient of pushRecipients) {
        try {
          await models.Notification.create({
            recipientId: recipient._id,
            recipientType: recipient.userType,
            type: 'other',
            title,
            message: body || title,
            data: { source: 'admin_broadcast', eventId: eventId || null },
          });
        } catch (err) {
          console.error('[Broadcast] Failed to save in-app notification:', err.message);
        }
      }
    }

    let status = 'completed';

    if (needsEmail && stats.emailSent === 0 && stats.emailFailed === 0 && stats.emailSkipped > 0) {
      status = 'failed';
    } else if (needsPush && stats.pushSent === 0 && stats.pushFailed === 0 && stats.pushSkipped > 0) {
      status = 'failed';
    } else if (stats.emailFailed > 0 || stats.pushFailed > 0) {
      status = stats.emailSent > 0 || stats.pushSent > 0 ? 'partial' : 'failed';
    }

    const log = await models.AdminNotificationLog.create({
      title,
      body: body || '',
      emailSubject: emailSubject || '',
      channel,
      targetMode: isSelectedMode ? 'selected' : 'broadcast',
      audienceTypes: loggedAudienceTypes,
      selectedRecipientCount: isSelectedMode ? selectedRecipients.length : 0,
      eventId: eventId || null,
      eventTitle: eventTitle || '',
      sentBy,
      sentByName: sentByName || 'Super Admin',
      stats,
      status,
    });

    return { log, stats, status };
  }
}

module.exports = new NotificationBroadcastService();
