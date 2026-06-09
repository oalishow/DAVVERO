import { useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';

const STUDENT_BOND_KEY = 'davveroId_student_identity';
const STUDENT_TRACK_KEY = 'davveroId_student_track_ra';

export default function NotificationObserver() {
  const isMasterLogged = localStorage.getItem('adminMasterLogged') === 'true';
  const bondedId = localStorage.getItem(STUDENT_BOND_KEY) || localStorage.getItem(STUDENT_TRACK_KEY);
  
  // Determine recipient for notifications (admin or the specific student)
  const recipientId = isMasterLogged ? "admin" : bondedId ? bondedId : null;

  // Use the central hook that reads the 'notifications' collection and sets PWA Badge
  const { unreadCount } = useNotifications(recipientId);
  const { subscribe, permission, isSupported, subscription } = usePushNotifications();

  useEffect(() => {
    // Auto-subscribe to push notifications if supported and not already subscribed
    // Only attempt if permission is not explicitly denied
    const initPush = async () => {
      if (isSupported && permission !== "denied" && !subscription) {
        try {
          await subscribe();
        } catch (error) {
          console.error("Falha ao inicializar notificações push automaticamente:", error);
        }
      }
    };
    
    initPush();
  }, [isSupported, permission, subscription]);

  // For PWA Push / Badge sync
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) {
        navigator.setAppBadge(unreadCount).catch(console.error);
      } else {
        navigator.clearAppBadge().catch(console.error);
      }
    }
  }, [unreadCount]);

  return null;
}
