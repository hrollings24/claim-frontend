# claim-frontend

Mobile-first Ionic/Angular app. Login/sign-up is handled entirely by the Cognito Hosted UI (see [claim-infrastructure](../claim-infrastructure)) — this app never handles passwords directly.

## Setup

Requires Node 20 or 22 (an odd-numbered version like 21 will break the Angular build tooling).

```bash
npm install
cp src/environments/environment.template.ts src/environments/environment.ts
cp src/environments/environment.template.ts src/environments/environment.prod.ts
```

Fill in `environment.ts`/`environment.prod.ts` with the real Cognito values from `terraform output` in `claim-infrastructure` (`user_pool_id`, `user_pool_client_id`, and the domain from `hosted_ui_domain` without the `https://`). These files are gitignored — never commit real values. Once a release pipeline exists for this repo, it should generate them from secrets instead.

## Run

```bash
npx ionic serve --port 8100
```

Port 8100 matters: it's the callback URL registered on the Cognito app client.
