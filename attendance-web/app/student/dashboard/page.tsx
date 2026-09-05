// attendance-web/app/student/dashboard/page.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [joinCode, setJoinCode] = useState('');
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);

  // State สำหรับ Modal แจ้งเตือนต่างๆ
  const [showJoinConfirmModal, setShowJoinConfirmModal] = useState(false);
  const [showNoFaceJoinModal, setShowNoFaceJoinModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // State สำหรับแก้ไขข้อมูลส่วนตัว
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({ firstName: '', lastName: '', password: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [showFaceWarning, setShowFaceWarning] = useState(false);

  // State สำหรับ Custom Alert / Success Popup
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

  const executeLogout = useCallback(() => {
    localStorage.removeItem('student_user');
    localStorage.removeItem('student_token');
    router.replace('/student/login');
  }, [router]);

  const fetchMyCourses = useCallback(async (studentId: string, token: string) => {
    try {
      const res = await fetch(`/api/student/courses?studentId=${studentId}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const json = await res.json();
      if (json.success) {
        setMyCourses(json.data);
      }
    } catch (err) {
      console.error('Fetch courses error:', err);
    }
  }, []);

  useEffect(() => {
    const checkUserAndFace = async () => {
      const savedUser = localStorage.getItem('student_user');
      const token = localStorage.getItem('student_token');

      if (!savedUser) {
        router.push('/student/login');
        return;
      }

      const userData = JSON.parse(savedUser);

      if (userData.role && userData.role.toUpperCase() !== 'STUDENT') {
        executeLogout();
        return;
      }

      const initialFullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.name || 'นักศึกษา';
      setUser({ ...userData, displayName: initialFullName });

      try {
        const resProfile = await fetch(`/api/student/profile?studentId=${userData.id}&_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const profileData = await resProfile.json();

        let hasFace = false;
        if (profileData.success && profileData.data) {
          hasFace = !!profileData.data.faceVectors;
          if (!hasFace) {
            setShowFaceWarning(true);
          }

          const freshName = `${profileData.data.firstName || ''} ${profileData.data.lastName || ''}`.trim() || initialFullName;
          setUser((prev: any) => ({
            ...prev,
            ...profileData.data,
            hasFaceVectors: hasFace,
            displayName: freshName
          }));
        }

        await fetchMyCourses(userData.id, token || '');
        setIsPageLoading(false);
      } catch (err) {
        console.error('Check status error:', err);
        setIsPageLoading(false);
      }
    };

    checkUserAndFace();
  }, [router, fetchMyCourses, executeLogout]);

  const handleJoinClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setAlertModal({
        show: true,
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกรหัส Join Code (6 หลัก) ก่อนดำเนินการ',
        isSuccess: false,
      });
      return;
    }

    const hasFace = !!(user?.faceVectors || user?.hasFaceVectors);

    if (!hasFace) {
      setShowNoFaceJoinModal(true);
    } else {
      setShowJoinConfirmModal(true);
    }
  };

  const handleConfirmJoinClass = async () => {
    setIsJoining(true);
    setStatus('กำลังเข้าร่วม...');
    try {
      const token = localStorage.getItem('student_token');
      const savedUser = localStorage.getItem('student_user');
      const userData = savedUser ? JSON.parse(savedUser) : user;
      const studentId = userData?.id || user?.id;

      const res = await fetch('/api/student/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ studentId, joinCode: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('เข้าร่วมสำเร็จ');
        setJoinCode('');
        setShowJoinConfirmModal(false);
        setShowNoFaceJoinModal(false);

        // แสดง Popup สำเร็จ และเมื่อกดปุ่มตกลง จะบังคับรีเฟรชหน้าเว็บทันที
        setAlertModal({
          show: true,
          title: 'เข้าร่วมชั้นเรียนสำเร็จ',
          message: 'คุณได้เข้าร่วมรายวิชาเรียบร้อยแล้ว',
          isSuccess: true,
          onClose: () => {
            window.location.reload();
          }
        });
      } else {
        setStatus(`${data.error}`);
        setShowJoinConfirmModal(false);
        setShowNoFaceJoinModal(false);
        setAlertModal({
          show: true,
          title: 'ไม่สามารถเข้าร่วมได้',
          message: data.error || 'เกิดข้อผิดพลาดในการเข้าร่วมรายวิชา',
          isSuccess: false,
        });
      }
    } catch (err) {
      console.error('Join error:', err);
      setStatus('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setShowJoinConfirmModal(false);
      setShowNoFaceJoinModal(false);
      setAlertModal({
        show: true,
        title: 'เกิดข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
        isSuccess: false,
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const token = localStorage.getItem('student_token');
      const res = await fetch('/api/student/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: user.id,
          firstName: editData.firstName,
          lastName: editData.lastName,
          password: editData.password
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditModalOpen(false);
        if (editData.password && editData.password.length > 0) {
          setAlertModal({
            show: true,
            title: 'เปลี่ยนรหัสผ่านสำเร็จ',
            message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
            isSuccess: true,
            onClose: () => executeLogout(),
          });
          return;
        }

        const newFullName = `${editData.firstName} ${editData.lastName}`.trim();
        const updatedUser = {
          ...user,
          firstName: editData.firstName,
          lastName: editData.lastName,
          displayName: newFullName
        };
        localStorage.setItem('student_user', JSON.stringify(updatedUser));
        setUser(updatedUser);

        setAlertModal({
          show: true,
          title: 'บันทึกข้อมูลเรียบร้อย',
          message: 'ข้อมูลส่วนตัวของคุณได้รับการอัปเดตเรียบร้อยแล้ว',
          isSuccess: true,
        });
      } else {
        setAlertModal({
          show: true,
          title: 'เกิดข้อผิดพลาด',
          message: data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
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
      setIsUpdating(false);
    }
  };

  const handleCloseAlertModal = () => {
    if (alertModal.onClose) {
      alertModal.onClose();
    }
    setAlertModal({ show: false, title: '', message: '', isSuccess: true });
  };

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-[#f0f7f4] flex items-center justify-center p-10">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-emerald-800 font-bold animate-pulse uppercase text-xs tracking-widest">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">

      {/* 1. Header ด้านบน */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1 whitespace-nowrap">
              ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
            </h1>
            <p className="text-emerald-100 font-medium text-xs md:text-sm">
              นักศึกษา: <span className="font-bold text-white">{user?.displayName}</span> : <span className="font-mono text-emerald-200">{user?.studentCode}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditData({
                  firstName: user.firstName || '',
                  lastName: user.lastName || '',
                  password: ''
                });
                setIsEditModalOpen(true);
              }}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              แก้ไขโปรไฟล์
            </button>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="bg-red-500/80 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      {/* 2. Navigation Bar */}
      <nav className="bg-[#0d9488] shadow-inner px-4 overflow-x-auto">
        <div className="max-w-4xl mx-auto flex items-center justify-start gap-1 min-w-max py-2 text-white font-bold text-xs">
          <span className="px-3 py-1 bg-white/20 rounded-lg">หน้าหลักนักศึกษา</span>
        </div>
      </nav>

      {/* 3. Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8">

        {/* แถบแจ้งเตือนสแกนหน้า */}
        {showFaceWarning && !(user?.faceVectors || user?.hasFaceVectors) && (
          <div className="mb-6 animate-in slide-in-from-top duration-500">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-amber-800 text-sm">ยังไม่ได้ลงทะเบียนใบหน้า</h3>
                <p className="text-amber-700 text-xs mt-0.5">กรุณาลงทะเบียนใบหน้าเพื่อใช้งานระบบเช็คชื่ออัตโนมัติ</p>
              </div>
              <Link className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all whitespace-nowrap" href="/student/face-enrollment">
                ลงทะเบียนเดี๋ยวนี้
              </Link>
            </div>
          </div>
        )}

        {/* ฟอร์มเข้าร่วมชั้นเรียน */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200/80 mb-8">
          <h2 className="text-lg font-black text-slate-800 mb-1">เข้าร่วมชั้นเรียนใหม่</h2>
          <p className="text-xs text-slate-400 mb-3">กรอกรหัสเข้าร่วม (Join Code 6 หลัก) ที่ได้รับจากอาจารย์ผู้สอน</p>
          <form onSubmit={handleJoinClick} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="กรอกรหัส JOIN CODE 6 หลัก (เช่น PNW11W)"
              required
              maxLength={10}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-mono font-bold text-slate-700 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-sm transition-all cursor-pointer">
              JOIN
            </button>
          </form>
          {status && <p className="mt-3 text-xs font-bold text-emerald-700">{status}</p>}
        </div>

        {/* รายการวิชาที่ลงทะเบียนแล้ว */}
        <h2 className="text-xl font-black text-slate-800 mb-4">วิชาที่ลงทะเบียนแล้ว</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myCourses.length > 0 ? (
            myCourses.map((course) => (
              <Link
                key={course.id}
                href={`/student/courses/${course.id}`}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:border-emerald-500/50 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border border-emerald-100 font-mono">
                      {course.courseCode} (กลุ่ม {course.section || '1'})
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase">• Active</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-1 group-hover:text-emerald-700 transition-colors">
                    {course.courseName}
                  </h3>
                  <div className="text-xs text-slate-500 mb-4 font-medium flex gap-2 items-center">
                    <span>เทอม {course.semester}/{course.academicYear}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-50 text-slate-500 text-center py-2 rounded-xl text-[10px] font-bold border border-slate-100 uppercase group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                  ดูรายงานการเข้าเรียน
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold text-xs">
              ยังไม่มีวิชาที่เข้าร่วม...
            </div>
          )}
        </div>
      </main>

      {/* 4. Footer ด้านล่าง */}
      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm mt-auto">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

      {/* Modal แจ้งเตือนกรณี "ยังไม่ได้ลงทะเบียนใบหน้า" */}
      {showNoFaceJoinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-4 font-black text-xl">
              !
            </div>

            <h3 className="text-xl font-black text-slate-800">ยังไม่ลงทะเบียนใบหน้า</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              หากคุณเข้าชั้นเรียนตอนนี้ <br />
              <span className="text-amber-600 font-bold">จะไม่สามารถเช็คชื่อด้วยใบหน้าได้</span> <br />
              คุณต้องการดำเนินการอย่างไร?
            </p>

            <div className="bg-slate-50 rounded-xl p-4 my-5 text-xs text-slate-600 text-left space-y-2 border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Join Code ที่จะเข้าร่วม:</span>
                <span className="font-mono font-bold text-emerald-700 uppercase">{joinCode.trim()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">สถานะใบหน้า:</span>
                <span className="font-bold text-red-500">ยังไม่มีข้อมูลในระบบ</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Link className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-xs shadow-sm transition-all text-center" href="/student/face-enrollment">
                ลงทะเบียนใบหน้าก่อน
              </Link>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNoFaceJoinModal(false)}
                  className="flex-1 py-2.5 font-bold text-slate-400 hover:text-slate-600 text-xs rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isJoining}
                  onClick={handleConfirmJoinClass}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  {isJoining ? 'กำลังเข้าร่วม...' : 'ยืนยันเข้าชั้นเรียน'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal ป๊อบอัปยืนยันการเข้าร่วมชั้นเรียน */}
      {showJoinConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 font-black text-xl">
              ✓
            </div>

            <h3 className="text-xl font-black text-slate-800">ยืนยันการเข้าร่วมชั้นเรียน</h3>
            <p className="text-xs text-slate-400 mt-1">
              คุณต้องการเข้าร่วมรายวิชารหัส Join Code <br />
              <span className="font-mono font-bold text-emerald-700 text-sm uppercase">{joinCode.trim()}</span> ใช่หรือไม่?
            </p>

            <div className="bg-slate-50 rounded-xl p-4 my-5 text-xs text-slate-600 text-left space-y-2 border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">นักศึกษา:</span>
                <span className="font-bold text-slate-800">{user?.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">รหัสประจำตัว:</span>
                <span className="font-mono font-bold text-slate-700">{user?.studentCode}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isJoining}
                onClick={() => setShowJoinConfirmModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-400 hover:text-slate-600 text-xs rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isJoining}
                onClick={handleConfirmJoinClass}
                className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                {isJoining ? 'กำลังเข้าร่วม...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการออกจากระบบ */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-4 font-black text-xl">
              !
            </div>

            <h3 className="text-xl font-black text-slate-800">ยืนยันการออกจากระบบ</h3>
            <p className="text-xs text-slate-500 mt-1">
              คุณต้องการออกจากระบบการใช้งานในฐานะนักศึกษาใช่หรือไม่?
            </p>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-400 hover:text-slate-600 text-xs rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeLogout}
                className="flex-[2] bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal แก้ไขข้อมูลส่วนตัว */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-md shadow-xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-5 text-slate-800">จัดการข้อมูลส่วนตัว</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อจริง</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={editData.firstName}
                    onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">นามสกุล</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={editData.lastName}
                    onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">รหัสผ่านใหม่</label>
                <input
                  type="password"
                  placeholder="ปล่อยว่างถ้าไม่ต้องการเปลี่ยน"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={editData.password}
                  onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                />
              </div>

              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-emerald-700 mb-1">โมเดลใบหน้า (Face Scan)</label>
                <p className="text-[11px] text-slate-500 mb-3 font-medium">สามารถอัปเดตใบหน้าใหม่ได้ หากระบบสแกนเดิมมีปัญหา</p>
                <Link className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-all" href="/student/re-enroll">
                  อัปเดตใบหน้าใหม่
                </Link>
              </div>

              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 font-bold text-slate-400 hover:text-slate-600 text-xs rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">ยกเลิก</button>
                <button type="submit" disabled={isUpdating} className="flex-1 py-2.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs shadow-sm transition-all active:scale-95 cursor-pointer">
                  {isUpdating ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-200">
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
              className={`w-28 py-2.5 text-white rounded-xl text-xs md:text-sm font-bold shadow-sm transition-all mx-auto block active:scale-95 cursor-pointer ${
                alertModal.isSuccess ? 'bg-[#16a34a] hover:bg-[#15803d]' : 'bg-[#dc2626] hover:bg-[#b91c1c]'
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