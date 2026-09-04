import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * [GET] - ดึงรายวิชาทั้งหมดในระบบ และรายชื่ออาจารย์ทั้งหมดสำหรับ Dropdown
 */
export async function GET() {
  try {
    const [courses, teachers] = await prisma.$transaction([
      // 1. ดึงรายวิชาทั้งหมดพร้อมข้อมูลอาจารย์และจำนวนนักศึกษา
      prisma.course.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          },
          _count: {
            select: { students: true }
          }
        }
      }),
      // 2. ดึงอาจารย์ทั้งหมดมาแสดงในตัวเลือก
      prisma.teacher.findMany({
        orderBy: { firstName: 'asc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        }
      })
    ]);

    // จัดรูปแบบชื่ออาจารย์สำหรับแสดงผล
    const formattedCourses = courses.map((c: any) => {
      const teacherName = c.teacher 
        ? `${c.teacher.firstName || ''} ${c.teacher.lastName || ''}`.trim() 
        : null;
      return {
        ...c,
        teacherDisplayName: teacherName || 'ไม่พบผู้สอน / บัญชีถูกลบ'
      };
    });

    const formattedTeachers = teachers.map((t: any) => ({
      id: t.id,
      name: `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'ไม่ระบุชื่อ'
    }));

    return NextResponse.json({
      success: true,
      data: {
        courses: formattedCourses,
        teachers: formattedTeachers
      }
    });

  } catch (error: any) {
    console.error("Admin Courses GET Error:", error.message);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายวิชา: ' + error.message }, 
      { status: 500 }
    );
  }
}

/**
 * [POST] - สร้างวิชาใหม่โดยผูกเข้ากับ ID ของอาจารย์ที่แอดมินเลือก
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { courseCode, courseName, teacherId } = body;

    if (!courseCode || !courseName || !teacherId) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, 
        { status: 400 }
      );
    }

    // ตรวจสอบรหัสวิชาซ้ำ
    const existingCourse = await prisma.course.findUnique({
      where: { courseCode: courseCode.trim() }
    });

    if (existingCourse) {
      return NextResponse.json(
        { success: false, error: 'รหัสวิชานี้มีอยู่ในระบบแล้ว' }, 
        { status: 400 }
      );
    }

    const newCourse = await prisma.course.create({
      data: {
        courseCode: courseCode.trim(),
        courseName: courseName.trim(),
        teacherId: parseInt(teacherId, 10),
        status: 'ACTIVE'
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: newCourse,
      message: 'สร้างรายวิชาใหม่สำเร็จเรียบร้อย'
    });

  } catch (error: any) {
    console.error("Admin Courses POST Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการสร้างรายวิชา' }, 
      { status: 500 }
    );
  }
}

/**
 * [DELETE] - ลบรายวิชาออกจากระบบอย่างถาวร (พร้อมเคลียร์ข้อมูลความสัมพันธ์เพื่อป้องกัน Foreign Key Violation)
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบ ID รายวิชาที่ต้องการลบ' }, 
        { status: 400 }
      );
    }

    // ใช้ Transaction เพื่อเคลียร์ข้อมูลที่เกี่ยวข้องทั้งหมดก่อนลบคอร์ส
    await prisma.$transaction(async (tx) => {
      // 1. ลบข้อมูลการเข้าเรียน (Attendance) ทั้งหมดของวิชานี้
      await tx.attendance.deleteMany({
        where: { courseId: id }
      });

      // 2. ลบเซสชันการเช็คชื่อ (AttendanceSession) ทั้งหมดของวิชานี้
      await tx.attendanceSession.deleteMany({
        where: { courseId: id }
      });

      // 3. ตัดความสัมพันธ์ของนักศึกษาที่ลงทะเบียนในวิชานี้ออก
      await tx.course.update({
        where: { id: id },
        data: {
          students: {
            set: []
          }
        }
      });

      // 4. ลบรายวิชา
      await tx.course.delete({
        where: { id: id }
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: 'ลบรายวิชาออกจากระบบเรียบร้อยแล้ว' 
    });

  } catch (error: any) {
    console.error("Admin Courses DELETE Error:", error.message);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถลบรายวิชาได้: ' + error.message }, 
      { status: 500 }
    );
  }
}