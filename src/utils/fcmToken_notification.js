const firebase = require('../core/firebase');
const notification = firebase.notification();

exports.sendNotification = async (Token, messages) => {
  //messages is an array which has title and body
  let message = {
    token: Token.toString(),
    notification: {
      title: messages[0],
      body: messages[1]
    },
    data: messages[2] ? messages[2] : {}
  };
  let result = {};
  try {
    const res = await notification.messaging().send(message);
    result.message = 'send successfull';
    result.send = res;
    return result;
  } catch (error) {
    result.message = 'oops! cannot send';
    result.error = error;
    return result;
  }
};
