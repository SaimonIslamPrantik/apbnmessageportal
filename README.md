# APBn Squad Message Portal — v1

## Files

- `index.html` — complete browser frontend
- `supabase/schema.sql` — database, RLS, trigger and Realtime setup
- `supabase/functions/delete-account/index.ts` — authenticated self-delete Edge Function
- `supabase/functions/admin-delete-user/index.ts` — admin account-delete Edge Function

## 1. Create Supabase project

Create a Supabase project and open its SQL Editor.

Paste and run `supabase/schema.sql`.

## 2. Auth setting

This version intentionally uses a username-looking identifier such as:

`alphabet@number`

internally mapped to a Base64URL-encoded local part such as:

`<encoded>@apbn.local`

It is not intended to be a real email address.

In Supabase Authentication settings, disable email confirmation for this username/password-only portal. If email confirmation is enabled, the synthetic address cannot receive the confirmation message.

## 3. Configure frontend

Open `index.html` and replace:

`YOUR_PROJECT_REF`

and

`YOUR_PUBLISHABLE_OR_ANON_KEY`

with your project's browser-safe Supabase values.

Never put the `service_role` key in `index.html`.

## 4. Deploy Edge Functions

Using the Supabase CLI:

    supabase login
    supabase link --project-ref YOUR_PROJECT_REF
    supabase functions deploy delete-account
    supabase functions deploy admin-delete-user

The Supabase platform provides the function environment variables for the linked project, including the service role key. Do not copy that key into frontend JavaScript.

## 5. Create the first admin

Create a normal account from the website, then run in SQL Editor:

    update public.profiles
    set role = 'admin'
    where username_normalized = lower('alphabet@number');

After the next login, the Admin button appears.

## 6. Realtime

The SQL adds `public.messages` to the `supabase_realtime` publication. The frontend listens for INSERT/UPDATE/DELETE changes and reloads the message list.

## 7. Username rule

Accepted:

- `alphabet@number`
- `alphabet@number`
- `alphabet@number`

Rejected:

- `maruf`
- `Maruf_012`
- `Maruf@ABC`
- `012@Maruf`
- `Maruf @012`
- `alphabet@number!`

The database trigger also enforces the format so browser-side validation is not the only protection.

## 8. Moderation

Members can soft-delete their own messages. The message remains visible as:

`This message is deleted by user`

with its original timestamp.

Admins can ban/unban profiles and remove messages. Admin account deletion uses an Edge Function because Supabase's `auth.admin.deleteUser()` requires the service-role key and must run on a server.

## 9. Important production hardening

Before public deployment, consider:

- CAPTCHA/rate limits for signup and message sending.
- A stricter content moderation system if needed.
- A proper private Realtime channel if scaling beyond a small squad.
- Audit logs for admin actions.
- A real account/settings menu instead of the first-version username click.
- HTTPS hosting.
- Custom SMTP only if you later add real email verification/reset flows.

## Visual style
Version 2 uses a black 2000s/Y2K-inspired interface: glossy buttons, scanline texture, red/yellow accents, metallic panels, and the supplied APBn group image in the portal branding.
