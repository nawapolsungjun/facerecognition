// attendance-web/app/admin/reports/courses/[id]/history/page.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminCourseHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params.id as string;
  const filterDateParam = searchParams.get('date');
  const filterTimeSlotParam = searchParams.get('timeSlot');

  const [courseInfo, setCourseInfo] = useState<{
    courseName: string;
    courseCode: string;
    section?: string;
    semester?: string;
    academicYear?: string;
    joinCode?: string;
    teacher?: any
  } | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<any | null>(null);

  const getAuthToken = () => localStorage.getItem('admin_token') || localStorage.getItem('token');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const resCourse = await fetch(`/api/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const courseJson = await resCourse.json();
      if (courseJson.success && courseJson.data) {
        setCourseInfo(courseJson.data);
      }

      const queryParams = new URLSearchParams();
      if (filterDateParam) queryParams.append('date', filterDateParam);
      if (filterTimeSlotParam) queryParams.append('timeSlot', filterTimeSlotParam);

      const queryString = queryParams.toString();
      const url = queryString
        ? `/api/attendance/history/${courseId}?${queryString}`
        : `/api/attendance/history/${courseId}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        let list = json.data;

        if (filterTimeSlotParam) {
          const targetSlot = filterTimeSlotParam.trim();
          list = list.filter((session: any) => {
            if (session.timeSlot && session.timeSlot.includes(targetSlot)) return true;
            if (session.note && session.note.includes(targetSlot)) return true;
            const sampleRecord = (session.attendances || session.records || []).find((r: any) => r.remark);
            if (sampleRecord?.remark && sampleRecord.remark.includes(targetSlot)) return true;
            return false;
          });
        }

        setSessions(list);
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error('Fetch admin history error:', err);
    } finally {
      setLoading(false);
    }
  }, [courseId, filterDateParam, filterTimeSlotParam]);

  useEffect(() => {
    if (courseId) {
      fetchHistory();
    }
  }, [courseId, fetchHistory]);

  const teacherName = courseInfo?.teacher?.firstName
    ? `${courseInfo.teacher.firstName} ${courseInfo.teacher.lastName || ''}`.trim()
    : courseInfo?.teacher?.name || 'ไม่ระบุอาจารย์';

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">
      {/* Header สำหรับ Admin */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative print:hidden">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
      </header>

      <nav className="bg-[#0d9488] shadow-inner px-4 overflow-x-auto print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-1 min-w-max">
          <Link
            href={`/admin/reports/courses/${courseId}`}
            className="flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm text-emerald-50 hover:bg-emerald-700/50 hover:text-white rounded-t-xl transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            รายงานการเข้าเรียน
          </Link>
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm bg-white text-slate-800 shadow rounded-t-xl"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ประวัติการบันทึก
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* ปุ่มย้อนกลับ */}
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0f766e] transition-colors cursor-pointer"
          >
            ← ย้อนกลับ
          </button>
        </div>

        {/* การ์ดข้อมูลวิชา (สไตล์เดียวกับหน้าจัดการนักศึกษา) */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-bold">
                  อาจารย์ผู้สอน: <span className="text-slate-700">{teacherName}</span>
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <span className="font-mono text-emerald-700">{courseInfo?.courseCode || 'กำลังโหลด...'}</span> {courseInfo?.courseName || ''}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs font-bold text-slate-600">
                <span className="bg-slate-100 px-3 py-1 rounded-md">กลุ่มเรียน: {courseInfo?.section || '-'}</span>
                <span className="bg-slate-100 px-3 py-1 rounded-md">เทอม: {courseInfo?.semester || '-'}/{courseInfo?.academicYear || '-'}</span>
                {courseInfo?.joinCode && (
                  <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-md flex items-center gap-1.5 uppercase tracking-wider shadow-sm">
                    <span>Join Code:</span> 
                    <span className="select-all">{courseInfo.joinCode}</span>
                  </span>
                )}
              </div>
              
              {(filterDateParam || filterTimeSlotParam) && (
                <p className="text-xs text-slate-500 font-bold mt-3 pt-3 border-t border-slate-100">
                  {filterDateParam && (
                    <>
                      กรองเฉพาะวันที่: <span className="text-emerald-700 font-mono">{filterDateParam}</span>
                    </>
                  )}
                  {filterTimeSlotParam && (
                    <span className="ml-2">
                      ช่วงเวลา: <span className="text-emerald-700 font-mono">[{filterTimeSlotParam} น.]</span>
                    </span>
                  )}
                  <Link href={`/admin/reports/courses/${courseId}/history`} className="ml-2 text-xs text-slate-400 hover:text-slate-600 underline">
                    (แสดงทั้งหมด)
                  </Link>
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className="text-xs font-bold px-3.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                บันทึกแล้วทั้งหมด {sessions.length} รอบ
              </span>
            </div>
          </div>
        </div>

        {/* Sessions Card Grid */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 font-bold animate-pulse text-xs bg-white rounded-2xl border border-slate-200/80">
            กำลังโหลดประวัติการบันทึก...
          </div>
        ) : sessions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {sessions.map((session: any, idx: number) => {
              const dateFormatted = session.createdAt
                ? new Date(session.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                : '-';
              const timeFormatted = session.createdAt
                ? new Date(session.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
                : '-';

              const imgList = session.imageUrl
                ? session.imageUrl.split(',').filter((url: string) => url.trim() !== '')
                : [];
              const firstImg = imgList[0] || null;
              const roundNum = session.roundNumber || session.round || (sessions.length - idx);

              return (
                <div
                  key={session.id || idx}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-xl text-xs border border-emerald-100">
                        ครั้งที่ {roundNum}
                      </span>
                      <span className="text-xs text-slate-400 font-mono font-bold">
                        {dateFormatted} {timeFormatted} น.
                      </span>
                    </div>

                    <div className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-100 h-44 mb-4">
                      {firstImg ? (
                        <>
                          <img src={firstImg} alt="Session Image" className="w-full h-full object-cover" />
                          {imgList.length > 1 && (
                            <span className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm">
                              +{imgList.length - 1} รูปเพิ่ม
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs bg-slate-50">
                          ไม่มีรูปภาพ
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 font-bold mb-1">
                      จำนวนรายการเช็คชื่อ: <span className="text-emerald-700 font-black">{session.attendances?.length || session.records?.length || session.totalChecked || 0}</span> คน
                    </p>
                    {session.note && (
                      <p className="text-[11px] text-slate-400 italic mb-4 line-clamp-1">
                        {session.note}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedSessionDetail({ ...session, roundNumber: roundNum })}
                    className="w-full mt-3 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    ดูรายละเอียดรอบนี้
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 font-bold text-xs border border-slate-200/80">
            ไม่พบประวัติการบันทึกการเช็คชื่อ
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm mt-auto">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

      {/* Modal แสดงรายละเอียดการเช็คชื่อ */}
      {selectedSessionDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header ของ Modal */}
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-lg text-slate-800">
                  รายละเอียดการเช็คชื่อ ครั้งที่ {selectedSessionDetail.roundNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  เวลาบันทึก: {new Date(selectedSessionDetail.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' })} น.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionDetail(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-2xl cursor-pointer p-1"
              >
                &times;
              </button>
            </div>

            {/* แสดงรูปภาพประกอบถ้ามี */}
            {selectedSessionDetail.imageUrl && (
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  รูปภาพประกอบการเช็คชื่อ
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedSessionDetail.imageUrl
                    .split(',')
                    .filter((url: string) => url.trim() !== '')
                    .map((imgUrl: string, idx: number) => (
                      <div
                        key={idx}
                        className="rounded-xl overflow-hidden border border-slate-200/60 bg-slate-900 h-44"
                      >
                        <img
                          src={imgUrl.trim()}
                          alt={`รูปถ่ายการเช็คชื่อ #${idx + 1}`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* รายการรายชื่อนักศึกษา */}
            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden mb-5">
              {(selectedSessionDetail.attendances || selectedSessionDetail.records) &&
                (selectedSessionDetail.attendances?.length > 0 || selectedSessionDetail.records?.length > 0) ? (
                (selectedSessionDetail.attendances || selectedSessionDetail.records).map((att: any, idx: number) => {
                  const studentName =
                    att.student?.name ||
                    `${att.student?.firstName || ''} ${att.student?.lastName || ''}`.trim() ||
                    att.name ||
                    'ไม่ระบุชื่อ';
                  const studentCode = att.student?.studentCode || att.studentCode || '-';

                  return (
                    <div
                      key={att.id || idx}
                      className="p-3.5 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-mono text-xs font-bold text-emerald-700">
                          {studentCode}
                        </p>
                        <p className="font-bold text-xs md:text-sm text-slate-800">
                          {studentName}
                        </p>
                        {att.remark && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {att.remark}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-xl border shrink-0 ${att.status === 'มาเรียน'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : att.status === 'มาสาย'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : att.status === 'ลา'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                      >
                        {att.status}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 font-bold text-xs">
                  ไม่มีรายการเช็คชื่อรายบุคคลในรอบนี้
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}