import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentCode, name, email, password, faceVectors } = body;

    // 1. ตรวจสอบว่ามี Email หรือรหัสนักศึกษานี้ในระบบหรือยัง
    const existingUser = await prisma.user.findUnique({ where: { email } });
    const existingStudent = await prisma.student.findUnique({ where: { studentCode } });

    if (existingUser || existingStudent) {
      return NextResponse.json(
        { success: false, error: 'อีเมลหรือรหัสนักศึกษานี้ถูกลงทะเบียนไปแล้ว' },
        { status: 400 }
      );
    }

    // 2. Hash รหัสผ่านเพื่อความปลอดภัย
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. 🚀 พระเอกของงาน: สร้าง User และ Student พร้อมกันและผูก Relation ทันที
    const newUser = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        role: 'STUDENT',
        username: studentCode, // ใช้รหัสนักศึกษาเป็น Username ไปเลย
        student: {
          create: {
            studentCode: studentCode,
            name: name,
            password: hashedPassword, // เก็บไว้ตาม Schema เดิมของบอส
            faceVectors: faceVectors || null,
          }
        }
      },
      include: {
        student: true // เพื่อตรวจสอบความสำเร็จ
      }
    });

    return NextResponse.json({
      success: true,
      message: 'ลงทะเบียนนักศึกษาเรียบร้อยแล้ว',
      data: { userId: newUser.id, studentId: newUser.student?.id }
    });

  } catch (error: any) {
    console.error("❌ Register Error:", error.message);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการลงทะเบียน' },
      { status: 500 }
    );
  }
}