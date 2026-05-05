const firebase = require('firebase-admin');

let serviceAccount;
try {
  // Try to load the new Planora service account
  serviceAccount = require('../../planora-firebase-service-account.json');
  console.log('✅ Firebase service account loaded successfully');
} catch (error) {
  console.warn('⚠️  WARNING: Firebase service account file missing. Push notifications will be disabled.');
  console.warn('Expected file: planora-firebase-service-account.json');
}

const notification = () => {
  if (!serviceAccount) {
    console.warn('⚠️  Skipping Firebase initialization: missing credentials.');
    return null;
  }
  
  try {
    // Check if already initialized
    if (firebase.apps.length > 0) {
      console.log('ℹ️  Firebase already initialized, using existing instance');
      return firebase.app('notification');
    }
    
    const app = firebase.initializeApp(
      {
        credential: firebase.credential.cert(serviceAccount)
      },
      'notification'
    );
    
    console.log('✅ Firebase initialized successfully for project:', serviceAccount.project_id);
    return app;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    return null;
  }
};

module.exports = { notification };
