import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * [PUT] - อัปเดตข้อมูลผู้ใช้ (อาจารย์ และ นักศึกษา) โดย Admin
 * รองรับการแก้ไข: ชื่อจริง, นามสกุล, อีเมล, username, รหัสนักศึกษา และรหัสผ่านใหม่
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { 
      id, 
      firstName, 
      lastName, 
      name, 
      role, 
      studentCode, 
      email, 
      username, 
      password 
    } = body;

    // ตรวจสอบความพร้อมของข้อมูลพื้นฐาน
    if (!id) {
      return NextResponse.json({ success: false, error: 'ไม่พบ ID ผู้ใช้ที่ต้องการอัปเดต' }, { status: 400 });
    }

    // 1. ตรวจสอบว่า User คนนี้มีอยู่จริงหรือไม่
    const currentUser = await prisma.user.findUnique({
      where: { id: id },
    });

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลผู้ใช้ในระบบ' }, { status: 404 });
    }

    // กำหนด username ที่ต้องการใช้ (ถ้าไม่ส่งมา ให้ใช้ค่าเดิมของ User)
    const targetUsername = username?.trim() || (role === 'STUDENT' && studentCode?.trim() ? studentCode.trim() : currentUser.username);
    const targetEmail = email !== undefined ? email?.trim() : currentUser.email;

    // 2. ตรวจสอบว่า Username ซ้ำกับ User "คนอื่น" หรือไม่
    if (targetUsername && targetUsername !== currentUser.username) {
      const duplicateUsername = await prisma.user.findFirst({
        where: {
          username: targetUsername,
          NOT: { id: id },
        },
      });

      if (duplicateUsername) {
        return NextResponse.json({ 
          success: false, 
          error: `ชื่อผู้ใช้งาน (Username) "${targetUsername}" มีผู้ใช้งานอื่นใช้แล้ว` 
        }, { status: 400 });
      }
    }

    // 3. ตรวจสอบว่า Email ซ้ำกับ User "คนอื่น" หรือไม่ (ถ้ามี email)
    if (targetEmail && targetEmail !== currentUser.email) {
      const duplicateEmail = await prisma.user.findFirst({
        where: {
          email: targetEmail,
          NOT: { id: id },
        },
      });

      if (duplicateEmail) {
        return NextResponse.json({ 
          success: false, 
          error: `อีเมล "${targetEmail}" มีผู้ใช้งานอื่นใช้แล้ว` 
        }, { status: 400 });
      }
    }

    // จัดการชื่อจริงและนามสกุล (รองรับทั้งแยกฟิลด์และส่งรวมมา)
    let fName = firstName || '';
    let lName = lastName || '';

    if (!fName && name) {
      const parts = name.trim().split(/\s+/);
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ') || '';
    }

    // 4. เตรียมข้อมูลสำหรับอัปเดตตารางหลัก (User Table)
    const userData: any = {};

    if (targetEmail !== undefined) userData.email = targetEmail;
    if (targetUsername) userData.username = targetUsername;

    // ตรวจสอบว่ามีการส่งรหัสผ่านใหม่มาเพื่อ Reset หรือไม่
    let passwordChanged = false;
    if (password && password.trim().length > 0) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      userData.password = hashedPassword;
      passwordChanged = true;
    }

    // อัปเดตตาราง User
    await prisma.user.update({
      where: { id: id },
      data: userData,
    });

    // 5. แยกอัปเดตข้อมูลเฉพาะตามบทบาท (Role-based Update)
    if (role === 'TEACHER') {
      const teacherUpdateData: any = {};
      if (fName) teacherUpdateData.firstName = fName;
      if (lName) teacherUpdateData.lastName = lName;

      await prisma.teacher.updateMany({
        where: { userId: id },
        data: teacherUpdateData,
      });
    } else if (role === 'STUDENT') {
      const studentUpdateData: any = {};
      if (fName) studentUpdateData.firstName = fName;
      if (lName) studentUpdateData.lastName = lName;

      if (studentCode?.trim()) {
        studentUpdateData.studentCode = studentCode.trim();
      }

      if (userData.password) {
        studentUpdateData.password = userData.password;
      }

      await prisma.student.updateMany({
        where: { userId: id },
        data: studentUpdateData,
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: passwordChanged 
        ? 'บันทึกข้อมูลและรีเซ็ตรหัสผ่านเรียบร้อยแล้ว' 
        : 'บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว' 
    });

  } catch (error: any) {
    console.error("Update User Error:", error);
    
    // จัดการ Error กรณี Unique Constraint ซ้ำ (P2002)
    if (error.code === 'P2002') {
      const targetFields = error.meta?.target ? ` (${error.meta.target})` : '';
      return NextResponse.json({ 
        success: false, 
        error: `ข้อมูล${targetFields} ซ้ำกับผู้ใช้งานอื่นในระบบ` 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถอัปเดตข้อมูลได้')
    }, { status: 500 });
  }
}