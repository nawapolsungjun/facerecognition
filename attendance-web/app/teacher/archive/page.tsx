// attendance-web/app/teacher/archive/page.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

export default function ArchivedCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getAuthToken = () => localStorage.getItem('teacher_token') || localStorage.getItem('token');

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const res = await fetch('/api/courses/archived', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCourses(json.data);
      } else {
        setCourses([]);
      }
    } catch (err) {
      console.error("Fetch archived courses error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const restoreCourse = async (id: string, courseName: string) => {
    if (!confirm(`ต้องการนำวิชา ${courseName} กลับมาเปิดสอนใช่ไหมครับ?`)) return;
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'ACTIVE' })
      });
      if (res.ok) {
        fetchArchived();
      }
    } catch (err) {
      console.error("Restore course error:", err);
    }
  };

  useEffect(() => { 
    fetchArchived(); 
  }, [fetchArchived]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">
      <header className="bg-[#0f766e] text-white py-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <Link
              href="/teacher/dashboard"
              className="text-emerald-100 hover:text-white font-bold inline-flex items-center gap-1.5 text-xs uppercase tracking-wider transition-all mb-1"
            >
              ← กลับหน้า Dashboard
            </Link>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">คลังรายวิชา (Archived Courses)</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:py-10">
        <div className="grid gap-4">
          {loading ? (
            <div className="text-center py-20 text-slate-400 font-bold animate-pulse text-xs">
              กำลังโหลดข้อมูลคลังรายวิชา...
            </div>
          ) : courses.length > 0 ? (
            courses.map((course: any) => (
              <div key={course.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/85 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-slate-500 uppercase">{course.courseCode}</span>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">ปิดคลาสแล้ว</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">{course.courseName}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-medium text-slate-500">
                    <span>กลุ่ม {course.section || '1'}</span>
                    <span>•</span>
                    <span>เทอม {course.semester || '1'}/{course.academicYear || '2569'}</span>
                    <span>•</span>
                    <span className="font-mono">Join Code: <strong className="text-slate-700 select-all">{course.joinCode || '-'}</strong></span>
                  </div>
                </div>
                <button 
                  onClick={() => restoreCourse(course.id, course.courseName)}
                  className="w-full sm:w-auto bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap border border-amber-200 shadow-2xs"
                >
                  🔄 ดึงกลับมาเปิดสอน
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-slate-400 font-bold text-xs">
              ไม่มีรายวิชาที่ถูกจัดเก็บไว้ในคลังขณะนี้
            </div>
          )}
        </div>
      </main>

      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>
    </div>
  );
}