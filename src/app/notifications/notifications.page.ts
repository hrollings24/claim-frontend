import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonItemSliding, RefresherCustomEvent } from '@ionic/angular';
import { InboxNotification, NotificationService } from '../notification.service';

@Component({
  selector: 'app-notifications',
  templateUrl: 'notifications.page.html',
  styleUrls: ['notifications.page.scss'],
  standalone: false,
})
export class NotificationsPage {
  notifications: InboxNotification[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private alerts: AlertController,
  ) {}

  /** Reloads on entry, so anything that arrived since last time shows up. */
  ionViewWillEnter(): void {
    void this.reload();
  }

  async reload(event?: RefresherCustomEvent): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.notifications = await this.notificationService.list();
    } catch {
      this.error = 'Could not load your notifications.';
    } finally {
      this.loading = false;
      await event?.target.complete();
    }
  }

  /** Taps through to the game it's about. */
  open(notification: InboxNotification): Promise<boolean> {
    return this.router.navigateByUrl(notification.url ?? (notification.gameCode ? `/lobby/${notification.gameCode}` : '/home'));
  }

  /** Gone from the list straight away; the server catches up behind it. */
  async dismiss(notification: InboxNotification, slider?: IonItemSliding): Promise<void> {
    await slider?.close();
    this.notifications = this.notifications.filter(n => n.id !== notification.id);

    try {
      await this.notificationService.dismiss(notification.id);
    } catch {
      this.error = 'Could not dismiss that one — pull down to refresh.';
    }
  }

  async confirmDismissAll(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Clear all notifications?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Clear all', role: 'destructive', handler: () => void this.dismissAll() },
      ],
    });

    await alert.present();
  }

  private async dismissAll(): Promise<void> {
    const previous = this.notifications;
    this.notifications = [];

    try {
      await this.notificationService.dismissAll();
    } catch {
      this.notifications = previous;
      this.error = 'Could not clear them — try again.';
    }
  }

  /** "Just now", "12 min ago", "3 hr ago", "Tue 14:05". */
  age(notification: InboxNotification): string {
    const created = new Date(notification.createdAt);
    const minutes = Math.round((Date.now() - created.getTime()) / 60000);

    if (minutes < 1) {
      return 'Just now';
    }

    if (minutes < 60) {
      return `${minutes} min ago`;
    }

    if (minutes < 24 * 60) {
      return `${Math.round(minutes / 60)} hr ago`;
    }

    return created.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
