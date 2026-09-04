// attendance-web/app/admin/courses/[id]/students/page.tsx
'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AdminCourseStudentsPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [courseWeeksData, setCourseWeeksData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States สำหรับ Searchable Select
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpenSelect, setIsOpenSelect] = useState(false);
  const selectBoxRef = useRef<HTMLDivElement>(null);

  // States สำหรับค้นหาและจัดเรียงรายชื่อนักศึกษาในคลาส
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // States สำหรับ Modal แก้ไขข้อมูลวิชา
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [isSavingCourse, setIsSavingCourse] = useState(false);

  // Modal สำหรับยกเลิกนักศึกษาในคลาสเรียน
  const [studentToRemove, setStudentToRemove] = useState<{ id: number; name: string } | null>(null);

  // Modal สำหรับดูรายงานประวัตินักศึกษา
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<any>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Custom Alert Modal
  const [alertModal, setAlertModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    isSuccess?: boolean;
    onClose?: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    isSuccess: true,
  });

  const getAuthToken = () => localStorage.getItem('admin_token') || localStorage.getItem('token');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectBoxRef.current && !selectBoxRef.current.contains(event.target as Node)) {
        setIsOpenSelect(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ดึงข้อมูลรายชื่อนักศึกษาและข้อมูลสรุปสัปดาห์จาก API report แบบเดียวกับหน้า Report หลัก
  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const [resStudents, resWeeks, resHistory] = await Promise.all([
        fetch(`/api/admin/courses/${courseId}/students`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/report/${courseId}?mode=weeks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => null),
        fetch(`/api/attendance/history/${courseId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => null)
      ]);

      const json = await resStudents.json();
      if (json.success && json.data) {
        setCourse(json.data.course);
        setAllStudents(json.data.allStudents || []);
        setEditCode(json.data.course.courseCode || '');
        setEditName(json.data.course.courseName || '');
      } else {
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: json.error || 'ไม่พบข้อมูลรายวิชา',
          isSuccess: false,
        });
      }

      if (resWeeks && resWeeks.ok) {
        const weeksJson = await resWeeks.ok ? await resWeeks.json() : { success: false, data: [] };
        if (weeksJson.success && Array.isArray(weeksJson.data)) {
          setCourseWeeksData(weeksJson.data);
        }
      }

      // สำรองข้อมูลประวัติเพื่อใช้จับคู่ชื่อและข้อมูลย่อยถ้าจำเป็น
      if (resHistory && resHistory.ok) {
        const historyJson = await resHistory.json();
        const rawHistory = Array.isArray(historyJson.data) ? historyJson.data : Array.isArray(historyJson) ? historyJson : [];
        if (course && course.students) {
          // ผูก attendances เข้ากับนักศึกษาแต่ละคนให้ตรงกัน
          const updatedStudents = course.students.map((st: any) => {
            const stId = String(st.id);
            const stCode = String(st.studentCode || '').trim();
            const stAttendances: any[] = [];

            rawHistory.forEach((sess: any) => {
              const records = sess.attendances || sess.records || [];
              const matched = records.find((r: any) => {
                const rId = String(r.studentId || r.student?.id || r.id || '');
                const rCode = String(r.studentCode || r.student?.studentCode || '').trim();
                return (stId && rId === stId) || (stCode && rCode === stCode);
              });

              if (matched) {
                stAttendances.push({
                  ...matched,
                  sessionId: sess.id,
                  sessionType: sess.sessionType,
                  timeSlot: sess.timeSlot,
                  note: sess.note,
                  createdAt: sess.createdAt || sess.date
                });
              }
            });

            return { ...st, attendances: stAttendances };
          });
          setCourse((prev: any) => prev ? { ...prev, students: updatedStudents } : prev);
        }
      }
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) fetchData();
  }, [courseId, fetchData]);

  // ฟังก์ชันเปิด Modal รายงานสถิติของนักศึกษา
  const handleOpenStudentReport = (student: any, displayName: string) => {
    setSelectedStudentForReport({
      ...student,
      displayName,
    });
    setIsReportModalOpen(true);
  };

  const handleUpdateCourseDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCode.trim() || !editName.trim()) {
      setAlertModal({
        show: true,
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกรหัสวิชาและชื่อวิชาให้ครบถ้วน',
        isSuccess: false,
      });
      return;
    }

    setIsSavingCourse(true);
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/students`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ courseCode: editCode.trim(), courseName: editName.trim() })
      });
      const json = await res.json();
      if (json.success) {
        setIsEditingCourse(false);
        fetchData();
        setAlertModal({
          show: true,
          title: 'แก้ไขข้อมูลสำเร็จ',
          message: 'อัปเดตข้อมูลรายวิชาเรียบร้อยแล้ว',
          isSuccess: true,
        });
      } else {
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: json.error || 'ไม่สามารถอัปเดตข้อมูลรายวิชาได้',
          isSuccess: false,
        });
      }
    } catch {
      setAlertModal({
        show: true,
        title: 'เกิดข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
        isSuccess: false,
      });
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setAlertModal({
        show: true,
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาเลือกนักศึกษาที่ต้องการเพิ่ม',
        isSuccess: false,
      });
      return;
    }

    const isExist = course?.students?.some((s: any) => s.id === parseInt(selectedStudentId));
    if (isExist) {
      setAlertModal({
        show: true,
        title: 'ข้อมูลซ้ำ',
        message: 'นักศึกษาคนนี้อยู่ในรายวิชานี้เรียบร้อยแล้ว',
        isSuccess: false,
      });
      return;
    }

    setIsSubmitting(true);
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/students`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentId: selectedStudentId })
      });
      const json = await res.json();
      if (json.success) {
        setSelectedStudentId('');
        setSearchQuery('');
        fetchData();
        setAlertModal({
          show: true,
          title: 'เพิ่มนักศึกษาสำเร็จ',
          message: 'เพิ่มนักศึกษาเข้าชั้นเรียนเรียบร้อยแล้ว',
          isSuccess: true,
        });
      } else {
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: json.error || 'ไม่สามารถเพิ่มนักศึกษาได้',
          isSuccess: false,
        });
      }
    } catch {
      setAlertModal({
        show: true,
        title: 'เกิดข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ',
        isSuccess: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRemoveStudent = async () => {
    if (!studentToRemove) return;
    const token = getAuthToken();

    try {
      const res = await fetch(`/api/admin/courses/${courseId}/students?studentId=${studentToRemove.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setStudentToRemove(null);
        fetchData();
        setAlertModal({
          show: true,
          title: 'ยกเลิกสำเร็จ',
          message: 'ยกเลิกนักศึกษาในคลาสเรียนเรียบร้อยแล้ว',
          isSuccess: true,
        });
      } else {
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: json.error || 'ไม่สามารถยกเลิกนักศึกษาได้',
          isSuccess: false,
        });
      }
    } catch {
      setAlertModal({
        show: true,
        title: 'เกิดข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ',
        isSuccess: false,
      });
    }
  };

  const availableStudents = useMemo(() => {
    const enrolledIds = new Set((course?.students || []).map((s: any) => s.id));
    const available = allStudents.filter((s: any) => !enrolledIds.has(s.id));

    return available
      .map((student: any) => {
        const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || 'ไม่ระบุชื่อ';
        return {
          ...student,
          cleanDisplayName: studentName,
          fullLabel: `[${student.studentCode}] ${studentName}`
        };
      })
      .sort((a: any, b: any) => (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true }));
  }, [allStudents, course?.students]);

  const filteredDropdownOptions = useMemo(() => {
    if (!searchQuery.trim()) return availableStudents;
    const q = searchQuery.toLowerCase().trim();
    return availableStudents.filter(
      (s: any) => s.studentCode.toLowerCase().includes(q) || s.cleanDisplayName.toLowerCase().includes(q)
    );
  }, [availableStudents, searchQuery]);

  const filteredAndSortedStudents = useMemo(() => {
    if (!course?.students) return [];
    return [...course.students]
      .filter((student: any) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase().trim();
        const code = (student.studentCode || '').toLowerCase();
        const firstName = (student.firstName || '').toLowerCase();
        const lastName = (student.lastName || '').toLowerCase();
        const fullName = `${student.firstName || ''} ${student.lastName || ''} ${student.name || ''}`.toLowerCase();
        return code.includes(term) || firstName.includes(term) || lastName.includes(term) || fullName.includes(term);
      })
      .sort((a: any, b: any) => {
        const codeA = a.studentCode || '';
        const codeB = b.studentCode || '';
        if (sortOrder === 'asc') {
          return codeA.localeCompare(codeB, undefined, { numeric: true });
        } else {
          return codeB.localeCompare(codeA, undefined, { numeric: true });
        }
      });
  }, [course?.students, searchTerm, sortOrder]);

  // ประมวลผลตาราง 15 สัปดาห์มาตรฐานใน Modal ให้ตรงกับตารางรายงานหลัก 100%
  const studentWeeklyAttendance = useMemo(() => {
    if (!selectedStudentForReport) return [];

    const studentAtts: any[] = selectedStudentForReport.attendances || [];
    const totalWeeks = 15;
    const weeksList = [];

    for (let i = 0; i < totalWeeks; i++) {
      const weekIndex = i + 1;
      const sessionSummary = courseWeeksData[i] || null;

      if (sessionSummary) {
        // ค้นหาเรคคอร์ดที่ตรงกับ sessionId ของสัปดาห์นั้น
        const matchedAtt = studentAtts.find((att: any) => {
          return att.sessionId && sessionSummary.sessionId && att.sessionId === sessionSummary.sessionId;
        });

        // หากไม่เจอด้วย sessionId ให้เทียบจากวันที่
        const bestRecord = matchedAtt || studentAtts.find((att: any) => {
          const attDate = new Date(att.date || att.createdAt).toISOString().split('T')[0];
          return attDate === sessionSummary.rawDate;
        });

        weeksList.push({
          weekNumber: weekIndex,
          isRecorded: true,
          date: sessionSummary.rawDate || sessionSummary.dateStr,
          timeLabel: sessionSummary.timeStr || '',
          isComp: sessionSummary.sessionType === 'COMPENSATION',
          status: bestRecord ? bestRecord.status : 'ขาดเรียน',
          remark: bestRecord?.remark || sessionSummary.note || '',
          recordTime: bestRecord?.createdAt || bestRecord?.date || null
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
  }, [selectedStudentForReport, courseWeeksData]);

  const teacherName = course?.teacher?.firstName
    ? `${course.teacher.firstName} ${course.teacher.lastName || ''}`.trim()
    : course?.teacher?.name || 'ไม่ระบุอาจารย์';

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">

      {/* 1. Header ด้านบน */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative">
        <div className="absolute top-6 left-6 flex items-center gap-3">
          <Link
            href="/admin/courses"
            className="text-emerald-100 hover:text-white font-bold inline-flex items-center gap-1 text-xs uppercase tracking-wider transition-all"
          >
            ← รายวิชาทั้งหมด
          </Link>
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </header>

      {/* 2. Navigation Tabs Bar */}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            จัดการรายชื่อนักศึกษา
          </button>
        </div>
      </nav>

      {/* 3. Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">

        {/* รายละเอียดวิชาหัวข้อหลัก */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-bold">
                  อาจารย์ผู้สอน: <span className="text-slate-700">{teacherName}</span>
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-800">
                <span className="font-mono">{course?.courseCode}</span> : {course?.courseName}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditCode(course?.courseCode || '');
                setEditName(course?.courseName || '');
                setIsEditingCourse(true);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              แก้ไขข้อมูลวิชา
            </button>
          </div>
        </div>

        {/* ฟอร์มเพิ่มนักศึกษาเข้าชั้นเรียน */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-black text-slate-800">เพิ่มนักศึกษาเข้าสู่รายวิชานี้</h3>
            <span className="text-xs text-slate-400 font-bold">
              คงเหลือยังไม่ลงทะเบียน {availableStudents.length} คน
            </span>
          </div>

          <form onSubmit={handleAddStudent} className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full" ref={selectBoxRef}>
              <div
                className="relative w-full cursor-pointer"
                onClick={() => setIsOpenSelect(prev => !prev)}
              >
                <input
                  type="text"
                  placeholder={`-- เลือกนักศึกษาจากฐานข้อมูลระบบ (${availableStudents.length} คนที่ยังไม่ลงทะเบียน) --`}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedStudentId('');
                    setIsOpenSelect(true);
                  }}
                  onFocus={() => setIsOpenSelect(true)}
                  className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-text"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {isOpenSelect && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50 divide-y divide-slate-100 animate-in fade-in duration-150">
                  {filteredDropdownOptions.length > 0 ? (
                    filteredDropdownOptions.map((student: any) => (
                      <div
                        key={student.id}
                        onClick={() => {
                          setSelectedStudentId(String(student.id));
                          setSearchQuery(student.fullLabel);
                          setIsOpenSelect(false);
                        }}
                        className={`px-4 py-2.5 text-xs md:text-sm cursor-pointer hover:bg-emerald-50/80 transition-colors flex justify-between items-center ${selectedStudentId === String(student.id) ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700'
                          }`}
                      >
                        <span className="font-mono font-bold text-emerald-700">[{student.studentCode}]</span>
                        <span className="font-bold text-slate-800">{student.cleanDisplayName}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 font-bold">
                      ไม่พบข้อมูลที่ตรงกับคำค้นหา
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedStudentId}
              className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-xs transition-all whitespace-nowrap disabled:bg-slate-300 cursor-pointer"
            >
              {isSubmitting ? 'กำลังบันทึก...' : '+ เพิ่มเข้าวิชา'}
            </button>
          </form>
        </div>

        {/* แถบค้นหาในคลาส */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              placeholder="ค้นหารหัส หรือ ชื่อ, นามสกุลในวิชานี้..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-500 font-bold">
            แสดง <span className="text-emerald-700 font-black">{filteredAndSortedStudents.length}</span> จากทั้งหมด {course?.students?.length || 0} คน
          </span>
        </div>

        {/* ตารางแสดงรายชื่อนักศึกษาในวิชานี้ */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/60">
                  <th className="p-4 text-xs font-bold text-slate-600 w-16 text-center">ลำดับ</th>
                  <th
                    className="p-4 text-xs font-bold text-slate-600 w-48 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    title="คลิกเพื่อเรียงลำดับรหัส"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>รหัสประจำตัว</span>
                      <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.5 rounded font-black">
                        {sortOrder === 'asc' ? '▲' : '▼'}
                      </span>
                    </div>
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-600 w-1/3">ชื่อ</th>
                  <th className="p-4 text-xs font-bold text-slate-600">นามสกุล</th>
                  <th className="p-4 text-xs font-bold text-slate-600 text-center w-36">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedStudents.length > 0 ? (
                  filteredAndSortedStudents.map((student: any, index: number) => {
                    const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || 'ไม่ระบุชื่อ';
                    const firstName = student.firstName || student.name || '-';
                    const lastName = student.lastName || '-';

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4 text-xs font-bold text-slate-400 text-center align-middle">
                          {index + 1}
                        </td>
                        <td className="p-4 font-mono text-xs md:text-sm font-bold text-emerald-700 align-middle">
                          {student.studentCode}
                        </td>
                        <td
                          className="p-4 font-bold text-slate-800 hover:text-emerald-700 cursor-pointer text-xs md:text-sm align-middle"
                          onClick={() => handleOpenStudentReport(student, studentName)}
                        >
                          {firstName}
                        </td>
                        <td
                          className="p-4 font-bold text-slate-700 hover:text-emerald-700 cursor-pointer text-xs md:text-sm align-middle"
                          onClick={() => handleOpenStudentReport(student, studentName)}
                        >
                          {lastName}
                        </td>
                        <td className="p-4 text-center align-middle">
                          <div className="flex justify-center items-center gap-1.5">

                            {/* 1. ปุ่มดูรายงานสถิติของนักศึกษา (Report Icon) */}
                            <button
                              type="button"
                              onClick={() => handleOpenStudentReport(student, studentName)}
                              title="ดูสถิติการเข้าเรียน"
                              className="p-2 text-slate-700 bg-slate-100 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-200/80 transition-all shadow-2xs cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>

                            {/* 2. ปุ่มยกเลิกนักศึกษาในคลาสเรียน (Trash Can Icon) */}
                            <button
                              type="button"
                              onClick={() => setStudentToRemove({ id: student.id, name: studentName })}
                              title="ยกเลิกนักศึกษาในคลาสเรียน"
                              className="p-2 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-xl border border-red-200/60 transition-all shadow-2xs cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>

                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center p-14 text-slate-400 font-bold text-xs">
                      {searchTerm ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา' : 'ยังไม่มีนักศึกษาลงทะเบียนในรายวิชานี้'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* 4. Footer ด้านล่าง */}
      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm mt-auto">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

      {/* 5. Center Modal Popup: แก้ไขข้อมูลรายวิชา */}
      {isEditingCourse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800">แก้ไขข้อมูลรายวิชา</h3>
              <button
                type="button"
                onClick={() => setIsEditingCourse(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateCourseDetails} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">รหัสวิชา</label>
                <input
                  type="text"
                  required
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">ชื่อรายวิชา</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditingCourse(false)}
                  className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingCourse}
                  className="flex-[2] bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs disabled:bg-slate-300 cursor-pointer"
                >
                  {isSavingCourse ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Popup: ยืนยันการยกเลิกนักศึกษาในคลาสเรียน */}
      {studentToRemove && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800">ยืนยันการยกเลิกนักศึกษาในคลาสเรียน</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              คุณต้องการยกเลิกคุณ <span className="font-bold text-slate-800">{studentToRemove.name}</span> ในคลาสเรียนนี้หรือไม่? <br />
              <span className="text-red-600 font-bold mt-1 inline-block">ข้อมูลสถิติการเข้าเรียนของนักศึกษาคนนี้ในวิชานี้จะหายไป</span>
            </p>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setStudentToRemove(null)}
                className="flex-1 py-2.5 font-bold text-slate-400 hover:text-slate-600 text-xs rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveStudent}
                className="flex-[2] bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                ยืนยันการยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Center Modal Popup: รายงานสถิติประวัตินักศึกษา (สำหรับ Admin - แสดงผล 15 สัปดาห์มาตรฐาน) */}
      {isReportModalOpen && selectedStudentForReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* Header ของ Modal */}
            <div className="flex justify-between items-start pb-4 mb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-800 leading-tight">
                  {selectedStudentForReport.displayName || selectedStudentForReport.name}
                </h2>
                <p className="text-xs font-bold text-emerald-700 mt-1 font-mono">
                  รหัสประจำตัว: {selectedStudentForReport.studentCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold cursor-pointer transition-colors p-1"
              >
                &times;
              </button>
            </div>

            {/* กล่องสรุปสถานะการเข้าเรียน 4 ช่อง */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: 'มาเรียน', val: 'มาเรียน', color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'มาสาย', val: 'มาสาย', color: 'text-amber-700', bg: 'bg-amber-50' },
                { label: 'ลา', val: 'ลา', color: 'text-blue-700', bg: 'bg-blue-50' },
                { label: 'ขาดเรียน', val: 'ขาดเรียน', color: 'text-red-700', bg: 'bg-red-50' }
              ].map((item) => (
                <div key={item.val} className={`${item.bg} p-2.5 rounded-2xl text-center border border-slate-100`}>
                  <p className="text-[10px] font-bold text-slate-500 mb-0.5">{item.label}</p>
                  <p className={`text-lg font-black ${item.color}`}>
                    {studentWeeklyAttendance.filter((a: any) => a.isRecorded && a.status === item.val).length}
                  </p>
                </div>
              ))}
            </div>

            {/* รายการแสดงผลสรุป 15 สัปดาห์มาตรฐานตรงกับตารางรวม */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  ตารางสรุปสถิติ 15 สัปดาห์ตลอดภาคการศึกษา
                </h3>
                <span className="text-[11px] text-slate-400 font-bold">
                  (บันทึกแล้ว {studentWeeklyAttendance.filter(w => w.isRecorded).length} จาก 15 สัปดาห์)
                </span>
              </div>

              {studentWeeklyAttendance.map((record: any) => (
                <div 
                  key={record.weekNumber} 
                  className={`flex justify-between items-center p-3.5 rounded-2xl border transition-colors ${
                    record.isRecorded 
                      ? 'bg-slate-50 border-slate-200/70 hover:bg-slate-100/60' 
                      : 'bg-slate-50/40 border-slate-100 opacity-60'
                  }`}
                >
                  <div className="pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        record.isRecorded 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        สัปดาห์ที่ {record.weekNumber}
                      </span>

                      {record.isRecorded && record.isComp && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          คาบสอนชดเชย
                        </span>
                      )}

                      <span className="text-xs font-bold text-slate-800">
                        {record.isRecorded && record.date
                          ? new Date(record.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                          : 'ยังไม่บันทึก'}
                      </span>
                    </div>

                    {record.isRecorded ? (
                      <div>
                        <p className="text-[11px] font-medium text-slate-500">
                          {record.timeLabel && <span className="font-mono font-bold text-slate-700 mr-1">({record.timeLabel} น.)</span>}
                          {record.recordTime && (
                            <span className="text-slate-400">
                              เวลาเช็คชื่อ: {new Date(record.recordTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                            </span>
                          )}
                        </p>
                        {record.remark && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {record.remark}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        ยังไม่มีการบันทึกข้อมูลการเช็คชื่อในสัปดาห์นี้
                      </p>
                    )}
                  </div>

                  {record.isRecorded ? (
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold border shrink-0 ${
                      record.status === 'มาเรียน'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : record.status === 'มาสาย'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : record.status === 'ลา'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {record.status}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-xl text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 shrink-0">
                      -
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* ปุ่มปิด Modal */}
            <div className="pt-4 mt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="w-full sm:w-28 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Custom Alert Modal */}
      {alertModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-200">
            {alertModal.isSuccess ? (
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-sm">
                PASS
              </div>
            ) : (
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-sm">
                ERR
              </div>
            )}

            <h3 className="text-lg font-black text-slate-800 mb-1">{alertModal.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
              {alertModal.message}
            </p>

            <button
              type="button"
              onClick={() => {
                if (alertModal.onClose) alertModal.onClose();
                setAlertModal({ show: false, title: '', message: '', isSuccess: true });
              }}
              className={`w-28 py-2.5 text-white rounded-xl text-xs md:text-sm font-bold shadow-xs transition-all mx-auto block active:scale-95 cursor-pointer ${
                alertModal.isSuccess ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

    </div>
  );
}