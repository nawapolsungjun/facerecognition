// attendance-web/app/admin/courses/page.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

export default function AdminCourseManagementPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // เพิ่ม field: section, semester, academicYear ลงใน state เริ่มต้น
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

  // State สำหรับ Custom Alert Modal
  const [alertModal, setAlertModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    isSuccess?: boolean;
  }>({
    show: false,
    title: '',
    message: '',
    isSuccess: true,
  });

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
    // เพิ่มการตรวจสอบความครบถ้วนของข้อมูลใหม่
    if (!newCourse.code.trim() || !newCourse.name.trim() || !newCourse.teacherId || !newCourse.section.trim() || !newCourse.academicYear.trim()) {
      setAlertModal({
        show: true,
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกข้อมูลรายวิชาและเลือกผู้สอนให้ครบถ้วน',
        isSuccess: false,
      });
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
        // Reset state กลับเป็นค่าตั้งต้น
        setNewCourse({ code: '', name: '', teacherId: '', section: '1', semester: '1', academicYear: '2569' });
        fetchInitialData();
        setAlertModal({
          show: true,
          title: 'สร้างรายวิชาสำเร็จ',
          message: data.message || 'สร้างรายวิชาใหม่เรียบร้อยแล้ว',
          isSuccess: true,
        });
      } else {
        setShowCreateConfirmModal(false);
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: data.error || 'สร้างรายวิชาไม่สำเร็จ',
          isSuccess: false,
        });
      }
    } catch {
      setShowCreateConfirmModal(false);
      setAlertModal({
        show: true,
        title: 'เกิดข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
        isSuccess: false,
      });
    } finally {
      setIsCreating(false);
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
        setAlertModal({
          show: true,
          title: 'ลบรายวิชาสำเร็จ',
          message: 'ลบรายวิชาออกจากระบบเรียบร้อยแล้ว',
          isSuccess: true,
        });
      } else {
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: json.error || 'เกิดข้อผิดพลาดในการลบรายวิชา',
          isSuccess: false,
        });
      }
    } catch {
      setAlertModal({
        show: true,
        title: 'เกิดข้อผิดพลาด',
        message: 'การเชื่อมต่อฐานข้อมูลล้มเหลว',
        isSuccess: false,
      });
    }
  };

  const selectedTeacherObj = teachers.find(t => String(t.id) === String(newCourse.teacherId));

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">

      {/* 1. Header ด้านบน */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative">
        <div className="absolute top-6 left-6">
          <Link
            href="/admin/dashboard"
            className="text-emerald-100 hover:text-white font-bold inline-flex items-center gap-2 text-xs uppercase tracking-wider transition-all"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </header>

      {/* 2. Navigation Bar */}
      <nav className="bg-[#0d9488] shadow-inner px-4 overflow-x-auto">
        <div className="max-w-5xl mx-auto flex items-center justify-start gap-2 min-w-max py-2 text-white font-bold text-xs">
          <span className="px-3 py-1 bg-white/20 rounded-lg">จัดการรายวิชาในระบบ (Admin)</span>
        </div>
      </nav>

      {/* 3. Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8">

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800">รายวิชาในระบบ</h2>
            <p className="text-slate-500 text-xs font-medium mt-1">ตรวจสอบและควบคุมรายวิชาทั้งหมดที่ถูกสร้างขึ้นในระบบ</p>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-xs transition-all cursor-pointer"
          >
            + สร้างรายวิชาใหม่
          </button>
        </div>

        {/* ตารางแสดงผลรายวิชา */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/60">
                  <th className="p-4 text-xs font-bold text-slate-600 w-16 text-center">ลำดับ</th>
                  <th className="p-4 text-xs font-bold text-slate-600 w-40">รหัสวิชา</th>
                  <th className="p-4 text-xs font-bold text-slate-600">ชื่อรายวิชา / ข้อมูลชั้นเรียน</th>
                  <th className="p-4 text-xs font-bold text-slate-600">อาจารย์ผู้สอน</th>
                  <th className="p-4 text-xs font-bold text-slate-600 text-center w-40">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="text-center p-14 text-slate-400 font-bold text-xs animate-pulse">
                      กำลังดึงข้อมูลรายวิชาจากระบบ...
                    </td>
                  </tr>
                )}

                {!loading && courses.map((course, idx) => (
                  <tr key={course.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 text-xs font-bold text-slate-400 text-center">
                      {idx + 1}
                    </td>
                    <td className="p-4">
                      <div className="font-mono font-bold text-emerald-700 text-xs md:text-sm">
                        {course.courseCode}
                      </div>
                      {/* แสดงรหัส Join Code ตรงนี้ */}
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 border border-slate-200 rounded-md text-[10px] font-bold text-slate-600">
                        <span>Join:</span>
                        <span className="font-mono text-emerald-600 tracking-wider uppercase select-all">{course.joinCode || '-'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/admin/courses/${course.id}/students`}
                        className="font-bold text-slate-800 hover:text-emerald-700 transition-colors text-xs md:text-sm inline-block"
                      >
                        {course.courseName} <span className="font-medium text-slate-500 text-xs ml-1">(กลุ่ม {course.section})</span>
                      </Link>
                      <div className="text-[11px] text-slate-500 mt-1 font-medium flex gap-3">
                        <span>เทอม {course.semester}/{course.academicYear}</span>
                        <span className="text-slate-300">|</span>
                        <span>นักศึกษา: {course._count?.students || 0} คน</span>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-700">
                      {course.teacherDisplayName || (
                        <span className="text-amber-700 italic text-xs">ไม่พบผู้สอน / บัญชีถูกลบ</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center items-center gap-1.5">

                        {/* 1. ปุ่มดูรายชื่อนักศึกษา (User Group Icon) */}
                        <Link
                          href={`/admin/courses/${course.id}/students`}
                          title="จัดการรายชื่อนักศึกษา"
                          className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-700 hover:text-white rounded-xl border border-emerald-200/60 transition-all shadow-2xs"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </Link>

                        {/* 2. ปุ่มดูรายงานการเข้าเรียน (Report / Chart Icon) */}
                        <Link
                          href={`/admin/reports/courses/${course.id}`}
                          title="รายงานการเข้าเรียน"
                          className="p-2 text-slate-700 bg-slate-100 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-200/80 transition-all shadow-2xs"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </Link>

                        {/* 3. ปุ่มลบรายวิชา (Trash Can Icon) */}
                        <button
                          type="button"
                          onClick={() => setCourseToDelete({ id: course.id, name: course.courseName })}
                          title="ลบรายวิชา"
                          className="p-2 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-xl border border-red-200/60 transition-all shadow-2xs cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && courses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center p-14 text-slate-400 font-bold text-xs">
                      ยังไม่มีรายวิชาถูกสร้างขึ้นในระบบขณะนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 4. Footer ด้านล่าง */}
      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

      {/* Modal สร้างรายวิชาใหม่ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 md:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-5">สร้างรายวิชาใหม่ (Admin)</h2>

            <form onSubmit={handleOpenCreateConfirm} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">รหัสวิชา</label>
                  <input
                    required
                    type="text"
                    value={newCourse.code}
                    onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                    placeholder="เช่น 5141319"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
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
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Grid 3 ช่องสำหรับ กลุ่มเรียน เทอม ปีการศึกษา */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">กลุ่มเรียน (Section)</label>
                  <input
                    required
                    type="text"
                    value={newCourse.section}
                    onChange={(e) => setNewCourse({ ...newCourse, section: e.target.value })}
                    placeholder="เช่น 1, 2, วส.67"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">ภาคเรียน (Semester)</label>
                  <select
                    required
                    value={newCourse.semester}
                    onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="1">เทอม 1</option>
                    <option value="2">เทอม 2</option>
                    <option value="3">เทอม 3 (ซัมเมอร์)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">ปีการศึกษา</label>
                  <input
                    required
                    type="text"
                    value={newCourse.academicYear}
                    onChange={(e) => setNewCourse({ ...newCourse, academicYear: e.target.value })}
                    placeholder="เช่น 2569"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">อาจารย์ผู้สอนรายวิชา</label>
                <select
                  required
                  value={newCourse.teacherId}
                  onChange={(e) => setNewCourse({ ...newCourse, teacherId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs md:text-sm font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value="" disabled>-- เลือกอาจารย์ผู้สอน --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                >
                  ตกลงสร้างวิชา
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการสร้างรายวิชา */}
      {showCreateConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800">ยืนยันการสร้างรายวิชา</h3>
            <p className="text-xs text-slate-400 mt-1">
              กรุณาตรวจสอบความถูกต้องของข้อมูลรายวิชา
            </p>

            <div className="bg-slate-50 rounded-xl p-4 my-5 text-xs text-slate-600 text-left space-y-2 border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">รหัสวิชา:</span>
                <span className="font-mono font-bold text-emerald-700">{newCourse.code.trim()}</span>
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
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-400 font-bold">อาจารย์ผู้สอน:</span>
                <span className="font-bold text-slate-700">{selectedTeacherObj?.name || '-'}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isCreating}
                onClick={() => setShowCreateConfirmModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                แก้ไข
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={handleConfirmCreateCourse}
                className="flex-[2] bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 disabled:bg-slate-300 cursor-pointer"
              >
                {isCreating ? 'กำลังสร้าง...' : 'ยืนยันสร้างวิชา'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการลบรายวิชา (คงเดิม) */}
      {courseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800">ยืนยันการลบรายวิชา</h3>
            <p className="text-xs text-slate-500 mt-2">
              คุณต้องการลบวิชา <span className="font-bold text-slate-800">{courseToDelete.name}</span> หรือไม่? <br />
              <span className="text-red-600 font-bold mt-1 inline-block">ข้อมูลการเช็คชื่อและนักศึกษาในวิชานี้จะถูกลบถาวร</span>
            </p>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setCourseToDelete(null)}
                className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCourse}
                className="flex-[2] bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                ลบรายวิชา
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal (คงเดิม) */}
      {alertModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-200">
            {alertModal.isSuccess ? (
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ) : (
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              </div>
            )}

            <h3 className="text-lg font-black text-slate-800 mb-1">{alertModal.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
              {alertModal.message}
            </p>

            <button
              type="button"
              onClick={() => setAlertModal({ show: false, title: '', message: '', isSuccess: true })}
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