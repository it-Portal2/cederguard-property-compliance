// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCDV1FvrJe3hW1VQoyUFb8yh1TRAV1T6OQ",
  authDomain: "cedar-risk-compliance-suite.firebaseapp.com",
  projectId: "cedar-risk-compliance-suite",
  storageBucket: "cedar-risk-compliance-suite.firebasestorage.app",
  messagingSenderId: "63265176715",
  appId: "1:63265176715:web:a17405dcbb8280f917a88e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/cedar-logo.png' // Make sure this exists or use a default
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
