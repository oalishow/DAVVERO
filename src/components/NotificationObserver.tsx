import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, appId, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { Member } from '../types';

export default function NotificationObserver() {
  const lastProcessedTime = useRef(Date.now());
  const notifiedIds = useRef(new Set<string>());

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        // Reset processed time to avoid spamming existing pending items
        lastProcessedTime.current = Date.now();
        
        // Request permission
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }

        // Listener for PENDING APPROVALS
        const qPending = query(
          collection(db, `artifacts/${appId}/public/data/students`),
          where('isApproved', '==', false)
        );

        const unsubPending = onSnapshot(qPending, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data() as Member;
              const docId = change.doc.id;
              
              // Only notify for items created after we started observing
              // Or at least very recently to avoid mass notifications on startup
              const created = data.createdAt ? new Date(data.createdAt).getTime() : 0;
              
              if (created > lastProcessedTime.current && !notifiedIds.current.has(docId)) {
                sendNotification('A vero ID - Nova Solicitação', {
                  body: `O(A) estudante ${data.name} solicitou uma nova identidade.`,
                  tag: `pending-${docId}`
                });
                notifiedIds.current.add(docId);
              }
            }
          });
        });

        // Listener for PENDING CHANGES (Suggest Edits)
        // Note: Firestore doesn't support 'where field != null' directly in a simple query without indexing complexity 
        // using the SDK, but we can query by a boolean flag if we had one.
        // For now, let's just listen to the collection for modifications if the count is manageable, 
        // or specifically handle it.
        // Actually, the members list is already synced in many places.
        
        // Let's refine the query for changes.
        // If we don't have a 'hasPendingChanges' field, we'd need to fetch all or use a different strategy.
        // Looking at current data, 'pendingChanges' is an object.
        
        const qChanges = query(
          collection(db, `artifacts/${appId}/public/data/students`)
        );

        const unsubChanges = onSnapshot(qChanges, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
             // We only care about modifications that might have added pendingChanges
             if (change.type === 'modified') {
                const data = change.doc.data() as Member;
                const docId = change.doc.id;
                
                if (data.pendingChanges && !notifiedIds.current.has(`change-${docId}`)) {
                   sendNotification('A vero ID - Nova Sugestão', {
                      body: `O(A) estudante ${data.name} enviou uma sugestão de alteração.`,
                      tag: `change-${docId}`
                   });
                   notifiedIds.current.add(`change-${docId}`);
                } else if (!data.pendingChanges) {
                   // Clear from set if changes were handled
                   notifiedIds.current.delete(`change-${docId}`);
                }
             }
          });
        });

        return () => {
          unsubPending();
          unsubChanges();
        };
      }
    });

    return () => unsubAuth();
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
