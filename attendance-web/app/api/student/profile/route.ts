// attendance-web/app/api/student/profile/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

/**
 * [GET] - ดึงข้อมูลโปรไฟล์นักศึกษา (รองรับค้นหาทั้งจาก userId และ id)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId'); 

    if (!studentId || studentId === 'undefined' || studentId === 'null') {
      return NextResponse.json({ success: false, error: 'ID นักศึกษาไม่ถูกต้อง' }, { status: 400 });
    }

    const student = await prisma.student.findFirst({
      where: { 
        OR: [
          { userId: studentId },
          { id: isNaN(Number(studentId)) ? -1 : Number(studentId) }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentCode: true,
        faceVectors: true,
        userId: true,
      }
    });

    if (!student) {
      console.warn(`[Profile API] ไม่พบข้อมูลนักศึกษาสำหรับ ID: ${studentId}`);
      return NextResponse.json({ 
        success: false, 
        error: 'ไม่พบข้อมูลนักศึกษาในระบบ' 
      }, { status: 404 });
    }

    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'ไม่ระบุชื่อ';

    return NextResponse.json({ 
      success: true, 
      data: {
        ...student,
        name: fullName
      }
    });

  } catch (error: any) {
    console.error("[GET Profile Error]:", error.message);
    return NextResponse.json({ success: false, error: 'Server Error: ' + error.message }, { status: 500 });
  }
}

/**
 * [PUT] - อัปเดตโปรไฟล์นักศึกษา (ชื่อจริง, นามสกุล และรหัสผ่าน พร้อมตรวจสอบรหัสผ่านเดิม)
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, firstName, lastName, name, oldPassword, password } = body;
    const searchId = id ? String(id) : "";

    if (!searchId) {
      return NextResponse.json({ success: false, error: 'ไม่พบ ID ผู้ใช้ที่ส่งมา' }, { status: 400 });
    }

    // 1. ค้นหานักศึกษาและดึงข้อมูลเชื่อมโยงไปยังตาราง User เพื่อตรวจสอบรหัสผ่านเดิม
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: isNaN(Number(searchId)) ? -1 : Number(searchId) }, 
          { userId: searchId } 
        ]
      },
      include: {
        user: true // ดึงข้อมูล User มาเช็ครหัสผ่าน
      }
    });

    if (!student) {
      return NextResponse.json({ 
        success: false, 
        error: 'ไม่พบข้อมูลนักศึกษาในระบบ' 
      }, { status: 404 });
    }

    // 🔒 หากมีการกรอกรหัสผ่านใหม่ ต้องตรวจสอบรหัสผ่านเดิมก่อน
    if (password && password.trim().length > 0) {
      if (!oldPassword) {
        return NextResponse.json({ success: false, error: 'กรุณากรอกรหัสผ่านเดิมเพื่อยืนยันการเปลี่ยนรหัสผ่าน' }, { status: 400 });
      }

      if (!student.user || !student.user.password) {
        return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลบัญชีผู้ใช้สำหรับตรวจสอบรหัสผ่าน' }, { status: 400 });
      }

      // เปรียบเทียบรหัสผ่านเดิมกับค่าที่แฮชไว้ในฐานข้อมูล
      const isPasswordValid = await bcrypt.compare(oldPassword, student.user.password);
      if (!isPasswordValid) {
        return NextResponse.json({ success: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' }, { status: 400 });
      }
    }

    // จัดการชื่อจริงและนามสกุล
    let fName = firstName || '';
    let lName = lastName || '';

    if (!fName && name) {
      const parts = name.trim().split(/\s+/);
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ') || '';
    }

    // 2. อัปเดตข้อมูลแบบ Transaction
    await prisma.$transaction(async (tx) => {
      const studentUpdateData: any = {};
      if (fName) studentUpdateData.firstName = fName;
      if (lName) studentUpdateData.lastName = lName;

      // อัปเดตข้อมูลในตาราง Student
      await tx.student.update({
        where: { id: student.id },
        data: studentUpdateData
      });

      // หากผ่านการตรวจสอบรหัสผ่านเดิมแล้ว ให้แฮชและอัปเดตที่ตาราง User
      if (password && password.trim().length > 0) {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        if (student.userId) {
          await tx.user.update({
            where: { id: student.userId }, 
            data: { password: hashedPassword }
          });
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'บันทึกการเปลี่ยนแปลงข้อมูลเรียบร้อยแล้ว' 
    });

  } catch (error: any) {
    console.error("[PUT Profile Error]:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}