import nodemailer from "nodemailer";

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function formatCurrency(amount) {
  return "\u20B9" + amount.toLocaleString("en-IN");
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

  try {
    await getTransporter().sendMail({
      from: `"YourTube" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: "YourTube Login Verification Code",
      html,
    });
    console.log("OTP email sent to:", email);
    return true;
  } catch (error) {
    console.error("Failed to send OTP email:", error.message);
    return false;
  }
}

export async function sendSubscriptionConfirmation(user, sub, planDef) {
  const supportEmail = "sautamkar00@gmail.com";
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
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
      .btn { display: inline-block; background: #f59e0b; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin: 10px 0; }
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

        <div class="detail-row">
          <span class="detail-label">Plan</span>
          <span class="detail-value">${planDef?.name || sub.plan}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Billing Cycle</span>
          <span class="detail-value">${CYCLE_LABELS[sub.billingCycle] || sub.billingCycle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Amount Paid</span>
          <span class="detail-value">${formatCurrency(sub.amountPaid)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Invoice Number</span>
          <span class="detail-value">${sub.invoiceNumber || "N/A"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Payment ID</span>
          <span class="detail-value">${sub.razorpayPaymentId || "N/A"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Order ID</span>
          <span class="detail-value">${sub.razorpayOrderId || "N/A"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Subscription Start</span>
          <span class="detail-value">${formatDate(sub.startDate)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Valid Until</span>
          <span class="detail-value">${sub.expiryDate ? formatDate(sub.expiryDate) : "N/A"}</span>
        </div>
        <div class="detail-row" style="border-bottom:none;">
          <span class="detail-label">Auto-Renew</span>
          <span class="detail-value">${sub.autoRenew ? "Yes" : "No"}</span>
        </div>

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
        </div>
        ` : ""}

        <p style="font-size:14px; color:#666; margin-top:20px;">
          You can manage your subscription, view billing history, or cancel anytime from your
          <a href="http://localhost:3000/subscription" style="color:#f59e0b;">Subscription Dashboard</a>.
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

  try {
    await getTransporter().sendMail({
      from: `"YourTube" <${process.env.SMTP_EMAIL}>`,
      to: user.email,
      subject: `YourTube ${planDef?.name || sub.plan} Subscription Confirmed - ${sub.invoiceNumber || ""}`,
      html,
    });
    console.log("Confirmation email sent to:", user.email);
    return true;
  } catch (error) {
    console.error("Failed to send confirmation email:", error.message);
    return false;
  }
}

export async function sendCancellationEmail(user, sub, planDef) {
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
        <p style="margin-top:20px;">Changed your mind? You can <a href="http://localhost:3000/subscription" style="color:#f59e0b;">reactivate your subscription</a> anytime before it expires.</p>
      </div>
      <div class="footer">
        <p>Questions? Contact us at <a href="mailto:sautamkar00@gmail.com">sautamkar00@gmail.com</a></p>
      </div>
    </div>
  </body>
  </html>
  `;

  try {
    await getTransporter().sendMail({
      from: `"YourTube" <${process.env.SMTP_EMAIL}>`,
      to: user.email,
      subject: `YourTube Subscription Cancelled`,
      html,
    });
    console.log("Cancellation email sent to:", user.email);
    return true;
  } catch (error) {
    console.error("Failed to send cancellation email:", error.message);
    return false;
  }
}
