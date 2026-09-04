import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * 🔍 [GET] - ดึงข้อมูลรายวิชาและรายชื่อนักศึกษาพร้อมประวัติการเข้าเรียน
 * ใช้สำหรับ: หน้า Student List และการโชว์ Drawer สรุปรายคน
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } 
) {
  try {
    const resolvedParams = await params;
    const courseId = resolvedParams.id;

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'ไม่พบ ID รายวิชา' }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        students: {
          include: {
            // 🚀 ดึงประวัติการเช็คชื่อพ่วงมาด้วย (ชื่อฟิลด์ต้องตรงกับ schema.prisma)
            attendances: {
              where: {
                courseId: courseId 
              },
              orderBy: {
                date: 'desc' 
              }
            }
          }
        },
        _count: {
          select: { students: true }
        }
      }
    });

    if (!course) {
      return NextResponse.json({ success: false, error: 'ไม่พบรายวิชานี้' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: course });

  } catch (error: any) {
    console.error("❌ GET Course Error:", error.message);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

/**
 * ⚙️ [PATCH] - แก้ไขข้อมูลวิชา หรือ จัดเก็บวิชา (Archive)
 * ใช้สำหรับ: ฟังก์ชัน 2.2 และ 2.3 ใน Modal ตั้งค่า
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { courseName, courseCode, status } = body;

    const updated = await prisma.course.update({
      where: { id },
      data: {
        ...(courseName && { courseName }),
        ...(courseCode && { courseCode }),
        ...(status && { status }), // เช่น 'ACTIVE' หรือ 'ARCHIVED'
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("❌ PATCH Course Error:", error.message);
    return NextResponse.json({ success: false, error: 'ไม่สามารถแก้ไขข้อมูลได้' }, { status: 500 });
  }
}

/**
 * 🗑️ [DELETE] - ลบรายวิชาทิ้งถาวร (พร้อมเคลียร์ข้อมูลความสัมพันธ์เพื่อป้องกัน Foreign Key Violation)
 * ใช้สำหรับ: ฟังก์ชัน 2.3 (Danger Zone)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // ใช้ Transaction เพื่อเคลียร์ข้อมูลลูกที่ผูกกับ Course ก่อนลบตัวคอร์ส
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

      // 4. ลบรายวิชาอย่างสมบูรณ์
      await tx.course.delete({
        where: { id: id }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ DELETE Course Error:", error.message);
    return NextResponse.json({ success: false, error: 'ไม่สามารถลบวิชานี้ได้: ' + error.message }, { status: 500 });
  }
}