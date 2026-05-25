import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { email } from '@/lib/email';

export async function POST(request) {
  try {
    let allLoans = [];
    let allAccounts = [];

    // Resolve dynamic host
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const appUrl = `${protocol}://${host}`;

    let recipientEmail = null;
    let hasPayload = false;
    let contactFilter = '';

    try {
      const body = await request.json();
      if (body && (body.loans !== undefined || body.accounts !== undefined)) {
        allLoans = body.loans || [];
        allAccounts = body.accounts || [];
        hasPayload = true;
      }
      recipientEmail = body.emailAddress || null;
      contactFilter = body.contactFilter || '';
    } catch (e) {
      // Body empty or invalid, fallback to querying DB (failsafe)
      console.log('No payload passed to report API. Querying database...');
    }

    // Fallback: If no payload was passed at all, fetch from DB
    if (!hasPayload) {
      allLoans = await db.getLoans();
      allAccounts = await db.getAccounts();
    }

    // Send email report
    const result = await email.sendFullLoanReportEmail(allLoans, allAccounts, appUrl, recipientEmail, contactFilter);

    if (result.simulated) {
      return NextResponse.json({
        success: true,
        simulated: true,
        message: 'SMTP credentials missing. The full loan report has been simulated and printed in the server logs!',
        stats: result.stats
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Full portfolio financial report sent successfully to your email!'
    });
  } catch (error) {
    console.error('Error generating email report API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error. Failed to generate and send report.' },
      { status: 500 }
    );
  }
}
