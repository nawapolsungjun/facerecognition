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
          select: { id: true, firstName: true, lastName: true }
        },
        students: {
          select: { id: true, studentCode: true, firstName: true, lastName: true }
        }
      }
    });

    if (!course) return NextResponse.json({ success: false, error: 'ไม่พบรายวิชา' }, { status: 404 });

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
        select: { student: { select: { id: true, studentCode: true } } }
      });
      if (userRecord?.student?.id) {
        numericStudentId = Number(userRecord.student.id);
        studentCodeStr = userRecord.student.studentCode || '';
      } else {
        const matchedStudent = course.students.find((s: any) => String(s.id) === studentIdParam || s.studentCode === studentIdParam);
        if (matchedStudent) {
          numericStudentId = Number(matchedStudent.id);
          studentCodeStr = matchedStudent.studentCode || '';
        }
      }
    }

    // 3. ดึงประวัติการเช็คชื่อทั้งหมดของรายวิชานี้
    const sessions = await prisma.attendanceSession.findMany({
      where: { courseId: courseId },
      include: { attendances: true },
      orderBy: { createdAt: 'asc' } // ต้องเรียงตามเวลาเพื่อให้นับรอบ 1, 2, 3 ได้ถูกต้อง
    });

    // 4. จัดกลุ่มคาบเรียน (ยุบรวมรอบย่อยในวันและช่วงเวลาเดียวกัน)
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
      if (timeMatch) timeSlot = `${timeMatch[1]}-${timeMatch[2]}`.replace(/\s+/g, '');
      else timeSlot = d.getHours() < 12 ? '09:00-12:00' : '13:00-16:00';

      const isComp = sess.sessionType === 'COMPENSATION' || fullText.includes('สอนชดเชย');
      const sessionType = isComp ? 'COMPENSATION' : 'REGULAR';
      const slotKey = `${dateStr}_${timeSlot}_${sessionType}`;

      if (!uniqueSlots.has(slotKey)) {
        uniqueSlots.set(slotKey, {
          dateStr, timeSlot, sessionType,
          sessionsList: [sess], // เก็บ Array ของรอบการสแกน
          rawTimestamp: d.getTime(),
        });
      } else {
        uniqueSlots.get(slotKey).sessionsList.push(sess);
      }
    });

    const standardWeeks = Array.from(uniqueSlots.values()).sort((a, b) => a.rawTimestamp - b.rawTimestamp);

    // 5. คำนวณสถานะผ่านระบบ Matrix 1 และ 0 พร้อมปรับปรุงหมายเหตุให้กระชับและไม่ซ้ำซ้อน
    const attendances: any[] = [];

    // ฟังก์ชันช่วยทำความสะอาดข้อความหมายเหตุที่ซ้ำซ้อน
    const cleanRemarkString = (str: string) => {
      if (!str) return '';
      return str
        .replace(/\(แก้ไข(โดยอาจารย์|โดยผู้ดูแลระบบ)?เมื่อ[^)]*?\)/gi, '')
        .replace(/\(แก้ไขเวลา[^)]*?\)/gi, '')
        .trim();
    };

    standardWeeks.forEach((weekItem: any, idx: number) => {
      const validAtts = weekItem.sessionsList.map((sess: any) => {
        const records = sess.attendances || [];
        return records.find((item: any) => {
          const rId = String(item.studentId || '');
          const rCode = String(item.studentCode || '').trim();
          return (numericStudentId && rId === String(numericStudentId)) || (studentCodeStr && rCode === studentCodeStr);
        });
      }).filter(Boolean);

      const patternArray = validAtts.map((r: any) => {
        if (r && r.status !== 'ขาดเรียน' && r.status !== 'รอตรวจสอบ') {
          return 1;
        }
        return 0;
      });

      const patternStr = patternArray.join('');
      let finalStatus = 'ขาดเรียน';

      if (patternArray.length === 3) {
        if (['111', '101'].includes(patternStr)) finalStatus = 'มาเรียน';
        else if (['110', '100', '010'].includes(patternStr)) finalStatus = 'รอตรวจสอบ';
        else if (['011', '001'].includes(patternStr)) finalStatus = 'มาสาย';
        else finalStatus = 'ขาดเรียน';
      } 
      else if (patternArray.length === 2) {
        if (patternStr === '11') finalStatus = 'มาเรียน';
        else if (patternStr === '10') finalStatus = 'รอตรวจสอบ';
        else if (patternStr === '01') finalStatus = 'มาสาย';
        else finalStatus = 'ขาดเรียน';
      } 
      else if (patternArray.length === 1) {
        finalStatus = patternStr === '1' ? 'มาเรียน' : 'ขาดเรียน';
      }

      let rawRemark = '';
      let editTimestamp = '';

      if (validAtts.length > 0) {
        const manualEdit = validAtts.find((a: any) => (a.remark || '').includes('แก้ไข') || a.isManual);
        if (manualEdit) {
          rawRemark = manualEdit.remark || '';
        } else {
          const lastAtt = validAtts[validAtts.length - 1];
          rawRemark = lastAtt.remark || '';
        }
      }

      const matchEditTime = rawRemark.match(/\(แก้ไข(โดยอาจารย์|โดยผู้ดูแลระบบ)?เมื่อ[^)]*?\)/i);
      if (matchEditTime) {
        editTimestamp = matchEditTime[0];
      }

      let cleanedBase = cleanRemarkString(rawRemark);
      cleanedBase = cleanedBase.replace(/\[\d{2}:\d{2}-\d{2}:\d{2}( น.)?\]\s*/g, '');

      let finalRemark = cleanedBase;
      if (editTimestamp && !finalRemark.includes(editTimestamp)) {
        finalRemark = finalRemark ? `${finalRemark} ${editTimestamp}` : editTimestamp;
      }

      const sessionNote = weekItem.sessionsList[0]?.note ? `(${weekItem.sessionsList[0].note})` : '';
      const displayRemark = `${finalRemark} ${sessionNote}`.trim();

      attendances.push({
        id: `week_${idx + 1}_${weekItem.rawTimestamp}`,
        weekNumber: idx + 1,
        status: finalStatus,
        remark: displayRemark,
        date: weekItem.sessionsList[0]?.createdAt,
        createdAt: weekItem.sessionsList[0]?.createdAt,
        sessionType: weekItem.sessionType,
        timeSlot: weekItem.timeSlot,
        pattern: patternStr
      });
    });

    const present = attendances.filter((a: any) => a.status === 'มาเรียน').length;
    const late = attendances.filter((a: any) => a.status === 'มาสาย').length;
    const leave = attendances.filter((a: any) => a.status === 'ลา').length;
    const pending = attendances.filter((a: any) => a.status === 'รอตรวจสอบ').length;
    const absent = attendances.filter((a: any) => a.status === 'ขาดเรียน').length;

    const formattedFriends = course.students.map((s: any) => ({
      id: s.id, studentCode: s.studentCode, firstName: s.firstName, lastName: s.lastName,
      name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'ไม่ระบุชื่อ'
    }));

    return NextResponse.json({
      success: true,
      data: {
        id: course.id, courseCode: course.courseCode, courseName: course.courseName,
        section: course.section, semester: course.semester, academicYear: course.academicYear,
        teacherName: course.teacher ? `${course.teacher.firstName || ''} ${course.teacher.lastName || ''}`.trim() : 'ไม่ระบุผู้สอน',
        friends: formattedFriends,
        attendance: attendances,
        summary: { total: attendances.length, present, late, leave, pending, absent }
      }
    });

  } catch (error: any) {
    console.error("Course Details API Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}