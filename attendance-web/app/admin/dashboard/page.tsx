// attendance-web/app/admin/dashboard/page.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ teachers: 0, students: 0, courses: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [adminInfo, setAdminInfo] = useState<any>(null);

  // State สำหรับแก้ไขข้อมูลส่วนตัว
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [showProfileConfirmModal, setShowProfileConfirmModal] = useState(false);

  // State ควบคุมการแสดง/ซ่อนรหัสผ่านในแต่ละช่อง
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  // ฟังก์ชันแสดง Alert Message (ตั้งเวลาหายเองอัตโนมัติ 3.5 วินาที)
  const showToast = useCallback((type: 'success' | 'error', title: string, message: string, duration = 2000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, type, title, message });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, duration);
  }, []);

  const executeLogout = useCallback(() => {
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    const fetchAdminData = async () => {
      const savedUserStr = localStorage.getItem('admin_user') || localStorage.getItem('user');
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token') || '';

      if (!savedUserStr) {
        router.replace('/login');
        return;
      }

      try {
        const localUser = JSON.parse(savedUserStr);

        let initialFirst = localUser.firstName || '';
        let initialLast = localUser.lastName || '';
        if (!initialFirst && localUser.name) {
          const parts = localUser.name.trim().split(' ');
          initialFirst = parts[0] || '';
          initialLast = parts.slice(1).join(' ') || '';
        }

        const initialEmail = localUser.email || '';
        const initialDisplayName = `${initialFirst} ${initialLast}`.trim() || localUser.name || 'ผู้ดูแลระบบ';

        const baseAdminData = {
          ...localUser,
          firstName: initialFirst,
          lastName: initialLast,
          email: initialEmail,
          displayName: initialDisplayName,
        };

        setAdminInfo(baseAdminData);

        // ดึงข้อมูลโปรไฟล์ล่าสุดจาก API
        if (localUser.id) {
          const resProfile = await fetch(`/api/admin/profile?adminId=${localUser.id}&_t=${Date.now()}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          const profileJson = await resProfile.json();

          if (profileJson.success && profileJson.data) {
            const dbAdmin = profileJson.data;
            let first = dbAdmin.firstName || '';
            let last = dbAdmin.lastName || '';

            if (!first && dbAdmin.name) {
              const nameParts = dbAdmin.name.trim().split(' ');
              first = nameParts[0] || '';
              last = nameParts.slice(1).join(' ') || '';
            }

            const currentEmail = dbAdmin.email || initialEmail;
            const freshDisplayName = `${first} ${last}`.trim() || currentEmail || 'ผู้ดูแลระบบ';

            const updatedData = {
              ...localUser,
              ...dbAdmin,
              firstName: first,
              lastName: last,
              email: currentEmail,
              displayName: freshDisplayName,
            };

            setAdminInfo(updatedData);
            localStorage.setItem('admin_user', JSON.stringify(updatedData));
          }
        }
      } catch (e) {
        console.error('Error parsing admin user:', e);
      }

      // ดึงข้อมูลสถิติภาพรวม
      try {
        const resStats = await fetch(`/api/admin/stats?_t=${Date.now()}`);
        const statsJson = await resStats.json();
        if (statsJson.success) {
          setStats(statsJson.stats);
        }
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminData();
  }, [router]);

  const handleOpenEditModal = () => {
    const savedUserStr = localStorage.getItem('admin_user') || localStorage.getItem('user');
    let fallbackUser: any = {};
    try {
      if (savedUserStr) fallbackUser = JSON.parse(savedUserStr);
    } catch { }

    setEditData({
      firstName: adminInfo?.firstName || fallbackUser.firstName || '',
      lastName: adminInfo?.lastName || fallbackUser.lastName || '',
      email: adminInfo?.email || fallbackUser.email || '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    });

    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsEditModalOpen(true);
  };

  const handleOpenProfileConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData.firstName.trim() || !editData.lastName.trim() || !editData.email.trim()) {
      showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อ นามสกุล และอีเมลให้ครบถ้วน');
      return;
    }

    const isChangingPassword = editData.newPassword || editData.oldPassword || editData.confirmPassword;
    if (isChangingPassword) {
      if (!editData.oldPassword) {
        showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกรหัสผ่านเดิมเพื่อยืนยันการเปลี่ยนรหัสผ่าน');
        return;
      }
      if (!editData.newPassword) {
        showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกรหัสผ่านใหม่');
        return;
      }
      if (editData.newPassword !== editData.confirmPassword) {
        showToast('error', 'รหัสผ่านไม่ตรงกัน', 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
        return;
      }
    }
    setShowProfileConfirmModal(true);
  };

  const handleConfirmUpdateProfile = async () => {
    if (!adminInfo?.id) {
      showToast('error', 'เกิดข้อผิดพลาด', 'ไม่พบ ID ของผู้ดูแลระบบ');
      return;
    }

    const token = localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
    setIsUpdating(true);

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: adminInfo.id,
          firstName: editData.firstName.trim(),
          lastName: editData.lastName.trim(),
          email: editData.email.trim(),
          oldPassword: editData.oldPassword,
          password: editData.newPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setShowProfileConfirmModal(false);
        setIsEditModalOpen(false);

        if (editData.newPassword && editData.newPassword.length > 0) {
          showToast('success', 'เปลี่ยนรหัสผ่านสำเร็จ', 'กำลังนำคุณออกจากระบบเพื่อเข้าสู่ระบบใหม่...');
          setTimeout(() => executeLogout(), 2000);
          return;
        }

        const newFullName = `${editData.firstName.trim()} ${editData.lastName.trim()}`;
        const updatedUser = {
          ...adminInfo,
          firstName: editData.firstName.trim(),
          lastName: editData.lastName.trim(),
          email: editData.email.trim(),
          displayName: newFullName,
        };

        localStorage.setItem('admin_user', JSON.stringify(updatedUser));
        setAdminInfo(updatedUser);

        showToast('success', 'บันทึกข้อมูลเรียบร้อย', 'ข้อมูลส่วนตัวของคุณได้รับการอัปเดตเรียบร้อยแล้ว');
      } else {
        setShowProfileConfirmModal(false);
        showToast('error', 'เกิดข้อผิดพลาด', data.error || 'ไม่สามารถอัปเดตข้อมูลได้');
      }
    } catch {
      setShowProfileConfirmModal(false);
      showToast('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setIsUpdating(false);
    }
  };

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
      <header className="bg-[#0f766e] text-white py-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1 whitespace-nowrap">
              ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
            </h1>
            <p className="text-emerald-100 font-medium text-xs md:text-sm">
              ผู้ดูแลระบบ: <span className="font-bold text-white">{adminInfo?.displayName || 'Admin'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="px-3 py-1.5 text-sm font-medium text-[#0f766e] bg-white hover:bg-gray-100 rounded-lg transition shadow-sm cursor-pointer"
            >
              แก้ไขโปรไฟล์
            </button>
            <button
              type="button"
              onClick={executeLogout}
              className="bg-red-600/80 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-xs"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800">ยินดีต้อนรับ ผู้ดูแลระบบ</h2>
            <p className="text-slate-500 text-xs font-medium mt-1">จัดการบัญชีผู้ใช้งาน สิทธิ์การเข้าถึง และตรวจสอบภาพรวมระบบได้ที่นี่</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link href="/admin/users?tab=TEACHER" className="block bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm text-left hover:border-emerald-500/50 hover:shadow-md transition-all group">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">อาจารย์ทั้งหมด</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-slate-800 tracking-tight group-hover:text-emerald-700 transition-colors">{isLoading ? '...' : stats.teachers}</span>
              <span className="text-slate-400 font-bold text-xs">คน</span>
            </div>
          </Link>
          <Link href="/admin/users?tab=STUDENT" className="block bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm text-left hover:border-emerald-500/50 hover:shadow-md transition-all group">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">นักศึกษาทั้งหมด</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-slate-800 tracking-tight group-hover:text-emerald-700 transition-colors">{isLoading ? '...' : stats.students}</span>
              <span className="text-slate-400 font-bold text-xs">คน</span>
            </div>
          </Link>
          <Link href="/admin/courses" className="block bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm text-left hover:border-emerald-500/50 hover:shadow-md transition-all group">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">รายวิชาในระบบ</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-slate-800 tracking-tight group-hover:text-emerald-700 transition-colors">{isLoading ? '...' : stats.courses}</span>
              <span className="text-slate-400 font-bold text-xs">วิชา</span>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100">
              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-sm border border-emerald-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </span>
              <h3 className="text-lg font-black text-slate-800">จัดการบัญชีผู้ใช้</h3>
            </div>
            <div className="space-y-3">
              <Link href="/admin/users/register" className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl hover:bg-emerald-50 hover:text-emerald-800 transition-all group border border-slate-100 hover:border-emerald-200">
                <span className="font-bold text-slate-700 group-hover:text-emerald-800 text-xs md:text-sm">ลงทะเบียนอาจารย์ / นักศึกษาใหม่</span>
                <span className="group-hover:translate-x-1 transition-transform text-slate-400 group-hover:text-emerald-700">→</span>
              </Link>
              <Link href="/admin/users" className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl hover:bg-emerald-50 hover:text-emerald-800 transition-all group border border-slate-100 hover:border-emerald-200">
                <span className="font-bold text-slate-700 group-hover:text-emerald-800 text-xs md:text-sm">รายชื่อผู้ใช้และยกเลิกบัญชี</span>
                <span className="group-hover:translate-x-1 transition-transform text-slate-400 group-hover:text-emerald-700">→</span>
              </Link>
            </div>
          </section>
          <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100">
              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-sm border border-emerald-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </span>
              <h3 className="text-lg font-black text-slate-800">รายงานและภาพรวม</h3>
            </div>
            <div className="space-y-3">
              <Link href="/admin/reports/courses" className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl hover:bg-emerald-50 hover:text-emerald-800 transition-all group border border-slate-100 hover:border-emerald-200">
                <span className="font-bold text-slate-700 group-hover:text-emerald-800 text-xs md:text-sm">ออกรายงานสรุปการเข้าเรียนภาพรวม</span>
                <span className="group-hover:translate-x-1 transition-transform text-slate-400 group-hover:text-emerald-700">→</span>
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm mt-auto">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

      {/* Modal: ตั้งค่าโปรไฟล์ */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-slate-800 mb-5">ตั้งค่าโปรไฟล์ผู้ดูแลระบบ</h2>
            <form onSubmit={handleOpenProfileConfirm} className="space-y-4">

              {/* ชื่อจริง และ นามสกุล */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อจริง</label>
                  <input
                    required
                    type="text"
                    value={editData.firstName}
                    onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    placeholder="ชื่อจริง"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">นามสกุล</label>
                  <input
                    required
                    type="text"
                    value={editData.lastName}
                    onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    placeholder="นามสกุล"
                  />
                </div>
              </div>

              {/* อีเมลผู้ใช้งาน */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">อีเมลผู้ใช้งาน</label>
                <input
                  required
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  placeholder="admin@example.com"
                />
              </div>

              {/* ส่วนเปลี่ยนรหัสผ่าน พร้อมปุ่มรูปดวงตา */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700">เปลี่ยนรหัสผ่าน (กรอกเมื่อต้องการเปลี่ยน)</h4>

                {/* รหัสผ่านเดิม */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">รหัสผ่านเดิม</label>
                  <div className="relative">
                    <input
                      type={showOldPassword ? "text" : "password"}
                      placeholder="กรอกรหัสผ่านเดิม"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      value={editData.oldPassword}
                      onChange={(e) => setEditData({ ...editData, oldPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showOldPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* รหัสผ่านใหม่ */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">รหัสผ่านใหม่</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="กรอกรหัสผ่านใหม่"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      value={editData.newPassword}
                      onChange={(e) => setEditData({ ...editData, newPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showNewPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* ยืนยันรหัสผ่านใหม่ */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">ยืนยันรหัสผ่านใหม่</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      value={editData.confirmPassword}
                      onChange={(e) => setEditData({ ...editData, confirmPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer">
                  ยกเลิก
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer">
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการแก้ไขโปรไฟล์ */}
      {showProfileConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-1">ตรวจสอบความถูกต้อง</h3>

            <div className="bg-slate-50 rounded-xl p-4 my-5 text-xs text-slate-600 text-left space-y-2 border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">ชื่อ - นามสกุล:</span>
                <span className="font-bold text-slate-800">{editData.firstName} {editData.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">อีเมล:</span>
                <span className="font-bold text-slate-800">{editData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">รหัสผ่าน:</span>
                <span className={`font-bold ${editData.newPassword ? "text-amber-700" : "text-slate-400"}`}>
                  {editData.newPassword ? "เปลี่ยนรหัสผ่านใหม่ (ต้องเข้าสู่ระบบใหม่)" : "ใช้รหัสผ่านเดิม"}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" disabled={isUpdating} onClick={() => setShowProfileConfirmModal(false)} className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer">
                ยกเลิก
              </button>
              <button type="button" disabled={isUpdating} onClick={handleConfirmUpdateProfile} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer">
                {isUpdating ? "กำลังบันทึก..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}