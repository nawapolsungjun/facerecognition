// attendance-web/app/admin/users/register/page.tsx
'use client';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterUserPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    role: 'STUDENT' as 'STUDENT' | 'TEACHER',
    firstName: '',
    lastName: '',
    studentCode: '',
    email: '',
    password: '',
  });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);

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

  // ฟังก์ชันแสดง Toast Notification (ตั้งเวลา 1500ms / 1.5 วินาที)
  const showToast = useCallback((type: 'success' | 'error', title: string, message: string, duration = 1500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, type, title, message });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, duration);
  }, []);

  // เปิด Popup ตรวจสอบข้อมูลก่อนส่ง
  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.password.trim()) {
      showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลให้ครบทุกช่องก่อนดำเนินการ');
      return;
    }
    if (formData.role === 'STUDENT' && !formData.studentCode.trim()) {
      showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณาระบุรหัสนักศึกษาสำหรับบัญชีนักเรียน');
      return;
    }
    setShowConfirmModal(true);
  };

  // ส่งข้อมูลลงทะเบียนผู้ใช้ใหม่
  const handleConfirmSubmit = async () => {
    setLoading(true);

    try {
      const payload = {
        ...formData,
        username: formData.role === 'STUDENT' ? formData.studentCode : formData.email,
      };

      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setShowConfirmModal(false);
        showToast('success', 'ลงทะเบียนสำเร็จเรียบร้อย', `สร้างบัญชีสำหรับ ${formData.firstName} ${formData.lastName} เรียบร้อยแล้ว`);

        // นำทางไปยังหน้ารายชื่อผู้ใช้หลังแสดงแจ้งเตือนเรียบร้อย
        const targetTab = formData.role === 'TEACHER' ? 'teacher' : 'STUDENT';
        setTimeout(() => {
          router.push(`/admin/users?tab=${targetTab}`);
        }, 1500);
      } else {
        setShowConfirmModal(false);
        showToast('error', 'เกิดข้อผิดพลาด', data.error || 'ไม่สามารถลงทะเบียนผู้ใช้ใหม่ได้');
      }
    } catch {
      setShowConfirmModal(false);
      showToast('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800 relative">

      {/* Toast Alert Message ลอยตรงกลางด้านบน (Top-Middle) */}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border bg-white animate-in slide-in-from-top-4 fade-in duration-300 min-w-[320px] max-w-md border-slate-100">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
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

      {/* 1. Header */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm print:hidden">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 md:py-8 flex flex-col justify-center">
        {/* ปุ่มย้อนกลับ ตรงแนวขอบซ้ายของการ์ดพอดี */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0f766e] transition-colors cursor-pointer"
          >
            ← ย้อนกลับ
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200/80">

          <div className="text-center mb-6 pb-4 border-b border-slate-100">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">ลงทะเบียนผู้ใช้ใหม่</h2>
            <p className="text-slate-400 font-medium mt-1 text-xs">สร้างบัญชีสำหรับอาจารย์หรือนักศึกษา</p>
          </div>

          <form onSubmit={handleOpenConfirm} className="space-y-4">

            {/* บทบาท */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                บทบาทผู้ใช้งาน
              </label>
              <select
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 cursor-pointer"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'STUDENT' | 'TEACHER' })}
              >
                <option value="STUDENT">นักศึกษา (Student)</option>
                <option value="TEACHER">อาจารย์ (Teacher)</option>
              </select>
            </div>

            {/* ชื่อจริง และ นามสกุล */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อจริง
                </label>
                <input
                  type="text"
                  required
                  placeholder="ระบุชื่อจริง"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  นามสกุล
                </label>
                <input
                  type="text"
                  required
                  placeholder="ระบุนามสกุล"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            {/* รหัสนักศึกษา และ อีเมล */}
            <div className={`grid ${formData.role === 'STUDENT' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-4`}>
              {formData.role === 'STUDENT' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสนักศึกษา
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น 67605050001-3"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700"
                    value={formData.studentCode}
                    onChange={(e) => setFormData({ ...formData, studentCode: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  อีเมล
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {/* รหัสผ่าน */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                รหัสผ่านเริ่มต้น
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 transition-all"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <p className="text-[11px] text-slate-400 font-medium mt-1 italic">
                * รหัสนี้ผู้ใช้สามารถไปเปลี่ยนเองได้ภายหลังในหน้าโปรไฟล์
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-[#0f766e] hover:bg-emerald-700 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold text-sm shadow-sm transition-all cursor-pointer"
              >
                ยืนยันการลงทะเบียน
              </button>
            </div>
          </form>
        </div>
      </main>

      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

      {/* 3. Modal Popup ตรวจสอบและยืนยันข้อมูลผู้ใช้ */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="text-center mb-5">
              <h3 className="text-xl font-black text-slate-800">ตรวจสอบข้อมูลผู้ใช้</h3>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 mb-6 text-xs border border-slate-200/60">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="font-bold text-slate-400">บทบาท:</span>
                <span className="font-bold text-emerald-700 uppercase bg-emerald-100/60 px-2 py-0.5 rounded-lg text-xs">
                  {formData.role === 'STUDENT' ? 'นักศึกษา' : 'อาจารย์'}
                </span>
              </div>

              {formData.role === 'STUDENT' && (
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="font-bold text-slate-400">รหัสนักศึกษา:</span>
                  <span className="font-mono font-bold text-emerald-700">{formData.studentCode}</span>
                </div>
              )}

              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="font-bold text-slate-400">ชื่อ - นามสกุล:</span>
                <span className="font-bold text-slate-800">{formData.firstName} {formData.lastName}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-400">อีเมลระบบ:</span>
                <span className="font-medium text-slate-700">{formData.email}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-400 hover:text-slate-600 transition-all text-xs rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmSubmit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:bg-slate-300 cursor-pointer"
              >
                {loading ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}