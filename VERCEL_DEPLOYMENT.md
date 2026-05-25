# 🚀 Deploying LoanShare to Vercel (100% Free)

Follow these simple steps to deploy your private LoanShare dashboard with active email notifications, snooze/collect interactions, and automatic bank balance tracking.

---

## 1. Setup Your Free Supabase Database (2 Minutes)

1. Go to [Supabase](https://supabase.com) and sign up for a **free account**.
2. Click **New Project** and name it `loanshare`.
3. Wait about 1 minute for your database to provision.
4. On the left sidebar, click the **SQL Editor** icon (looks like `>_`).
5. Click **New query**, paste the entire contents of your [schema.sql](file:///C:/Users/P3Fusion%20Inc/Downloads/SurfShark/schema.sql) file into the editor, and click **Run**.
   - *This will automatically build all your database tables, check constraints, Row Level Security rules, and pre-populate your starting bank accounts!*
6. On the left sidebar, go to **Project Settings** -> **API**.
7. Copy the following two keys (you will paste them into Vercel later):
   - **Project URL** (under URL)
   - **anon / public** API Key (under Service Keys)

---

## 2. Get a Free Google SMTP App Password (1 Minute)

To send automated, reliable emails from your own Gmail address for free:
1. Go to your [Google Account Settings](https://myaccount.google.com/).
2. On the left pane, select **Security**.
3. Under *How you sign in to Google*, make sure **2-Step Verification** is turned **ON**.
4. Search or navigate to **App passwords** (or type "App Passwords" in the search bar at the top).
5. Enter a name for the app (e.g. `LoanShare Vercel`) and click **Create**.
6. Google will display a **16-character password** (e.g. `abcd efgh ijkl mnop`).
7. Copy this password carefully! (You will use it on Vercel as `SMTP_PASS`).

---

## 3. Deploy to Vercel (1 Minute)

1. Push this codebase to a private repository on your **GitHub** account.
2. Sign in to [Vercel](https://vercel.com) using your GitHub account (free Hobby tier).
3. Click **Add New** -> **Project** and import your private repository.
4. Expand the **Environment Variables** section and add the following keys:

| Environment Variable | Description / Value |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase **Project URL** (e.g. `https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase **anon / public** API Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase **service_role** API Key (Required for administrative email OTP bypasses) |
| `SMTP_USER` | Your own Gmail address (e.g. `me@gmail.com`) |
| `SMTP_PASS` | Your 16-character **Gmail App Password** (no spaces, e.g., `heexmlhaetebzfzo`) |
| `SMTP_TO` | *Optional*. The registered email address to receive alerts (defaults to `SMTP_USER` if omitted) |

5. Click **Deploy**!

---

## 4. Automatic Daily Alerts (Vercel Cron)

Because we included [vercel.json](file:///C:/Users/P3Fusion%20Inc/Downloads/SurfShark/vercel.json) in the root of the project, Vercel will **automatically schedule a cron job** that triggers your due date check and emails you every morning at 8:00 AM!

- You can view and test this cron job on your Vercel Dashboard under **Settings** -> **Cron Jobs**.

---

## 5. Security & Multi-User Admin Login (Google Sign-In)

If you decide to lock down the interface to just the 5 of you, you can easily enable Google Login on Supabase:
1. Go to your **Supabase Dashboard** -> **Authentication** -> **Providers**.
2. Toggle on **Google**.
3. Create a Google Cloud Developer project, obtain your Client ID and Client Secret, and paste them into Supabase.
4. Set up an authentication check/middleware in Next.js.
   *(Since this app is currently configured for admin access with client-side local sync, it's 100% ready for sandbox testing immediately!)*
