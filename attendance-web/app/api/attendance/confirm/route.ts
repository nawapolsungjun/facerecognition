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

    // 1. ตรวจสอบ courseId
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

    // 3. จัดการเขียนไฟล์รูปภาพลงโฟลเดอร์ public/uploads/ (รองรับทั้งรูปเดี่ยวและหลายรูป)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const savedImagePaths: string[] = [];
    const incomingImages: string[] = [];

    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      incomingImages.push(...imageUrls);
    } else if (imageUrl && typeof imageUrl === 'string') {
      incomingImages.push(imageUrl);
    }

    for (const rawImage of incomingImages) {
      if (!rawImage || typeof rawImage !== 'string') continue;

      if (rawImage.startsWith('data:image')) {
        try {
          const matches = rawImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64');
            const fileName = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
            const filePath = path.join(uploadDir, fileName);

            fs.writeFileSync(filePath, buffer);
            savedImagePaths.push(`/uploads/${fileName}`);
          }
        } catch (fileErr) {
          console.error('Save image file error:', fileErr);
        }
      } else if (rawImage.startsWith('/uploads/')) {
        savedImagePaths.push(rawImage);
      }
    }

    // จัดเก็บรูปแรกเป็นตัวหลัก และเก็บ Path ทั้งหมด
    const finalImageUrl = savedImagePaths.length > 0 ? savedImagePaths[0] : null;

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
          statusMap.set(String(item.studentId).trim(), {
            status: item.status || 'ขาดเรียน',
            remark: item.remark || undefined,
          });
        }
      });
    }

    // 6. บันทึกลงฐานข้อมูลผ่าน Transaction
    const result = await prisma.$transaction(
      async (tx) => {
        // สร้างรอบการเช็คชื่อหลัก (AttendanceSession)
        const newSession = await tx.attendanceSession.create({
          data: {
            courseId: courseId,
            roundNumber: currentRoundNumber,
            imageUrl: finalImageUrl,
            note: defaultSessionNote,
            timeSlot: currentSlot,
            sessionType: currentType,
            createdAt: sessionDate,
          },
        });

        // สร้างประวัติของนักศึกษาแต่ละคนในวิชา
        const attendanceRecords = course.students.map((student: any) => {
          const evaluated = statusMap.get(String(student.id).trim());
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
          totalSavedImages: savedImagePaths.length,
        };
      },
      {
        timeout: 20000, // ขยายเวลารองรับการบันทึกรูป
      }
    );

    const typeLabel = result.sessionType === 'COMPENSATION' ? 'คาบสอนชดเชย' : 'คาบปกติ';
    return NextResponse.json({
      success: true,
      message: `บันทึกการเช็คชื่อ ${typeLabel} (${result.timeSlot} น.) รอบที่ ${result.roundNumber} เรียบร้อยแล้ว`,
      data: result,
    });
  } catch (error: any) {
    console.error('[API Confirm Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' },
      { status: 500 }
    );
  }
}