// attendance-web/app/api/report/[courseId]/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id?: string; courseId?: string }> | { id?: string; courseId?: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const courseId = resolvedParams.courseId || resolvedParams.id;

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรหัสรายวิชา' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const mode = searchParams.get('mode');
    const timeSlotParam = searchParams.get('timeSlot');
    const sessionTypeParam = searchParams.get('sessionType');

    // =========================================================================
    // 1. โหมดสรุปสถิติรายสัปดาห์ (Weeks Mode: แยกคาบปกติ/ชดเชย และเช้า/บ่าย ด้วย sessionId)
    // =========================================================================
    if (mode === 'weeks') {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
          students: {
            orderBy: { studentCode: 'asc' },
          },
        },
      });

      if (!course) {
        return NextResponse.json({ success: false, error: 'ไม่พบรายวิชานี้ในระบบ' }, { status: 404 });
      }

      const totalStudentsInClass = course.students.length;

      // ดึง AttendanceSession ทั้งหมดเรียงตามเวลา
      const sessions = await prisma.attendanceSession.findMany({
        where: { courseId: courseId },
        orderBy: { createdAt: 'asc' },
      });

      // ดึง Attendance ทั้งหมด (เรียงใหม่ไปเก่า เพื่อให้เรคคอร์ดล่าสุดอยู่บนสุด)
      const allAttendances = await prisma.attendance.findMany({
        where: { courseId: courseId },
        orderBy: [
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      });

      // จัดกลุ่ม Session ที่เป็นคาบเดียวกัน (วันที่ + ช่วงเวลา + ประเภทคาบ) ให้อยู่ในกลุ่มเดียวกัน
      const uniqueSlotsMap = new Map<string, any>();

      sessions.forEach((sess: any) => {
        const d = new Date(sess.date || sess.createdAt);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const rawDate = `${y}-${m}-${day}`;
        const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

        const sessionNote = sess.note || '';
        let timeSlot = sess.timeSlot || '';
        const match = `${sessionNote} ${timeSlot}`.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
        if (match) {
          timeSlot = `${match[1]}-${match[2]}`.replace(/\s+/g, '');
        } else {
          const hr = d.getHours();
          timeSlot = hr < 12 ? '09:00-12:00' : '13:00-16:00';
        }

        const isComp = sess.sessionType === 'COMPENSATION' || sessionNote.includes('สอนชดเชย');
        const sessionType = isComp ? 'COMPENSATION' : 'REGULAR';
        const slotKey = `${rawDate}_${timeSlot}_${sessionType}`;

        if (!uniqueSlotsMap.has(slotKey)) {
          uniqueSlotsMap.set(slotKey, {
            primarySessionId: sess.id,
            sessionIds: [sess.id],
            rawDate,
            dateStr,
            timeStr: timeSlot,
            sessionType,
            note: sessionNote,
            createdAt: sess.createdAt,
          });
        } else {
          const existing = uniqueSlotsMap.get(slotKey);
          if (!existing.sessionIds.includes(sess.id)) {
            existing.sessionIds.push(sess.id);
          }
          if (sessionNote && !existing.note) {
            existing.note = sessionNote;
          }
        }
      });

      const consolidatedSessions = Array.from(uniqueSlotsMap.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // สร้างข้อมูลสัปดาห์จากกลุ่มที่จัดแล้ว
      const weeksData = consolidatedSessions.map((slotGroup: any, index: number) => {
        const studentLatestStatus = new Map<number, string>();

        // คัดกรอง attendance ที่ผูกกับ sessionId ในกลุ่มนี้โดยตรง (แม่นยำ 100% ไม่ปนคาบอื่น)
        const slotAttendances = allAttendances.filter((att: any) => {
          return att.sessionId && slotGroup.sessionIds.includes(att.sessionId);
        });

        // ดึงสถานะล่าสุดของนักศึกษาในคาบนี้
        slotAttendances.forEach((att: any) => {
          if (!studentLatestStatus.has(att.studentId)) {
            studentLatestStatus.set(att.studentId, att.status);
          }
        });

        let present = 0;
        let late = 0;
        let leave = 0;
        let pending = 0;
        let absent = 0;

        course.students.forEach((student) => {
          const st = studentLatestStatus.get(student.id) || 'ขาดเรียน';
          if (st === 'มาเรียน') present++;
          else if (st === 'มาสาย') late++;
          else if (st === 'ลา') leave++;
          else if (st === 'รอตรวจสอบ') pending++;
          else absent++;
        });

        const percentage = totalStudentsInClass > 0
          ? Math.round(((present + late) / totalStudentsInClass) * 100)
          : 0;

        return {
          weekNumber: index + 1,
          sessionId: slotGroup.primarySessionId,
          rawDate: slotGroup.rawDate,
          dateStr: slotGroup.dateStr,
          timeStr: slotGroup.timeStr,
          sessionType: slotGroup.sessionType,
          present,
          late,
          leave,
          pending,
          absent,
          totalCount: totalStudentsInClass,
          percentage,
          note: slotGroup.note,
          isChecked: true,
        };
      });

      return NextResponse.json({
        success: true,
        data: weeksData,
        totalStudents: totalStudentsInClass,
      });
    }

    // =========================================================================
    // 2. โหมดรายงานประจำวัน (Daily Mode: แยกคาบด้วย sessionId 100%)
    // =========================================================================
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: true,
        students: {
          orderBy: { studentCode: 'asc' },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ success: false, error: 'ไม่พบรายวิชานี้ในระบบ' }, { status: 404 });
    }

    // ค้นหา Sessions ในวันนั้น
    const daySessions = await prisma.attendanceSession.findMany({
      where: {
        courseId: courseId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // หา Session IDs ที่ตรงกับคาบ/ช่วงเวลาที่เลือก
    let targetSessionIds: string[] = [];
    if (timeSlotParam || sessionTypeParam) {
      const cleanSlot = timeSlotParam ? timeSlotParam.replace(/\s+/g, '') : null;
      targetSessionIds = daySessions
        .filter((sess: any) => {
          const fullText = `${sess.note || ''} ${sess.timeSlot || ''}`;
          const isComp = sess.sessionType === 'COMPENSATION' || fullText.includes('สอนชดเชย');
          const sessType = isComp ? 'COMPENSATION' : 'REGULAR';

          const matchType = sessionTypeParam ? sessType === sessionTypeParam : true;
          const matchSlot = cleanSlot ? fullText.replace(/\s+/g, '').includes(cleanSlot) : true;

          return matchType && matchSlot;
        })
        .map((s: any) => s.id);
    } else if (daySessions.length > 0) {
      // ถ้าไม่ได้ระบุ ให้เอา Session ทั้งหมดในวันนั้น
      targetSessionIds = daySessions.map((s: any) => s.id);
    }

    // ดึง Attendance ที่ผูกกับ sessionId เหล่านี้โดยตรง
    const attendances = await prisma.attendance.findMany({
      where: {
        courseId: courseId,
        sessionId: {
          in: targetSessionIds.length > 0 ? targetSessionIds : daySessions.map((s: any) => s.id),
        },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });

    let present = 0, late = 0, leave = 0, pending = 0, absent = 0;

    const reportList = course.students.map((student: any) => {
      const record = attendances.find((att: any) => att.studentId === student.id);
      const status = record ? record.status : 'ขาดเรียน';
      const time = record?.createdAt || record?.date || null;
      const remark = record?.remark || '';
      const updatedAt = record?.updatedAt || null;

      if (status === 'มาเรียน') present++;
      else if (status === 'มาสาย') late++;
      else if (status === 'ลา') leave++;
      else if (status === 'รอตรวจสอบ') pending++;
      else absent++;

      const displayName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || 'ไม่ระบุชื่อ';

      return {
        id: student.id,
        studentId: student.id,
        studentCode: student.studentCode,
        firstName: student.firstName,
        lastName: student.lastName,
        name: displayName,
        status: status,
        time: time,
        remark: remark,
        updatedAt: updatedAt,
        isManual: record?.isManual || false,
      };
    });

    return NextResponse.json({
      success: true,
      data: reportList,
      summary: {
        total: course.students.length,
        present,
        late,
        leave,
        pending,
        absent,
      },
    });

  } catch (error: any) {
    console.error('Report API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน' },
      { status: 500 }
    );
  }
}