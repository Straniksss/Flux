import { app, BrowserWindow, Notification } from 'electron';
import * as path from 'path';
import { loadTasks, loadSettings } from './database';
import { Task } from '../src/types';

let getMainWindow: () => BrowserWindow | null = () => null;
const activeTimeouts = new Map<string, NodeJS.Timeout>();

export function initNotificationService(getWindow: () => BrowserWindow | null) {
  getMainWindow = getWindow;
  rescheduleAllDeadlineNotifications();
}

function getLocalizedStrings() {
  const settings = loadSettings();
  const lang = settings.language || 'ru';
  
  if (lang === 'ru') {
    return {
      title: 'Напоминание о дедлайне',
      body: (title: string, dateStr: string) => `Срок задачи "${title}" истекает ${dateStr}`,
      testTitle: 'Тестовое уведомление',
      testBody: 'Уведомления успешно работают!',
      locale: 'ru-RU'
    };
  } else if (lang === 'uk') {
    return {
      title: 'Нагадування про дедлайн',
      body: (title: string, dateStr: string) => `Термін завдання "${title}" закінчується о ${dateStr}`,
      testTitle: 'Тестове сповіщення',
      testBody: 'Сповіщення успішно працюють!',
      locale: 'uk-UA'
    };
  } else {
    return {
      title: 'Deadline reminder',
      body: (title: string, dateStr: string) => `Task "${title}" is due at ${dateStr}`,
      testTitle: 'Test Notification',
      testBody: 'Notifications are working!',
      locale: 'en-US'
    };
  }
}

export function showDeadlineNotification(task: Task) {
  if (!Notification.isSupported()) {
    console.warn('Notifications are not supported on this platform');
    return;
  }

  const strings = getLocalizedStrings();
  const dateStr = task.dueAt ? new Date(task.dueAt).toLocaleString(strings.locale) : '';
  const title = strings.title;
  const body = strings.body(task.title, dateStr);

  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, '../assets/icon.png')
  });

  notification.on('click', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      win.webContents.send('reminders:openTask', task.id);
    }
  });

  notification.show();
}

export function scheduleDeadlineNotification(task: Task) {
  // Clear any existing timeout for this task first
  cancelDeadlineNotification(task.id);

  if (!task.dueAt) return;
  if (task.status === 'completed' || task.status === 'cancelled') return;

  const dueTime = new Date(task.dueAt).getTime();
  const now = Date.now();
  const delay = dueTime - now;

  if (delay > 0) {
    const timeoutId = setTimeout(() => {
      showDeadlineNotification(task);
      activeTimeouts.delete(task.id);
    }, delay);
    activeTimeouts.set(task.id, timeoutId);
  }
}

export function cancelDeadlineNotification(taskId: string) {
  const timeoutId = activeTimeouts.get(taskId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    activeTimeouts.delete(taskId);
  }
}

export function rescheduleAllDeadlineNotifications() {
  // Clear all existing timeouts
  for (const timeoutId of activeTimeouts.values()) {
    clearTimeout(timeoutId);
  }
  activeTimeouts.clear();

  // Load all tasks
  const tasks = loadTasks();
  const now = Date.now();

  for (const task of tasks) {
    if (!task.dueAt) continue;
    if (task.status === 'completed' || task.status === 'cancelled') continue;

    const dueTime = new Date(task.dueAt).getTime();
    if (dueTime > now) {
      scheduleDeadlineNotification(task);
    }
  }
}

export function sendTestNotification() {
  if (!Notification.isSupported()) {
    console.warn('Notifications are not supported on this platform');
    return;
  }

  const strings = getLocalizedStrings();
  
  const notification = new Notification({
    title: strings.testTitle,
    body: strings.testBody,
    icon: path.join(__dirname, '../assets/icon.png')
  });

  notification.on('click', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  notification.show();
}
