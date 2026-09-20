// attendance-web/app/student/courses/[id]/page.tsx
'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface UserProfile {
  id: string;
  studentCode?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role?: string;
}

interface FriendProfile {
  id?: string;
  studentCode?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

interface CourseData {
  courseCode?: string;
  courseName?: string;
  teacherName?: string;
  section?: string;
  semester?: string;
  academicYear?: string;
  friends?: FriendProfile[];
}

export default function StudentCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [courseWeeks, setCourseWeeks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'attendance' | 'friends'>('attendance');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchDetails = useCallback(async (studentId: string, token: string, studentCode: string) => {
    setLoading(true);
    try {
      // 1. ดึงข้อมูลวิชา และ 2. ดึงประวัติการเข้าเรียนทั้งหมดของวิชานี้ (ชุดเดียวกับฝั่งอาจารย์)
      const [resDetails, resHistory] = await Promise.all([
        fetch(`/api/student/courses/details?courseId=${courseId}&studentId=${studentId}&_t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        }),
        fetch(`/api/attendance/history/${courseId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        }).catch(() => null)
      ]);

      const json = await resDetails.json();
      if (json.success && json.data) {
        setCourseData(json.data);
      } else {
        alert(json.error || 'ไม่สามารถโหลดข้อมูลรายวิชาได้');
        router.push('/student/dashboard');
        return;
      }

      // จัดกลุ่มประวัติการเข้าเรียนเป็น 15 สัปดาห์/คาบเรียน
      if (resHistory && resHistory.ok) {
        const historyJson = await resHistory.json();
        if (historyJson.success && Array.isArray(historyJson.data)) {
          const sorted = [...historyJson.data].sort((a: any, b: any) => {
            return new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime();
          });

          const uniqueSlots = new Map<string, any>();

          for (const sess of sorted) {
            const d = new Date(sess.date || sess.createdAt);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${day}`;

            let timeSlot = sess.timeSlot || '';
            const fullText = `${sess.note || ''} ${sess.timeSlot || ''}`;
            const timeMatch = fullText.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);

            if (timeMatch) {
              timeSlot = `${timeMatch[1]}-${timeMatch[2]}`.replace(/\s+/g, '');
            } else {
              const hr = d.getHours();
              if (hr < 12) timeSlot = '09:00-12:00';
              else if (hr < 17) timeSlot = '13:00-16:00';
              else timeSlot = '17:00-20:00';
            }

            const isComp = sess.sessionType === 'COMPENSATION' || fullText.includes('สอนชดเชย');
            const slotKey = `${dateStr}_${timeSlot}_${isComp ? 'COMPENSATION' : 'REGULAR'}`;

            if (!uniqueSlots.has(slotKey)) {
              uniqueSlots.set(slotKey, {
                ...sess,
                slotKey,
                dateStr,
                timeSlot,
                isComp,
                allSessions: [sess]
              });
            } else {
              const existing = uniqueSlots.get(slotKey);
              existing.allSessions.push(sess);
              uniqueSlots.set(slotKey, {
                ...existing,
                ...sess,
                allSessions: existing.allSessions
              });
            }
          }

          setCourseWeeks(Array.from(uniqueSlots.values()));
        }
      }
    } catch (err) {
      console.error('Fetch course detail error:', err);
    } finally {
      setLoading(false);
    }
  }, [courseId, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedUserStr = localStorage.getItem('student_user') || localStorage.getItem('user');
    const token = localStorage.getItem('student_token') || localStorage.getItem('token') || '';

    if (!savedUserStr) {
      router.replace('/student/login');
      return;
    }

    try {
      const parsedUser: UserProfile = JSON.parse(savedUserStr);

      if (parsedUser.role && parsedUser.role.toUpperCase() !== 'STUDENT') {
        router.replace('/student/login');
        return;
      }

      const displayName = `${parsedUser.firstName || ''} ${parsedUser.lastName || ''}`.trim() || parsedUser.name || 'นักศึกษา';
      setUser({ ...parsedUser, displayName } as UserProfile);

      if (parsedUser.id) {
        fetchDetails(String(parsedUser.id), token, String(parsedUser.studentCode || ''));
      }
    } catch {
      router.replace('/student/login');
    }
  }, [fetchDetails, router]);

  const cleanDisplayRemark = (str: string) => {
    if (!str) return '';
    const matchEdit = str.match(/\(แก้ไข(โดยอาจารย์\vert{}โดยผู้ดูแลระบบ)?เมื่อ[^)]*?\)/i);
    const editTimestamp = matchEdit ? matchEdit[0] : '';

    let base = str
      .replace(/\(แก้ไข(โดยอาจารย์\vert{}โดยผู้ดูแลระบบ)?เมื่อ[^)]*?\)/gi, '')
      .replace(/\(แก้ไขเวลา[^)]*?\)/gi, '')
      .replace(/\[\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(\s*น\.)?\s*\]/gi, '')
      .replace(/\(\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(\s*น\.)?\s*\)/gi, '')
      .replace(/\[คาบปกติ\]/gi, '')
      .replace(/\[สอนชดเชย\]/gi, '')
      .replace(/\(รอบที่\s*\d+\)/gi, '')
      .replace(/\[รอบที่\s*\d+\]/gi, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\[\s*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (editTimestamp) {
      return base ? `${base} ${editTimestamp}` : editTimestamp;
    }
    return base;
  };

  // รวมและจัดกลุ่มประวัติการเช็คชื่อตามคาบเรียนจริง 15 สัปดาห์
  const studentWeeklyAttendance = useMemo(() => {
    if (!user) return [];

    const myId = String(user.id);
    const myCode = String(user.studentCode || '').trim();
    const totalWeeks = 15;
    const weeksList = [];

    for (let i = 0; i < totalWeeks; i++) {
      const weekIndex = i + 1;
      const weekSlot = courseWeeks[i] || null;

      if (weekSlot) {
        const allSessionsInWeek = weekSlot.allSessions || [weekSlot];
        const studentRecordsInWeek: any[] = [];

        for (const s of allSessionsInWeek) {
          const list = s.records || s.attendances || [];
          const found = list.find((r: any) =>
            String(r.studentId) === myId ||
            String(r.id) === myId ||
            String(r.studentCode || '').trim() === myCode
          );
          if (found) {
            studentRecordsInWeek.push(found);
          }
        }

        let finalStatus = 'ขาดเรียน';
        let rawRemark = '';

        if (studentRecordsInWeek.length > 0) {
          const latestRecord = studentRecordsInWeek[studentRecordsInWeek.length - 1];
          rawRemark = latestRecord.remark || '';

          // หากมีสถานะที่อาจารย์แก้ไขหรือระบุไว้ชัดเจน
          const manualStatus = studentRecordsInWeek.find((r: any) => ['ลา', 'มาสาย', 'มาเรียน'].includes(r.status));

          if (manualStatus) {
            finalStatus = manualStatus.status;
          } else {
            const patternArray = studentRecordsInWeek.map((att: any) => {
              if (att && att.status !== 'ขาดเรียน' && att.status !== 'รอตรวจสอบ') {
                return 1;
              }
              return 0;
            });
            const patternStr = patternArray.join('');

            if (patternArray.length === 3) {
              if (['111', '101'].includes(patternStr)) finalStatus = 'มาเรียน';
              else if (['110', '100', '010'].includes(patternStr)) finalStatus = 'รอตรวจสอบ';
              else if (['011', '001'].includes(patternStr)) finalStatus = 'มาสาย';
              else finalStatus = 'ขาดเรียน';
            } else if (patternArray.length === 2) {
              if (patternStr === '11') finalStatus = 'มาเรียน';
              else if (patternStr === '10') finalStatus = 'รอตรวจสอบ';
              else if (patternStr === '01') finalStatus = 'มาสาย';
              else finalStatus = 'ขาดเรียน';
            } else if (patternArray.length === 1) {
              finalStatus = patternStr === '1' ? 'มาเรียน' : 'ขาดเรียน';
            }
          }
        }

        const matchEditTime = rawRemark.match(/\(แก้ไข(โดยอาจารย์\vert{}โดยผู้ดูแลระบบ)?เมื่อ[^)]*?\)/i);
        const editTimestamp = matchEditTime ? matchEditTime[0] : '';
        const cleanedBase = cleanDisplayRemark(rawRemark);

        let finalRemark = cleanedBase;
        if (editTimestamp && !finalRemark.includes(editTimestamp)) {
          finalRemark = finalRemark ? `${finalRemark} ${editTimestamp}` : editTimestamp;
        }

        const sessionDate = weekSlot.createdAt || weekSlot.date;

        weeksList.push({
          weekNumber: weekIndex,
          isRecorded: true,
          date: sessionDate,
          timeLabel: weekSlot.timeSlot || '',
          isComp: weekSlot.isComp || weekSlot.sessionType === 'COMPENSATION',
          status: finalStatus,
          remark: finalRemark.trim(),
          recordTime: sessionDate
        });
      } else {
        weeksList.push({
          weekNumber: weekIndex,
          isRecorded: false,
          date: null,
          timeLabel: '',
          isComp: false,
          status: 'ยังไม่บันทึก',
          remark: '',
          recordTime: null
        });
      }
    }

    return weeksList;
  }, [user, courseWeeks]);

  // สรุปยอดตามเกณฑ์: สาย 2 ครั้ง = ขาด 1 ครั้ง, ลา 2 ครั้ง = ขาด 1 ครั้ง
  const summary = useMemo(() => {
    const recordedList = studentWeeklyAttendance.filter((a) => a.isRecorded);
    const total = recordedList.length;
    const present = recordedList.filter((a) => a.status === 'มาเรียน').length;
    const late = recordedList.filter((a) => a.status === 'มาสาย').length;
    const leave = recordedList.filter((a) => a.status === 'ลา').length;
    const pending = recordedList.filter((a) => a.status === 'รอตรวจสอบ').length;
    const absent = recordedList.filter((a) => a.status === 'ขาดเรียน').length;

    const penaltyFromLate = Math.floor(late / 2);
    const penaltyFromLeave = Math.floor(leave / 2);
    const effectiveAbsences = absent + penaltyFromLate + penaltyFromLeave;

    const actualAttended = Math.max(0, total - effectiveAbsences);
    const attendancePercentage = total > 0 ? Math.round((actualAttended / total) * 100) : 100;

    const MAX_ALLOWED_ABSENT = 3;
    const remainingAbsentQuota = Math.max(0, MAX_ALLOWED_ABSENT - effectiveAbsences);
    const isExamEligible = attendancePercentage >= 80;

    return {
      total,
      present,
      late,
      leave,
      pending,
      absent,
      percentage: attendancePercentage,
      maxAllowedAbsent: MAX_ALLOWED_ABSENT,
      remainingAbsentQuota,
      isExamEligible
    };
  }, [studentWeeklyAttendance]);

  const filteredAndSortedFriends = useMemo(() => {
    if (!courseData?.friends) return [];
    return [...courseData.friends]
      .filter((f) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase().trim();
        const code = (f.studentCode || '').toLowerCase();
        const firstName = (f.firstName || '').toLowerCase();
        const lastName = (f.lastName || '').toLowerCase();
        const fullName = `${f.firstName || ''} ${f.lastName || ''} ${f.name || ''}`.toLowerCase();
        return code.includes(term) || firstName.includes(term) || lastName.includes(term) || fullName.includes(term);
      })
      .sort((a, b) => {
        const codeA = a.studentCode || '';
        const codeB = b.studentCode || '';
        if (sortOrder === 'asc') {
          return codeA.localeCompare(codeB, undefined, { numeric: true });
        } else {
          return codeB.localeCompare(codeA, undefined, { numeric: true });
        }
      });
  }, [courseData?.friends, searchTerm, sortOrder]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f7f4] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-emerald-800 font-bold text-xs animate-pulse tracking-wider">กำลังดึงข้อมูลรายวิชา...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800 print:bg-white print:p-0">
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative print:hidden">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
      </header>

      <nav className="bg-[#0d9488] shadow-inner px-4 overflow-x-auto print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-1 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm rounded-t-xl transition-all cursor-pointer ${activeTab === 'attendance'
                ? 'bg-white text-slate-800 shadow'
                : 'text-emerald-50 hover:bg-emerald-700/50 hover:text-white'
              }`}
          >
            ประวัติการเข้าเรียนของฉัน
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('friends')}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm rounded-t-xl transition-all cursor-pointer ${activeTab === 'friends'
                ? 'bg-white text-slate-800 shadow'
                : 'text-emerald-50 hover:bg-emerald-700/50 hover:text-white'
              }`}
          >
            รายชื่อนักศึกษาในชั้นเรียน
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0f766e] transition-colors cursor-pointer"
          >
            ← ย้อนกลับ
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">รายวิชา</span>
            <h2 className="text-2xl font-black text-slate-800">
              {courseData?.courseCode} : {courseData?.courseName}
            </h2>
            {courseData?.section && (
              <div className="text-xs text-slate-500 mt-1 font-medium flex gap-3 flex-wrap">
                <span>กลุ่มเรียน: {courseData.section}</span>
                <span>•</span>
                <span>ภาคเรียนที่: {courseData.semester}/{courseData.academicYear}</span>
              </div>
            )}
            <p className="text-xs text-slate-500 font-medium mt-1">
              อาจารย์ผู้สอน: <span className="text-slate-800 font-bold">{courseData?.teacherName || 'อาจารย์ประจำวิชา'}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-slate-50 text-slate-600 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-slate-200/60">
              นักศึกษาทั้งหมด {courseData?.friends?.length || 0} คน
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">เกณฑ์เวลาเรียน (ไม่ต่ำกว่า 80%)</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`text-3xl font-black font-mono ${summary.percentage >= 80 ? 'text-emerald-700' : summary.percentage >= 70 ? 'text-amber-700' : 'text-red-700'
                  }`}>
                  {summary.percentage}%
                </span>
                <span className="text-xs font-bold text-slate-500">เวลาเรียนสะสม</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {summary.isExamEligible ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>สถานะ: มีสิทธิ์สอบ</span>
                  <span className="text-slate-400 font-normal">|</span>
                  <span className="text-emerald-700 font-bold">ขาดได้อีก {summary.remainingAbsentQuota} ครั้ง</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  <span>สถานะ: ขาดเรียนเกินเกณฑ์ (หมดสิทธิ์สอบ)</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mt-4">
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60 text-center">
              <p className="text-[11px] font-bold text-slate-500 mb-1">ทั้งหมด</p>
              <p className="text-2xl font-black text-slate-800">{summary.total}</p>
            </div>
            <div className="bg-[#ecfdf5] p-3.5 rounded-2xl border border-emerald-100 text-center">
              <p className="text-[11px] font-bold text-emerald-800 mb-1">มาเรียน</p>
              <p className="text-2xl font-black text-[#16a34a]">{summary.present}</p>
            </div>
            <div className="bg-[#fffbeb] p-3.5 rounded-2xl border border-amber-100 text-center">
              <p className="text-[11px] font-bold text-amber-800 mb-1">มาสาย</p>
              <p className="text-2xl font-black text-[#d97706]">{summary.late}</p>
            </div>
            <div className="bg-[#eff6ff] p-3.5 rounded-2xl border border-blue-100 text-center">
              <p className="text-[11px] font-bold text-blue-800 mb-1">ลา</p>
              <p className="text-2xl font-black text-[#2563eb]">{summary.leave}</p>
            </div>
            <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-100 text-center">
              <p className="text-[11px] font-bold text-purple-700 mb-1">รอตรวจสอบ</p>
              <p className="text-2xl font-black text-purple-600">{summary.pending}</p>
            </div>
            <div className="bg-[#fef2f2] p-3.5 rounded-2xl border border-red-100 text-center">
              <p className="text-[11px] font-bold text-red-700 mb-1">ขาดเรียน</p>
              <p className="text-2xl font-black text-[#dc2626]">{summary.absent}</p>
            </div>
          </div>
        </div>

        {activeTab === 'attendance' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80">
                    <th className="p-4 text-sm font-black text-slate-700 w-24 text-center whitespace-nowrap">สัปดาห์ที่</th>
                    <th className="p-4 text-sm font-black text-slate-700 w-44 text-center whitespace-nowrap">วันที่และเวลา</th>
                    <th className="p-4 text-sm font-black text-slate-700 w-40 text-center whitespace-nowrap">รายละเอียด</th>
                    <th className="p-4 text-sm font-black text-slate-700 text-center min-w-[200px] whitespace-nowrap">หมายเหตุ</th>
                    <th className="p-4 text-sm font-black text-slate-700 text-center w-28 whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentWeeklyAttendance.filter(a => a.isRecorded).length > 0 ? (
                    studentWeeklyAttendance.filter(a => a.isRecorded).map((a) => {
                      return (
                        <tr key={a.weekNumber} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-4 text-xs font-bold text-slate-700 text-center align-middle">
                            {a.weekNumber}
                          </td>
                          <td className="p-4 text-xs font-bold text-slate-700 text-center whitespace-nowrap align-middle">
                            <div>{new Date(a.date || Date.now()).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</div>
                            {a.timeLabel && <div className="text-[11px] text-slate-400 font-medium mt-0.5">{a.timeLabel} น.</div>}
                          </td>
                          <td className="p-4 text-xs font-bold text-slate-700 text-center align-middle">
                            {a.isComp ? 'คาบสอนชดเชย' : 'คาบเรียนปกติ'}
                          </td>
                          <td className="p-4 text-xs text-slate-600 align-middle">
                            {a.remark ? (
                              <span className="text-xs text-slate-700 leading-relaxed font-medium">
                                {a.remark}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300 italic">
                                - ไม่มีหมายเหตุ -
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center whitespace-nowrap align-middle">
                            <span
                              className={`px-3 py-1 rounded-xl text-xs font-bold inline-block border ${a.status === 'มาเรียน'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : a.status === 'มาสาย'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : a.status === 'ลา'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : a.status === 'รอตรวจสอบ'
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-red-50 text-red-700 border-red-200'
                                }`}
                            >
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-14 text-center text-slate-400 font-bold text-xs">
                        ยังไม่มีประวัติการเช็คชื่อในรายวิชานี้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between gap-3">
              <div className="relative w-full max-w-sm">
                <input
                  type="text"
                  placeholder="ค้นหารหัส หรือ ชื่อ, นามสกุล..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80">
                      <th className="p-4 text-sm font-black text-slate-700 w-16 text-center whitespace-nowrap">ลำดับ</th>
                      <th
                        className="p-4 text-sm font-black text-slate-700 w-48 text-center cursor-pointer select-none hover:bg-slate-100 transition-colors whitespace-nowrap"
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      >
                        <div className="inline-flex items-center justify-center gap-1.5 w-full">
                          <span>รหัสประจำตัว</span>
                          <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.5 rounded font-black">
                            {sortOrder === 'asc' ? '▲' : '▼'}
                          </span>
                        </div>
                      </th>
                      <th className="p-4 text-sm font-black text-slate-700 w-1/3 text-center whitespace-nowrap">ชื่อ</th>
                      <th className="p-4 text-sm font-black text-slate-700 text-center whitespace-nowrap">นามสกุล</th>
                      <th className="p-4 text-sm font-black text-slate-700 text-center w-36 whitespace-nowrap">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAndSortedFriends.length > 0 ? (
                      filteredAndSortedFriends.map((f, index) => {
                        const firstName = f.firstName || '-';
                        const lastName = f.lastName || '-';
                        const isMe = f.id === user?.id || f.studentCode === user?.studentCode;

                        return (
                          <tr key={f.id || index} className={`hover:bg-slate-50/60 transition-colors ${isMe ? 'bg-emerald-50/40' : ''}`}>
                            <td className="p-4 text-xs font-bold text-slate-400 text-center align-middle">
                              {index + 1}
                            </td>
                            <td className="p-4 font-mono font-bold text-emerald-700 text-xs md:text-sm text-center align-middle whitespace-nowrap">
                              {f.studentCode}
                            </td>
                            <td className="p-4 font-bold text-slate-800 text-xs md:text-sm text-center align-middle">
                              {firstName} {isMe && <span className="text-[11px] text-emerald-700 font-bold ml-1.5">(ฉัน)</span>}
                            </td>
                            <td className="p-4 font-bold text-slate-700 text-xs md:text-sm text-center align-middle">
                              {lastName}
                            </td>
                            <td className="p-4 text-center align-middle">
                              <span className="text-xs font-bold px-3 py-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/60 inline-block">
                                ลงทะเบียนแล้ว
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-14 text-center text-slate-400 font-bold text-xs">
                          {searchTerm ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา' : 'ยังไม่มีนักศึกษาเข้าร่วมรายวิชานี้'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm mt-auto print:hidden">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>
    </div>
  );
}