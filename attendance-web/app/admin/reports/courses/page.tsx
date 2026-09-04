// attendance-web/app/admin/reports/courses/page.tsx
'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AdminCoursesReportPage() {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States สำหรับการค้นหาและการจัดเรียง
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const getAuthToken = () => localStorage.getItem('admin_token') || localStorage.getItem('token');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const res = await fetch('/api/admin/reports/courses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setReports(json.data);
      } else {
        setReports([]);
      }
    } catch (err) {
      console.error('Fetch admin reports error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ประมวลผลค้นหาและเรียงลำดับรหัสวิชา
  const filteredAndSortedReports = useMemo(() => {
    return reports
      .filter((item) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase().trim();
        const code = (item.courseCode || '').toLowerCase();
        const name = (item.courseName || '').toLowerCase();
        const teacher = (item.teacherName || '').toLowerCase();
        return code.includes(term) || name.includes(term) || teacher.includes(term);
      })
      .sort((a, b) => {
        const codeA = (a.courseCode || '').toString();
        const codeB = (b.courseCode || '').toString();
        return sortOrder === 'asc'
          ? codeA.localeCompare(codeB, undefined, { numeric: true })
          : codeB.localeCompare(codeA, undefined, { numeric: true });
      });
  }, [reports, searchTerm, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">
      
      {/* 1. ส่วนหน้าจอปกติ (ซ่อนอัตโนมัติเมื่อสั่งพิมพ์) */}
      <div className="print:hidden flex flex-col flex-1">
        
        {/* Header */}
        <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative">
          <div className="absolute top-6 left-6">
            <Link
              href="/admin/dashboard"
              className="text-emerald-100 hover:text-white font-bold inline-flex items-center gap-1.5 text-xs uppercase tracking-wider transition-all"
            >
              ← Dashboard
            </Link>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
            ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
          </h1>
          <p className="text-emerald-100 font-medium text-xs md:text-sm">
            สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
          </p>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">
          
          {/* กล่องหัวเรื่อง */}
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[14px] font-bold text-slate-400">รายงานภาพรวม</span>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">สรุปการเข้าเรียนแยกตามรายวิชา</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ภาพรวมสถิติการเช็คชื่อสะสมของแต่ละวิชาในระบบ (คลิกที่รายวิชาเพื่อดูรายงานอย่างละเอียด)
              </p>
            </div>
            <span className="bg-slate-50 text-slate-600 font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-200/60 whitespace-nowrap">
              รายวิชาทั้งหมด {reports.length} วิชา
            </span>
          </div>

          {/* แถบค้นหา */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="ค้นหารหัสวิชา, ชื่อวิชา หรือ อาจารย์ผู้สอน..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  &times;
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-bold w-full sm:w-auto text-right whitespace-nowrap">
              พบข้อมูลทั้งหมด <span className="text-emerald-700 font-black">{filteredAndSortedReports.length}</span> วิชา
            </div>
          </div>

          {/* ตารางแสดงรายงาน (เพิ่มคลาส overflow-x-hidden หรือปรับแต่งจัดการการแสดงผล) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/60">
                    <th className="py-4 px-3 text-xs font-bold text-slate-600 w-10 text-center">ลำดับ</th>
                    <th 
                      className="py-4 px-3 text-xs font-bold text-slate-600 w-24 cursor-pointer select-none hover:bg-slate-100/80 transition-colors whitespace-nowrap"
                      onClick={toggleSortOrder}
                      title="คลิกเพื่อสลับการเรียงลำดับรหัสวิชา"
                    >
                      <div className="inline-flex items-center gap-1 group">
                        <span>รหัสวิชา</span>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-slate-200/60 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors text-[9px] font-black">
                          {sortOrder === 'asc' ? '▲' : '▼'}
                        </span>
                      </div>
                    </th>
                    <th className="py-4 px-3 text-xs font-bold text-slate-600">ชื่อรายวิชา</th>
                    <th className="py-4 px-3 text-xs font-bold text-slate-600 w-36 whitespace-nowrap">อาจารย์ผู้สอน</th>
                    <th className="py-4 px-3 text-xs font-bold text-slate-600 text-center w-16 whitespace-nowrap">นศ.</th>
                    <th className="py-4 px-3 text-xs font-bold text-slate-600 text-center w-44 whitespace-nowrap">สรุปการเข้าเรียน</th>
                    <th className="py-4 px-3 text-xs font-bold text-slate-600 text-center w-24 whitespace-nowrap">ร้อยละ (%)</th>
                    <th className="py-4 px-3 text-xs font-bold text-slate-600 text-center w-16 whitespace-nowrap">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-14 text-center font-bold text-slate-400 animate-pulse text-xs">
                        กำลังโหลดข้อมูลสรุปรายวิชา...
                      </td>
                    </tr>
                  ) : filteredAndSortedReports.length > 0 ? (
                    filteredAndSortedReports.map((item, index) => (
                      <tr 
                        key={item.id || index} 
                        onClick={() => router.push(`/admin/reports/courses/${item.id}`)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        title="คลิกเพื่อดูรายละเอียดการเช็คชื่อของวิชานี้"
                      >
                        {/* ลำดับ */}
                        <td className="py-4 px-3 text-center text-xs font-bold text-slate-400">
                          {index + 1}
                        </td>

                        {/* รหัสวิชา */}
                        <td className="py-4 px-3 font-mono font-bold text-emerald-700 text-xs whitespace-nowrap">
                          {item.courseCode}
                        </td>

                        {/* ชื่อรายวิชา */}
                        <td className="py-4 px-3 font-bold text-slate-800 text-xs">
                          {item.courseName}
                        </td>

                        {/* อาจารย์ผู้สอน */}
                        <td className="py-4 px-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                          {item.teacherName || '-'}
                        </td>

                        {/* จำนวนนักศึกษา */}
                        <td className="py-4 px-3 text-center font-bold font-mono text-emerald-700 text-xs whitespace-nowrap">
                          {item.totalStudents || 0}
                        </td>

                        {/* สรุปผลสถานะ */}
                        <td className="py-4 px-3 whitespace-nowrap">
                          <div className="flex justify-center items-center gap-1 text-[11px] font-bold">
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
                              มา {item.summary?.present || 0}
                            </span>
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100">
                              สาย {item.summary?.late || 0}
                            </span>
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
                              ลา {item.summary?.leave || 0}
                            </span>
                            <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded border border-red-100">
                              ขาด {item.summary?.absent || 0}
                            </span>
                          </div>
                        </td>

                        {/* ร้อยละการเข้าเรียน */}
                        <td className="py-4 px-3 whitespace-nowrap">
                          <div className="flex flex-col items-center">
                            <span className={`text-xs font-mono font-bold ${item.percentage >= 80 ? 'text-emerald-700' : item.percentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {item.percentage || 0}%
                            </span>
                            <div className="w-14 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${item.percentage >= 80 ? 'bg-emerald-500' : item.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${item.percentage || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        {/* ปุ่มไอคอนดูรายงาน */}
                        <td className="py-4 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center items-center">
                            <Link
                              href={`/admin/reports/courses/${item.id}`}
                              title="ดูรายงานการเข้าเรียน"
                              className="p-1.5 text-slate-700 bg-slate-100 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-200/85 transition-all shadow-2xs cursor-pointer inline-flex items-center justify-center"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-16 text-center text-slate-400 font-bold text-xs">
                        {searchTerm ? 'ไม่พบข้อมูลรายวิชาที่ตรงกับคำค้นหา' : 'ไม่พบข้อมูลรายวิชาในระบบ'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm">
          © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
          <p className="text-emerald-100 font-medium text-xs md:text-sm">
            สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
          </p>
        </footer>
      </div>

    </div>
  );
}