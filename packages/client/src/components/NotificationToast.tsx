import { useEffect } from 'react';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface NotificationToastProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export type { Notification };

const COLORS: Record<string, string> = {
  info: '#2563eb',
  success: '#16a34a',
  warning: '#ca8a04',
  error: '#dc2626',
};

export function NotificationToast({ notifications, onDismiss }: NotificationToastProps) {
  return (
    <div style={{
      position: 'fixed', top: '16px', right: '16px',
      display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1000,
    }}>
      {notifications.map(n => (
        <ToastItem key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ notification, onDismiss }: { notification: Notification; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notification.id), 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  return (
    <div style={{
      padding: '10px 16px', borderRadius: '8px',
      background: '#222', color: '#e0e0e0', fontSize: '13px',
      borderLeft: `4px solid ${COLORS[notification.type]}`,
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      minWidth: '250px', maxWidth: '400px',
      cursor: 'pointer',
    }}
      onClick={() => onDismiss(notification.id)}
    >
      {notification.message}
    </div>
  );
}
