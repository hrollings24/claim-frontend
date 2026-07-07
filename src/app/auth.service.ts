import { Injectable } from '@angular/core';
import { Amplify } from 'aws-amplify';
import { Hub } from 'aws-amplify/utils';
import { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from 'aws-amplify/auth';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../environments/environment';

export interface AppUser {
  name: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<AppUser | null>(null);
  user$ = this.userSubject.asObservable();

  constructor() {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: environment.cognito.userPoolId,
          userPoolClientId: environment.cognito.userPoolClientId,
          loginWith: {
            oauth: {
              domain: environment.cognito.domain,
              scopes: ['openid', 'email', 'profile'],
              redirectSignIn: [environment.cognito.redirectSignIn],
              redirectSignOut: [environment.cognito.redirectSignOut],
              responseType: 'code',
            },
          },
        },
      },
    });

    Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect' || payload.event === 'signedIn') {
        this.refreshUser();
      }
      if (payload.event === 'signedOut') {
        this.userSubject.next(null);
      }
    });

    this.refreshUser();
  }

  login(): Promise<void> {
    return signInWithRedirect();
  }

  logout(): Promise<void> {
    return signOut();
  }

  private async refreshUser(): Promise<void> {
    try {
      await getCurrentUser();
      const session = await fetchAuthSession();
      const idTokenPayload = session.tokens?.idToken?.payload;
      this.userSubject.next({
        name: (idTokenPayload?.['name'] as string) ?? '',
        email: (idTokenPayload?.['email'] as string) ?? '',
      });
    } catch {
      this.userSubject.next(null);
    }
  }
}
