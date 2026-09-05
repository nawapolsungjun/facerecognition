// attendance-web/app/api/auth/reset-password/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token, password } = body;

        if (!token || !password) {
            return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
        }

        // 1. ค้นหา User ที่มี Token ตรงกันและยังไม่หมดอายุ
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: {
                    gt: new Date(), // ต้องมากกว่าเวลาปัจจุบัน (ยังไม่หมดอายุ)
                },
            },
        });

        if (!user) {
            return NextResponse.json({
                success: false,
                error: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาขอใหม่อีกครั้ง'
            }, { status: 400 });
        }

        // 2. แฮชรหัสผ่านใหม่
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. อัปเดตรหัสผ่านใหม่ และเคลียร์ค่า Token ทิ้ง (เพื่อให้ใช้ได้ครั้งเดียว)
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null,
            },
        });

        return NextResponse.json({
            success: true,
            role: user.role, // ส่ง role กลับไปให้หน้าบ้านรู้
            message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว'
        });

    } catch (error: any) {
        console.error('Reset Password Error:', error);
        return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}