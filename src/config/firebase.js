const firebase = require('firebase-admin');

var notificationAcc = require('../../testing-4b090-firebase-adminsdk-fbsvc-ec4854046e.json').notification;

const notification = () => {
  return firebase.initializeApp(
    {
      credential: firebase.credential.cert(notificationAcc)
    },
    'notification'
  );
};

module.exports = { notification };
