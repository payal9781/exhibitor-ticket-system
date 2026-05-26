const crypto = require('crypto');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const Organizer = require('../models/Organizer');
const Event = require('../models/Event');
const UserEventSlot = require('../models/UserEventSlot');
const generateSlots = require('../utils/slotGenerator');
const { buildAddedByFromRequest } = require('../utils/addedByHelper');
const axios = require('axios');

const isSuperAdmin = (user) =>
  user?.type === 'superAdmin' || user?.type === 'superadmin';

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

const attachToEvent = async (event, participantId, userType, reqOrUser) => {
  const req = reqOrUser?.user ? reqOrUser : { user: reqOrUser };
  const reqUser = req.user;
  if (reqUser.type === 'organizer' && event.organizerId?.toString() !== reqUser.id) {
    throw Object.assign(new Error('Access denied for this event'), { status: 403 });
  }

  const array = userType === 'exhibitor' ? event.exhibitor : event.visitor;
  if (array.some((p) => p.userId.toString() === participantId.toString())) {
    return { alreadyInEvent: true };
  }

  const qrCode = await require('../utils/qrGenerator')({
    eventId: event._id,
    userId: participantId,
    userType,
    startDate: event.fromDate,
    endDate: event.toDate,
    eventTitle: event.title,
  });

  const addedBy = await buildAddedByFromRequest(req);

  array.push({
    userId: participantId,
    qrCode,
    registeredAt: new Date(),
    isVerified: true,
    approvalStatus: 'approved',
    addedBy,
  });

  await event.save();

  const existingSlots = await UserEventSlot.findOne({
    userId: participantId,
    userType,
    eventId: event._id,
  });

  if (!existingSlots) {
    const rawSlots = generateSlots(
      event.fromDate,
      event.toDate,
      event.meetingStartTime || event.startTime,
      event.meetingEndTime || event.endTime,
      event.timeInterval || 30
    );
    await UserEventSlot.create({
      userId: participantId,
      userType,
      eventId: event._id,
      slots: rawSlots.map((s) => ({ ...s, status: 'available', showSlots: false })),
    });
  }

  return { alreadyInEvent: false };
};

const createDigitalCard = async (payload) => {
  try {
    const result = await axios.post(
      'https://digitalcard.co.in/web/create-account/mobile',
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );
    return result.data?.data?.path || '';
  } catch {
    return '';
  }
};

const bulkImportExhibitors = async (user, { rows = [], eventId } = {}) => {
  const results = { created: 0, skipped: 0, failed: 0, errors: [] };
  let event = null;

  if (eventId && eventId !== 'none') {
    event = await Event.findById(eventId);
    if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
    if (!event.isActive) throw Object.assign(new Error('Cannot import to inactive event'), { status: 400 });
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    try {
      const companyName = String(row.companyName || '').trim();
      const phone = normalizePhone(row.phone);
      const email = String(row.email || '').trim().toLowerCase();

      if (!companyName) {
        results.failed++;
        results.errors.push({ row: rowNum, message: 'Company name is required' });
        continue;
      }
      if (phone.length !== 10) {
        results.failed++;
        results.errors.push({ row: rowNum, message: 'Phone must be 10 digits' });
        continue;
      }

      let existing = await Exhibitor.findOne({ phone, isDeleted: false });
      if (!existing && email) {
        existing = await Exhibitor.findOne({ email, isDeleted: false });
      }

      if (existing) {
        results.skipped++;
        if (event) {
          try {
            await attachToEvent(event, existing._id, 'exhibitor', user);
          } catch (err) {
            results.errors.push({ row: rowNum, message: err.message });
          }
        }
        continue;
      }

      const exhibitor = new Exhibitor({
        companyName,
        phone,
        email: email || undefined,
        website: row.website || '',
        Sector: row.Sector || row.sector || '',
        bio: row.bio || '',
        keyWords: row.keyWords
          ? String(row.keyWords)
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean)
          : [],
        isActive: true,
      });

      const digitalProfile = await createDigitalCard({
        name: companyName,
        email: exhibitor.email || '',
        mobile: phone,
        businessKeyword: 'Event Exhibitor',
        originId: '67ca6934c15747af04fff36c',
        countryCode: '91',
      });
      if (digitalProfile) exhibitor.digitalProfile = digitalProfile;

      await exhibitor.save();
      results.created++;

      if (event) {
        await attachToEvent(event, exhibitor._id, 'exhibitor', user);
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ row: rowNum, message: err.message || 'Import failed' });
    }
  }

  return results;
};

const bulkImportVisitors = async (user, { rows = [], eventId } = {}) => {
  const results = { created: 0, skipped: 0, failed: 0, errors: [] };
  let event = null;

  if (eventId && eventId !== 'none') {
    event = await Event.findById(eventId);
    if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
    if (!event.isActive) throw Object.assign(new Error('Cannot import to inactive event'), { status: 400 });
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    try {
      const name = String(row.name || '').trim();
      const phone = normalizePhone(row.phone);
      const email = String(row.email || '').trim().toLowerCase();

      if (!name) {
        results.failed++;
        results.errors.push({ row: rowNum, message: 'Name is required' });
        continue;
      }
      if (phone.length !== 10) {
        results.failed++;
        results.errors.push({ row: rowNum, message: 'Phone must be 10 digits' });
        continue;
      }

      const existing = await Visitor.findOne({ phone, isDeleted: false });
      if (existing) {
        results.skipped++;
        if (event) {
          try {
            await attachToEvent(event, existing._id, 'visitor', user);
          } catch (err) {
            results.errors.push({ row: rowNum, message: err.message });
          }
        }
        continue;
      }

      const visitor = new Visitor({
        name,
        phone,
        email: email || undefined,
        companyName: row.companyName || '',
        website: row.website || '',
        Sector: row.Sector || row.sector || '',
        bio: row.bio || '',
        isActive: true,
      });

      const digitalProfile = await createDigitalCard({
        name,
        email: visitor.email || '',
        mobile: phone,
        businessKeyword: 'Event Visitor',
        originId: '67ca6934c15747af04fff36c',
        countryCode: '91',
      });
      if (digitalProfile) visitor.digitalProfile = digitalProfile;

      await visitor.save();
      results.created++;

      if (event) {
        await attachToEvent(event, visitor._id, 'visitor', user);
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ row: rowNum, message: err.message || 'Import failed' });
    }
  }

  return results;
};

const bulkImportOrganizers = async ({ rows = [], defaultPassword } = {}) => {
  const results = { created: 0, skipped: 0, failed: 0, errors: [] };
  const fallbackPassword =
    defaultPassword && String(defaultPassword).length >= 8
      ? String(defaultPassword)
      : `Org@${crypto.randomBytes(4).toString('hex')}`;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    try {
      let fn = String(row.firstName || '').trim();
      let ln = String(row.lastName || '').trim();
      const email = String(row.email || '').trim().toLowerCase();
      const company = String(row.company || row.organizationName || '').trim();
      const phone = row.phone ? normalizePhone(row.phone) : '';
      const password = String(row.password || '').trim() || fallbackPassword;

      if ((!fn || !ln) && row.name) {
        const parts = String(row.name).trim().split(/\s+/);
        if (!fn) fn = parts[0];
        if (!ln) ln = parts.slice(1).join(' ') || parts[0];
      }

      if (!fn || !ln) {
        results.failed++;
        results.errors.push({ row: rowNum, message: 'First and last name are required' });
        continue;
      }
      if (!email) {
        results.failed++;
        results.errors.push({ row: rowNum, message: 'Email is required' });
        continue;
      }
      if (!company) {
        results.failed++;
        results.errors.push({ row: rowNum, message: 'Company is required' });
        continue;
      }
      if (password.length < 8) {
        results.failed++;
        results.errors.push({ row: rowNum, message: 'Password must be at least 8 characters' });
        continue;
      }

      const existing = await Organizer.findOne({
        $or: [{ email, isDeleted: false }, ...(phone ? [{ phone, isDeleted: false }] : [])],
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      const organizer = new Organizer({
        name: `${fn} ${ln}`,
        email,
        password,
        phone: phone || undefined,
        organizationName: company,
        isActive: row.isActive !== false && row.isActive !== 'false',
      });

      await organizer.save();
      results.created++;
    } catch (err) {
      results.failed++;
      results.errors.push({ row: rowNum, message: err.message || 'Import failed' });
    }
  }

  return results;
};

module.exports = {
  bulkImportExhibitors,
  bulkImportVisitors,
  bulkImportOrganizers,
};
