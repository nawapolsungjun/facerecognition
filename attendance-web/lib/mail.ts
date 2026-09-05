// attendance-web/lib/mail.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendResetPasswordEmail(email: string, resetUrl: string) {
  try {
    const mailOptions = {
      from: `"ระบบตรวจสอบรายชื่อ" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'ลิงก์สำหรับรีเซ็ตรหัสผ่านของคุณ',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #0f766e;">รีเซ็ตรหัสผ่านบัญชีของคุณ</h2>
          <p>คุณได้รับอีเมลฉบับนี้เนื่องจากมีการร้องขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณในระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า</p>
          <p>กรุณาคลิกที่ปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์นี้จะหมดอายุใน 15 นาที):</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">ตั้งรหัสผ่านใหม่</a>
          </div>
          <p style="color: #64748b; font-size: 12px;">หากคุณไม่ได้เป็นผู้ขอรีเซ็ตรหัสผ่าน โปรดเพิกเฉยต่ออีเมลฉบับนี้</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    console.error('Send Email Error:', error);
    return { success: false, error: error.message };
  }
}