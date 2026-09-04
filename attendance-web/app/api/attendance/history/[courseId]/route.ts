import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId?: string; id?: string }> | { courseId?: string; id?: string } }
) {
  try {
    // 1. แกะค่า params รองรับทั้ง [courseId] และ [id]
    const resolvedParams = await Promise.resolve(params);
    const courseId = resolvedParams.courseId || resolvedParams.id;

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรหัสรายวิชา' },
        { status: 400 }
      );
    }

    // 2. ตรวจสอบ query parameters (date, timeSlot, sessionType)
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const timeSlotParam = searchParams.get('timeSlot');
    const sessionTypeParam = searchParams.get('sessionType');

    const whereClause: any = {
      courseId: courseId,
    };

    if (dateParam) {
      const targetDate = new Date(dateParam);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // ใช้เฉพาะ createdAt เนื่องจากตาราง AttendanceSession ไม่มีคอลัมน์ date
      whereClause.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // 3. ดึงรายการ Session พร้อมข้อมูลการเช็คชื่อของนักศึกษาในแต่ละรอบ
    const sessions = await prisma.attendanceSession.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' }, // เรียงรอบ 1 -> 2 -> 3 ตามลำดับเวลา
      include: {
        attendances: {
          orderBy: [
            { updatedAt: 'desc' },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          select: {
            id: true,
            status: true,
            remark: true,
            createdAt: true,
            updatedAt: true,
            date: true,
            student: {
              select: {
                id: true,
                studentCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // 4. แมปข้อมูล Session พร้อมสกัด sessionType และ timeSlot
    let formattedSessions = sessions.map((session: any) => {
      const sessionNote = session.note || '';
      
      const isCompensation =
        session.sessionType === 'COMPENSATION' ||
        sessionNote.includes('[สอนชดเชย]') ||
        sessionNote.includes('สอนชดเชย');
      const sessionType = isCompensation ? 'COMPENSATION' : 'REGULAR';

      let timeSlot = session.timeSlot || '';
      const fullText = `${sessionNote} ${session.timeSlot || ''}`;
      const timeSlotMatch = fullText.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);

      if (timeSlotMatch) {
        timeSlot = `${timeSlotMatch[1]}-${timeSlotMatch[2]}`.replace(/\s+/g, '');
      } else if (!timeSlot) {
        const d = new Date(session.createdAt);
        const hr = d.getHours();
        timeSlot = hr < 12 ? '09:00-12:00' : (hr < 17 ? '13:00-16:00' : '17:00-20:00');
      }

      const records = session.attendances.map((att: any) => {
        const fullName = att.student
          ? `${att.student.firstName || ''} ${att.student.lastName || ''}`.trim() || 'ไม่ระบุชื่อ'
          : 'ไม่ระบุชื่อ';

        return {
          id: att.id,
          studentId: att.student?.id,
          studentCode: att.student?.studentCode,
          name: fullName,
          status: att.status,
          remark: att.remark,
          time: att.date || att.createdAt,
          updatedAt: att.updatedAt,
        };
      });

      return {
        id: session.id,
        roundNumber: session.roundNumber,
        imageUrl: session.imageUrl,
        note: session.note,
        createdAt: session.createdAt,
        date: session.createdAt,
        sessionType,
        timeSlot,
        records,
        attendances: session.attendances.map((att: any) => ({
          ...att,
          student: att.student
            ? {
                ...att.student,
                name: `${att.student.firstName || ''} ${att.student.lastName || ''}`.trim() || 'ไม่ระบุชื่อ',
              }
            : null,
        })),
      };
    });

    // 5. กรองตาม timeSlot หรือ sessionType หากระบุมาใน query
    if (timeSlotParam || sessionTypeParam) {
      const cleanTargetSlot = timeSlotParam ? timeSlotParam.replace(/\s+/g, '') : null;

      formattedSessions = formattedSessions.filter((s: any) => {
        const matchSlot = cleanTargetSlot
          ? (s.timeSlot === cleanTargetSlot || s.note?.replace(/\s+/g, '').includes(cleanTargetSlot))
          : true;

        const matchType = sessionTypeParam
          ? s.sessionType === sessionTypeParam
          : true;

        return matchSlot && matchType;
      });
    }

    return NextResponse.json({ success: true, data: formattedSessions });
  } catch (error: any) {
    console.error('Fetch Attendance History Error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติ' },
      { status: 500 }
    );
  }
}