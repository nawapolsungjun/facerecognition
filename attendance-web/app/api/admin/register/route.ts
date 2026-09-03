import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      name, 
      role, 
      employeeId, 
      studentCode, 
      username 
    } = body;

    let fName = firstName || '';
    let lName = lastName || '';

    if (!fName && name) {
      const parts = name.trim().split(/\s+/);
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ') || '';
    }

    if (!email || !password || !role) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // 1. ตรวจสอบความซ้ำซ้อนของอีเมล
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'อีเมลนี้ถูกใช้งานในระบบแล้ว' },
        { status: 400 }
      );
    }

    // 2. ตรวจสอบรหัสนักศึกษาซ้ำ
    if (role === 'STUDENT') {
      if (!studentCode) {
        return NextResponse.json(
          { success: false, error: 'กรุณาระบุรหัสนักศึกษา' },
          { status: 400 }
        );
      }

      const existingStudent = await prisma.student.findUnique({
        where: { studentCode }
      });
      if (existingStudent) {
        return NextResponse.json(
          { success: false, error: 'รหัสนักศึกษานี้มีอยู่ในระบบแล้ว' },
          { status: 400 }
        );
      }
    }

    // 3. Hash รหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. บันทึกข้อมูลด้วย Transaction
    const newUser = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const finalUsername = role === 'STUDENT' ? studentCode : (username || email.split('@')[0]);

      const user = await tx.user.create({
        data: {
          email,
          username: finalUsername,
          password: hashedPassword,
          role: role,
        },
      });

      if (role === 'TEACHER') {
        await tx.teacher.create({
          data: {
            userId: user.id,
            firstName: fName,
            lastName: lName,
          },
        });
      } else if (role === 'ADMIN') {
        await tx.admin.create({
          data: {
            userId: user.id,
            firstName: fName,
            lastName: lName,
            employeeId: employeeId || null,
          },
        });
      } else if (role === 'STUDENT') {
        await tx.student.create({
          data: {
            userId: user.id,
            studentCode: studentCode,
            firstName: fName,
            lastName: lName,
            password: hashedPassword,
          },
        });
      }

      return user;
    });

    return NextResponse.json({
      success: true,
      message: `ลงทะเบียนผู้ใช้ ${role} สำเร็จแล้ว`,
      data: { userId: newUser.id }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error("Admin Register Error:", errorMessage);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์: ' + errorMessage },
      { status: 500 }
    );
  }
}