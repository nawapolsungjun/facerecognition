// attendance-web/app/api/attendance/direct/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, courseId, status, date, time, remark, sessionId } = body;

    if (!studentId || !courseId || !status || !date) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน (ต้องการ studentId, courseId, status และ date)' },
        { status: 400 }
      );
    }

    const numericStudentId = Number(studentId);
    const now = new Date();

    // 1. กำหนดเวลาที่บันทึกของคาบนั้น
    const targetDate = new Date(date);
    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      targetDate.setHours(hours || 0, minutes || 0, 0, 0);
    } else {
      targetDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    }

    // 2. จัดรูปแบบข้อความหมายเหตุ
    const editTimeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    const baseRemark = remark?.trim() || 'แก้ไขโดยอาจารย์';
    const finalRemark = `${baseRemark} (แก้ไขเมื่อ ${editTimeStr} น.)`;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 3. ค้นหา sessionId ของคาบในวันนั้นให้แม่นยำที่สุด
    let targetSessionId = sessionId;

    if (!targetSessionId) {
      const daySessions = await prisma.attendanceSession.findMany({
        where: {
          courseId: String(courseId),
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (daySessions.length > 0) {
        // พยายามเทียบจากช่วงเวลาใน remark หรือเลือก Session แรก/ล่าสุดของวัน
        const matched = daySessions.find((s: any) => {
          const note = (s.note || '').replace(/\s+/g, '');
          const reqRemark = (remark || '').replace(/\s+/g, '');
          return reqRemark && note && note.includes(reqRemark);
        });

        targetSessionId = matched ? matched.id : daySessions[0].id;
      } else {
        // ถ้ายังไม่มี AttendanceSession ในวันนั้นเลย ให้สร้างให้อัตโนมัติ เพื่อให้ผูกข้อมูลได้
        const newSession = await prisma.attendanceSession.create({
          data: {
            courseId: String(courseId),
            roundNumber: 1,
            note: 'สร้างอัตโนมัติจากการแก้ไขสถานะ',
          },
        });
        targetSessionId = newSession.id;
      }
    }

    // 4. ค้นหาเรคคอร์ดเดิมโดยอิงจาก studentId และ sessionId โดยตรง
    let existingRecord = await prisma.attendance.findFirst({
      where: {
        studentId: numericStudentId,
        courseId: String(courseId),
        sessionId: String(targetSessionId),
      },
    });

    let result;

    if (existingRecord) {
      // ถ้ามีอยู่แล้วให้อัปเดต
      result = await prisma.attendance.update({
        where: { id: existingRecord.id },
        data: {
          status: status,
          date: targetDate,
          isManual: true,
          remark: finalRemark,
          updatedAt: now,
        },
      });
    } else {
      // ถ้ายังไม่มี (กรณีเด็กยังไม่เคยมีประวัติเช็คชื่อในคาบนั้น) ให้สร้างใหม่ผูก sessionId ทันที
      result = await prisma.attendance.create({
        data: {
          studentId: numericStudentId,
          courseId: String(courseId),
          sessionId: String(targetSessionId),
          status: status,
          date: targetDate,
          isManual: true,
          remark: finalRemark,
          updatedAt: now,
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'อัปเดตสถานะการเข้าเรียนเรียบร้อยแล้ว',
      data: result 
    });

  } catch (error: any) {
    console.error("Direct Attendance API Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'ไม่สามารถบันทึกข้อมูลได้' },
      { status: 500 }
    );
  }
}