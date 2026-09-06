// attendance-web/app/admin/courses/page.tsx
'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminCourseManagementPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // ตัวกรองสถานะของวิชา
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');

  // State เริ่มต้นสำหรับสร้างรายวิชา
  const [newCourse, setNewCourse] = useState({
    code: '',
    name: '',
    teacherId: '',
    section: '1',
    semester: '1',
    academicYear: '2569'
  });

  const [showCreateConfirmModal, setShowCreateConfirmModal] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<{ id: string; name: string } | null>(null);
  const [courseToToggleStatus, setCourseToToggleStatus] = useState<{ id: string; name: string; currentStatus: string } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // State สำหรับ Toast Alert Message ลอยตรงกลางด้านบน (หายเองอัตโนมัติ)
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((type: 'success' | 'error', title: string, message: string, duration = 3500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, type, title, message });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, duration);
  }, []);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/courses');
      const json = await res.json();
      if (json.success && json.data) {
        setCourses(json.data.courses || []);
        setTeachers(json.data.teachers || []);
      }
    } catch (err) {
      console.error("Fetch courses error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleOpenCreateConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.code.trim() || !newCourse.name.trim() || !newCourse.teacherId || !newCourse.section.trim() || !newCourse.academicYear.trim()) {
      showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลรายวิชาและเลือกผู้สอนให้ครบถ้วน');
      return;
    }
    setShowCreateConfirmModal(true);
  };

  const handleConfirmCreateCourse = async () => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseCode: newCourse.code.trim(),
          courseName: newCourse.name.trim(),
          teacherId: newCourse.teacherId,
          section: newCourse.section.trim(),
          semester: newCourse.semester.trim(),
          academicYear: newCourse.academicYear.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateConfirmModal(false);
        setIsModalOpen(false);
        setNewCourse({ code: '', name: '', teacherId: '', section: '1', semester: '1', academicYear: '2569' });
        fetchInitialData();
        showToast('success', 'สร้างรายวิชาสำเร็จ', data.message || 'สร้างรายวิชาใหม่เรียบร้อยแล้ว');
      } else {
        setShowCreateConfirmModal(false);
        showToast('error', 'เกิดข้อผิดพลาด', data.error || 'สร้างรายวิชาไม่สำเร็จ');
      }
    } catch {
      setShowCreateConfirmModal(false);
      showToast('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleCourseStatus = async () => {
    if (!courseToToggleStatus) return;
    setIsUpdatingStatus(true);
    const newStatus = courseToToggleStatus.currentStatus === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    const statusText = newStatus === 'ARCHIVED' ? 'จัดเก็บรายวิชา' : 'เปิดสอนรายวิชา';

    try {
      const res = await fetch(`/api/courses/${courseToToggleStatus.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json();
      if (res.ok && (json.success || json.data)) {
        setCourseToToggleStatus(null);
        fetchInitialData();
        showToast('success', `${statusText}สำเร็จ`, `ปรับสถานะวิชา ${courseToToggleStatus.name} เรียบร้อยแล้ว`);
      } else {
        showToast('error', 'เกิดข้อผิดพลาด', json.error || `ไม่สามารถ${statusText}ได้`);
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleConfirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    try {
      const res = await fetch(`/api/admin/courses?id=${courseToDelete.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setCourseToDelete(null);
        fetchInitialData();
        showToast('success', 'ลบรายวิชาสำเร็จ', 'ลบรายวิชาออกจากระบบเรียบร้อยแล้ว');
      } else {
        showToast('error', 'เกิดข้อผิดพลาด', json.error || 'เกิดข้อผิดพลาดในการลบรายวิชา');
      }
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด', 'การเชื่อมต่อฐานข้อมูลล้มเหลว');
    }
  };

  const filteredCourses = useMemo(() => {
    if (statusFilter === 'ALL') return courses;
    return courses.filter(c => {
      const isArchived = c.status === 'ARCHIVED';
      return statusFilter === 'ARCHIVED' ? isArchived : !isArchived;
    });
  }, [courses, statusFilter]);

  const activeCount = useMemo(() => courses.filter(c => c.status !== 'ARCHIVED').length, [courses]);
  const archivedCount = useMemo(() => courses.filter(c => c.status === 'ARCHIVED').length, [courses]);

  const selectedTeacherObj = teachers.find(t => String(t.id) === String(newCourse.teacherId));

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800 relative">

      {/* Toast Alert Message ลอยตรงกลางด้านบน (Top-Middle) */}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border bg-white animate-in slide-in-from-top-4 fade-in duration-300 min-w-[320px] max-w-md border-slate-100">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
            }`}>
            {toast.type === 'success' ? (
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
            onClick={() => setToast((prev) => ({ ...prev, show: false }))}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Header ด้านบน */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm print:hidden">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:py-6 md:px-8">

        {/* ปุ่มย้อนกลับ */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0f766e] transition-colors cursor-pointer"
          >
            ← ย้อนกลับ
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">รายวิชาในระบบ</h2>
            <p className="text-slate-400 text-xs font-medium mt-0.5">ตรวจสอบและควบคุมรายวิชาทั้งหมดที่ถูกสร้างขึ้นในระบบ</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              + สร้างรายวิชาใหม่
            </button>
          </div>
        </div>

        {/* แท็บกรองสถานะรายวิชา */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${statusFilter === 'ALL'
                ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            ทั้งหมด ({courses.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${statusFilter === 'ACTIVE'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
              }`}
          >
            กำลังเปิดสอน ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ARCHIVED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${statusFilter === 'ARCHIVED'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-50'
              }`}
          >
            จัดเก็บแล้ว ({archivedCount})
          </button>
        </div>

        {/* ตารางแสดงผลรายวิชา */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden font-sans">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/60 text-xs font-bold text-slate-600">
                  <th className="py-3.5 px-3 w-14 text-center">ลำดับ</th>
                  <th className="py-3.5 px-4 w-20">รหัสวิชา</th>
                  <th className="py-3.5 px-4 w-25">ชื่อรายวิชา</th>
                  <th className="py-3.5 px-3 w-25 text-center">กลุ่ม</th>
                  <th className="py-3.5 px-3 w-24 text-center">ภาคเรียน</th>
                  <th className="py-3.5 px-3 w-28 text-center">จำนวนนักศึกษา</th>
                  <th className="py-3.5 px-4 w-40">อาจารย์ผู้สอน</th>
                  <th className="py-3.5 px-3 w-32 text-center">สถานะ</th>
                  <th className="py-3.5 px-4 w-44 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {loading && (
                  <tr>
                    <td colSpan={9} className="text-center p-12 text-slate-400 font-medium animate-pulse">
                      กำลังดึงข้อมูลรายวิชาจากระบบ...
                    </td>
                  </tr>
                )}

                {!loading && filteredCourses.map((course, idx) => {
                  const isArchived = course.status === 'ARCHIVED';

                  return (
                    <tr key={course.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      {/* ลำดับ */}
                      <td className="py-3.5 px-3 text-center text-slate-400 font-medium">
                        {idx + 1}
                      </td>

                      {/* รหัสวิชา */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        {course.courseCode}
                      </td>

                      {/* ชื่อรายวิชา */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/admin/courses/${course.id}/students`}
                          className="font-bold text-slate-800 hover:text-emerald-700 transition-colors inline-block"
                        >
                          {course.courseName}
                        </Link>
                      </td>

                      {/* กลุ่ม (Section) */}
                      <td className="py-3.5 px-3 text-center font-medium text-slate-600">
                        {course.section || '1'}
                      </td>

                      {/* ภาคเรียน (Semester/Year) */}
                      <td className="py-3.5 px-3 text-center font-medium text-slate-600">
                        {course.semester}/{course.academicYear}
                      </td>

                      {/* จำนวนนักศึกษา */}
                      <td className="py-3.5 px-3 text-center font-medium">
                        {(course._count?.students || 0) > 0 ? (
                          <span className="text-slate-700 font-bold">
                            {course._count.students} คน
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            ไม่มีนักศึกษา
                          </span>
                        )}
                      </td>

                      {/* อาจารย์ผู้สอน */}
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {course.teacherDisplayName || (
                          <span className="text-amber-700">ไม่พบผู้สอน / บัญชีถูกลบ</span>
                        )}
                      </td>

                      {/* สถานะของวิชา */}
                      <td className="py-3.5 px-3 text-center">
                        {isArchived ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            จัดเก็บแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            กำลังเปิดสอน
                          </span>
                        )}
                      </td>

                      {/* จัดการ */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex justify-center items-center gap-1.5">

                          {/* 2. ดูรายชื่อนักศึกษา */}
                          <Link
                            href={`/admin/courses/${course.id}/students`}
                            title="จัดการรายชื่อนักศึกษา"
                            className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-700 hover:text-white rounded-lg border border-emerald-200/60 transition-all shadow-2xs"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          </Link>

                          {/* 3. ดูรายงานการเข้าเรียน */}
                          <Link
                            href={`/admin/reports/courses/${course.id}`}
                            title="รายงานการเข้าเรียน"
                            className="p-1.5 text-slate-700 bg-slate-100 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-200/80 transition-all shadow-2xs"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </Link>

                          {/* 4. ลบรายวิชา */}
                          <button
                            type="button"
                            onClick={() => setCourseToDelete({ id: course.id, name: course.courseName })}
                            title="ลบรายวิชา"
                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg border border-red-200/60 transition-all shadow-2xs cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!loading && filteredCourses.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center p-12 text-slate-400 font-medium">
                      ไม่พบรายวิชาในสถานะที่เลือก
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 3. Footer ด้านล่าง */}
      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

      {/* Modal สร้างรายวิชาใหม่ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 relative">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-300 hover:text-slate-600 text-xl font-bold transition-colors cursor-pointer"
            >
              &times;
            </button>

            <h2 className="text-lg font-black text-slate-800 mb-4">สร้างรายวิชาใหม่</h2>

            <form onSubmit={handleOpenCreateConfirm} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">รหัสวิชา</label>
                  <input
                    required
                    type="text"
                    value={newCourse.code}
                    onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                    placeholder="เช่น 5141319"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อวิชา</label>
                  <input
                    required
                    type="text"
                    value={newCourse.name}
                    onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                    placeholder="เช่น สัมมนาทางเทคโนโลยี"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Grid 3 ช่องสำหรับ กลุ่มเรียน เทอม ปีการศึกษา */}
              <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">กลุ่มเรียน</label>
                  <input
                    required
                    type="text"
                    value={newCourse.section}
                    onChange={(e) => setNewCourse({ ...newCourse, section: e.target.value })}
                    placeholder="1"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">ภาคเรียน</label>
                  <select
                    required
                    value={newCourse.semester}
                    onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer text-center"
                  >
                    <option value="1">เทอม 1</option>
                    <option value="2">เทอม 2</option>
                    <option value="3">ซัมเมอร์</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">ปีการศึกษา</label>
                  <input
                    required
                    type="text"
                    value={newCourse.academicYear}
                    onChange={(e) => setNewCourse({ ...newCourse, academicYear: e.target.value })}
                    placeholder="2569"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">อาจารย์ผู้สอนรายวิชา</label>
                <select
                  required
                  value={newCourse.teacherId}
                  onChange={(e) => setNewCourse({ ...newCourse, teacherId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <option value="" disabled>-- เลือกอาจารย์ผู้สอน --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2.5 mt-5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-[0.99] cursor-pointer"
                >
                  ยืนยัน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการสร้างรายวิชา */}
      {showCreateConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800">ตรวจสอบความถูกต้อง</h3>

            <div className="bg-slate-50 rounded-xl p-3.5 my-4 text-xs text-slate-600 text-left space-y-2 border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">รหัสวิชา:</span>
                <span className="font-bold text-emerald-700">{newCourse.code.trim()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">ชื่อวิชา:</span>
                <span className="font-bold text-slate-800">{newCourse.name.trim()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">กลุ่มเรียน:</span>
                <span className="font-bold text-slate-700">{newCourse.section.trim()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">ปีการศึกษา:</span>
                <span className="font-bold text-slate-700">{newCourse.semester.trim()}/{newCourse.academicYear.trim()}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200">
                <span className="text-slate-400 font-bold">อาจารย์ผู้สอน:</span>
                <span className="font-bold text-slate-700">{selectedTeacherObj?.name || '-'}</span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isCreating}
                onClick={() => setShowCreateConfirmModal(false)}
                className="flex-1 py-2 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={handleConfirmCreateCourse}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:bg-slate-300 cursor-pointer"
              >
                {isCreating ? 'กำลังสร้าง...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการเปลี่ยนสถานะวิชา (เปิดสอน <-> จัดเก็บ) */}
      {courseToToggleStatus && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800">
              {courseToToggleStatus.currentStatus === 'ARCHIVED' ? 'ยืนยันการเปิดสอนรายวิชา' : 'ยืนยันการจัดเก็บรายวิชา'}
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {courseToToggleStatus.currentStatus === 'ARCHIVED'
                ? `คุณต้องการนำวิชา "${courseToToggleStatus.name}" กลับมาเปิดสอนอีกครั้งใช่หรือไม่?`
                : `คุณต้องการจัดเก็บวิชา "${courseToToggleStatus.name}" (ปิดคลาส) ใช่หรือไม่?`}
            </p>

            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => setCourseToToggleStatus(null)}
                className="flex-1 py-2 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={handleToggleCourseStatus}
                className={`flex-1 text-white py-2 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:bg-slate-300 cursor-pointer ${courseToToggleStatus.currentStatus === 'ARCHIVED'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-amber-600 hover:bg-amber-700'
                  }`}
              >
                {isUpdatingStatus ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการลบรายวิชา */}
      {courseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800">ยืนยันการลบรายวิชา</h3>
            <p className="text-xs text-slate-500 mt-1.5">
              คุณต้องการลบวิชา <span className="font-bold text-slate-800">{courseToDelete.name}</span> หรือไม่? <br />
              <span className="text-red-600 font-bold mt-1 inline-block">ข้อมูลการเช็คชื่อและนักศึกษาในวิชานี้จะถูกลบถาวร</span>
            </p>

            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setCourseToDelete(null)}
                className="flex-1 py-2 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCourse}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}