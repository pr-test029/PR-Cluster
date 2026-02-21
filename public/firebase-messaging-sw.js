importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCNbuzJPStroRQpetbc-wF7VBKR-Qdu4Qo",
    authDomain: "pr-connexion-app-123.firebaseapp.com",
    projectId: "pr-connexion-app-123",
    storageBucket: "pr-connexion-app-123.firebasestorage.app",
    messagingSenderId: "1088483110910",
    appId: "1:1088483110910:web:a9c3c0f6556fe6b2411aaf"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.ico'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
