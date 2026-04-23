import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, appId, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { Member } from '../types';

export default function NotificationObserver() {
  const lastProcessedTime = useRef(Date.now());
  const notifiedIds = useRef(new Set<string>());

  useEffect(() => {
    // Only administrators should receive notifications 
    const checkAndSubscribe = () => {
      const isMasterLogged = localStorage.getItem('adminMasterLogged') === 'true';
      if (!isMasterLogged) return null;

      // Ask for permission if not asked yet
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
         Notification.requestPermission();
      }

      // Reset processed time to avoid spamming existing pending items
      lastProcessedTime.current = Date.now();
      
      // Listener for PENDING ACTIONS
      const qActions = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where('hasPendingAction', '==', true)
      );

      const unsubActions = onSnapshot(qActions, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || (change.type === 'modified' && !notifiedIds.current.has(change.doc.id))) {
            const data = change.doc.data() as Member;
            const docId = change.doc.id;
            
            // Only notify if it's new since we opened the session
            const created = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();
            
            if (created > lastProcessedTime.current && !notifiedIds.current.has(docId)) {
              const title = data.isApproved === false ? '🎒 Nova Solicitação' : '✏️ Sugestão de Edição';
              const body = data.isApproved === false 
                ? `Estudante ${data.name} solicitou uma nova identidade digital.` 
                : `Estudante ${data.name} enviou uma proposta de alteração de dados.`;

              sendNotification(title, {
                body,
                tag: `pending-${docId}`
              });
              notifiedIds.current.add(docId);
            }
          } else if (change.type === 'removed') {
            notifiedIds.current.delete(change.doc.id);
          }
        });
      });

      return unsubActions;
    };

    let unsub = checkAndSubscribe();

    // Check periodically if login state changed
    const interval = setInterval(() => {
       const isMasterLogged = localStorage.getItem('adminMasterLogged') === 'true';
       if (isMasterLogged && !unsub) {
           unsub = checkAndSubscribe();
       } else if (!isMasterLogged && unsub) {
           unsub();
           unsub = null;
       }
    }, 2000);

    return () => {
      clearInterval(interval);
      if (unsub) unsub();
    };
  }, []);

  const sendNotification = (title: string, options: NotificationOptions) => {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          ...options,
          icon: '/icon.svg',
          badge: '/icon.svg'
        });
        
        // Play subtle sound if desired (optional)
        // const audio = new Audio('/notification.mp3');
        // audio.play().catch(() => {});
      } catch (e) {
        console.error("Failed to show notification", e);
      }
    }
  };

  return null;
}
