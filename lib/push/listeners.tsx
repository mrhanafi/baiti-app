import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { ReactNode, useEffect } from 'react';

/**
 * Mounted high in the tree (in `app/_layout.tsx`). Listens for notification
 * taps and deeplinks the user into the relevant screen.
 *
 * Push payload's `data.kind` drives routing:
 *   sos.triggered   → guards land on /guard-sos (queue)
 *   sos.responding  → owner lands on /(tabs)/ (banner is shown automatically)
 *   sos.resolved    → owner lands on /(tabs)/
 */
export function PushListeners({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // Tap-while-app-running OR tap-from-killed-state (Expo replays it).
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | {
            kind?: string;
            event_id?: string;
            pass_id?: string;
            announcement_id?: string;
            report_id?: string;
            task_id?: string;
            complaint_id?: string;
          }
        | undefined;
      const kind = data?.kind;

      if (kind === 'sos.triggered') {
        router.push('/guard-sos');
      } else if (kind === 'sos.responding' || kind === 'sos.resolved') {
        router.push('/(tabs)');
      } else if (kind === 'visitor.arrived' && data?.pass_id) {
        router.push({ pathname: '/visitor/[id]', params: { id: data.pass_id } });
      } else if (kind === 'announcement.published' && data?.announcement_id) {
        router.push({ pathname: '/announcements/[id]', params: { id: data.announcement_id } });
      } else if (kind === 'maintenance.update' && data?.report_id) {
        router.push({ pathname: '/complaints/[id]', params: { id: data.report_id } });
      } else if (kind === 'maintenance.task.assigned' && data?.task_id) {
        router.push({ pathname: '/work-orders/[id]', params: { id: data.task_id } });
      } else if (kind === 'complaint.task.completed' && data?.complaint_id) {
        router.push({ pathname: '/complaints/[id]', params: { id: data.complaint_id } });
      } else if (kind === 'facility.booking.update' || kind === 'facility.booking.pending') {
        router.push('/facility/bookings');
      }
    });

    // Foreground receive — handled by the notification handler in
    // lib/push/register.ts (shows the banner). No additional logic needed here.
    return () => {
      tapSub.remove();
    };
  }, [router]);

  return <>{children}</>;
}
