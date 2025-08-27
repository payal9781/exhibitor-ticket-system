const firebase = require('firebase-admin');

var notificationAcc = require('../../testing-4b090-firebase-adminsdk-fbsvc-ed05361c31.json').notification;

const notification = () => {
  return firebase.initializeApp(
    {
      credential: firebase.credential.cert(notificationAcc)
    },
    'notification'
  );
};

module.exports = { notification };
