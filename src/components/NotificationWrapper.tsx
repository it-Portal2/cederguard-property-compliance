import React, { useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../lib/firebase';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { isDesktop } from '../lib/desktop/isDesktop';

export const NotificationWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setFcmToken, addNotification, setNotifications } = useStore();

  useEffect(() => {
    // FCM requires a service worker, which doesn't run in Electron's
    // file:// renderer. Desktop relies on toast notifications only.
    if (isDesktop) return;
    if (!user || !messaging) return;

    const setupNotifications = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Note: In a real production app, the VAPID key should be in an environment variable.
          // Using a placeholder for now.
          const currentToken = await getToken(messaging, {
            vapidKey: 'BCmYtH_q8-H2f4m6Z-9uCq7hFv5E5M-wLx4R-R-S-M-E-L-O-V-E-R-I-S-K' // Placeholder
          }).catch(err => {
            console.warn('FCM Token generation failed. Probably missing valid VAPID key.', err);
            return null;
          });
          
          if (currentToken) {
            setFcmToken(currentToken);
          }
        }

        // Load existing notifications
        const res = await api.getData('notifications');
        if (res && res.data) {
          setNotifications(res.data);
        }

        // Listen for foreground messages
        const unsubscribe = onMessage(messaging, (payload) => {
          if (payload.notification) {
            addNotification({
              title: payload.notification.title || 'New Notification',
              body: payload.notification.body || '',
              type: (payload.data?.type as any) || 'system',
              link: payload.data?.link
            });
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    const setup = setupNotifications();
    return () => {
      setup.then(unsubscribe => typeof unsubscribe === 'function' && unsubscribe());
    };
  }, [user]);

  return <>{children}</>;
};
