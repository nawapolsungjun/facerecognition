'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

  // State สำหรับ Custom Alert / Success Popup
  const [alertModal, setAlertModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    isSuccess?: boolean;
  }>({
    show: false,
    title: '',
    message: '',
    isSuccess: false,
  });

  // เปิด Popup ตรวจสอบข้อมูลก่อนส่ง
  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.password.trim()) {
      setAlertModal({
        show: true,
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกข้อมูลให้ครบทุกช่องก่อนดำเนินการ',
        isSuccess: false,
      });
      return;
    }
    if (formData.role === 'STUDENT' && !formData.studentCode.trim()) {
      setAlertModal({
        show: true,
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาระบุรหัสนักศึกษาสำหรับบัญชีนักเรียน',
        isSuccess: false,
      });
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
        setAlertModal({
          show: true,
          title: 'ลงทะเบียนสำเร็จเรียบร้อย',
          message: `สร้างบัญชีสำหรับ ${formData.firstName} ${formData.lastName} เรียบร้อยแล้ว`,
          isSuccess: true,
        });
      } else {
        setShowConfirmModal(false);
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: data.error || 'ไม่สามารถลงทะเบียนผู้ใช้ใหม่ได้',
          isSuccess: false,
        });
      }
    } catch {
      setShowConfirmModal(false);
      setAlertModal({
        show: true,
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
        isSuccess: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAlertModal = () => {
    const wasSuccess = alertModal.isSuccess;
    const currentRole = formData.role;
    setAlertModal({ show: false, title: '', message: '', isSuccess: false });
    if (wasSuccess) {
      if (currentRole === 'TEACHER') {
        router.push('/admin/users?tab=teacher');
      } else {
        router.push('/admin/users?tab=STUDENT');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">

      {/* 1. Header */}
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

      {/* 2. Main Content Card */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 md:py-8 flex flex-col justify-center">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200/80">

          <div className="text-center mb-6 pb-4 border-b border-slate-100">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">ลงทะเบียนผู้ใช้ใหม่</h2>
            <p className="text-slate-400 font-medium mt-1 text-xs">สร้างบัญชีสำหรับอาจารย์หรือนักศึกษา (Admin Only)</p>
          </div>

          <form onSubmit={handleOpenConfirm} className="space-y-4">

            {/* บทบาท */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                บทบาทผู้ใช้งาน
              </label>
              <select
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
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
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            {/* รหัสนักศึกษา และ อีเมล */}
            <div className={`grid ${formData.role === 'STUDENT' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-4`}>
              {formData.role === 'STUDENT' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-bold text-emerald-700 mb-1">
                    รหัสนักศึกษา (Username)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น 67605050001-3"
                    className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs md:text-sm font-bold text-emerald-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    value={formData.studentCode}
                    onChange={(e) => setFormData({ ...formData, studentCode: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  อีเมลระบบ
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold text-sm shadow-sm transition-all cursor-pointer"
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
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3 font-black text-xl">
                ✓
              </div>
              <h3 className="text-xl font-black text-slate-800">ตรวจสอบข้อมูลผู้ใช้</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">กรุณาตรวจสอบความถูกต้องก่อนบันทึกลงระบบ</p>
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
                แก้ไขข้อมูล
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmSubmit}
                className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:bg-slate-300 cursor-pointer"
              >
                {loading ? 'กำลังบันทึก...' : 'ยืนยันถูกต้อง'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Custom Modal: แจ้งเตือนสำเร็จ / ข้อผิดพลาด */}
      {alertModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-200">
            {/* ไอคอนแสดงสถานะ */}
            {alertModal.isSuccess ? (
              <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              </div>
            )}

            <h3 className="text-xl font-black text-slate-800 mb-1.5">{alertModal.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
              {alertModal.message}
            </p>

            <button
              type="button"
              onClick={handleCloseAlertModal}
              className={`w-28 py-2.5 text-white rounded-xl text-xs md:text-sm font-bold shadow-sm transition-all mx-auto block active:scale-95 cursor-pointer ${alertModal.isSuccess ? 'bg-[#16a34a] hover:bg-[#15803d]' : 'bg-[#dc2626] hover:bg-[#b91c1c]'
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