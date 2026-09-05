// attendance-web/app/student/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ studentCode: '', password: '' });
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus('กำลังตรวจสอบข้อมูล...');

    try {
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setStatus('เข้าสู่ระบบสำเร็จ!');

        localStorage.setItem('student_user', JSON.stringify(data.user));

        if (data.token) {
          localStorage.setItem('student_token', data.token);
        }

        router.push('/student/dashboard');
      } else {
        setStatus(`${data.error}`);
      }
    } catch (err) {
      setStatus('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">

      {/* 1. Header ด้านบนตาม Style ระบบ */}
      <header className="bg-[#0f766e] text-white pt-10 pb-8 px-4 text-center shadow-sm">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </header>

      {/* 2. Main Content Card ฟอร์มเข้าสู่ระบบนักศึกษา */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 md:py-12 flex flex-col justify-center">
        <form onSubmit={handleLogin} className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border border-slate-100 w-full animate-in zoom-in-95 duration-200">

          <div className="text-center mb-6 pb-5 border-b border-slate-100">
            <div className="inline-flex items-center justify-center p-3.5 bg-emerald-50 text-emerald-700 rounded-2xl mb-3 border border-emerald-100 shadow-2xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">เข้าสู่ระบบนักศึกษา</h2>
            <p className="text-slate-400 font-bold mt-1 text-xs">
              กรุณากรอกรหัสนักศึกษาและรหัสผ่านเพื่อเข้าใช้งาน
            </p>
          </div>

          {status && (
            <div className={`p-3.5 rounded-xl mb-5 text-xs font-bold border text-center animate-shake ${status.includes('สำเร็จ')
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : 'bg-red-50 text-red-600 border-red-100'
              }`}>
              {status}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">รหัสนักศึกษา</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-bold font-mono text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="กรอกรหัสนักศึกษา"
                value={formData.studentCode}
                onChange={e => setFormData({ ...formData, studentCode: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">รหัสผ่าน</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            {/* ตัวอย่างบริเวณใต้ช่องกรอกรหัสผ่าน หรือใต้ปุ่มเข้าสู่ระบบ */}
            <div className="flex items-center justify-between text-sm mt-2 mb-4">
              <span></span> {/* ดันข้อความไปขวา */}
              <Link href="/forgot-password?role=student" className="text-[#0f766e] hover:underline">
                ลืมรหัสผ่าน?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#0f766e] hover:bg-[#0d645e] active:scale-[0.99] text-white py-3.5 rounded-xl font-bold text-sm shadow-sm transition-all mt-6 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
          >
            {isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </main>

      {/* 3. Footer ด้านล่าง */}
      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm mt-auto">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm mt-0.5">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

    </div>
  );
}