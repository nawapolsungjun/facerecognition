import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json({ success: false, error: 'Missing studentId' }, { status: 400 });
  }

  try {
    let studentWithCourses = null;

    // 1. ตรวจสอบว่า studentId ที่ส่งมาเป็นตัวเลข (Int) หรือ String
    const isNumeric = !isNaN(Number(studentId)) && !isNaN(parseFloat(studentId));

    if (isNumeric) {
      // ค้นหาผ่านฟิลด์ id (Int)
      studentWithCourses = await prisma.student.findUnique({
        where: { id: Number(studentId) },
        include: {
          courses: { include: { teacher: true } }
        }
      });
    } else {
      // ค้นหาผ่านฟิลด์ userId (String)
      studentWithCourses = await prisma.student.findUnique({
        where: { userId: studentId },
        include: {
          courses: { include: { teacher: true } }
        }
      });
    }

    // 2. กรณีไม่พบข้อมูล
    if (!studentWithCourses) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลวิชาของนักศึกษาท่านนี้' }, { status: 404 });
    }

    // 3. จัด Format ข้อมูลส่งกลับ (ประกอบชื่อจาก firstName และ lastName)
    const formattedCourses = studentWithCourses.courses.map((course) => {
      const teacherFullName = course.teacher
        ? `${course.teacher.firstName || ''} ${course.teacher.lastName || ''}`.trim() || 'ไม่ระบุชื่ออาจารย์'
        : 'ไม่ระบุชื่ออาจารย์';

      return {
        id: course.id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        teacherName: teacherFullName,
      };
    });

    return NextResponse.json({ success: true, data: formattedCourses });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Database Error';
    console.error("Fetch Student Courses Error:", errorMessage);
    return NextResponse.json({ 
      success: false, 
      error: 'Database Error', 
      details: errorMessage 
    }, { status: 500 });
  }
}