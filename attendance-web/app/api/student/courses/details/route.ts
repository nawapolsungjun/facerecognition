// attendance-web/app/api/student/courses/details/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const studentIdParam = searchParams.get('studentId');

    if (!courseId || !studentIdParam) {
      return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    // 1. ดึงข้อมูลรายวิชา, ผู้สอน และเพื่อนร่วมคลาส
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        students: {
          select: {
            id: true,
            studentCode: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!course) {
      return NextResponse.json({ success: false, error: 'ไม่พบรายวิชา' }, { status: 404 });
    }

    // 2. ค้นหา numeric studentId (Int) และ studentCode สำหรับจับคู่ประวัติ
    let numericStudentId: number | null = null;
    let studentCodeStr = '';
    const parsed = parseInt(studentIdParam, 10);

    if (!isNaN(parsed)) {
      numericStudentId = parsed;
      const foundSt = course.students.find((s: any) => s.id === numericStudentId);
      if (foundSt) studentCodeStr = foundSt.studentCode || '';
    } else {
      const userRecord = await prisma.user.findFirst({
        where: { id: studentIdParam },
        select: {
          student: {
            select: { id: true, studentCode: true }
          }
        }
      });

      if (userRecord?.student?.id) {
        numericStudentId = Number(userRecord.student.id);
        studentCodeStr = userRecord.student.studentCode || '';
      } else {
        const matchedStudent = course.students.find(
          (s: any) => String(s.id) === studentIdParam || s.studentCode === studentIdParam
        );
        if (matchedStudent) {
          numericStudentId = Number(matchedStudent.id);
          studentCodeStr = matchedStudent.studentCode || '';
        }
      }
    }

    // 3. ดึงประวัติการเช็คชื่อทั้งหมดของรายวิชานี้ (AttendanceSession) แบบเดียวกับที่ฝั่งอาจารย์ใช้สร้างรายงาน
    const sessions = await prisma.attendanceSession.findMany({
      where: { courseId: courseId },
      include: {
        attendances: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // 4. จัดกลุ่มคาบเรียน (ยุบรวมรอบย่อยในวันและช่วงเวลาเดียวกันให้อยู่ในสัปดาห์เดียวกันแบบเดียวกับฝั่งอาจารย์)
    const uniqueSlots = new Map<string, any>();

    sessions.forEach((sess: any) => {
      const d = new Date(sess.createdAt || sess.date || 0);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;

      let timeSlot = sess.timeSlot || '';
      const fullText = `${sess.note || ''} ${sess.timeSlot || ''}`;
      const timeMatch = fullText.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);

      if (timeMatch) {
        timeSlot = `${timeMatch[1]}-${timeMatch[2]}`.replace(/\s+/g, '');
      } else {
        const hr = d.getHours();
        timeSlot = hr < 12 ? '09:00-12:00' : '13:00-16:00';
      }

      const isComp = sess.sessionType === 'COMPENSATION' || fullText.includes('สอนชดเชย');
      const sessionType = isComp ? 'COMPENSATION' : 'REGULAR';
      const slotKey = `${dateStr}_${timeSlot}_${sessionType}`;

      if (!uniqueSlots.has(slotKey)) {
        uniqueSlots.set(slotKey, {
          dateStr,
          timeSlot,
          sessionType,
          sessionsList: [sess],
          rawTimestamp: d.getTime(),
        });
      } else {
        const existing = uniqueSlots.get(slotKey);
        existing.sessionsList.push(sess);
      }
    });

    const standardWeeks = Array.from(uniqueSlots.values()).sort(
      (a, b) => a.rawTimestamp - b.rawTimestamp,
    );

    // 5. ดึงสถานะของนักศึกษาคนนี้ในแต่ละสัปดาห์มาตรฐาน
    const attendances: any[] = [];
    const priority: Record<string, number> = {
      มาสาย: 5,
      มาเรียน: 4,
      ลา: 3,
      ขาดเรียน: 1,
    };

    standardWeeks.forEach((weekItem: any, idx: number) => {
      const matchedStatuses: any[] = [];

      weekItem.sessionsList.forEach((sess: any) => {
        const records = sess.attendances || [];
        const r = records.find((item: any) => {
          const rId = String(item.studentId || '');
          const rCode = String(item.studentCode || '').trim();
          return (numericStudentId && rId === String(numericStudentId)) || 
                 (studentCodeStr && rCode === studentCodeStr);
        });

        if (r) {
          matchedStatuses.push(r);
        }
      });

      if (matchedStatuses.length > 0) {
        // เรียงลำดับตาม Priority ของสถานะ (มาสาย > มาเรียน > ลา > ขาดเรียน)
        matchedStatuses.sort((a, b) => (priority[b.status] || 0) - (priority[a.status] || 0));
        const best = matchedStatuses[0];

        attendances.push({
          id: best.id,
          weekNumber: idx + 1,
          status: best.status,
          remark: best.remark || weekItem.sessionsList[0]?.note || '',
          date: best.date || weekItem.sessionsList[0]?.createdAt,
          createdAt: best.createdAt || weekItem.sessionsList[0]?.createdAt,
          sessionType: weekItem.sessionType,
          timeSlot: weekItem.timeSlot,
        });
      } else {
        // ถ้าไม่มีการบันทึกในสัปดาห์นั้น ให้ถือว่าขาดเรียน
        attendances.push({
          id: `missing_${idx + 1}`,
          weekNumber: idx + 1,
          status: 'ขาดเรียน',
          remark: '',
          date: weekItem.sessionsList[0]?.createdAt,
          createdAt: weekItem.sessionsList[0]?.createdAt,
          sessionType: weekItem.sessionType,
          timeSlot: weekItem.timeSlot,
        });
      }
    });

    const present = attendances.filter((a: any) => a.status === 'มาเรียน').length;
    const late = attendances.filter((a: any) => a.status === 'มาสาย').length;
    const leave = attendances.filter((a: any) => a.status === 'ลา').length;
    const absent = attendances.filter((a: any) => a.status === 'ขาดเรียน').length;

    const formattedFriends = course.students.map((s: any) => ({
      id: s.id,
      studentCode: s.studentCode,
      firstName: s.firstName,
      lastName: s.lastName,
      name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'ไม่ระบุชื่อ'
    }));

    const teacherName = course.teacher
      ? `${course.teacher.firstName || ''} ${course.teacher.lastName || ''}`.trim() || 'อาจารย์ประจำวิชา'
      : 'ไม่ระบุผู้สอน';

    return NextResponse.json({
      success: true,
      data: {
        id: course.id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        teacherName,
        friends: formattedFriends,
        attendance: attendances,
        summary: {
          total: attendances.length,
          present,
          late,
          leave,
          absent
        }
      }
    });

  } catch (error: any) {
    console.error("Course Details API Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}