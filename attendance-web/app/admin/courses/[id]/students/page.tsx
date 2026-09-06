// attendance-web/app/admin/courses/[id]/students/page.tsx
'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AdminCourseStudentsPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States สำหรับ Multi-Select เพิ่มนักศึกษาหลายคนพร้อมกัน
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States สำหรับ Searchable Multi-Select
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
  const [editSection, setEditSection] = useState('1');
  const [editSemester, setEditSemester] = useState('1');
  const [editAcademicYear, setEditAcademicYear] = useState('2569');
  const [editJoinCode, setEditJoinCode] = useState('');
  const [isSavingCourse, setIsSavingCourse] = useState(false);

  // State สำหรับ Modal ยืนยันการจัดเก็บรายวิชา (Archive)
  const [showArchiveCourseModal, setShowArchiveCourseModal] = useState(false);

  // Modal สำหรับยกเลิกนักศึกษาในคลาสเรียน
  const [studentToRemove, setStudentToRemove] = useState<{ id: number; name: string } | null>(null);

  // Modal สำหรับดูรายงานประวัตินักศึกษา
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<any>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Toast Alert Message State (ลอยตรงกลางด้านบน)
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
    onClose?: () => void;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((type: 'success' | 'error', title: string, message: string, onClose?: () => void, duration = 3500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, type, title, message, onClose });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
      if (onClose) onClose();
    }, duration);
  }, []);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const [resStudents, resHistory] = await Promise.all([
        fetch(`/api/admin/courses/${courseId}/students`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
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
        setEditSection(json.data.course.section || '1');
        setEditSemester(json.data.course.semester || '1');
        setEditAcademicYear(json.data.course.academicYear || '2569');
        setEditJoinCode(json.data.course.joinCode || '');
      } else {
        showToast('error', 'เกิดข้อผิดพลาด', json.error || 'ไม่พบข้อมูลรายวิชา');
      }

      if (resHistory && resHistory.ok) {
        const historyJson = await resHistory.json();
        const rawList = Array.isArray(historyJson.data) ? historyJson.data : Array.isArray(historyJson) ? historyJson : [];
        const sortedHistory = [...rawList].sort((a: any, b: any) => {
          return new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime();
        });
        setHistorySessions(sortedHistory);
      }
    } catch (err) {
      console.error("Error fetching admin course data:", err);
      showToast('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setLoading(false);
    }
  }, [courseId, showToast]);

  useEffect(() => {
    if (courseId) fetchData();
  }, [courseId, fetchData]);

  const handleOpenStudentReport = (student: any, displayName: string) => {
    setSelectedStudentForReport({
      ...student,
      displayName,
    });
    setIsReportModalOpen(true);
  };

  const handleUpdateCourseDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCode.trim() || !editName.trim() || !editSection.trim() || !editAcademicYear.trim()) {
      showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลรายวิชาให้ครบถ้วน');
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
        body: JSON.stringify({ 
          courseCode: editCode.trim(), 
          courseName: editName.trim(),
          section: editSection.trim(),
          semester: editSemester.trim(),
          academicYear: editAcademicYear.trim(),
          joinCode: editJoinCode.trim()
        })
      });
      const json = await res.json();
      if (json.success) {
        setIsEditingCourse(false);
        fetchData();
        showToast('success', 'แก้ไขข้อมูลสำเร็จ', 'อัปเดตข้อมูลรายวิชาเรียบร้อยแล้ว');
      } else {
        showToast('error', 'เกิดข้อผิดพลาด', json.error || 'ไม่สามารถอัปเดตข้อมูลรายวิชาได้');
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleConfirmArchiveCourse = async () => {
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'ARCHIVED' })
      });
      if (res.ok) {
        setShowArchiveCourseModal(false);
        router.push('/admin/courses');
      } else {
        setShowArchiveCourseModal(false);
        showToast('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถจัดเก็บรายวิชาได้');
      }
    } catch {
      setShowArchiveCourseModal(false);
      showToast('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleAddStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกนักศึกษาที่ต้องการเพิ่มอย่างน้อย 1 คน');
      return;
    }

    setIsSubmitting(true);
    const token = getAuthToken();
    try {
      const promises = selectedStudentIds.map(studentId =>
        fetch(`/api/admin/courses/${courseId}/students`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ studentId })
        }).then(res => res.json())
      );

      await Promise.all(promises);

      setSelectedStudentIds([]);
      setSearchQuery('');
      fetchData();
      showToast('success', 'เพิ่มนักศึกษาสำเร็จ', 'เพิ่มนักศึกษาเข้าชั้นเรียนเรียบร้อยแล้ว');
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ');
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
        showToast('success', 'ยกเลิกสำเร็จ', 'ยกเลิกนักศึกษาในคลาสเรียนเรียบร้อยแล้ว');
      } else {
        showToast('error', 'เกิดข้อผิดพลาด', json.error || 'ไม่สามารถยกเลิกนักศึกษาได้');
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ');
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

  const cleanRemarkString = (str: string) => {
    if (!str) return '';
    return str
      .replace(/\(แก้ไข(โดยอาจารย์|โดยผู้ดูแลระบบ)?เมื่อ[^)]*?\)/gi, '')
      .replace(/\(แก้ไขเวลา[^)]*?\)/gi, '')
      .trim();
  };

  const studentWeeklyAttendance = useMemo(() => {
    if (!selectedStudentForReport) return [];

    const studentId = String(selectedStudentForReport.id || '');
    const studentCode = String(selectedStudentForReport.studentCode || '').trim();
    const studentName = `${selectedStudentForReport.firstName || ''} ${selectedStudentForReport.lastName || ''}`.trim() || selectedStudentForReport.name || '';

    const uniqueSlots = new Map<string, any>();
    historySessions.forEach((sess: any) => {
      const d = new Date(sess.date || sess.createdAt || 0);
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
        timeSlot = hr < 12 ? '09:00-12:00' : '13:00-16:00';
      }

      const isComp = sess.sessionType === 'COMPENSATION' || fullText.includes('สอนชดเชย');
      const sessionType = isComp ? 'COMPENSATION' : 'REGULAR';
      const slotKey = `${dateStr}_${timeSlot}_${sessionType}`;

      if (!uniqueSlots.has(slotKey)) {
        uniqueSlots.set(slotKey, {
          dateStr,
          timeSlot,
          sessionType,
          note: sess.note || '',
          sessionsList: [sess],
          rawTimestamp: d.getTime(),
        });
      } else {
        uniqueSlots.get(slotKey).sessionsList.push(sess);
      }
    });

    const standardWeeks = Array.from(uniqueSlots.values()).sort(
      (a, b) => a.rawTimestamp - b.rawTimestamp,
    );

    const totalWeeks = 15;
    const weeksList = [];

    for (let i = 0; i < totalWeeks; i++) {
      const weekIndex = i + 1;
      const weekSession = standardWeeks[i] || null;

      if (weekSession) {
        const studentRecordsInWeek: any[] = [];

        weekSession.sessionsList.forEach((session: any) => {
          const records = session.attendances || session.records || [];
          const r = records.find((item: any) => {
            const rId = String(item.studentId || item.student?.id || item.id || '');
            const rCode = String(item.studentCode || item.student?.studentCode || '').trim();
            const rName = `${item.firstName || item.student?.firstName || ''} ${item.lastName || item.student?.lastName || ''}`.trim() || item.name || item.student?.name;

            return (studentId && rId && rId === studentId) ||
                   (studentCode && rCode && rCode === studentCode) ||
                   (studentName && rName && rName === studentName);
          });

          if (r) {
            studentRecordsInWeek.push(r);
          }
        });

        let finalStatus = 'ขาดเรียน';
        let finalRemark = weekSession.note || '';

        if (studentRecordsInWeek.length > 0) {
          const manuallyEdited = studentRecordsInWeek.find(
            (r) => (r.remark || '').includes('แก้ไข') || r.isManual === true
          );

          if (manuallyEdited) {
            finalStatus = manuallyEdited.status;
            finalRemark = manuallyEdited.remark;
          } else {
            studentRecordsInWeek.sort((a, b) => {
              const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
              const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
              return tB - tA;
            });
            finalStatus = studentRecordsInWeek[0].status || 'ขาดเรียน';
            finalRemark = studentRecordsInWeek[0].remark || weekSession.note || '';
          }
        }

        let editTimestamp = '';
        const matchEditTime = finalRemark.match(/\(แก้ไข(โดยอาจารย์|โดยผู้ดูแลระบบ)?เมื่อ[^)]*?\)/i);
        if (matchEditTime) {
          editTimestamp = matchEditTime[0];
        }

        let cleanedBase = cleanRemarkString(finalRemark);
        cleanedBase = cleanedBase.replace(/\[\d{2}:\d{2}-\d{2}:\d{2}( น.)?\]\s*/g, '');

        let formattedRemark = cleanedBase;
        if (editTimestamp && !formattedRemark.includes(editTimestamp)) {
          formattedRemark = formattedRemark ? `${formattedRemark} ${editTimestamp}` : editTimestamp;
        }

        const bestRecord = studentRecordsInWeek[0];

        weeksList.push({
          weekNumber: weekIndex,
          isRecorded: true,
          date: weekSession.dateStr,
          timeLabel: weekSession.timeSlot || '',
          isComp: weekSession.sessionType === 'COMPENSATION',
          status: finalStatus,
          remark: formattedRemark,
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
  }, [selectedStudentForReport, historySessions]);

  // สรุปสถานะและคำนวณเกณฑ์เวลาเรียนของนักศึกษาที่เลือกใน Modal สำหรับ Admin
  const modalStudentSummary = useMemo(() => {
    const recordedList = studentWeeklyAttendance.filter((a: any) => a.isRecorded);
    const total = recordedList.length;
    const present = recordedList.filter((a: any) => a.status === 'มาเรียน').length;
    const late = recordedList.filter((a: any) => a.status === 'มาสาย').length;
    const leave = recordedList.filter((a: any) => a.status === 'ลา').length;
    const pending = recordedList.filter((a: any) => a.status === 'รอตรวจสอบ').length;
    const absent = recordedList.filter((a: any) => a.status === 'ขาดเรียน').length;

    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
    const MAX_ALLOWED_ABSENT = 3;
    const remainingAbsentQuota = Math.max(0, MAX_ALLOWED_ABSENT - absent);
    const isExamEligible = absent <= MAX_ALLOWED_ABSENT;

    return {
      total,
      present,
      late,
      leave,
      pending,
      absent,
      percentage,
      remainingAbsentQuota,
      isExamEligible,
    };
  }, [studentWeeklyAttendance]);

  const teacherName = course?.teacher?.firstName
    ? `${course.teacher.firstName} ${course.teacher.lastName || ''}`.trim()
    : course?.teacher?.name || 'ไม่ระบุอาจารย์';

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800 relative">

      {/* Toast Alert Message ลอยตรงกลางด้านบน */}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border bg-white animate-in slide-in-from-top-4 fade-in duration-300 min-w-[320px] max-w-md border-slate-100">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            toast.type === "success" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
          }`}>
            {toast.type === "success" ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
          <div className="flex-1 pr-1 text-left">
            <h4 className="text-xs font-bold text-slate-800">{toast.title}</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setToast((prev) => ({ ...prev, show: false }));
              if (toast.onClose) toast.onClose();
            }}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Header ด้านบน */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
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
            จัดการรายวิชา
          </button>
        </div>
      </nav>

      {/* 3. Main Content */}
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

        {/* รายละเอียดวิชาหัวข้อหลัก (มีปุ่มจัดเก็บวิชาและแก้ไขข้อมูลวิชาข้างกัน) */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-bold">
                  อาจารย์ผู้สอน: <span className="text-slate-700">{teacherName}</span>
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <span className="font-mono text-emerald-700">{course?.courseCode || '...'}</span> {course?.courseName || '...'}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs font-bold text-slate-600">
                <span className="bg-slate-100 px-3 py-1 rounded-md">กลุ่มเรียน: {course?.section || '-'}</span>
                <span className="bg-slate-100 px-3 py-1 rounded-md">เทอม: {course?.semester || '1'}/{course?.academicYear || '2569'}</span>
                <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-md flex items-center gap-1.5 uppercase tracking-wider shadow-sm">
                  <span>Join Code:</span> 
                  <span className="select-all">{course?.joinCode || '-'}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowArchiveCourseModal(true)}
                className="px-4 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-all cursor-pointer whitespace-nowrap"
              >
                จัดเก็บวิชา
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditCode(course?.courseCode || '');
                  setEditName(course?.courseName || '');
                  setEditSection(course?.section || '1');
                  setEditSemester(course?.semester || '1');
                  setEditAcademicYear(course?.academicYear || '2569');
                  setEditJoinCode(course?.joinCode || '');
                  setIsEditingCourse(true);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
              >
                แก้ไขข้อมูลวิชา
              </button>
            </div>
          </div>
        </div>

        {/* ฟอร์มเพิ่มนักศึกษาเข้าชั้นเรียน (Multi-Select) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-black text-slate-800">เพิ่มนักศึกษาเข้าสู่รายวิชานี้</h3>
            <span className="text-xs text-slate-400 font-bold">
              เลือกแล้ว {selectedStudentIds.length} คน (คงเหลือ {availableStudents.length} คน)
            </span>
          </div>

          <form onSubmit={handleAddStudents} className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full" ref={selectBoxRef}>
              <div
                className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer flex flex-wrap items-center gap-1.5"
                onClick={() => setIsOpenSelect(true)}
              >
                {selectedStudentIds.length > 0 ? (
                  selectedStudentIds.map((id) => {
                    const st = availableStudents.find((s: any) => String(s.id) === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                        {st ? `[${st.studentCode}] ${st.cleanDisplayName}` : id}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudentIds(prev => prev.filter(item => item !== id));
                          }}
                          className="hover:text-red-600 font-black ml-1 cursor-pointer"
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })
                ) : (
                  <span className="text-slate-400 font-normal">-- คลิกเพื่อเลือกนักศึกษา (เลือกได้หลายคน) --</span>
                )}
              </div>

              {isOpenSelect && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 animate-in fade-in duration-150">
                  <div className="p-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="พิมพ์ค้นหารหัส หรือ ชื่อนักศึกษา..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500"
                      autoFocus
                    />
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentIds(filteredDropdownOptions.map((s: any) => String(s.id)))}
                        className="text-[10px] font-bold text-emerald-700 hover:underline px-1"
                      >
                        เลือกทั้งหมด
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentIds([])}
                        className="text-[10px] font-bold text-slate-400 hover:underline px-1"
                      >
                        ล้าง
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {filteredDropdownOptions.length > 0 ? (
                      filteredDropdownOptions.map((student: any) => {
                        const isSelected = selectedStudentIds.includes(String(student.id));
                        return (
                          <div
                            key={student.id}
                            onClick={() => {
                              const sId = String(student.id);
                              setSelectedStudentIds(prev =>
                                isSelected ? prev.filter(i => i !== sId) : [...prev, sId]
                              );
                            }}
                            className={`px-4 py-2.5 text-xs cursor-pointer hover:bg-emerald-50/80 transition-colors flex items-center justify-between ${
                              isSelected ? 'bg-emerald-50/60 font-bold text-emerald-900' : 'text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                              />
                              <span className="font-mono font-bold text-emerald-700">[{student.studentCode}]</span>
                              <span>{student.cleanDisplayName}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400 font-bold">
                        ไม่พบข้อมูลที่ตรงกับคำค้นหา
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || selectedStudentIds.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs md:text-sm shadow-xs transition-all whitespace-nowrap disabled:bg-slate-300 cursor-pointer"
            >
              {isSubmitting ? 'กำลังบันทึก...' : `+ เพิ่มเข้าวิชา (${selectedStudentIds.length})`}
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

        {/* ตารางแสดงรายชื่อนักศึกษาในวิชานี้ (คอลัมน์เหมือนของอาจารย์) */}
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
                  <th className="p-4 text-xs font-bold text-slate-600">ชื่อ - นามสกุล</th>
                  <th className="p-4 text-xs font-bold text-slate-600 text-center w-36">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedStudents.length > 0 ? (
                  filteredAndSortedStudents.map((student: any, index: number) => {
                    const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || 'ไม่ระบุชื่อ';

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
                          {studentName}
                        </td>
                        <td className="p-4 text-center align-middle">
                          <div className="flex justify-center items-center gap-1.5">
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
                    <td colSpan={4} className="text-center p-14 text-slate-400 font-bold text-xs">
                      {searchTerm ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา' : 'ยังไม่มีนักศึกษาลงทะเบียนในรายวิชานี้'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* 4. Footer */}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">รหัสวิชา</label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">ชื่อรายวิชา</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="col-span-2 grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/60 mt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">กลุ่มเรียน (Section)</label>
                    <input
                      type="text"
                      required
                      value={editSection}
                      onChange={(e) => setEditSection(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">ภาคเรียน</label>
                    <select
                      required
                      value={editSemester}
                      onChange={(e) => setEditSemester(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="1">เทอม 1</option>
                      <option value="2">เทอม 2</option>
                      <option value="3">เทอม 3 (ซัมเมอร์)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">ปีการศึกษา</label>
                    <input
                      type="text"
                      required
                      value={editAcademicYear}
                      onChange={(e) => setEditAcademicYear(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">รหัสเข้าร่วมชั้นเรียน (Join Code)</label>
                  <input
                    type="text"
                    required
                    value={editJoinCode}
                    onChange={(e) => setEditJoinCode(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs text-emerald-700 tracking-wider uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
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

      {/* Modal Popup: ยืนยันการจัดเก็บวิชา (Archive) */}
      {showArchiveCourseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800">ยืนยันการจัดเก็บรายวิชา</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              วิชานี้จะถูกย้ายไปยังคลังรายวิชา (ปิดคลาส) และจะไม่แสดงผลในหน้ารายวิชาที่กำลังเปิดสอน
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowArchiveCourseModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmArchiveCourse}
                className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                จัดเก็บรายวิชา
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Popup: ยืนยันการยกเลิกนักศึกษาในคลาสเรียน */}
      {studentToRemove && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
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

      {/* 7. Center Modal Popup: รายงานสถิติประวัตินักศึกษา (พร้อมการ์ดเกณฑ์เวลาเรียน) */}
      {isReportModalOpen && selectedStudentForReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

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

            {/* การ์ดเกณฑ์เวลาเรียน (ไม่ต่ำกว่า 80%) และสถิติสะสม */}
            <div className="bg-slate-50/80 rounded-2xl p-4 md:p-5 border border-slate-200/80 mb-4 shrink-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200/60">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    เกณฑ์เวลาเรียน (ไม่ต่ำกว่า 80%)
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className={`text-3xl font-black font-mono ${
                      modalStudentSummary.percentage >= 80
                        ? 'text-emerald-700'
                        : modalStudentSummary.percentage >= 70
                          ? 'text-amber-700'
                          : 'text-red-700'
                    }`}>
                      {modalStudentSummary.percentage}%
                    </span>
                    <span className="text-xs font-bold text-slate-500">เวลาเรียนสะสม</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {modalStudentSummary.isExamEligible ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>สถานะ: มีสิทธิ์สอบ</span>
                      <span className="text-slate-400 font-normal">|</span>
                      <span className="text-emerald-700 font-normal">
                        ขาดได้อีก {modalStudentSummary.remainingAbsentQuota} ครั้ง
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                      <span>สถานะ: ขาดเรียนเกินเกณฑ์ (หมดสิทธิ์สอบ)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* กล่องสรุปสถานะการเข้าเรียน 6 ช่อง */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-3">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-slate-500 mb-0.5 whitespace-nowrap">ทั้งหมด</p>
                  <p className="text-lg font-black text-slate-800">{modalStudentSummary.total}</p>
                </div>
                <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-emerald-800 mb-0.5 whitespace-nowrap">มาเรียน</p>
                  <p className="text-lg font-black text-emerald-700">{modalStudentSummary.present}</p>
                </div>
                <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-100 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-amber-800 mb-0.5 whitespace-nowrap">มาสาย</p>
                  <p className="text-lg font-black text-amber-700">{modalStudentSummary.late}</p>
                </div>
                <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-100 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-blue-800 mb-0.5 whitespace-nowrap">ลา</p>
                  <p className="text-lg font-black text-blue-700">{modalStudentSummary.leave}</p>
                </div>
                <div className="bg-purple-50/70 p-2.5 rounded-xl border border-purple-100 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-purple-700 mb-0.5 whitespace-nowrap">รอตรวจสอบ</p>
                  <p className="text-lg font-black text-purple-600">{modalStudentSummary.pending}</p>
                </div>
                <div className="bg-red-50/70 p-2.5 rounded-xl border border-red-100 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-red-700 mb-0.5 whitespace-nowrap">ขาดเรียน</p>
                  <p className="text-lg font-black text-red-700">{modalStudentSummary.absent}</p>
                </div>
              </div>
            </div>

            {/* รายการแสดงผลสรุป 15 สัปดาห์ */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  ตารางสรุปสถิติ 15 สัปดาห์ตลอดภาคการศึกษา
                </h3>
                <span className="text-[11px] text-slate-400 font-bold">
                  (บันทึกแล้ว {modalStudentSummary.total} จาก 15 สัปดาห์)
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
                  <div className="pr-3 flex-1">
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
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed break-words">
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
                    <span className={`px-3 py-1 rounded-xl text-[11px] whitespace-nowrap font-bold border shrink-0 ${
                      record.status === 'มาเรียน'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : record.status === 'มาสาย'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : record.status === 'ลา'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : record.status === 'รอตรวจสอบ'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
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

    </div>
  );
}