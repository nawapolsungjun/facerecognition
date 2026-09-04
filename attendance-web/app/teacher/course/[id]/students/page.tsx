// attendance-web/app/teacher/course/[id]/students/page.tsx
'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function StudentListPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const [course, setCourse] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // รายการคาบเรียนหลักของรายวิชา (แยกคาบเช้า/บ่ายชัดเจน และรวบรอบ 1, 2, เก็บตกให้อยู่ในคาบเดียวกัน)
  const [courseWeeks, setCourseWeeks] = useState<any[]>([]);

  // State สำหรับ Modal รายงานประวัตินักศึกษา
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // State สำหรับจัดการการแก้ไขข้อมูลวิชา
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [editData, setEditData] = useState({ courseName: '', courseCode: '' });
  const [isDirty, setIsDirty] = useState(false);

  // State สำหรับ Searchable Select กล่องเพิ่มนักศึกษา
  const [allSystemStudents, setAllSystemStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedStudentCode, setSelectedStudentCode] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isOpenSelect, setIsOpenSelect] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState(false);
  const selectBoxRef = useRef<HTMLDivElement>(null);

  // State สำหรับค้นหาและจัดเรียงรหัสในห้องเรียน
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // State สำหรับ Popup ยืนยันต่างๆ
  const [showUpdateCourseModal, setShowUpdateCourseModal] = useState(false);
  const [showArchiveCourseModal, setShowArchiveCourseModal] = useState(false);
  const [showDeleteCourseModal, setShowDeleteCourseModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<{ id: any; name: string } | null>(null);

  // State สำหรับ Custom Alert Modal
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

  const getAuthToken = () => localStorage.getItem('teacher_token') || localStorage.getItem('token');

  const fetchCourseData = useCallback(async () => {
    const token = getAuthToken();
    try {
      const [resCourse, resAllStudents, resHistory] = await Promise.all([
        fetch(`/api/courses/${courseId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => null),
        fetch(`/api/attendance/history/${courseId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => null)
      ]);

      const json = await resCourse.json();
      if (json.success && json.data) {
        setCourse(json.data);
        setEditData({ courseName: json.data.courseName, courseCode: json.data.courseCode });
        setIsDirty(false);

        setSelectedStudent((currentSelected: any) => {
          if (!currentSelected) return null;
          const updatedStudent = json.data.students.find((s: any) => s.id === currentSelected.id);
          if (updatedStudent) {
            const freshName = `${updatedStudent.firstName || ''} ${updatedStudent.lastName || ''}`.trim() || updatedStudent.name || 'ไม่ระบุชื่อ';
            return { ...updatedStudent, displayName: freshName };
          }
          return currentSelected;
        });
      } else {
        if (resCourse.status === 401) router.push('/login');
      }

      if (resAllStudents && resAllStudents.ok) {
        const allJson = await resAllStudents.json();
        if (allJson.success && Array.isArray(allJson.data)) {
          setAllSystemStudents(allJson.data.filter((u: any) => u.role === 'STUDENT'));
        }
      }

      // ดึงประวัติการเช็คชื่อทั้งหมดและจัดกลุ่มคาบเรียน (แยกเช้า/บ่าย ไม่ทับกัน และรวบรอบ 1/2)
      if (resHistory && resHistory.ok) {
        const historyJson = await resHistory.json();
        if (historyJson.success && Array.isArray(historyJson.data)) {
          const sorted = [...historyJson.data].sort((a: any, b: any) => {
            return new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime();
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

            const isComp =
              sess.sessionType === 'COMPENSATION' ||
              fullText.includes('สอนชดเชย');

            // Key สำหรับแยกแต่ละคาบเรียนให้ถูกต้อง: วันที่ + ช่วงเวลา + ประเภทคาบ
            const slotKey = `${dateStr}_${timeSlot}_${isComp ? 'COMPENSATION' : 'REGULAR'}`;

            if (!uniqueSlots.has(slotKey)) {
              uniqueSlots.set(slotKey, {
                ...sess,
                slotKey,
                dateStr,
                timeSlot,
                isComp,
                sessionIds: [sess.id]
              });
            } else {
              const existing = uniqueSlots.get(slotKey);
              if (!existing.sessionIds.includes(sess.id)) {
                existing.sessionIds.push(sess.id);
              }
              uniqueSlots.set(slotKey, {
                ...existing,
                ...sess,
                sessionIds: existing.sessionIds
              });
            }
          }

          setCourseWeeks(Array.from(uniqueSlots.values()));
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, [courseId, router]);

  useEffect(() => {
    if (courseId) fetchCourseData();
  }, [courseId, fetchCourseData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectBoxRef.current && !selectBoxRef.current.contains(event.target as Node)) {
        setIsOpenSelect(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleAddStudentToCourse = async () => {
    if (!selectedStudentId && !selectedStudentCode) {
      setAlertModal({
        show: true,
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาเลือกนักศึกษาที่ต้องการเพิ่มเข้าชั้นเรียน',
        isSuccess: false,
      });
      return;
    }

    setIsAdding(true);
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/courses/${courseId}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: selectedStudentId,
          studentCode: selectedStudentCode
        })
      });

      const json = await res.json();
      if (json.success) {
        setSelectedStudentId('');
        setSelectedStudentCode('');
        setSearchQuery('');
        fetchCourseData();
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
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
        isSuccess: false,
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleConfirmUpdateCourse = async () => {
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editData)
      });
      if (res.ok) {
        setShowUpdateCourseModal(false);
        setIsSettingOpen(false);
        fetchCourseData();
        setAlertModal({
          show: true,
          title: 'แก้ไขข้อมูลเรียบร้อย',
          message: 'บันทึกการเปลี่ยนแปลงข้อมูลรายวิชาเรียบร้อยแล้ว',
          isSuccess: true,
        });
      } else {
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลรายวิชา',
          isSuccess: false,
        });
      }
    } catch {
      setAlertModal({
        show: true,
        title: 'เกิดข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
        isSuccess: false,
      });
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
        router.push('/teacher/dashboard');
      } else {
        setShowArchiveCourseModal(false);
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: 'ไม่สามารถจัดเก็บรายวิชาได้',
          isSuccess: false,
        });
      }
    } catch {
      setShowArchiveCourseModal(false);
      setAlertModal({
        show: true,
        title: 'เกิดข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
        isSuccess: false,
      });
    }
  };

  const handleConfirmDeleteCourse = async () => {
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setShowDeleteCourseModal(false);
        router.push('/teacher/dashboard');
      } else {
        setShowDeleteCourseModal(false);
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: 'ไม่สามารถลบรายวิชาได้',
          isSuccess: false,
        });
      }
    } catch {
      setShowDeleteCourseModal(false);
      setAlertModal({
        show: true,
        title: 'เกิดข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
        isSuccess: false,
      });
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    const idToDelete = String(studentToDelete.id);
    const token = getAuthToken();
    setIsDeleting(idToDelete);

    try {
      const res = await fetch(`/api/courses/${courseId}/students/${idToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCourse((prev: any) => ({
          ...prev,
          students: prev.students.filter((s: any) => String(s.id) !== idToDelete)
        }));
        if (selectedStudent?.id === studentToDelete.id) setIsReportModalOpen(false);
        setStudentToDelete(null);
        setAlertModal({
          show: true,
          title: 'ลบข้อมูลสำเร็จ',
          message: 'นำนักศึกษาออกจากรายวิชาเรียบร้อยแล้ว',
          isSuccess: true,
        });
      } else {
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: `ลบไม่สำเร็จ: ${data.error}`,
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
      setIsDeleting(null);
      setStudentToDelete(null);
    }
  };

  const handleCloseAlertModal = () => {
    if (alertModal.onClose) {
      alertModal.onClose();
    }
    setAlertModal({ show: false, title: '', message: '', isSuccess: true });
  };

  const availableStudents = useMemo(() => {
    if (!course?.students) return [];
    const enrolledIds = new Set(course.students.map((s: any) => s.id));
    const enrolledCodes = new Set(course.students.map((s: any) => s.studentCode));

    const available = allSystemStudents.filter(
      (s: any) => !enrolledIds.has(s.id) && !enrolledCodes.has(s.studentCode)
    );

    return available
      .map((st: any) => {
        const fullName = `${st.firstName || ''} ${st.lastName || ''}`.trim() || st.name || 'ไม่ระบุชื่อ';
        return {
          ...st,
          cleanDisplayName: fullName,
          fullLabel: `[${st.studentCode}] ${fullName}`
        };
      })
      .sort((a: any, b: any) => (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true }));
  }, [allSystemStudents, course?.students]);

  const filteredDropdownOptions = useMemo(() => {
    if (!searchQuery.trim()) return availableStudents;
    const q = searchQuery.toLowerCase().trim();
    return availableStudents.filter(
      (st: any) => st.studentCode.toLowerCase().includes(q) || st.cleanDisplayName.toLowerCase().includes(q)
    );
  }, [availableStudents, searchQuery]);

  const filteredAndSortedStudents = useMemo(() => {
    if (!course?.students) return [];
    return [...course.students]
      .filter((s: any) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase().trim();
        const code = (s.studentCode || '').toLowerCase();
        const fullName = `${s.firstName || ''} ${s.lastName || ''} ${s.name || ''}`.toLowerCase();
        return code.includes(term) || fullName.includes(term);
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

  // คำนวณประวัติ 15 สัปดาห์มาตรฐานให้ตรงตามตารางสรุปสถิติภาพรวมทุกสัปดาห์ 100%
  const studentWeeklyAttendance = useMemo(() => {
    if (!selectedStudent) return [];

    const studentAtts: any[] = selectedStudent.attendances || [];
    const totalWeeks = 15;
    const weeksList = [];

    for (let i = 0; i < totalWeeks; i++) {
      const weekIndex = i + 1;
      const session = courseWeeks[i] || null;

      if (session) {
        // ค้นหาเรคคอร์ดของนักศึกษาในคาบนี้โดยยึดตาม sessionId หรือ วันที่
        const matchedAtts = studentAtts.filter((att: any) => {
          if (session.sessionIds && session.sessionIds.includes(att.sessionId)) {
            return true;
          }
          if (att.sessionId && session.id && att.sessionId === session.id) {
            return true;
          }
          const attDate = new Date(att.date || att.createdAt).toISOString().split('T')[0];
          return attDate === session.dateStr;
        });

        // หากมีการเช็คชื่อหลายรอบ ให้เลือกสถานะล่าสุดหรือสถานะที่มีความสำคัญสูงสุด
        let bestRecord = null;
        if (matchedAtts.length > 0) {
          const priority: Record<string, number> = { มาสาย: 5, มาเรียน: 4, ลา: 3, ขาดเรียน: 1 };
          matchedAtts.sort((a, b) => {
            const pA = priority[a.status] || 0;
            const pB = priority[b.status] || 0;
            if (pA !== pB) return pB - pA;
            return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
          });
          bestRecord = matchedAtts[0];
        }

        const sessionDate = session.createdAt || session.date;

        weeksList.push({
          weekNumber: weekIndex,
          isRecorded: true,
          date: sessionDate,
          timeLabel: session.timeSlot || '',
          isComp: session.isComp || session.sessionType === 'COMPENSATION',
          status: bestRecord ? bestRecord.status : 'ขาดเรียน',
          remark: bestRecord?.remark || session.note || '',
          recordTime: bestRecord?.createdAt || session.createdAt
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
  }, [selectedStudent, courseWeeks]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">

      {/* 1. Header */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative">
        <div className="absolute top-6 left-6">
          <Link
            href="/teacher/dashboard"
            className="text-emerald-100 hover:text-white font-bold inline-flex items-center gap-2 text-xs uppercase tracking-wider transition-all"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          วิชา: <span className="font-bold text-white">{course?.courseCode || '...'}</span>  <span className="text-white-200">{course?.courseName || '...'}</span>
        </p>
      </header>

      {/* 3. Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">
        
        {/* กล่องข้อมูลรายวิชา */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">รายวิชา</span>
            <h2 className="text-2xl font-black text-slate-800">{course?.courseCode || '...'} : {course?.courseName || '...'}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-slate-50 text-slate-600 font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-200/60">
              นักศึกษาทั้งหมด {course?.students?.length || 0} คน
            </span>
            <button
              type="button"
              onClick={() => setIsSettingOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              ตั้งค่าวิชา
            </button>
          </div>
        </div>

        {/* ฟอร์มเพิ่มนักศึกษา */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-black text-slate-800">
              เพิ่มนักศึกษาเข้าสู่รายวิชานี้
            </h3>
            <span className="text-xs text-slate-400 font-bold">
              คงเหลือยังไม่ลงทะเบียน {availableStudents.length} คน
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center">
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
                    setSelectedStudentCode('');
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
                    filteredDropdownOptions.map((st: any) => (
                      <div
                        key={st.id}
                        onClick={() => {
                          setSelectedStudentId(String(st.id));
                          setSelectedStudentCode(st.studentCode);
                          setSearchQuery(st.fullLabel);
                          setIsOpenSelect(false);
                        }}
                        className={`px-4 py-2.5 text-xs md:text-sm cursor-pointer hover:bg-emerald-50/80 transition-colors flex justify-between items-center ${selectedStudentId === String(st.id) ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700'
                          }`}
                      >
                        <span className="font-mono font-bold text-emerald-700">[{st.studentCode}]</span>
                        <span className="font-bold text-slate-800">{st.cleanDisplayName}</span>
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
              type="button"
              disabled={isAdding || (!selectedStudentId && !selectedStudentCode)}
              onClick={handleAddStudentToCourse}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs md:text-sm rounded-xl shadow-xs transition-all whitespace-nowrap disabled:bg-slate-300 cursor-pointer"
            >
              {isAdding ? 'กำลังบันทึก...' : '+ เพิ่มเข้าวิชา'}
            </button>
          </div>
        </div>

        {/* แถบค้นหา */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              placeholder="ค้นหารหัส หรือ ชื่อในวิชานี้..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-500 font-bold">
            แสดง <span className="text-emerald-700 font-black">{filteredAndSortedStudents.length}</span> จากทั้งหมด {course?.students?.length || 0} คน
          </span>
        </div>

        {/* ตารางรายชื่อนักศึกษา */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/60">
                  <th className="p-4 text-xs font-bold text-slate-600 w-16 text-center">ลำดับ</th>
                  <th
                    className="p-4 text-xs font-bold text-slate-600 w-48 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
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
                {filteredAndSortedStudents.length > 0 ? filteredAndSortedStudents.map((student: any, index: number) => {
                  const displayName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || 'ไม่ระบุชื่อ';

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 text-xs font-bold text-slate-400 text-center">
                        {index + 1}
                      </td>
                      <td className="p-4 font-mono font-bold text-emerald-700 text-xs md:text-sm">
                        {student.studentCode}
                      </td>
                      <td
                        className="p-4 font-bold text-slate-800 hover:text-emerald-700 cursor-pointer text-xs md:text-sm"
                        onClick={() => { 
                          setSelectedStudent({ ...student, displayName }); 
                          setIsReportModalOpen(true); 
                        }}
                      >
                        {displayName}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center items-center gap-1.5">

                          {/* ปุ่มดูรายงานสถิตินักศึกษา */}
                          <button
                            type="button"
                            onClick={() => { 
                              setSelectedStudent({ ...student, displayName }); 
                              setIsReportModalOpen(true); 
                            }}
                            title="ดูสถิติการเข้าเรียน"
                            className="p-2 text-slate-700 bg-slate-100 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-200/80 transition-all shadow-2xs cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>

                          {/* ปุ่มลบนักศึกษา */}
                          <button
                            type="button"
                            onClick={() => setStudentToDelete({ id: student.id, name: displayName })}
                            disabled={isDeleting === String(student.id)}
                            title="ลบนักศึกษาออกจากรายวิชา"
                            className={`p-2 rounded-xl border transition-all shadow-2xs cursor-pointer ${
                              isDeleting === String(student.id)
                                ? 'bg-slate-100 text-slate-300 border-slate-200'
                                : 'text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border-red-200/60'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={4} className="text-center p-14 text-slate-400 font-bold text-xs">
                      {searchTerm ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา' : 'ยังไม่มีนักศึกษาเข้าร่วมรายวิชานี้'}
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

      {/* 5. Center Modal Popup: สรุปสถิติ 15 สัปดาห์ */}
      {isReportModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            <div className="flex justify-between items-start pb-4 mb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-800 leading-tight">
                  {selectedStudent.displayName || selectedStudent.name}
                </h2>
                <p className="text-xs font-bold text-emerald-700 mt-1 font-mono">
                  รหัสประจำตัว: {selectedStudent.studentCode}
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

            {/* กล่องสรุปสถานะการเข้าเรียน */}
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

      {/* 6. Modal Popup: ตั้งค่าและแก้ไขรายวิชา */}
      {isSettingOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 mb-5 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-800">ตั้งค่ารายวิชา</h3>
                <p className="text-xs text-slate-400 mt-0.5">แก้ไขรายละเอียดและจัดการสถานะของรายวิชา</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowUpdateCourseModal(true);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ชื่อรายวิชา
                </label>
                <input
                  type="text"
                  required
                  value={editData.courseName}
                  onChange={(e) => handleInputChange('courseName', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  รหัสวิชา (Classroom Code)
                </label>
                <input
                  type="text"
                  required
                  value={editData.courseCode}
                  onChange={(e) => handleInputChange('courseCode', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowArchiveCourseModal(true)}
                  className="px-4 py-2.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-all cursor-pointer"
                >
                  จัดเก็บวิชา (ปิดคลาส)
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteCourseModal(true)}
                  className="px-4 py-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-all cursor-pointer"
                >
                  ลบวิชาถาวร
                </button>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsSettingOpen(false)}
                  className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!isDirty}
                  className="flex-[2] bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการแก้ไขข้อมูลวิชา */}
      {showUpdateCourseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800">ยืนยันการแก้ไขรายวิชา</h3>
            <p className="text-xs text-slate-400 mt-1">
              คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลวิชานี้ใช่หรือไม่?
            </p>
            <div className="bg-slate-50 rounded-xl p-4 my-5 text-xs text-slate-600 text-left space-y-2 border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">ชื่อวิชาใหม่:</span>
                <span className="font-bold text-slate-800">{editData.courseName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">รหัสวิชาใหม่:</span>
                <span className="font-mono font-bold text-emerald-700">{editData.courseCode}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowUpdateCourseModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmUpdateCourse}
                className="flex-[2] bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                ยืนยันบันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการจัดเก็บรายวิชา (Archive) */}
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

      {/* Modal Popup: ยืนยันการลบรายวิชาถาวร */}
      {showDeleteCourseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800">ยืนยันการลบรายวิชา</h3>
            <p className="text-xs text-red-600 font-bold mt-2 leading-relaxed">
              คำเตือน: ข้อมูลนักศึกษาและประวัติเช็คชื่อทั้งหมดในรายวิชานี้จะหายไปถาวรและกู้คืนไม่ได้
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowDeleteCourseModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCourse}
                className="flex-[2] bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                ลบวิชาถาวร
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการลบนักศึกษาออกจากวิชา */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800">ยืนยันการยกเลิกนักศึกษา</h3>
            <p className="text-xs text-slate-500 mt-2">
              คุณต้องการยกเลิกคุณ <span className="font-bold text-slate-800">{studentToDelete.name}</span> ออกจากวิชานี้หรือไม่?
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                className="flex-[2] bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                ลบออกจากวิชา
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
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
              onClick={handleCloseAlertModal}
              className={`w-28 py-2.5 text-white rounded-xl text-xs md:text-sm font-bold shadow-xs transition-all mx-auto block active:scale-95 cursor-pointer ${alertModal.isSuccess ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'
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