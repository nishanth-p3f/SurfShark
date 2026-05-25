import { NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { supabaseAdmin } from '@/lib/db';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Simple utility to secure verification token signing
const SECRET_KEY = process.env.SMTP_PASS || 'default-verification-secret-39281';

function encryptToken(data) {
  const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(SECRET_KEY, 'salt', 32), Buffer.alloc(16, 0));
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptToken(token) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(SECRET_KEY, 'salt', 32), Buffer.alloc(16, 0));
    let decrypted = decipher.update(token, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}

// 1. POST: Generate and dispatch password-reset OTP email
export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    let isMockMode = !supabaseUrl || !supabaseAdmin;
    let userId = null;

    // 1. Search for user in Supabase Auth if cloud is active
    if (!isMockMode) {
      try {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const foundUser = users.find(u => u.email?.toLowerCase() === trimmedEmail);
        if (!foundUser) {
          return NextResponse.json({ 
            error: 'No registered account found with this email. Please check your credentials or sign up first.' 
          }, { status: 404 });
        }
        userId = foundUser.id;
      } catch (authErr) {
        console.error('Supabase admin lookup failed, falling back to mock simulator:', authErr);
        isMockMode = true; // Fall back gracefully if service role key fails
      }
    }

    // Generate secure 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    // Check SMTP config
    const rawUser = process.env.SMTP_USER;
    const rawPass = process.env.SMTP_PASS;
    const smtpUser = rawUser ? rawUser.trim() : '';
    const smtpPass = rawPass ? rawPass.trim() : '';

    if (isMockMode || !smtpUser || !smtpPass) {
      console.warn('⚠️ Sandbox/Simulated password reset trigger. Simulated OTP code is:', code);
      const verificationToken = encryptToken({ email: trimmedEmail, code, expires, userId, isMock: true });
      return NextResponse.json({ 
        success: true, 
        simulated: true, 
        verificationToken,
        message: 'SMTP or Database offline. Simulated OTP generated successfully!' 
      });
    }

    // Send email using SMTP Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass }
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0; }
          .card { background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 480px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 24px; text-align: center; }
          .content { padding: 32px 24px; text-align: center; }
          .code { font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #6366f1; padding: 12px 24px; background-color: #f1f5f9; border-radius: 8px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 16px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2 style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.03em;">LoanShare Recovery</h2>
          </div>
          <div class="content">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #475569;">We received a request to reset the password for your LoanShare account. Use the following code to confirm this request:</p>
            <div class="code">${code}</div>
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8;">This code is valid for 10 minutes. If you did not request a password reset, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            LoanShare Secured Ledger
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"LoanShare Security" <${smtpUser}>`,
      to: trimmedEmail,
      subject: `Reset your password: ${code}`,
      html: htmlContent
    });

    const verificationToken = encryptToken({ email: trimmedEmail, code, expires, userId, isMock: false });
    return NextResponse.json({ success: true, verificationToken });

  } catch (error) {
    console.error('Error generating forgot password OTP:', error);
    return NextResponse.json({ error: 'Failed to send verification code.' }, { status: 500 });
  }
}

// 2. PUT: Verify OTP code and update user's password in Supabase
export async function PUT(request) {
  try {
    const { email, code, verificationToken, newPassword } = await request.json();
    if (!email || !code || !verificationToken || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Missing parameters or password too short (min 6 characters).' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Verify token details
    const payload = decryptToken(verificationToken);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired verification session.' }, { status: 400 });
    }

    if (payload.email !== trimmedEmail) {
      return NextResponse.json({ error: 'Email mismatch error.' }, { status: 400 });
    }

    if (payload.code !== code.trim()) {
      return NextResponse.json({ error: 'Incorrect 6-digit verification code.' }, { status: 400 });
    }

    if (Date.now() > payload.expires) {
      return NextResponse.json({ error: 'Verification code has expired.' }, { status: 400 });
    }

    // 2. Commit update to Supabase Auth if not in mock session
    if (payload.isMock || !supabaseAdmin) {
      return NextResponse.json({ 
        success: true, 
        simulated: true, 
        message: 'Password reset simulated successfully! Please update local storage.' 
      });
    }

    // Look up the user's ID again securely or use payload user ID
    let userId = payload.userId;
    if (!userId) {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      const foundUser = users.find(u => u.email?.toLowerCase() === trimmedEmail);
      if (!foundUser) {
        return NextResponse.json({ error: 'User could not be found during password commit.' }, { status: 404 });
      }
      userId = foundUser.id;
    }

    // Commit password change via Supabase Admin Client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Password reset successfully! You can now log in with your new password.' 
    });

  } catch (error) {
    console.error('Error committing password reset:', error);
    return NextResponse.json({ error: error.message || 'Failed to reset password.' }, { status: 500 });
  }
}
