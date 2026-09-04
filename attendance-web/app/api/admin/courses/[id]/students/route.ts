// attendance-web/app/api/admin/courses/[id]/students/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 1. [GET] ดึงข้อมูลรายวิชา, รายชื่อนักศึกษาในวิชาพร้อมประวัติการเช็คชื่อ และรายชื่อนักศึกษาทั้งหมด
export async function GET(
  req: Request, 
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const courseId = resolvedParams.id;

    if (!courseId) {
      return NextResponse.json({ success: false, error: "ไม่พบ Course ID" }, { status: 400 });
    }

    // ดึงข้อมูล Course พร้อม Teacher, Students และพ่วง Attendance เพื่อให้ข้อมูลประวัติครบถ้วน
    const courseInfo = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: true,
        students: {
          orderBy: { studentCode: 'asc' },
          include: {
            attendances: {
              where: { courseId: courseId },
              orderBy: [
                { updatedAt: 'desc' },
                { createdAt: 'desc' }
              ]
            }
          }
        }
      }
    });

    if (!courseInfo) {
      return NextResponse.json({ success: false, error: "ไม่พบรายวิชานี้ในระบบ" }, { status: 404 });
    }

    // ดึงรายชื่อนักศึกษาทั้งหมดในระบบมาเตรียมไว้สำหรับ Dropdown เพิ่มเข้าชั้นเรียน
    const allStudents = await prisma.student.findMany({
      orderBy: { studentCode: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: { 
        course: courseInfo, 
        allStudents: allStudents || [] 
      }
    });
  } catch (error: any) {
    console.error("GET Admin Course Students Error:", error);
    return NextResponse.json({ success: false, error: error.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}

// 2. [POST] แอดมินเพิ่มนักศึกษาเข้าไปในรายวิชานี้
export async function POST(
  req: Request, 
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const courseId = resolvedParams.id;
    const body = await req.json();
    const studentId = body?.studentId;

    if (!studentId) {
      return NextResponse.json({ success: false, error: "กรุณาระบุนักศึกษา" }, { status: 400 });
    }

    const parsedStudentId = parseInt(String(studentId), 10);
    if (isNaN(parsedStudentId)) {
      return NextResponse.json({ success: false, error: "รหัสไอดีนักศึกษาไม่ถูกต้อง" }, { status: 400 });
    }

    await prisma.course.update({
      where: { id: courseId },
      data: {
        students: {
          connect: { id: parsedStudentId }
        }
      }
    });

    return NextResponse.json({ success: true, message: "เพิ่มนักศึกษาเข้าชั้นเรียนสำเร็จ" });
  } catch (error: any) {
    console.error("POST Add Student Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 3. [DELETE] แอดมินคัดนักศึกษาออกจากรายวิชานี้
export async function DELETE(
  req: Request, 
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const courseId = resolvedParams.id;
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ success: false, error: "กรุณาระบุนักศึกษาที่จะลบ" }, { status: 400 });
    }

    const parsedStudentId = parseInt(studentId, 10);
    if (isNaN(parsedStudentId)) {
      return NextResponse.json({ success: false, error: "รหัสไอดีนักศึกษาไม่ถูกต้อง" }, { status: 400 });
    }

    await prisma.course.update({
      where: { id: courseId },
      data: {
        students: {
          disconnect: { id: parsedStudentId }
        }
      }
    });

    return NextResponse.json({ success: true, message: "คัดนักศึกษาออกจากรายวิชาสำเร็จ" });
  } catch (error: any) {
    console.error("DELETE Student Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 4. [PUT] แอดมินแก้ไขรหัสวิชาและชื่อรายวิชา
export async function PUT(
  req: Request, 
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const courseId = resolvedParams.id;
    const { courseCode, courseName } = await req.json();

    if (!courseCode?.trim() || !courseName?.trim()) {
      return NextResponse.json({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
    }

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        courseCode: courseCode.trim(),
        courseName: courseName.trim(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "อัปเดตข้อมูลรายวิชาสำเร็จเรียบร้อย", 
      data: updatedCourse 
    });
  } catch (error: any) {
    console.error("PUT Course Details Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}