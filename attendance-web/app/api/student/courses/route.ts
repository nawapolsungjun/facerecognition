// attendance-web/app/api/student/courses/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studentIdParam = searchParams.get('studentId');

  if (!studentIdParam) {
    return NextResponse.json({ success: false, error: 'Missing studentId' }, { status: 400 });
  }

  try {
    let numericStudentId: number | null = null;
    const isNumeric = !isNaN(Number(studentIdParam)) && !isNaN(parseFloat(studentIdParam));

    if (isNumeric) {
      numericStudentId = Number(studentIdParam);
    } else {
      const userRecord = await prisma.user.findFirst({
        where: { id: studentIdParam },
        select: {
          student: {
            select: { id: true }
          }
        }
      });

      if (userRecord?.student?.id) {
        numericStudentId = Number(userRecord.student.id);
      } else {
        const studentRecord = await prisma.student.findFirst({
          where: {
            OR: [
              { studentCode: studentIdParam },
              { id: isNaN(parseInt(studentIdParam, 10)) ? undefined : parseInt(studentIdParam, 10) }
            ]
          },
          select: { id: true }
        });

        if (studentRecord) {
          numericStudentId = Number(studentRecord.id);
        }
      }
    }

    if (numericStudentId === null) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลนักศึกษาในระบบ' }, { status: 404 });
    }

    // 1. ดึงข้อมูลนักศึกษาพร้อมรายวิชา และตัดฟิลด์ name ของ Teacher ที่ไม่มีใน Schema ออก
    const studentWithCourses = await prisma.student.findUnique({
      where: { id: numericStudentId },
      include: {
        courses: {
          include: {
            teacher: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        },
        attendances: {
          select: {
            courseId: true,
            status: true
          }
        }
      }
    });

    if (!studentWithCourses) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลวิชาของนักศึกษาท่านนี้' }, { status: 404 });
    }

    // 2. จัด Format ข้อมูลส่งกลับพร้อมคำนวณสถิติและสิทธิ์การสอบรายวิชา
    const formattedCourses = studentWithCourses.courses.map((course) => {
      const teacherObj = course.teacher;
      const teacherFullName = teacherObj
        ? `${teacherObj.firstName || ''} ${teacherObj.lastName || ''}`.trim() || 'ไม่ระบุชื่ออาจารย์'
        : 'ไม่ระบุชื่ออาจารย์';

      const courseAttendances = studentWithCourses.attendances.filter(
        (a) => a.courseId === course.id
      );

      const total = courseAttendances.length;
      const present = courseAttendances.filter((a) => a.status === 'มาเรียน').length;
      const late = courseAttendances.filter((a) => a.status === 'มาสาย').length;
      const leave = courseAttendances.filter((a) => a.status === 'ลา').length;
      const absent = courseAttendances.filter((a) => a.status === 'ขาดเรียน').length;

      const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
      const MAX_ALLOWED_ABSENT = 3;
      const isExamEligible = absent <= MAX_ALLOWED_ABSENT;

      return {
        id: course.id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        teacherName: teacherFullName,
        summary: {
          total,
          present,
          late,
          leave,
          absent,
          percentage,
          isExamEligible
        }
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