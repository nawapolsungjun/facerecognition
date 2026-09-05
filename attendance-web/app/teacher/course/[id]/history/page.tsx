// attendance-web/app/teacher/course/[id]/history/page.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function parseSessionImages(rawImageUrl: string | null | undefined): string[] {
  if (!rawImageUrl || typeof rawImageUrl !== 'string') return [];
  const trimmed = rawImageUrl.trim();
  if (!trimmed || trimmed.includes('[Large Image Base64 Omitted')) return [];

  if (trimmed.startsWith('data:image/')) {
    if (trimmed.includes('|||')) {
      return trimmed.split('|||').filter(Boolean);
    }
    return [trimmed];
  }

  if (trimmed.includes('|||')) {
    return trimmed.split('|||').map((s) => s.trim()).filter(Boolean);
  }

  if (trimmed.includes(',')) {
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return [trimmed];
}

export default function AttendanceHistoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params.id as string;
  const filterDateParam = searchParams.get('date');
  const filterTimeSlotParam = searchParams.get('timeSlot');

  // เพิ่มรองรับ section, semester, academicYear
  const [courseInfo, setCourseInfo] = useState<{
    courseName: string;
    courseCode: string;
    section?: string;
    semester?: string;
    academicYear?: string;
  } | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const getAuthToken = () => localStorage.getItem('teacher_token') || localStorage.getItem('token');

  const fetchCourseInfo = useCallback(async () => {
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setCourseInfo({
          courseName: json.data.courseName,
          courseCode: json.data.courseCode,
          section: json.data.section,
          semester: json.data.semester,
          academicYear: json.data.academicYear
        });
      }
    } catch (err) {
      console.error('Fetch course info error:', err);
    }
  }, [courseId]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const queryParams = new URLSearchParams();
      if (filterDateParam) queryParams.append('date', filterDateParam);
      if (filterTimeSlotParam) queryParams.append('timeSlot', filterTimeSlotParam);

      const queryString = queryParams.toString();
      let url = queryString
        ? `/api/attendance/history/${courseId}?${queryString}`
        : `/api/attendance/history/${courseId}`;

      let res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        url = queryString
          ? `/api/teacher/course/${courseId}/history?${queryString}`
          : `/api/teacher/course/${courseId}/history`;
        res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

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
      console.error('Fetch history error:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [courseId, filterDateParam, filterTimeSlotParam]);

  useEffect(() => {
    if (courseId) {
      fetchCourseInfo();
      fetchHistory();
    }
  }, [courseId, fetchCourseInfo, fetchHistory]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">

      {/* Header */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative print:hidden">
        <div className="absolute top-6 left-6">
          <Link
            href={`/teacher/report/${courseId}`}
            className="text-emerald-100 hover:text-white font-bold inline-flex items-center gap-2 text-xs uppercase tracking-wider transition-all"
          >
            ← Back to Report
          </Link>
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
        <div className="text-emerald-100 font-medium text-xs md:text-sm space-y-0.5">
          <p>
            วิชา: <span className="font-bold text-white font-mono">{courseInfo?.courseCode || 'กำลังโหลด...'}</span> - <span className="font-bold text-white">{courseInfo?.courseName || ''}</span>
          </p>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <nav className="bg-[#0d9488] shadow-inner px-4 overflow-x-auto print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-1 min-w-max">
          
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
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200/80 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[18px] font-bold text-slate-400">ประวัติการบันทึก</span>
            <div className="text-xl font-black text-slate-800 flex flex-wrap items-center gap-2 mt-1">
              <span>วิชา: <span className="font-mono text-emerald-700">{courseInfo?.courseCode || 'กำลังโหลด...'}</span> {courseInfo?.courseName ? `${courseInfo.courseName}` : ''}</span>
              {/* แสดงกลุ่มเรียนและภาคเรียน */}
              {courseInfo && (
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-bold border border-slate-200">
                  กลุ่ม {courseInfo.section || '-'} | เทอม {courseInfo.semester || '-'}/{courseInfo.academicYear || '-'}
                </span>
              )}
            </div>
            {(filterDateParam || filterTimeSlotParam) && (
              <p className="text-xs text-slate-500 font-bold mt-2">
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
                <Link href={`/teacher/course/${courseId}/history`} className="ml-2 text-xs text-slate-400 hover:text-slate-600 underline">
                  (แสดงทั้งหมด)
                </Link>
              </p>
            )}
          </div>
          <span className="bg-emerald-50 text-emerald-700 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-emerald-100">
            บันทึกแล้วทั้งหมด {sessions.length} รอบ
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center font-bold text-slate-400 animate-pulse bg-white rounded-2xl border border-slate-200/80 text-xs">
            กำลังโหลดประวัติการเช็คชื่อ...
          </div>
        ) : sessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session, index) => {
              const imageList = parseSessionImages(session.imageUrl);
              const roundNum = session.roundNumber || session.round || (sessions.length - index);
              const dateFormatted = session.createdAt
                ? new Date(session.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                : '-';
              const timeFormatted = session.createdAt
                ? new Date(session.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
                : '-';

              return (
                <div
                  key={session.id || index}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-xl text-xs border border-emerald-100">
                        ครั้งที่ {roundNum}
                      </span>
                      <span className="text-slate-400 font-mono font-bold text-xs">
                        {dateFormatted} {timeFormatted} น.
                      </span>
                    </div>

                    {imageList.length > 0 ? (
                      <div
                        onClick={() => setPreviewImageUrl(imageList[0])}
                        className="relative w-full h-44 bg-slate-100 rounded-xl overflow-hidden mb-3 border border-slate-100 cursor-zoom-in group"
                        title="คลิกเพื่อขยายรูปภาพขนาดใหญ่"
                      >
                        <img
                          src={imageList[0]}
                          alt={`รอบที่ ${roundNum}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="bg-slate-900/80 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm shadow flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                            </svg>
                            คลิกเพื่อดูภาพขยาย
                          </span>
                        </div>
                        {imageList.length > 1 && (
                          <span className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm">
                            +{imageList.length - 1} รูปเพิ่ม
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-44 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xs mb-3 border border-slate-100">
                        ไม่มีรูปถ่าย
                      </div>
                    )}

                    <p className="text-xs text-slate-600 font-bold mb-1">
                      จำนวนรายการเช็คชื่อ: <span className="text-emerald-700 font-black">{session.attendances?.length || session.records?.length || session.totalChecked || 0}</span> คน
                    </p>
                    {session.note && (
                      <p className="text-[11px] text-slate-400 italic mb-3 line-clamp-1">
                        {session.note}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedSession({ ...session, roundNumber: roundNum })}
                    className="w-full mt-3 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    ดูรายละเอียดรอบนี้
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-16 rounded-2xl text-center text-slate-400 font-bold text-xs border border-slate-200/80">
            ไม่พบประวัติการบันทึกการเช็คชื่อตามเงื่อนไขที่เลือก
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
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-lg text-slate-800">
                  รายละเอียดการเช็คชื่อ ครั้งที่ {selectedSession.roundNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  เวลาบันทึก: {new Date(selectedSession.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' })} น.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-2xl cursor-pointer p-1"
              >
                &times;
              </button>
            </div>

            {selectedSession.imageUrl && (
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  รูปภาพประกอบการเช็คชื่อ (คลิกเพื่อขยาย)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {parseSessionImages(selectedSession.imageUrl).map((imgUrl: string, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => setPreviewImageUrl(imgUrl.trim())}
                      className="relative rounded-xl overflow-hidden border border-slate-200/60 bg-slate-900 min-h-[180px] flex items-center justify-center cursor-zoom-in group"
                      title="คลิกเพื่อดูภาพขยายขนาดใหญ่"
                    >
                      <img
                        src={imgUrl.trim()}
                        alt={`รูปถ่ายการเช็คชื่อ #${idx + 1}`}
                        className="max-h-72 w-auto max-w-full object-contain block rounded-lg group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="bg-slate-900/80 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm shadow flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                          </svg>
                          คลิกขยาย
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
              {(selectedSession.attendances || selectedSession.records) &&
                (selectedSession.attendances?.length > 0 || selectedSession.records?.length > 0) ? (
                (selectedSession.attendances || selectedSession.records).map((att: any, idx: number) => {
                  const studentName =
                    att.student?.name ||
                    `${att.student?.firstName || ''} ${att.student?.lastName || ''}`.trim() ||
                    att.name ||
                    'ไม่ระบุชื่อ';
                  const studentCode = att.student?.studentCode || att.studentCode || '-';

                  return (
                    <div key={att.id || idx} className="p-3.5 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
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

      {/* Lightbox Modal: ขยายรูปภาพผลการสแกนขนาดเต็มจอ */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[94vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col p-4 md:p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="text-sm md:text-base font-black text-slate-800">
                  รูปภาพผลการสแกนใบหน้า (ขนาดขยาย)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold p-1 cursor-pointer"
                title="ปิด"
              >
                &times;
              </button>
            </div>

            <div className="relative overflow-auto max-h-[82vh] flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-200 p-2">
              <img
                src={previewImageUrl}
                alt="Enlarged Preview"
                className="max-h-[78vh] w-auto max-w-full object-contain block rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}