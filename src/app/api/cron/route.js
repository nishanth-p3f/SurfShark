import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { email } from '@/lib/email';

export async function GET(request) {
  try {
    // 1. Fetch all active loans and active reminders bypassing RLS using cron operations
    const activeLoans = await db.getAllLoansForCron();
    const allReminders = await db.getAllRemindersForCron();
    
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    const dueLoansToSend = [];

    for (const loan of activeLoans) {
      // Find if there is an active snooze reminder for this loan
      const reminder = allReminders.find(r => r.loan_id === loan.id && r.active === true);
      
      let shouldAlert = false;

      if (reminder) {
        const remindTime = new Date(reminder.remind_at);
        if (remindTime <= now) {
          // Snooze expired! Trigger reminder and deactivate this snooze so it joins the regular cycle
          shouldAlert = true;
          await db.cancelReminderForCron(loan.id); // set active = false using admin if available
          console.log(`Snooze expired for loan ${loan.id} (${loan.contact_name}). Triggering reminder.`);
        }
      } else {
        // No active snooze. Trigger if due today or overdue!
        if (loan.due_date <= todayStr) {
          shouldAlert = true;
        }
      }

      if (shouldAlert) {
        dueLoansToSend.push(loan);
      }
    }

    // 2. If no loans require notification, return empty
    if (dueLoansToSend.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No loans or borrows are due today, and no snooze timers have expired. No email sent.',
        count: 0
      });
    }

    // 3. Resolve host for email links
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const appUrl = `${protocol}://${host}`;

    // 4. Group due loans by the owner's registered email address
    const groupedDueLoans = {};
    for (const loan of dueLoansToSend) {
      let recipientEmail = loan.user_email ? loan.user_email.trim().toLowerCase() : '';
      if (!recipientEmail) {
        recipientEmail = 'default';
      }
      if (!groupedDueLoans[recipientEmail]) {
        groupedDueLoans[recipientEmail] = [];
      }
      groupedDueLoans[recipientEmail].push(loan);
    }

    // 5. Send due notification emails to each registered user email (or default SMTP_TO as fallback)
    const results = [];
    for (const [emailKey, userLoans] of Object.entries(groupedDueLoans)) {
      const recipient = emailKey === 'default' ? null : emailKey;
      const sendResult = await email.sendDueNotificationEmail(userLoans, appUrl, recipient);
      results.push({
        recipient: recipient || 'Default Configured SMTP Email',
        count: userLoans.length,
        simulated: !!sendResult.simulated,
        success: !sendResult.error
      });
    }

    return NextResponse.json({
      success: true,
      message: `Processed dues scan successfully! ${dueLoansToSend.length} items grouped into ${results.length} email dispatches.`,
      dispatches: results
    });
  } catch (error) {
    console.error('Error running daily cron check API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error. Cron check failed.' },
      { status: 500 }
    );
  }
}
