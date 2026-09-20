// attendance-web/app/api/student/login/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { studentCode, password } = await req.json();

    if (!studentCode || !password) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกรหัสนักศึกษา/อีเมล และรหัสผ่าน' },
        { status: 400 }
      );
    }

    const trimmedInput = studentCode.trim();

    // ค้นหา User จาก username, email ตรงๆ, email ของสถาบัน หรือ studentCode ในตาราง student
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: trimmedInput },
          { email: trimmedInput },
          { email: `${trimmedInput}@mail.rmutk.ac.th` },
          {
            student: {
              studentCode: trimmedInput
            }
          }
        ]
      },
      include: {
        student: true
      }
    });

    // 1. ถ้าค้นหาไม่พบบัญชีใดๆ ในระบบเลย
    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' },
        { status: 401 }
      );
    }

    // 2. ถ้าพบบัญชี แต่บทบาทไม่ใช่ STUDENT (เช่น อาจารย์ หรือ แอดมิน)
    if (user.role !== 'STUDENT') {
      return NextResponse.json(
        { success: false, error: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานในส่วนของนักศึกษา' },
        { status: 403 }
      );
    }

    // 3. ตรวจสอบรหัสผ่าน
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'รหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    // 4. ตรวจสอบข้อมูลในตาราง Student
    if (!user.student) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลนักศึกษาที่ผูกกับบัญชีนี้' },
        { status: 403 }
      );
    }

    const studentFullName = `${user.student.firstName || ''} ${user.student.lastName || ''}`.trim() || 'นักศึกษา';

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: studentFullName,
        studentCode: user.student.studentCode,
        role: user.role
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error("Student Login API Error:", errorMessage);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}