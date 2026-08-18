import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { fetchAuthSession } from 'aws-amplify/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

/**
 * Wraps the API with the Cognito access token every protected endpoint expects, so the feature
 * services don't each repeat the token plumbing.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  constructor(private http: HttpClient) {}

  async get<T>(path: string): Promise<T> {
    return firstValueFrom(
      this.http.get<T>(`${environment.apiUrl}${path}`, { headers: await this.headers() }),
    );
  }

  async post<T>(path: string, body: unknown = {}): Promise<T> {
    return firstValueFrom(
      this.http.post<T>(`${environment.apiUrl}${path}`, body, { headers: await this.headers() }),
    );
  }

  private async headers(): Promise<HttpHeaders> {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken?.toString();

    return new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
  }
}
