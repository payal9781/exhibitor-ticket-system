const WAPLOY_BASE_URL = process.env.WAPLOY_BASE_URL || 'https://wapploy.itfuturz.cloud/v1';
const WAPLOY_SEND_URL = `${WAPLOY_BASE_URL}/messages/send`;

const getFrontendUrls = () => {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return {
    webUrl: base,
    loginUrl: `${base}/login`,
  };
};

/**
 * Normalize Indian mobile numbers to international format (91XXXXXXXXXX).
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits.length >= 10 ? digits : null;
};

const logWhatsAppResult = (to, result) => {
  if (result.success) {
    const batchInfo = result.batchId ? ` (batchId: ${result.batchId})` : '';
    console.log(`WhatsApp message sent to ${to}${batchInfo}`);
    return;
  }

  const reason = result.reason || result.error || 'unknown error';
  console.log(`WhatsApp message not sent${to ? ` to ${to}` : ''}: ${reason}`);
};

const sendWhatsAppMessages = async (messages = []) => {
  const apiKey = process.env.WAPLOY_KEY;

  if (!apiKey) {
    const result = { success: false, reason: 'WAPLOY_KEY not configured' };
    logWhatsAppResult(null, result);
    return result;
  }

  const payload = messages
    .filter((msg) => msg?.to && msg?.text)
    .map(({ to, text }) => ({ to, text }));

  if (!payload.length) {
    const result = { success: false, reason: 'no valid recipient' };
    logWhatsAppResult(null, result);
    return result;
  }

  const body = { messages: payload };
  if (process.env.WAPLOY_SESSION_ID) {
    body.sessionId = process.env.WAPLOY_SESSION_ID;
  }

  const recipient = payload[0].to;

  try {
    const response = await fetch(WAPLOY_SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    // API returns 202 Accepted with batchId when queued successfully
    if (response.status === 202 || response.ok) {
      const result = {
        success: true,
        batchId: data.batchId,
        data,
      };
      logWhatsAppResult(recipient, result);
      return result;
    }

    const apiMessage = data?.message || data?.error || `HTTP ${response.status}`;
    const result = { success: false, reason: apiMessage, data };
    logWhatsAppResult(recipient, result);
    return result;
  } catch (error) {
    const result = { success: false, reason: error.message };
    logWhatsAppResult(recipient, result);
    return result;
  }
};

const sendOrganizerRegistrationPendingWhatsApp = async ({ name, phone, organizationName }) => {
  const to = normalizePhone(phone);
  if (!to) {
    const result = { success: false, reason: 'invalid phone number' };
    logWhatsAppResult(phone || null, result);
    return result;
  }

  const { webUrl, loginUrl } = getFrontendUrls();
  const orgLabel = organizationName?.trim() || 'your organization';
  const text = `Hello ${name || 'there'}!

Thank you for registering as an organizer on *Planora*.

*Organization:* ${orgLabel}

Your account is currently *pending approval*. Our admin team will review your registration shortly.

You will receive another WhatsApp message and email once your account is activated.

*Planora Web:* ${webUrl}
*Login (after approval):* ${loginUrl}

Thank you,
*Planora Team*`;

  return sendWhatsAppMessages([{ to, text }]);
};

const sendOrganizerAccountApprovedWhatsApp = async ({ name, phone }) => {
  const to = normalizePhone(phone);
  if (!to) {
    const result = { success: false, reason: 'invalid phone number' };
    logWhatsAppResult(phone || null, result);
    return result;
  }

  const { webUrl, loginUrl } = getFrontendUrls();

  const text = `Hello ${name || 'there'}!

Great news! Your *Planora* organizer account has been *approved and activated*.

You can now sign in and start managing your events.

*Planora Web:* ${webUrl}
*Login:* ${loginUrl}

Welcome aboard!
*Planora Team*`;

  return sendWhatsAppMessages([{ to, text }]);
};

module.exports = {
  normalizePhone,
  sendWhatsAppMessages,
  sendOrganizerRegistrationPendingWhatsApp,
  sendOrganizerAccountApprovedWhatsApp,
};
