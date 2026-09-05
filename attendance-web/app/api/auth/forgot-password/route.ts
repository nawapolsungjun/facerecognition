// attendance-web/app/api/auth/forgot-password/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendResetPasswordEmail } from '@/lib/mail';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'กรุณากรอกอีเมล' }, { status: 400 });
    }

    // 1. ค้นหาผู้ใช้จากอีเมล
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // เพื่อความปลอดภัย: ถึงจะไม่พบอีเมลในระบบ ก็ควรตอบกลับว่าส่งสำเร็จแล้ว 
    // เพื่อป้องกันผู้ไม่หวังดีสุ่มเช็กรายชื่ออีเมลที่มีในระบบ (Security Best Practice)
    if (!user) {
      return NextResponse.json({ 
        success: true, 
        message: 'หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว' 
      });
    }

    // 2. สร้าง Token สุ่มความปลอดภัยสูง และกำหนดเวลาหมดอายุ (15 นาที)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 นาทีข้างหน้า

    // 3. บันทึก Token ลงในฐานข้อมูลของ User คนนั้น
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // 4. สร้างลิงก์สำหรับรีเซ็ตรหัสผ่าน (อ้างอิงจาก Domain ของเว็บปัจจุบัน)
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const resetUrl = `${protocol}://${host}/reset-password?token=${resetToken}`;

    // 5. ส่งอีเมล
    const emailResult = await sendResetPasswordEmail(user.email, resetUrl);

    if (!emailResult.success) {
      return NextResponse.json({ success: false, error: 'ไม่สามารถส่งอีเมลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว' 
    });

  } catch (error: any) {
    console.error('Forgot Password Error:', error);
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
  }
}