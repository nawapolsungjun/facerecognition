// attendance-web/app/api/courses/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

// ฟังก์ชันสุ่มรหัสเข้าร่วมชั้นเรียน (Join Code) 6 หลัก
function generateJoinCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 🔍 [GET] - ดึงรายการวิชาของอาจารย์ (เฉพาะที่ ACTIVE)
 * ใช้สำหรับ: แสดงผลหน้า Dashboard หลัก
 */
export async function GET() {
  try {
    const headerList = await headers();
    const authHeader = headerList.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // หา teacherId ของอาจารย์ที่ Login อยู่
    const teacher = await prisma.teacher.findUnique({
      where: { userId: decoded.userId }
    });

    if (!teacher) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // 🚀 ดึงเฉพาะวิชาที่ status เป็น ACTIVE เท่านั้น
    const courses = await prisma.course.findMany({
      where: { 
        teacherId: teacher.id,
        status: 'ACTIVE' // ✅ กรองวิชาที่ Archive ทิ้งไป
      },
      orderBy: {
        createdAt: 'desc' // เรียงตามวิชาที่สร้างล่าสุด
      },
      include: {
        _count: {
          select: { students: true } // แถมยอดจำนวนนักศึกษาไปโชว์ที่การ์ดด้วย
        }
      }
    });

    return NextResponse.json({ success: true, data: courses });

  } catch (error: any) {
    console.error("❌ Fetch Courses Error:", error.message);
    return NextResponse.json({ success: false, error: 'ไม่สามารถโหลดรายวิชาได้' }, { status: 500 });
  }
}

/**
 * ➕ [POST] - สร้างรายวิชาใหม่โดยอาจารย์ (รองรับ Section, Semester, AcademicYear และสุ่ม Join Code)
 */
export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const authHeader = headerList.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนสร้างวิชา' }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    const teacher = await prisma.teacher.findUnique({
      where: { userId: decoded.userId }
    });

    if (!teacher) {
      return NextResponse.json({ success: false, error: 'ไม่พบสิทธิ์อาจารย์ในระบบ' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      courseCode, 
      courseName, 
      section = "1", 
      semester = "1", 
      academicYear = "2569" 
    } = body;

    if (!courseCode || !courseName) {
      return NextResponse.json({ success: false, error: 'กรุณากรอกรหัสวิชาและชื่อวิชา' }, { status: 400 });
    }

    // ตรวจสอบว่าวิชานี้และกลุ่มนี้ เปิดไปแล้วหรือยังในเทอมและปีการศึกษานี้
    const existingCourse = await prisma.course.findFirst({
      where: {
        courseCode: courseCode.trim(),
        section: section.trim(),
        semester: semester.trim(),
        academicYear: academicYear.trim(),
      }
    });

    if (existingCourse) {
      return NextResponse.json(
        { success: false, error: 'รายวิชานี้และกลุ่มเรียนนี้ ถูกเปิดไปแล้วในภาคเรียน/ปีการศึกษานี้' }, 
        { status: 400 }
      );
    }

    // สุ่มรหัส Join Code และตรวจสอบไม่ให้ซ้ำในระบบ
    let newJoinCode = '';
    let isUnique = false;
    while (!isUnique) {
      newJoinCode = generateJoinCode();
      const checkCode = await prisma.course.findUnique({
        where: { joinCode: newJoinCode }
      });
      if (!checkCode) {
        isUnique = true;
      }
    }

    const newCourse = await prisma.course.create({
      data: {
        courseCode: courseCode.trim(),
        courseName: courseName.trim(),
        section: section.trim(),
        semester: semester.trim(),
        academicYear: academicYear.trim(),
        joinCode: newJoinCode,
        teacherId: teacher.id, 
        status: 'ACTIVE'
      },
    });

    return NextResponse.json({ success: true, data: newCourse });

  } catch (error: any) {
    console.error("❌ Create Course Error:", error.message);
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการสร้างวิชา: ' + error.message }, { status: 500 });
  }
}