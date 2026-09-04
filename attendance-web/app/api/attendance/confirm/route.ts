// attendance-web/app/api/attendance/confirm/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      courseId,
      date,
      timeSlot,
      sessionType,
      imageUrls,
      imageUrl,
      attendanceData,
      detectedNames,
      note,
      sessionNote,
      round,
    } = body;

    // 1. ตรวจสอบความถูกต้องของ courseId
    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรหัสรายวิชา' },
        { status: 400 }
      );
    }

    // 2. ดึงข้อมูลนักศึกษาทั้งหมดในรายวิชานี้
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        students: true,
      },
    });

    if (!course) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายวิชานี้ในระบบ' },
        { status: 404 }
      );
    }

    // 3. จัดการแปลงรูปภาพเป็นไฟล์จริงใน public/uploads/
    let finalImageUrl: string | null = null;
    const rawImage = imageUrl || (Array.isArray(imageUrls) && imageUrls[0]) || null;

    if (rawImage && typeof rawImage === 'string') {
      if (rawImage.startsWith('data:image')) {
        // หากส่งมาเป็น Base64 ให้เขียนไฟล์ลง public/uploads/
        try {
          const uploadDir = path.join(process.cwd(), 'public', 'uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const matches = rawImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64');
            const fileName = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
            const filePath = path.join(uploadDir, fileName);

            fs.writeFileSync(filePath, buffer);
            finalImageUrl = `/uploads/${fileName}`; // ได้ Path รูปแบบเดียวกับ 3 แถวด้านบน
          }
        } catch (fileErr) {
          console.error('Save image file error:', fileErr);
          finalImageUrl = null;
        }
      } else if (rawImage.startsWith('/uploads/')) {
        // หากส่งมาเป็น URL Path อยู่แล้ว
        finalImageUrl = rawImage;
      }
    }

    // 4. บันทึกวันและเวลา
    const now = new Date();
    let sessionDate = new Date();

    if (date) {
      const [year, month, day] = date.split('-').map(Number);
      sessionDate = new Date(
        year,
        month - 1,
        day,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds()
      );
    }

    const currentRoundNumber = Number(round) || 1;
    const currentSlot = timeSlot || '09:00-12:00';
    const currentType = sessionType === 'COMPENSATION' ? 'COMPENSATION' : 'REGULAR';
    const customRemark = sessionNote || note || '';

    const defaultSessionNote = customRemark
      ? `[${currentSlot}] ${currentType === 'COMPENSATION' ? '[สอนชดเชย]' : '[คาบปกติ]'} (รอบที่ ${currentRoundNumber}) - ${customRemark}`
      : `[${currentSlot}] ${currentType === 'COMPENSATION' ? '[สอนชดเชย]' : '[คาบปกติ]'} (รอบที่ ${currentRoundNumber})`;

    // 5. สร้าง Map สถานะนักศึกษา
    const statusMap = new Map<string, { status: string; remark?: string }>();
    if (Array.isArray(attendanceData)) {
      attendanceData.forEach((item: any) => {
        if (item.studentId !== undefined && item.studentId !== null) {
          statusMap.set(String(item.studentId), {
            status: item.status || 'ขาดเรียน',
            remark: item.remark || undefined,
          });
        }
      });
    }

    // 6. บันทึกลงฐานข้อมูล
    const result = await prisma.$transaction(
      async (tx) => {
        const newSession = await tx.attendanceSession.create({
          data: {
            courseId: courseId,
            roundNumber: currentRoundNumber,
            imageUrl: finalImageUrl, // บันทึกเป็น /uploads/session_xxxx.jpg
            note: defaultSessionNote,
            createdAt: sessionDate,
          },
        });

        const attendanceRecords = course.students.map((student: any) => {
          const evaluated = statusMap.get(String(student.id));
          const finalStatus = evaluated ? evaluated.status : 'ขาดเรียน';

          let finalRemark = evaluated?.remark;
          if (!finalRemark) {
            if (currentType === 'COMPENSATION') {
              finalRemark = `[สอนชดเชย] ${finalStatus === 'มาเรียน' ? 'เข้าเรียน' : finalStatus} (${currentSlot} น.)`;
            } else if (currentRoundNumber >= 2 && finalStatus === 'มาสาย') {
              finalRemark = `เช็คชื่อรอบที่ 2 (${currentSlot} น.)`;
            }
          }

          return {
            studentId: student.id,
            courseId: courseId,
            status: finalStatus,
            remark: finalRemark || null,
            sessionId: newSession.id,
            date: sessionDate,
            createdAt: sessionDate,
            updatedAt: new Date(),
          };
        });

        await tx.attendance.createMany({
          data: attendanceRecords,
        });

        return {
          sessionId: newSession.id,
          roundNumber: currentRoundNumber,
          sessionType: currentType,
          timeSlot: currentSlot,
        };
      },
      {
        timeout: 15000,
      }
    );

    const typeLabel = result.sessionType === 'COMPENSATION' ? 'คาบสอนชดเชย' : 'คาบปกติ';
    return NextResponse.json({
      success: true,
      message: `บันทึกการเช็คชื่อ ${typeLabel} (${result.timeSlot} น.) รอบที่ ${result.roundNumber} เรียบร้อยแล้ว`,
      data: result,
    });
  } catch (error: any) {
    console.error('Confirm Attendance API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' },
      { status: 500 }
    );
  }
}