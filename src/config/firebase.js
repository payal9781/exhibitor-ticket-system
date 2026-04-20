const firebase = require('firebase-admin');

let notificationAcc;
try {
  notificationAcc = require('../../testing-4b090-firebase-adminsdk-fbsvc-ec4854046e.json').notification;
} catch (error) {
  console.warn('WARNING: Firebase service account file missing. Push notifications will be disabled.');
}

const notification = () => {
  if (!notificationAcc) {
    console.warn('Skipping Firebase initialization: missing credentials.');
    return null;
  }
  return firebase.initializeApp(
    {
      credential: firebase.credential.cert(notificationAcc)
    },
    'notification'
  );
};

module.exports = { notification };
