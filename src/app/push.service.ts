import { Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';

interface PushKey {
  publicKey: string;
  enabled: boolean;
}

export type PushState = 'unsupported' | 'unconfigured' | 'blocked' | 'off' | 'on';

@Injectable({ providedIn: 'root' })
export class PushService {
  constructor(private api: ApiClient) {}

  /**
   * Push needs a service worker, and iOS only allows one in an app added to the home screen —
   * in a normal Safari tab the APIs exist but a subscription will never arrive.
   */
  get isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async state(): Promise<PushState> {
    if (!this.isSupported) {
      return 'unsupported';
    }

    if (!(await this.key()).enabled) {
      return 'unconfigured';
    }

    if (Notification.permission === 'denied') {
      return 'blocked';
    }

    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    return subscription ? 'on' : 'off';
  }

  async enable(): Promise<PushState> {
    const { publicKey, enabled } = await this.key();
    if (!enabled) {
      return 'unconfigured';
    }

    if ((await Notification.requestPermission()) !== 'granted') {
      return Notification.permission === 'denied' ? 'blocked' : 'off';
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        // Required by every browser: a push must always result in something the user can see.
        userVisibleOnly: true,
        applicationServerKey: this.decodeKey(publicKey),
      }));

    await this.api.post('/api/push/subscriptions', this.describe(subscription));

    return 'on';
  }

  async disable(): Promise<PushState> {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      // Tell the server first: if unsubscribing succeeds and the delete doesn't, the server
      // keeps pushing to an endpoint nobody is listening on.
      await this.api.delete('/api/push/subscriptions', { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }

    return 'off';
  }

  private keyCache: Promise<PushKey> | null = null;

  private key(): Promise<PushKey> {
    return (this.keyCache ??= this.api.get<PushKey>('/api/push/key'));
  }

  private describe(subscription: globalThis.PushSubscription) {
    const json = subscription.toJSON();

    return {
      endpoint: subscription.endpoint,
      p256dh: json.keys?.['p256dh'] ?? '',
      auth: json.keys?.['auth'] ?? '',
    };
  }

  /**
   * The key travels as base64url text; subscribe() wants the raw bytes. The ArrayBuffer is
   * allocated up front and returned directly — a Uint8Array is generic over its buffer since
   * TypeScript 5.7 and no longer satisfies BufferSource on its own.
   */
  private decodeKey(base64Url: string): ArrayBuffer {
    const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const binary = atob(padded);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return buffer;
  }
}
