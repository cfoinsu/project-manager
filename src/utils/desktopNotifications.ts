import type { AppNotification } from '../types';
import { isTauri } from './tauriBridge';

export const sendDesktopNotification = async (title: string, body?: string) => {
  if (!isTauri()) return;
  try {
    const notification = await import('@tauri-apps/api/notification');
    let granted = await notification.isPermissionGranted();
    if (!granted) {
      granted = (await notification.requestPermission()) === 'granted';
    }
    if (granted) {
      notification.sendNotification({ title, body });
    }
  } catch (error) {
    console.warn('Desktop notification failed:', error);
  }
};

export const notifyUnreadItems = async (items: AppNotification[]) => {
  const notifiedKey = 'pa_desktop_notified_ids';
  const notified = new Set<string>(JSON.parse(localStorage.getItem(notifiedKey) || '[]'));
  const fresh = items.filter((item) => !item.read_at && !notified.has(item.id)).slice(0, 3);
  for (const item of fresh) {
    await sendDesktopNotification(item.title, item.body || '');
    notified.add(item.id);
  }
  localStorage.setItem(notifiedKey, JSON.stringify(Array.from(notified).slice(-200)));
};
