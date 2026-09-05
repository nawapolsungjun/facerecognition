// attendance-web/app/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        console.log("Login Success, Role:", data.user.role);

        if (data.user.role === 'ADMIN') {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          router.push('/admin/dashboard');

        } else if (data.user.role === 'TEACHER') {
          localStorage.setItem('teacher_token', data.token);
          localStorage.setItem('teacher_user', JSON.stringify(data.user));
          router.push('/teacher/dashboard');

        } else if (data.user.role === 'STUDENT') {
          localStorage.setItem('student_token', data.token);
          localStorage.setItem('student_user', JSON.stringify(data.user));
          router.push('/student/dashboard');

        } else {
          setErrorMsg('บทบาทผู้ใช้งานไม่ถูกต้อง');
        }
      } else {
        setErrorMsg(data.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setLoading(false);
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

      {/* 2. Main Content Card ฟอร์มเข้าสู่ระบบ */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 md:py-12 flex flex-col justify-center">
        <form onSubmit={handleLogin} className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border border-slate-100 w-full animate-in zoom-in-95 duration-200">

          <div className="text-center mb-6 pb-5 border-b border-slate-100">
            <div className="inline-flex items-center justify-center p-3.5 bg-emerald-50 text-emerald-700 rounded-2xl mb-3 border border-emerald-100 shadow-2xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">เข้าสู่ระบบ</h2>
            <p className="text-slate-400 font-bold mt-1 text-xs">
              กรุณากรอกข้อมูลบัญชีผู้ใช้งานของคุณ
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 p-3.5 rounded-xl mb-5 text-xs font-bold border border-red-100 text-center animate-shake">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">อีเมลผู้ใช้งาน</label>
              <input
                type="email"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">รหัสผ่าน</label>
              <input
                type="password"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span></span> {/* ตัวดันขวา */}
              <Link href="/forgot-password" className="text-[#0f766e] hover:underline font-medium">
                ลืมรหัสผ่าน?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0f766e] hover:bg-[#0d645e] active:scale-[0.99] text-white py-3.5 rounded-xl font-bold text-sm shadow-sm transition-all mt-6 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
          >
            {loading ? 'กำลังตรวจสอบสิทธิ์...' : 'ยืนยันเข้าสู่ระบบ'}
          </button>
        </form>
      </main>

      {/* 3. Footer ด้านล่าง */}
      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm mt-0.5">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

    </div>
  );
}