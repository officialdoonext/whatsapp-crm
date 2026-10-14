import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_USER = process.env.SMTP_USER || "noreply@doonext.app";
const SMTP_PASS = (process.env.SMTP_PASS || "*#*#Arumulla@123*#*#").replace(/^"|"$/g, "");
const SMTP_FROM = process.env.SMTP_FROM || "GrowNext Security <noreply@doonext.app>";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465 (SSL), false for 587 (STARTTLS)
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export async function sendDeletionOtpEmail(toEmail: string, code: string) {
  const subject = `Your Account Deletion Code: ${code}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b1120; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <!-- Header -->
                <tr>
                  <td style="padding: 32px 32px 16px; text-align: center; border-bottom: 1px solid #1e293b;">
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ef4444; letter-spacing: -0.5px;">
                      ⚠️ Account Deletion Request
                    </h1>
                    <p style="margin: 8px 0 0; font-size: 13px; color: #94a3b8;">
                      GrowNext / WACRM Security Verification
                    </p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                      You requested to permanently delete your WACRM account and all its data.
                    </p>
                    <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                      Use the 6-digit confirmation code below to verify your request:
                    </p>

                    <!-- Code Box -->
                    <div style="background-color: #1e1b4b; border: 2px dashed #6366f1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; display: inline-block;">
                        ${code}
                      </span>
                      <p style="margin: 10px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #a5b4fc; font-weight: 600;">
                        Valid for 10 minutes
                      </p>
                    </div>

                    <!-- Warning -->
                    <div style="background-color: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
                      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #fca5a5;">
                        <strong>Warning:</strong> Entering this code will permanently delete all your WhatsApp messages, contacts, campaigns, automations, and account configurations. This cannot be undone.
                      </p>
                    </div>

                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                      If you did not request this, please ignore this email and your account will remain safe.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 32px; background-color: #090d16; text-align: center; border-top: 1px solid #1e293b;">
                    <p style="margin: 0; font-size: 11px; color: #475569;">
                      GrowNext Security &bull; Automated System Notice
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = `Account Deletion Request\n\nYour 6-digit verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nWarning: Entering this code will permanently erase all data associated with your WACRM account.`;

  return transporter.sendMail({
    from: SMTP_FROM,
    to: toEmail,
    subject,
    text,
    html,
  });
}
