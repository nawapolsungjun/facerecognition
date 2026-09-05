// attendance-web/app/components/reports/CourseAttendanceSheetPrintForm.tsx
'use client';
import React, { useMemo } from 'react';

interface AttendanceRecord {
  weekNumber: number;
  status: 'มาเรียน' | 'มาสาย' | 'ลา' | 'ขาดเรียน' | string;
}

interface StudentAttendanceData {
  id: number | string;
  studentCode: string;
  name: string;
  records?: { [weekNumber: number]: string };
  totalPresent?: number;
  totalLate?: number;
  totalLeave?: number;
  totalAbsent?: number;
  percentage?: number;
  remark?: string;
}

interface CourseAttendanceSheetPrintFormProps {
  courseInfo: {
    courseCode: string;
    courseName: string;
    courseNameEn?: string;
    credits?: string;
    section?: string;
    room?: string;
    teacherName?: string;
    academicYear?: string;
    semester?: string;
    studyTime?: string;
    examTime?: string;
    degreeLevel?: string;
    faculty?: string;
    department?: string;
  };
  students: StudentAttendanceData[];
  totalWeeks?: number;
  actualRecordedWeeks?: number; // จำนวนสัปดาห์ที่สอนจริง (เช่น 4 สัปดาห์)
}

export default function CourseAttendanceSheetPrintForm({
  courseInfo,
  students = [],
  totalWeeks = 15,
  actualRecordedWeeks,
}: CourseAttendanceSheetPrintFormProps) {
  const printTimestamp =
    new Date().toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }) +
    ' ' +
    new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  const weeksArray = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  const getStatusSymbol = (status?: string) => {
    if (!status) return '';
    if (status === 'มาเรียน') return '/';
    if (status === 'มาสาย') return 'ส';
    if (status === 'ลา') return 'ล';
    if (status === 'ขาดเรียน') return 'ข';
    return status;
  };

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const codeA = String(a.studentCode || '').trim();
      const codeB = String(b.studentCode || '').trim();
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });
  }, [students]);

  return (
    <>
      <div className="print-container hidden print:block font-sarabun text-black bg-white w-full text-[12px] leading-tight">
        <table className="print-main-table w-full text-[11px] mb-4">
          <thead className="print-thead">
            {/* แถวที่ 1: ส่วนหัวหนังสือทางการ มทร.กรุงเทพ */}
            <tr className="no-border-row">
              <th colSpan={totalWeeks + 8} className="p-0 font-normal text-left no-border-cell">
                <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2">
                  <div>
                    <div className="text-[17px] font-bold text-black tracking-tight leading-normal">
                      มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
                    </div>
                    <div className="text-[12px] font-semibold text-slate-800 leading-normal">
                      {courseInfo.faculty || 'คณะบริหารธุรกิจ'} • {courseInfo.department || 'สาขาวิชานวัตกรรมระบบสารสนเทศ'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[15px] font-bold text-black leading-normal">
                      รายชื่อนักศึกษาที่ลงทะเบียน
                    </div>
                  </div>
                </div>
              </th>
            </tr>

            {/* แถวที่ 2: กล่องข้อมูลรายวิชา */}
            <tr className="no-border-row">
              <th colSpan={totalWeeks + 8} className="p-0 font-normal text-left pb-2.5 no-border-cell">
                <div className="border border-black p-2 bg-slate-50/20 text-[11.5px]">
                  {/* ปรับเพิ่ม กลุ่มเรียน และ ภาคเรียน/ปีการศึกษา ตรงนี้ */}
                  <div className="flex justify-between items-center mb-1.5">
                    <div>
                      <span className="font-bold">รหัสวิชา: </span>
                      <span className="font-mono font-bold">{courseInfo.courseCode}</span>
                    </div>
                    <div>
                      <span className="font-bold">ชื่อวิชา: </span>
                      <span>{courseInfo.courseName}</span>
                    </div>
                    <div>
                      <span className="font-bold">กลุ่มเรียน: </span>
                      <span>{courseInfo.section || '-'}</span>
                    </div>
                    <div>
                      <span className="font-bold">ภาคเรียน: </span>
                      <span>{courseInfo.semester || '-'}/{courseInfo.academicYear || '-'}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-300 pt-1.5 text-[11px] text-slate-800">
                    <div>
                      <span className="font-bold">ผู้สอน: </span>
                      <span>{courseInfo.teacherName || 'อาจารย์ประจำวิชา'}</span>
                    </div>
                    <div>
                      <span className="font-bold">วัน-เวลาเรียน: </span>
                      <span>{courseInfo.studyTime || 'ตามตารางสอนประจำภาคการศึกษา'}</span>
                    </div>
                    <div>
                      <span className="font-bold">จำนวนนักศึกษาทั้งหมด: </span>
                      <span className="font-bold font-mono text-sm">{sortedStudents.length}</span> คน
                    </div>
                  </div>
                </div>
              </th>
            </tr>

            {/* แถวที่ 3 & 4: หัวคอลัมน์ตารางเช็คชื่อ */}
            <tr className="bg-slate-100 text-center font-bold">
              <th rowSpan={2} className="table-grid-cell w-8">ที่</th>
              <th rowSpan={2} className="table-grid-cell w-28">รหัสประจำตัว</th>
              <th rowSpan={2} className="table-grid-cell text-left">ชื่อ - สกุล</th>
              <th colSpan={totalWeeks} className="table-grid-cell">
                การเข้าชั้นเรียน (สัปดาห์ที่ 1 - {totalWeeks})
              </th>
              <th rowSpan={2} className="table-grid-cell w-10">มา</th>
              <th rowSpan={2} className="table-grid-cell w-10">สาย</th>
              <th rowSpan={2} className="table-grid-cell w-10">ลา</th>
              <th rowSpan={2} className="table-grid-cell w-10">ขาด</th>
              <th rowSpan={2} className="table-grid-cell w-12">%</th>
            </tr>
            <tr className="bg-slate-100 text-center font-bold text-[10px]">
              {weeksArray.map((w) => (
                <th key={w} className="table-grid-cell w-5">
                  {w}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedStudents.length > 0 ? (
              sortedStudents.map((st, idx) => {
                const presentCount =
                  st.totalPresent ??
                  Object.values(st.records || {}).filter((v) => v === 'มาเรียน').length;
                const lateCount =
                  st.totalLate ??
                  Object.values(st.records || {}).filter((v) => v === 'มาสาย').length;
                const leaveCount =
                  st.totalLeave ??
                  Object.values(st.records || {}).filter((v) => v === 'ลา').length;
                const absentCount =
                  st.totalAbsent ??
                  Object.values(st.records || {}).filter((v) => v === 'ขาดเรียน').length;

                // ฐานการคำนวณ % ยึดจากสัปดาห์ที่มีการเรียนจริง หรือ totalWeeks
                const divisor = actualRecordedWeeks || totalWeeks;
                const percent =
                  st.percentage ??
                  (divisor > 0
                    ? Math.round(((presentCount + lateCount) / divisor) * 100)
                    : 0);

                return (
                  <tr key={st.id || idx} className="print-row">
                    <td className="table-grid-cell text-center font-mono">{idx + 1}</td>
                    <td className="table-grid-cell text-center font-mono font-bold">{st.studentCode}</td>
                    <td className="table-grid-cell whitespace-nowrap">{st.name}</td>

                    {weeksArray.map((w) => {
                      const status = st.records ? st.records[w] : undefined;
                      const symbol = getStatusSymbol(status);
                      return (
                        <td key={w} className="table-grid-cell text-center font-bold text-[10px]">
                          {symbol}
                        </td>
                      );
                    })}

                    <td className="table-grid-cell text-center font-mono">{presentCount}</td>
                    <td className="table-grid-cell text-center font-mono">{lateCount}</td>
                    <td className="table-grid-cell text-center font-mono">{leaveCount}</td>
                    <td className="table-grid-cell text-center font-mono">{absentCount}</td>
                    <td className="table-grid-cell text-center font-mono font-bold">{percent}%</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={totalWeeks + 8} className="table-grid-cell p-6 text-center text-slate-500 font-bold">
                  ไม่พบข้อมูลนักศึกษาในรายวิชานี้
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ส่วนท้ายเอกสารและช่องลงนาม */}
        <div className="print-footer break-inside-avoid">
          <div className="border-t border-black pt-2 text-[10.5px] text-slate-800 flex justify-between items-start">
            <div>
              <p className="font-bold mb-0.5">คำอธิบายสัญลักษณ์การเช็คชื่อ:</p>
              <p className="text-slate-600">
                [/] มาเรียนปกติ &nbsp;&nbsp;&nbsp;&nbsp; [ส] มาสาย &nbsp;&nbsp;&nbsp;&nbsp; [ล] ลากิจ/ลาป่วย &nbsp;&nbsp;&nbsp;&nbsp; [ข] ขาดเรียน
              </p>
              <div className="mt-2 space-y-0.5 text-slate-600">
                <p>1. อาจารย์ผู้สอนโปรดตรวจสอบความครบถ้วนของรายชื่อนักศึกษา หากพบข้อผิดพลาดให้ประสานงานฝ่ายทะเบียน</p>
                <p>2. นักศึกษาที่มีเวลาเรียนไม่ถึงร้อยละ 80 (ขาดเกินกำหนด) จะไม่มีสิทธิ์เข้าสอบปลายภาค</p>
              </div>
            </div>

            <div className="text-right text-[10px] text-slate-500">
              <p>สำนักส่งเสริมวิชาการและงานทะเบียน</p>
              <p className="mt-1">พิมพ์เมื่อ: {printTimestamp}</p>
            </div>
          </div>

          <div className="flex justify-end pt-8 pr-6 text-center text-[11.5px]">
            <div className="w-64">
              <p className="mb-12">ลงชื่อ ........................................................... อาจารย์ผู้สอน</p>
              <p className="text-slate-800 font-bold">
                ({courseInfo.teacherName || '...........................................................'})
              </p>
              <p className="text-slate-600 text-[11px] mt-0.5">วันที่ ........ / ........ / ................</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm 10mm 6mm 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            overflow: visible !important;
            height: auto !important;
          }
          div, main {
            overflow: visible !important;
          }
          .print-main-table {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .print-thead {
            display: table-header-group !important;
          }
          .no-border-row,
          .no-border-cell {
            border: none !important;
            background: transparent !important;
          }
          .table-grid-cell {
            border: 1px solid black !important;
            padding: 3px 4px !important;
          }
          .print-row {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-footer {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </>
  );
}