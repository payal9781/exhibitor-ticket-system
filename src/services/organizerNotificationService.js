const emailService = require('./emailService');
const whatsappService = require('./whatsappService');

const notifyOrganizerRegistrationPending = async ({ name, email, phone, organizationName }) => {
  const tasks = [
    emailService.sendOrganizerRegistrationPendingEmail(name, email, organizationName),
    whatsappService.sendOrganizerRegistrationPendingWhatsApp({ name, phone, organizationName }),
  ];

  const results = await Promise.allSettled(tasks);
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const channel = index === 0 ? 'email' : 'WhatsApp';
      console.error(`Organizer registration ${channel} notification failed:`, result.reason);
    }
  });
};

const notifyOrganizerAccountActivated = async ({ name, email, phone }) => {
  const tasks = [
    emailService.sendOrganizerAccountApprovedEmail(name, email),
    whatsappService.sendOrganizerAccountApprovedWhatsApp({ name, phone }),
  ];

  const results = await Promise.allSettled(tasks);
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const channel = index === 0 ? 'email' : 'WhatsApp';
      console.error(`Organizer activation ${channel} notification failed:`, result.reason);
    }
  });
};

module.exports = {
  notifyOrganizerRegistrationPending,
  notifyOrganizerAccountActivated,
};
