import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs'; 
import jwt from 'jsonwebtoken';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // 1. ค้นหาผู้ใช้ พร้อมดึงข้อมูลจากตารางที่เกี่ยวข้อง (รวม student ด้วยเผื่อกรณีนักศึกษาล็อกอิน)
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        admin: true,   
        teacher: true,
        student: true,
      }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'ไม่พบผู้ใช้งานนี้ในระบบ' }, { status: 404 });
    }

    // 2. ตรวจสอบรหัสผ่าน
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ success: false, error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    // 3. สร้าง JWT Token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    // 4. ประกอบชื่อ-นามสกุลจาก firstName และ lastName ตาม Schema จริง
    let fullName = 'ผู้ใช้งาน';
    if (user.role === 'ADMIN' && user.admin) {
      fullName = `${user.admin.firstName || ''} ${user.admin.lastName || ''}`.trim() || 'ผู้ดูแลระบบ';
    } else if (user.role === 'TEACHER' && user.teacher) {
      fullName = `${user.teacher.firstName || ''} ${user.teacher.lastName || ''}`.trim() || 'อาจารย์';
    } else if (user.role === 'STUDENT' && user.student) {
      fullName = `${user.student.firstName || ''} ${user.student.lastName || ''}`.trim() || 'นักศึกษา';
    }

    const userData = {
      id: user.id,
      role: user.role,
      name: fullName,
      department: null, // ไม่มีฟิลด์นี้ในตาราง teacher คืนค่า null เพื่อไม่ให้ frontend พัง
    };

    return NextResponse.json({
      success: true,
      token,
      user: userData,
      role: user.role,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error("❌ Login API Error:", errorMessage);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}