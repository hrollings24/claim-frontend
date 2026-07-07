// Copy this file to environment.ts (dev) and environment.prod.ts (prod), then
// fill in the real values from `terraform output` in claim-infrastructure.
// Neither environment.ts nor environment.prod.ts are committed to the repo —
// see .gitignore. A future CI/release pipeline can generate them from secrets
// instead of requiring a manual copy.

export const environment = {
  production: false,
  cognito: {
    userPoolId: 'REPLACE_ME',
    userPoolClientId: 'REPLACE_ME',
    domain: 'REPLACE_ME.auth.eu-west-2.amazoncognito.com',
    redirectSignIn: 'http://localhost:8100/',
    redirectSignOut: 'http://localhost:8100/',
  },
};
