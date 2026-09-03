import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // รับค่า userId (UUID) และ faceVectors (Array หรือ JSON String)
    const { userId, faceVectors } = body;

    // 1. ตรวจสอบข้อมูลเบื้องต้น
    if (!userId || !faceVectors) {
      return NextResponse.json({ 
        success: false, 
        error: 'ข้อมูลไม่ครบถ้วน (ขาด ID หรือ ข้อมูลใบหน้า)' 
      }, { status: 400 });
    }

    // 2. ตรวจสอบว่ามีนักศึกษาคนนี้อยู่ในระบบจริงไหม
    const student = await prisma.student.findFirst({
      where: { userId: userId },
    });

    if (!student) {
      return NextResponse.json({ 
        success: false, 
        error: 'ไม่พบข้อมูลนักศึกษาในระบบ กรุณาติดต่อแอดมิน' 
      }, { status: 404 });
    }

    // 3. อัปเดตข้อมูลใบหน้าลงในฐานข้อมูล
    const updatedStudent = await prisma.student.update({
      where: { 
        id: student.id
      },
      data: {
        faceVectors: typeof faceVectors === 'string' ? faceVectors : JSON.stringify(faceVectors),
      },
    });

    const studentFullName = `${updatedStudent.firstName || ''} ${updatedStudent.lastName || ''}`.trim() || 'ไม่ระบุชื่อ';

    console.log(`✅ [SUCCESS] Face vectors updated for: ${studentFullName} (${updatedStudent.studentCode})`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'ลงทะเบียนใบหน้าเข้าสู่ระบบสำเร็จแล้ว!',
      data: { 
        name: studentFullName,
        studentCode: updatedStudent.studentCode 
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error("🔴 FACE REGISTRATION API ERROR:", errorMessage);
    
    return NextResponse.json({ 
      success: false, 
      error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + errorMessage 
    }, { status: 500 });
  }
}