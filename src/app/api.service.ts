import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { fetchAuthSession } from 'aws-amplify/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  async hello(): Promise<string> {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken?.toString();

    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/api/hello`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'text',
      }),
    );
  }
}
