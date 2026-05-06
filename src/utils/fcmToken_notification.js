const firebase = require('../config/firebase');

exports.sendNotification = async (Token, messages) => {
  // messages is an array which has [title, body, data]
  
  // Validate token
  if (!Token || Token === '' || Token === 'undefined') {
    console.warn('⚠️  FCM: No valid token provided');
    return {
      message: 'No valid FCM token',
      error: 'Token is missing or invalid'
    };
  }

  // Get Firebase app instance
  const notificationApp = firebase.notification();
  
  if (!notificationApp) {
    console.error('❌ FCM: Firebase not initialized');
    return {
      message: 'Firebase not initialized',
      error: 'Firebase app is not available'
    };
  }

  // Prepare message payload
  const message = {
    token: Token.toString(),
    notification: {
      title: messages[0] || 'Notification',
      body: messages[1] || ''
    },
    data: messages[2] ? 
      // Convert all data values to strings (FCM requirement)
      Object.keys(messages[2]).reduce((acc, key) => {
        acc[key] = String(messages[2][key]);
        return acc;
      }, {}) 
      : {}
  };

  console.log('📤 Sending FCM notification:', {
    token: Token.substring(0, 20) + '...',
    title: message.notification.title,
    body: message.notification.body.substring(0, 50) + '...',
    dataKeys: Object.keys(message.data)
  });

  let result = {};
  try {
    // Send message using Firebase Admin SDK
    const res = await notificationApp.messaging().send(message);
    
    result.message = 'send successful';
    result.send = res;
    
    console.log('✅ FCM notification sent successfully:', res);
    return result;
    
  } catch (error) {
    result.message = 'oops! cannot send';
    result.error = error;
    
    console.error('❌ FCM notification failed:', {
      errorCode: error.code,
      errorMessage: error.message,
      token: Token.substring(0, 20) + '...'
    });
    
    // Log specific error types
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      console.error('⚠️  FCM: Invalid or expired token - user needs to re-login');
    }
    
    return result;
  }
};
