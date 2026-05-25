import nodemailer from 'nodemailer';

// Helper to clean and validate environment strings
function cleanEnvVar(val, placeholder) {
  if (!val) return '';
  const cleaned = val.trim();
  if (cleaned === '' || cleaned === placeholder) return '';
  return cleaned;
}

const rawUser = process.env.SMTP_USER;
const rawPass = process.env.SMTP_PASS;
const rawTo = process.env.SMTP_TO;

const smtpUser = cleanEnvVar(rawUser, 'your_gmail_address_here');
const smtpPass = cleanEnvVar(rawPass, 'your_gmail_app_password_here');

// If SMTP_TO is empty or not set, fall back to smtpUser
const resolvedTo = cleanEnvVar(rawTo, 'your_recipient_email_here');
const smtpTo = resolvedTo !== '' ? resolvedTo : smtpUser;

// Helper to validate email format simply
function isValidEmail(emailStr) {
  if (!emailStr) return false;
  return emailStr.includes('@') && emailStr.includes('.');
}

// Helper to get SMTP transporter
function getTransporter() {
  if (!smtpUser || !smtpPass || !isValidEmail(smtpUser)) {
    console.warn(
      '⚠️ SMTP Configuration Missing or Invalid:\n' +
      `   SMTP_USER: "${smtpUser}" (${isValidEmail(smtpUser) ? 'Valid format' : 'Invalid email format'})\n` +
      `   SMTP_PASS: "${smtpPass ? '******' : 'MISSING'}"\n` +
      '   Email operations will run in Simulation (Log Only) Mode.'
    );
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

// Render HTML styles for modern design
const emailStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0; }
  .card { background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 32px 24px; text-align: center; }
  .logo { font-size: 24px; font-weight: bold; letter-spacing: -0.05em; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .logo-icon { color: #3b82f6; font-size: 28px; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 600; opacity: 0.9; }
  .content { padding: 32px 24px; }
  .loan-item { background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #3b82f6; }
  .loan-item.borrow { border-left-color: #f43f5e; }
  .loan-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .contact-name { font-size: 16px; font-weight: 600; color: #0f172a; }
  .amount { font-size: 18px; font-weight: 700; color: #0f172a; }
  .amount.lend { color: #10b981; }
  .amount.borrow { color: #f43f5e; }
  .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; rounded: 9999px; text-transform: uppercase; background-color: #e2e8f0; color: #475569; border-radius: 12px; margin-bottom: 8px; }
  .badge.lend { background-color: #d1fae5; color: #065f46; }
  .badge.borrow { background-color: #ffe4e6; color: #991b1b; }
  .notes { font-size: 13px; color: #64748b; font-style: italic; margin-top: 4px; }
  .btn-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .btn { display: inline-block; padding: 8px 16px; font-size: 13px; font-weight: 600; text-align: center; text-decoration: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
  .btn-primary { background-color: #10b981; color: #ffffff; border: 1px solid #10b981; }
  .btn-secondary { background-color: #ffffff; color: #475569; border: 1px solid #cbd5e1; }
  .btn-snooze { background-color: #f8fafc; color: #3b82f6; border: 1px solid #bfdbfe; }
  .footer { text-align: center; padding: 24px; font-size: 12px; color: #94a3b8; }
  .divider { height: 1px; background-color: #e2e8f0; margin: 24px 0; }
  .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
  .stat-card { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; text-align: center; }
  .stat-title { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  .stat-val { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 4px; }
`;

export const email = {
  // Send active alerts when a loan is due
  async sendDueNotificationEmail(dueLoans, appUrl = 'http://localhost:3000', recipientEmail = null) {
    const transporter = getTransporter();
    
    // Dynamically resolve target recipient
    const targetTo = (recipientEmail && isValidEmail(recipientEmail.trim())) ? recipientEmail.trim() : smtpTo;

    // Safety check: If recipient is empty or invalid, fall back gracefully to simulation
    if (!transporter || !targetTo || !isValidEmail(targetTo)) {
      console.warn(`⚠️ Cannot send due email: No valid recipient found (resolved recipient: "${targetTo}"). Simulating instead.`);
      return { simulated: true, count: dueLoans.length };
    }

    // Format list of loans HTML (with Rupee symbols and Indian locale numbers!)
    const loansHtml = dueLoans.map(loan => {
      const isLend = loan.type === 'lend';
      const actionWord = isLend ? 'Collect from' : 'Repay to';
      const collectLink = `${appUrl}/api/actions?action=collect&loanId=${loan.id}`;
      const snooze2h = `${appUrl}/api/actions?action=snooze&loanId=${loan.id}&hours=2`;
      const snooze24h = `${appUrl}/api/actions?action=snooze&loanId=${loan.id}&hours=24`;
      
      return `
        <div class="loan-item ${loan.type}">
          <div class="loan-header">
            <div>
              <span class="badge ${loan.type}">${isLend ? 'Lent Out (Receive)' : 'Borrowed (Pay)'}</span>
              <div class="contact-name">${actionWord} ${loan.contact_name}</div>
              ${loan.notes ? `<div class="notes">"${loan.notes}"</div>` : ''}
              <div class="notes" style="font-weight:600; margin-top: 4px;">Due Date: ${loan.due_date}</div>
            </div>
            <div class="amount ${loan.type}">
              ₹${parseFloat(loan.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div class="btn-group">
            <a href="${collectLink}" class="btn btn-primary" target="_blank">✓ Mark Completed</a>
            <a href="${snooze2h}" class="btn btn-snooze" target="_blank">⏰ Snooze 2 Hours</a>
            <a href="${snooze24h}" class="btn btn-secondary" target="_blank">⏰ Snooze 24 Hours</a>
          </div>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>${emailStyles}</style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">
              <span class="logo-icon">◌⇄◌</span> LoanShare
            </div>
            <h1>Dues Collecting Today</h1>
          </div>
          <div class="content">
            <p style="margin-top:0; font-size: 15px; line-height: 1.5; color: #475569;">
              Hello, here is the list of loans and borrows that require attention today. You can tap the actions inside the email to instantly update your ledger.
            </p>
            <div class="divider"></div>
            ${loansHtml}
            <div class="divider"></div>
            <p style="font-size: 13px; color: #94a3b8; text-align: center; margin: 0;">
              To view all loans, manage bank balances, or view reports, visit your dashboard.
            </p>
            <div style="text-align: center; margin-top: 16px;">
              <a href="${appUrl}" class="btn btn-secondary" style="padding: 10px 24px; background: #0f172a; color: white; border: none;">Go to Dashboard</a>
            </div>
          </div>
          <div class="footer">
            Sent automatically by your LoanShare App.
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"LoanShare Alerts" <${smtpUser}>`,
      to: targetTo,
      subject: `⏰ LoanShare Alert: Dues Collecting Today (${dueLoans.length} items)`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  },

  // Send the full financial report
  async sendFullLoanReportEmail(allLoans, allAccounts, appUrl = 'http://localhost:3000', recipientEmail = null, contactFilter = '') {
    const transporter = getTransporter();

    // Dynamically resolve target recipient
    const targetTo = (recipientEmail && isValidEmail(recipientEmail.trim())) ? recipientEmail.trim() : smtpTo;

    // Safety check: If recipient is empty or invalid, fall back gracefully to simulation
    if (!transporter || !targetTo || !isValidEmail(targetTo)) {
      const activeLoans = allLoans.filter(l => l.status === 'active');
      const totalLent = activeLoans.filter(l => l.type === 'lend').reduce((acc, curr) => acc + parseFloat(curr.outstanding_amount), 0);
      const totalBorrowed = activeLoans.filter(l => l.type === 'borrow').reduce((acc, curr) => acc + parseFloat(curr.outstanding_amount), 0);
      const bankBalance = allAccounts.reduce((acc, curr) => acc + parseFloat(curr.balance), 0);
      const netWorth = bankBalance + totalLent - totalBorrowed;

      console.warn(`⚠️ Cannot send report email: No valid recipient found (resolved recipient: "${targetTo}"). Simulating instead.`);
      return { simulated: true, stats: { totalLent, totalBorrowed, bankBalance, netWorth } };
    }

    // Scoping check for single contact reports
    const isScoped = !!contactFilter;
    const scopedContactName = contactFilter ? contactFilter.trim() : '';

    const activeLoans = isScoped 
      ? allLoans.filter(l => l.status === 'active' && l.contact_name?.trim().toLowerCase() === scopedContactName.toLowerCase())
      : allLoans.filter(l => l.status === 'active');

    // Calculate report statistics
    const totalLent = activeLoans.filter(l => l.type === 'lend').reduce((acc, curr) => acc + parseFloat(curr.outstanding_amount), 0);
    const totalBorrowed = activeLoans.filter(l => l.type === 'borrow').reduce((acc, curr) => acc + parseFloat(curr.outstanding_amount), 0);
    const bankBalance = isScoped ? 0 : allAccounts.reduce((acc, curr) => acc + parseFloat(curr.balance), 0);
    const netWorth = isScoped ? (totalLent - totalBorrowed) : (bankBalance + totalLent - totalBorrowed);

    // Accounts listing HTML (Hidden for privacy if scoped to a specific contact!)
    let accountsHtml = '';
    if (!isScoped) {
      accountsHtml = allAccounts.map(acc => `
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
          <span style="font-weight: 500; color: #334155;">${acc.name}</span>
          <span style="font-weight: 600; color: #0f172a;">₹${parseFloat(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      `).join('') || '<div style="color: #94a3b8; font-style: italic; text-align: center; padding: 12px 0;">No accounts linked.</div>';
    }

    // PERSON-WISE SEGREGATION GENERATOR (Group active loans dynamically by unique contacts)
    const uniqueReportContacts = Array.from(new Set(activeLoans.map(l => l.contact_name?.trim()).filter(Boolean))).sort();
    
    const personWiseHtml = uniqueReportContacts.map(contact => {
      const contactLoans = activeLoans.filter(l => l.contact_name?.trim().toLowerCase() === contact.toLowerCase());
      const contactLent = contactLoans.filter(l => l.type === 'lend').reduce((sum, l) => sum + parseFloat(l.outstanding_amount), 0);
      const contactBorrowed = contactLoans.filter(l => l.type === 'borrow').reduce((sum, l) => sum + parseFloat(l.outstanding_amount), 0);
      const contactNet = contactLent - contactBorrowed;
      
      const loansRows = contactLoans.map(l => `
        <div style="padding: 8px 0; border-bottom: 1px dotted #e2e8f0; font-size: 13px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: 600; color: ${l.type === 'lend' ? '#10b981' : '#f43f5e'}; text-transform: uppercase; font-size: 10px; letter-spacing: 0.02em;">
              ${l.type === 'lend' ? 'Lent Out (To Get)' : 'Borrowed (To Pay)'}
            </span>
            <span style="font-weight: 700; color: #0f172a;">
              ₹${parseFloat(l.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 2px;">
            <span>Original: ₹${parseFloat(l.amount).toLocaleString('en-IN')} | Due: ${l.due_date}</span>
            ${l.notes ? `<span style="font-style: italic; color: #475569;">"${l.notes}"</span>` : ''}
          </div>
        </div>
      `).join('');

      return `
        <div style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background-color: #fafafa;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
            <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">${contact}</h4>
            <span style="font-size: 12px; font-weight: 700; color: ${contactNet >= 0 ? '#10b981' : '#f43f5e'};">
              Net: ${contactNet >= 0 ? '+' : ''}₹${contactNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          ${loansRows}
        </div>
      `;
    }).join('') || '<div style="color: #94a3b8; font-style: italic; text-align: center; padding: 12px 0;">No active transactions logged.</div>';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>${emailStyles}</style>
      </head>
      <body>
        <div class="card" style="max-width: 650px;">
          <div class="header" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);">
            <div class="logo">
              <span class="logo-icon">◌⇄◌</span> LoanShare
            </div>
            <h1>${isScoped ? `Ledger Statement: ${scopedContactName}` : 'Portfolio Financial Report'}</h1>
            <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.7;">Generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
          </div>
          <div class="content">
            
            <div class="stat-grid" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px;">
              <div class="stat-card" style="flex: 1; min-width: 120px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; background-color: #ffffff;">
                <div class="stat-title" style="color: #10b981; font-size: 11px; font-weight: bold; margin-bottom: 4px;">Total Lent</div>
                <div class="stat-val" style="color: #10b981; font-size: 16px; font-weight: 800;">₹${totalLent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div class="stat-card" style="flex: 1; min-width: 120px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; background-color: #ffffff;">
                <div class="stat-title" style="color: #f43f5e; font-size: 11px; font-weight: bold; margin-bottom: 4px;">Total Borrowed</div>
                <div class="stat-val" style="color: #f43f5e; font-size: 16px; font-weight: 800;">₹${totalBorrowed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              
              ${!isScoped ? `
              <div class="stat-card" style="flex: 1; min-width: 120px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; background-color: #ffffff;">
                <div class="stat-title" style="color: #64748b; font-size: 11px; font-weight: bold; margin-bottom: 4px;">Bank Balance</div>
                <div class="stat-val" style="color: #0f172a; font-size: 16px; font-weight: 800;">₹${bankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              ` : ''}

              <div class="stat-card" style="flex: 1; min-width: 120px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; background-color: #f0fdf4; border-color: #bbf7d0;">
                <div class="stat-title" style="color: #15803d; font-size: 11px; font-weight: bold; margin-bottom: 4px;">${isScoped ? 'Net Balance' : 'Net Portfolio'}</div>
                <div class="stat-val" style="color: #15803d; font-size: 16px; font-weight: 800;">₹${netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            ${!isScoped ? `
            <h3 style="margin: 24px 0 12px 0; font-size: 15px; border-bottom: 2px solid #0f172a; padding-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
              <span>🏦 Bank Accounts</span>
              <span style="font-size: 12px; color: #64748b; font-weight: normal;">Total: ₹${bankBalance.toLocaleString('en-IN')}</span>
            </h3>
            ${accountsHtml}
            ` : ''}

            <h3 style="margin: 32px 0 12px 0; font-size: 15px; border-bottom: 2px solid #6366f1; padding-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
              <span>👤 ${isScoped ? 'Scoped Statement Ledger' : 'Active Balances Person-Wise'}</span>
              <span style="font-size: 12px; color: #6366f1; font-weight: bold;">
                ${isScoped ? '' : `Net Owed: ${totalLent - totalBorrowed >= 0 ? '+' : ''}₹${(totalLent - totalBorrowed).toLocaleString('en-IN')}`}
              </span>
            </h3>
            ${personWiseHtml}

            <div class="divider" style="margin: 32px 0 20px 0; border-top: 1px solid #e2e8f0;"></div>
            <div style="text-align: center;">
              <a href="${appUrl}" class="btn" style="background-color: #0f172a; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open LoanShare Dashboard</a>
            </div>
          </div>
          <div class="footer" style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
            Report triggered from your dashboard.
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"LoanShare Reports" <${smtpUser}>`,
      to: targetTo,
      subject: isScoped 
        ? `📋 LoanShare Statement: ${scopedContactName} (Net Bal: ${netWorth >= 0 ? '+' : ''}₹${netWorth.toLocaleString('en-IN')})`
        : `📊 LoanShare: Complete Financial Report - Net Worth ₹${netWorth.toLocaleString('en-IN')}`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  }
};
