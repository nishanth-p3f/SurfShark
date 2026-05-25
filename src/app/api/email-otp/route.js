import { NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { supabaseAdmin } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

// 1. POST: Generate and dispatch OTP email to the new address
export async function POST(request) {
  try {
    const { newEmail } = await request.json();
    if (!newEmail || !newEmail.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    // Generate secure 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    // Send email using SMTP Nodemailer
    const rawUser = process.env.SMTP_USER;
    const rawPass = process.env.SMTP_PASS;
    const smtpUser = rawUser ? rawUser.trim() : '';
    const smtpPass = rawPass ? rawPass.trim() : '';

    if (!smtpUser || !smtpPass) {
      console.warn('⚠️ SMTP credentials not set up. Simulated OTP code is:', code);
      const verificationToken = encryptToken({ email: newEmail, code, expires });
      return NextResponse.json({ 
        success: true, 
        simulated: true, 
        verificationToken,
        message: 'SMTP credentials missing. Simulated OTP sent in server logs!' 
      });
    }

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
            <h2 style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.03em;">LoanShare Security</h2>
          </div>
          <div class="content">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #475569;">You requested to update your registered email address on LoanShare. Use the following verification code to confirm this change:</p>
            <div class="code">${code}</div>
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8;">This code will expire in 10 minutes. If you did not make this request, please ignore this email.</p>
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
      to: newEmail,
      subject: `Confirm your email change: ${code}`,
      html: htmlContent
    });

    const verificationToken = encryptToken({ email: newEmail, code, expires });
    return NextResponse.json({ success: true, verificationToken });

  } catch (error) {
    console.error('Error generating email change OTP:', error);
    return NextResponse.json({ error: 'Failed to send OTP.' }, { status: 500 });
  }
}

// 2. PUT: Verify the code and update the email instantly in Supabase Auth bypassing links
export async function PUT(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { newEmail, code, verificationToken } = await request.json();
    if (!newEmail || !code || !verificationToken) {
      return NextResponse.json({ error: 'Missing parameters.' }, { status: 400 });
    }

    // Verify token details
    const payload = decryptToken(verificationToken);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or corrupted verification token.' }, { status: 400 });
    }

    if (payload.email.toLowerCase() !== newEmail.toLowerCase()) {
      return NextResponse.json({ error: 'Token email mismatch.' }, { status: 400 });
    }

    if (payload.code !== code.trim()) {
      return NextResponse.json({ error: 'Incorrect verification code.' }, { status: 400 });
    }

    if (Date.now() > payload.expires) {
      return NextResponse.json({ error: 'Verification code has expired.' }, { status: 400 });
    }

    // Authenticate the requesting user securely using their Bearer JWT
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Session expired or unauthorized.' }, { status: 401 });
    }

    // Perform an instant email update using the admin client to bypass dual verification links
    if (supabaseAdmin) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email: newEmail,
        email_confirm: true // bypasses the need for the user to confirm via links!
      });
      if (updateError) {
        throw updateError;
      }
      return NextResponse.json({ success: true, message: 'Email address updated successfully!' });
    } else {
      return NextResponse.json({ 
        error: 'Admin authentication bypass key not configured on host. Email could not be instantly transferred.' 
      }, { status: 501 });
    }

  } catch (error) {
    console.error('Error verifying email change:', error);
    return NextResponse.json({ error: error.message || 'Verification failed.' }, { status: 500 });
  }
}
