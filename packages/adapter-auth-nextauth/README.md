# @openagentry/adapter-auth-nextauth

OpenAgentry `AuthAdapter` implementation backed by [next-auth v4](https://next-auth.js.org/).

Status: `0.1.0-alpha.0` — first concrete auth adapter for OpenAgentry. API not yet stable.

## Install

```bash
pnpm add @openagentry/adapter-auth-nextauth @openagentry/core next-auth
```

## Use

```ts
import { createNextAuthAuthAdapter } from '@openagentry/adapter-auth-nextauth';
import CredentialsProvider from 'next-auth/providers/credentials';

const auth = createNextAuthAuthAdapter({
  secret: process.env.NEXTAUTH_SECRET!,
  authOptions: {
    secret: process.env.NEXTAUTH_SECRET!,
    providers: [
      CredentialsProvider({
        name: 'Email + password',
        credentials: { email: { label: 'Email', type: 'email' } },
        async authorize(creds) {
          // ... your verification logic
          return null;
        },
      }),
    ],
    session: { strategy: 'jwt' },
  },
});

const providers = await auth.listProviders();
const session = await auth.verifySession(token);
```

See `LLM.md` for agent-facing context.

## Conformance

```bash
pnpm --filter @openagentry/adapter-auth-nextauth test:integration
```

Runs the universal + auth functional checks. No env vars required — the
adapter's default export uses `process.env.NEXTAUTH_SECRET` if present and
falls back to a built-in test secret otherwise.

## License

Apache-2.0.
