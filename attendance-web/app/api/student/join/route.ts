// attendance-web/app/api/student/join/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, joinCode } = body;

    if (!studentId || !joinCode) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน (studentId และ joinCode)' },
        { status: 400 }
      );
    }

    const rawIdStr = String(studentId).trim();
    const parsedIntId = parseInt(rawIdStr, 10);

    // 1. ค้นหานักศึกษา (ป้องกัน Error: userId ต้องเป็น String, id ต้องเป็น Int)
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { userId: rawIdStr },
          ...(!isNaN(parsedIntId) ? [{ id: parsedIntId }] : [])
        ]
      }
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลนักศึกษาในระบบ' },
        { status: 404 }
      );
    }

    // 2. ค้นหารายวิชาจาก joinCode (แปลงเป็นตัวพิมพ์ใหญ่เสมอ)
    const course = await prisma.course.findUnique({
      where: { 
        joinCode: String(joinCode).trim().toUpperCase() 
      },
      include: {
        students: {
          select: { id: true }
        }
      }
    });

    if (!course) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายวิชาจากรหัส Join Code นี้ (โปรดตรวจสอบรหัสอีกครั้ง)' },
        { status: 404 }
      );
    }

    // 3. ตรวจสอบว่าเคยเข้าร่วมรายวิชานี้แล้วหรือไม่
    const isAlreadyJoined = course.students.some((s: any) => s.id === student.id);
    if (isAlreadyJoined) {
      return NextResponse.json(
        { success: false, error: 'คุณได้เข้าร่วมชั้นเรียนนี้แล้ว' },
        { status: 400 }
      );
    }

    // 4. ผูกนักศึกษาเข้ากับรายวิชา
    await prisma.course.update({
      where: { id: course.id },
      data: {
        students: {
          connect: { id: student.id }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'เข้าร่วมชั้นเรียนสำเร็จเรียบร้อยแล้ว'
    });

  } catch (error: any) {
    console.error("Join Class API Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการเข้าร่วมชั้นเรียน' },
      { status: 500 }
    );
  }
}