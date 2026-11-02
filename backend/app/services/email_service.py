import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)

def send_otp_email(to_email: str, recipient_name: str, otp_code: str, expiration_minutes: int = 10) -> bool:
    """
    Sends an OTP verification code for password reset via Gmail SMTP.
    """
    if not to_email:
        logger.error("No recipient email specified for OTP dispatch.")
        return False

    smtp_host = settings.SMTP_HOST or "smtp.gmail.com"
    smtp_port = settings.SMTP_PORT or 587
    smtp_user = settings.SMTP_USER or "aeslbs8@gmail.com"
    # Gmail app passwords often have spaces in UI, strip them for SMTP auth
    smtp_pass = (settings.SMTP_PASSWORD or "dura eonv ejor xues").replace(" ", "").strip()
    from_email = settings.SMTP_FROM_EMAIL or smtp_user
    from_name = settings.SMTP_FROM_NAME or "Adani Smart Meter Workforce Operations"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{otp_code} is your Adani Workforce Password Reset OTP"
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email

    # Plain text version
    text_content = f"""Dear {recipient_name or 'Field Employee'},

Your One-Time Password (OTP) for resetting your Adani Smart Meter Workforce account password is:

{otp_code}

This OTP is valid for {expiration_minutes} minutes. Please do not share this code with anyone.

If you did not request this password reset, please ignore this message or report it to your Operations Administrator.

Best regards,
Adani Smart Meter Operations Team
"""

    # Responsive HTML version with Adani Branding
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Adani Workforce Password Reset</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #0A192F 0%, #1E3A8A 100%); padding: 24px 32px; text-align: left;">
              <div style="color: #60A5FA; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">
                ADANI POWER & SMART METERS
              </div>
              <div style="color: #FFFFFF; font-size: 20px; font-weight: 700;">
                Field Workforce Security
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 15px; line-height: 22px; color: #334155; margin: 0 0 16px 0;">
                Hello <strong>{recipient_name or 'Field Employee'}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 24px 0;">
                We received a request to reset the password for your Adani Field Operations account. Use the verification code below to complete the reset:
              </p>

              <!-- OTP Code Display Box -->
              <div style="text-align: center; margin: 28px 0; padding: 20px; background-color: #EFF6FF; border: 1px dashed #3B82F6; border-radius: 10px;">
                <div style="font-size: 11px; font-weight: 700; color: #2563EB; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">
                  ONE-TIME VERIFICATION CODE
                </div>
                <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1E3A8A; font-family: 'Courier New', Courier, monospace;">
                  {otp_code}
                </div>
                <div style="font-size: 12px; color: #64748B; margin-top: 8px;">
                  Valid for <strong>{expiration_minutes} minutes</strong>
                </div>
              </div>

              <p style="font-size: 13px; line-height: 20px; color: #64748B; margin: 0 0 16px 0;">
                For your security, never share this OTP with anyone, including Adani field managers or supervisors.
              </p>

              <div style="padding: 12px 16px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px; margin-top: 24px;">
                <p style="font-size: 12px; line-height: 18px; color: #92400E; margin: 0;">
                  <strong>Didn't request this?</strong> If you did not initiate this password reset, please contact your Operations Administrator immediately.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center;">
              <p style="font-size: 11px; color: #94A3B8; margin: 0 0 4px 0;">
                Adani Energy Solutions Limited • Smart Meter Operations Portal
              </p>
              <p style="font-size: 11px; color: #CBD5E1; margin: 0;">
                This is an automated system notification. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    part1 = MIMEText(text_content, "plain")
    part2 = MIMEText(html_content, "html")
    msg.attach(part1)
    msg.attach(part2)

    try:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=12)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(from_email, [to_email], msg.as_string())
        server.quit()
        logger.info(f"Successfully dispatched password reset OTP email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {e}")
        return False

