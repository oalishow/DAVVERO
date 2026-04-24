import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, arrayUnion, updateDoc, getDoc } from 'firebase/firestore';
import { messaging, db, appId } from '../lib/firebase';

const VAPID_KEY = "BDOrOqwHSBcujSa51Sl8Tb8CuJUFAi-YDSPeDGIf9Qb7ulUkEGlPXCmim2Jt1IvCY3nwWaUf_JTfb6IKT8Ts_tQ";

export function useFcm(userId: string | null, isPremium: boolean = false) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !messaging) return;
    if (!VAPID_KEY) {
      console.warn('FCM VAPID_KEY is missing. Push notifications cannot be initialized.');
      return;
    }

    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
          if (currentToken) {
            setToken(currentToken);
            
            // Save token to Firestore
            const tokenRef = doc(db, `artifacts/${appId}/public/data/fcm_tokens`, userId);
            const tokenSnap = await getDoc(tokenRef);
            
            if (tokenSnap.exists()) {
              await updateDoc(tokenRef, {
                tokens: arrayUnion(currentToken),
                updatedAt: new Date().toISOString()
              });
            } else {
              await setDoc(tokenRef, {
                tokens: [currentToken],
                userId,
                updatedAt: new Date().toISOString()
              });
            }
          }
        } else if (permission === 'denied') {
          console.warn('Permissão de notificação foi negada pelo usuário ou pelo navegador. Tente abrir o app em uma nova aba.');
        } else {
          console.log('Permissão de notificação:', permission);
        }
      } catch (error) {
        console.error('An error occurred while retrieving token:', error);
      }
    };

    requestPermission();

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      // You can implement custom toast or foreground notification here
    });

    return () => unsubscribe();
  }, [userId]);

  return { token };
}
