import nodemailer from "nodemailer";
import { google } from "googleapis";

const SEND_TIMEOUT_MS = 10000;

let smtpTransporter = null;
let gmailClient = null;

function hasGmailApiConfig() {
  return !!(
    (process.env.GMAIL_USER || process.env.SMTP_EMAIL) &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

function getGmailClient() {
  if (gmailClient) return gmailClient;
  if (!hasGmailApiConfig()) return null;

  const OAuth2 = google.auth.OAuth2;
  const oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  gmailClient = google.gmail({ version: "v1", auth: oauth2Client });
  return gmailClient;
}

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  const SMTP_EMAIL = process.env.SMTP_EMAIL;
  const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
  if (!SMTP_EMAIL || !SMTP_PASSWORD) return null;

  smtpTransporter = nodemailer.createTransport({
    service: "gmail",
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD },
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: 15000,
  });
  return smtpTransporter;
}

function getSenderEmail() {
  return process.env.GMAIL_USER || process.env.SMTP_EMAIL || "";
}

function encodeSubject(subject) {
  // RFC 2047 encoded-word for non-ASCII safety
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function buildRawMessage({ from, to, subject, html }) {
  const boundary = `yt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const textFallback = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(textFallback, "utf8").toString("base64"),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf8").toString("base64"),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const message = `${headers.join("\r\n")}\r\n\r\n${body}`;
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sendViaGmailApi({ to, subject, html }) {
  const gmail = getGmailClient();
  if (!gmail) return false;
  const fromEmail = getSenderEmail();
  if (!fromEmail) {
    console.error("[email] Cannot send - no sender email configured");
    return false;
  }
  const raw = buildRawMessage({
    from: `"YourTube" <${fromEmail}>`,
    to,
    subject,
    html,
  });
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return true;
}

async function sendViaSmtp({ to, subject, html }) {
  const t = getSmtpTransporter();
  if (!t) return false;
  const fromEmail = getSenderEmail();
  if (!fromEmail) return false;
  await t.sendMail({
    from: `"YourTube" <${fromEmail}>`,
    to,
    subject,
    html,
  });
  return true;
}

export async function verifyEmailTransport() {
  if (hasGmailApiConfig()) {
    try {
      const gmail = getGmailClient();
      await gmail.users.getProfile({ userId: "me" });
      console.log(`[email] Ready to send emails from ${getSenderEmail()} (Gmail API)`);
      return true;
    } catch (error) {
      console.error("[email] Verification failed (Gmail API):", error.message);
      return false;
    }
  }

  const t = getSmtpTransporter();
  if (!t) {
    console.error("[email] Email transport not configured");
    return false;
  }
  try {
    await t.verify();
    console.log(`[email] Ready to send emails from ${getSenderEmail()} (SMTP)`);
    return true;
  } catch (error) {
    console.error("[email] Verification failed (SMTP):", error.message);
    return false;
  }
}

async function sendMail({ to, subject, html }) {
  const started = Date.now();
  try {
    if (hasGmailApiConfig()) {
      const ok = await sendViaGmailApi({ to, subject, html });
      if (ok) {
        console.log(`[email] Sent to ${to} via Gmail API in ${Date.now() - started}ms`);
        return true;
      }
    }
    const ok = await sendViaSmtp({ to, subject, html });
    if (ok) {
      console.log(`[email] Sent to ${to} via SMTP in ${Date.now() - started}ms`);
      return true;
    }
    console.error(`[email] Cannot send to ${to} - no configured transport`);
    return false;
  } catch (error) {
    console.error(`[email] Failed to send to ${to}:`, error.message);
    return false;
  }
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(amount) {
  return "\u20B9" + Number(amount || 0).toLocaleString("en-IN");
}

const CYCLE_LABELS = { monthly: "Monthly", quarterly: "Quarterly (3 months)", yearly: "Yearly" };

export async function sendOtpEmail(email, otp, expiresInMinutes = 10) {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
      .container { max-width: 480px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 30px; text-align: center; }
      .header h1 { color: #fff; margin: 0; font-size: 22px; }
      .body { padding: 30px; text-align: center; }
      .otp { display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ef4444; background: #fff5f5; padding: 12px 24px; border-radius: 8px; margin: 20px 0; }
      .text { font-size: 14px; color: #444; line-height: 1.6; }
      .note { font-size: 12px; color: #888; margin-top: 20px; }
      .footer { background: #f4f4f4; padding: 16px 30px; text-align: center; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>YourTube</h1></div>
      <div class="body">
        <p class="text">Hi there,</p>
        <p class="text">Use the following One-Time Password (OTP) to verify your login. This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
        <div class="otp">${otp}</div>
        <p class="text">If you did not request this, please ignore this email.</p>
        <p class="note">For your security, never share this code with anyone.</p>
      </div>
      <div class="footer">YourTube &copy; ${new Date().getFullYear()}</div>
    </div>
  </body>
  </html>
  `;

  const sent = await sendMail({ to: email, subject: "YourTube Login Verification Code", html });
  if (sent) console.log("OTP email sent to:", email);
  return sent;
}

export async function sendNewDeviceOtpEmail(email, otp, deviceInfo, expiresInMinutes = 10) {
  const device = deviceInfo || {};
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
      .container { max-width: 480px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 30px; text-align: center; }
      .header h1 { color: #fff; margin: 0; font-size: 22px; }
      .body { padding: 30px; text-align: center; }
      .otp { display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ef4444; background: #fff5f5; padding: 12px 24px; border-radius: 8px; margin: 20px 0; }
      .text { font-size: 14px; color: #444; line-height: 1.6; }
      .note { font-size: 12px; color: #888; margin-top: 20px; }
      .device-box { background: #f8f8f8; border-radius: 8px; padding: 14px; margin: 16px 0; text-align: left; font-size: 13px; color: #333; }
      .device-box div { padding: 3px 0; }
      .footer { background: #f4f4f4; padding: 16px 30px; text-align: center; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>YourTube</h1></div>
      <div class="body">
        <p class="text">Hi there,</p>
        <p class="text">A new device just tried to sign in to your YourTube account. To protect your account, please verify this login. This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
        <div class="otp">${otp}</div>
        <div class="device-box">
          <div><strong>Device:</strong> ${device.deviceLabel || "Unknown"}</div>
          <div><strong>Browser:</strong> ${device.browser || "Unknown"}</div>
          <div><strong>OS:</strong> ${device.os || "Unknown"}</div>
          <div><strong>Approximate location:</strong> ${device.location || "Unknown"}</div>
        </div>
        <p class="text">If this wasn't you, your account may be at risk - please change your password.</p>
        <p class="note">For your security, never share this code with anyone. The new device will not be allowed in until the code is entered.</p>
      </div>
      <div class="footer">YourTube &copy; ${new Date().getFullYear()}</div>
    </div>
  </body>
  </html>
  `;

  const sent = await sendMail({ to: email, subject: "YourTube: New device sign-in verification", html });
  if (sent) console.log("New-device OTP email sent to:", email);
  return sent;
}

export async function sendSubscriptionConfirmation(user, sub, planDef) {
  const supportEmail = getSenderEmail() || "sautamkar00@gmail.com";
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; }
      .header { background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 30px; text-align: center; }
      .header h1 { color: #fff; margin: 0; font-size: 24px; }
      .header p { color: rgba(255,255,255,0.9); margin: 5px 0 0; }
      .body { padding: 30px; }
      .plan-badge { display: inline-block; background: ${planDef?.color || "#f59e0b"}20; color: ${planDef?.color || "#f59e0b"}; font-weight: bold; padding: 6px 16px; border-radius: 20px; font-size: 14px; }
      .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
      .detail-label { color: #666; font-size: 14px; }
      .detail-value { font-weight: 600; font-size: 14px; }
      .features { background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0; }
      .feature-item { padding: 6px 0; font-size: 14px; color: #333; }
      .footer { background: #f4f4f4; padding: 20px 30px; text-align: center; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>YourTube</h1>
        <p>Subscription Confirmation</p>
      </div>
      <div class="body">
        <p>Hi ${user.name || "there"},</p>
        <p>Your subscription has been successfully activated! Here are your details:</p>
        <div style="text-align:center; margin: 20px 0;">
          <span class="plan-badge">${planDef?.badge || sub.plan.toUpperCase()} Plan</span>
        </div>
        <div class="detail-row"><span class="detail-label">Plan</span><span class="detail-value">${planDef?.name || sub.plan}</span></div>
        <div class="detail-row"><span class="detail-label">Billing Cycle</span><span class="detail-value">${CYCLE_LABELS[sub.billingCycle] || sub.billingCycle}</span></div>
        <div class="detail-row"><span class="detail-label">Amount Paid</span><span class="detail-value">${formatCurrency(sub.amountPaid)}</span></div>
        <div class="detail-row"><span class="detail-label">Invoice Number</span><span class="detail-value">${sub.invoiceNumber || "N/A"}</span></div>
        <div class="detail-row"><span class="detail-label">Payment ID</span><span class="detail-value">${sub.razorpayPaymentId || "N/A"}</span></div>
        <div class="detail-row"><span class="detail-label">Order ID</span><span class="detail-value">${sub.razorpayOrderId || "N/A"}</span></div>
        <div class="detail-row"><span class="detail-label">Subscription Start</span><span class="detail-value">${formatDate(sub.startDate)}</span></div>
        <div class="detail-row"><span class="detail-label">Valid Until</span><span class="detail-value">${sub.expiryDate ? formatDate(sub.expiryDate) : "N/A"}</span></div>
        <div class="detail-row" style="border-bottom:none;"><span class="detail-label">Auto-Renew</span><span class="detail-value">${sub.autoRenew ? "Yes" : "No"}</span></div>
        ${planDef?.features ? `
        <div class="features">
          <h3 style="margin:0 0 10px; font-size:16px;">Your Features</h3>
          <div class="feature-item">${planDef.features.premiumVideos ? "\u2714" : "\u2716"} Premium Videos</div>
          <div class="feature-item">${"\u2714"} Max Quality: ${planDef.features.maxVideoQuality}</div>
          <div class="feature-item">${planDef.features.adFree ? "\u2714" : "\u2716"} Ad-Free Viewing</div>
          <div class="feature-item">${"\u2714"} Downloads: ${planDef.features.offlineDownloads === -1 ? "Unlimited" : planDef.features.offlineDownloads + "/day"}</div>
          <div class="feature-item">${"\u2714"} ${planDef.features.devicesSimultaneous} device(s) simultaneously</div>
          <div class="feature-item">${planDef.features.exclusiveCourses ? "\u2714" : "\u2716"} Exclusive Courses</div>
          <div class="feature-item">${planDef.features.priorityAccess ? "\u2714" : "\u2716"} Priority Access</div>
        </div>` : ""}
        <p style="font-size:14px; color:#666; margin-top:20px;">
          You can manage your subscription from your <a href="https://yourtube.vercel.app/subscription" style="color:#f59e0b;">Subscription Dashboard</a>.
        </p>
      </div>
      <div class="footer">
        <p>Questions? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
        <p>YourTube &copy; ${new Date().getFullYear()} | This is a receipt for your subscription purchase.</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const sent = await sendMail({
    to: user.email,
    subject: `YourTube ${planDef?.name || sub.plan} Subscription Confirmed - ${sub.invoiceNumber || ""}`,
    html,
  });
  if (sent) console.log("Confirmation email sent to:", user.email);
  return sent;
}

export async function sendCancellationEmail(user, sub, planDef) {
  const supportEmail = getSenderEmail() || "sautamkar00@gmail.com";
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; }
      .header { background: #6b7280; padding: 30px; text-align: center; }
      .header h1 { color: #fff; margin: 0; font-size: 24px; }
      .body { padding: 30px; }
      .footer { background: #f4f4f4; padding: 20px 30px; text-align: center; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>YourTube</h1></div>
      <div class="body">
        <p>Hi ${user.name || "there"},</p>
        <p>Your <strong>${planDef?.name || sub.plan}</strong> subscription has been cancelled.</p>
        <p>You will continue to have access until <strong>${sub.expiryDate ? formatDate(sub.expiryDate) : "the end of your billing period"}</strong>.</p>
        <p>After that, your account will be downgraded to the <strong>Free</strong> plan.</p>
      </div>
      <div class="footer">
        <p>Questions? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
      </div>
    </div>
  </body>
  </html>
  `;

  const sent = await sendMail({
    to: user.email,
    subject: "YourTube Subscription Cancelled",
    html,
  });
  if (sent) console.log("Cancellation email sent to:", user.email);
  return sent;
}
