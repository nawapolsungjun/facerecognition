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
 * [PUT] - อัปเดตโปรไฟล์นักศึกษา (ชื่อจริง, นามสกุล และรหัสผ่าน)
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, firstName, lastName, name, password } = body;
    const searchId = id ? String(id) : "";

    if (!searchId) {
      return NextResponse.json({ success: false, error: 'ไม่พบ ID ผู้ใช้ที่ส่งมา' }, { status: 400 });
    }

    // 1. ค้นหานักศึกษา
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: isNaN(Number(searchId)) ? -1 : Number(searchId) }, 
          { userId: searchId } 
        ]
      }
    });

    if (!student) {
      return NextResponse.json({ 
        success: false, 
        error: 'ไม่พบข้อมูลนักศึกษาในระบบ' 
      }, { status: 404 });
    }

    // จัดการชื่อจริงและนามสกุล
    let fName = firstName || '';
    let lName = lastName || '';

    if (!fName && name) {
      const parts = name.trim().split(/\s+/);
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ') || '';
    }

    // 2. อัปเดตข้อมูลแบบ Transaction (อัปเดตเฉพาะฟิลด์ที่มีในตาราง Student และ User จริง)
    await prisma.$transaction(async (tx) => {
      const studentUpdateData: any = {};
      if (fName) studentUpdateData.firstName = fName;
      if (lName) studentUpdateData.lastName = lName;

      // อัปเดตข้อมูลในตาราง Student ก่อน
      await tx.student.update({
        where: { id: student.id },
        data: studentUpdateData
      });

      // หากมีการส่งรหัสผ่านใหม่มา ให้แฮชและอัปเดตที่ตาราง User (เพราะตาราง Student ไม่มีฟิลด์ password)
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