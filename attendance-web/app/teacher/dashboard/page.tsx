// attendance-web/app/teacher/dashboard/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TeacherDashboard() {
  const [activeCourses, setActiveCourses] = useState<any[]>([]);
  const [archivedCourses, setArchivedCourses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [isCoursesLoading, setIsCoursesLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  // เพิ่มฟิลด์ section, semester, academicYear ใน state สร้างวิชา
  const [newCourse, setNewCourse] = useState({ 
    code: "", 
    name: "", 
    section: "1", 
    semester: "1", 
    academicYear: "2569" 
  });
  const [teacherInfo, setTeacherInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // State สำหรับแก้ไขโปรไฟล์
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({
    firstName: "",
    lastName: "",
    password: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // State สำหรับ Popup ยืนยันต่างๆ
  const [showProfileConfirmModal, setShowProfileConfirmModal] = useState(false);
  const [showCourseConfirmModal, setShowCourseConfirmModal] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [courseToRestore, setCourseToRestore] = useState<any>(null);

  // State สำหรับ Custom Alert / Success Popup
  const [alertModal, setAlertModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    isSuccess?: boolean;
    onClose?: () => void;
  }>({
    show: false,
    title: "",
    message: "",
    isSuccess: true,
  });

  const executeLogout = useCallback(() => {
    localStorage.removeItem("teacher_user");
    localStorage.removeItem("teacher_token");
    router.replace("/login");
  }, [router]);

  // ดึงวิชาที่กำลังเปิดสอน
  const fetchActiveCourses = useCallback(
    async (token: string) => {
      try {
        const res = await fetch("/api/courses", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) {
          setActiveCourses(json.data);
        } else if (res.status === 401) {
          executeLogout();
        }
      } catch (err) {
        console.error("Fetch active courses error:", err);
      }
    },
    [executeLogout],
  );

  // ดึงวิชาที่ถูกจัดเก็บ (Archive)
  const fetchArchivedCourses = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/courses/archived", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setArchivedCourses(json.data);
      }
    } catch (err) {
      console.error("Fetch archived courses error:", err);
    }
  }, []);

  const loadAllCourses = useCallback(
    async (token: string) => {
      setIsCoursesLoading(true);
      await Promise.all([
        fetchActiveCourses(token),
        fetchArchivedCourses(token),
      ]);
      setIsCoursesLoading(false);
    },
    [fetchActiveCourses, fetchArchivedCourses],
  );

  useEffect(() => {
    const token = localStorage.getItem("teacher_token");
    const savedUser = localStorage.getItem("teacher_user");

    if (!token || !savedUser) {
      router.replace("/login");
      return;
    }

    try {
      const userData = JSON.parse(savedUser);
      if (userData.role !== "TEACHER") {
        executeLogout();
        return;
      }

      const initialFullName =
        `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
        userData.name ||
        "อาจารย์";
      setTeacherInfo({ ...userData, displayName: initialFullName });

      const fetchLatestProfile = async () => {
        try {
          const res = await fetch(
            `/api/teacher/profile?teacherId=${userData.id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const resJson = await res.json();
          if (resJson.success && resJson.data) {
            const freshName =
              `${resJson.data.firstName || ""} ${resJson.data.lastName || ""}`.trim() ||
              initialFullName;
            setTeacherInfo((prev: any) => ({
              ...prev,
              ...resJson.data,
              displayName: freshName,
            }));
          }
        } catch (err) {
          console.error("Failed to load teacher profile:", err);
        }
      };

      fetchLatestProfile();
      loadAllCourses(token);
    } catch {
      executeLogout();
    }
  }, [router, loadAllCourses, executeLogout]);

  const handleOpenEditModal = () => {
    setEditData({
      firstName: teacherInfo?.firstName || "",
      lastName: teacherInfo?.lastName || "",
      password: "",
    });
    setIsEditModalOpen(true);
  };

  const handleOpenProfileConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData.firstName.trim() || !editData.lastName.trim()) {
      setAlertModal({
        show: true,
        title: "ข้อมูลไม่ครบถ้วน",
        message: "กรุณากรอกชื่อจริงและนามสกุล",
        isSuccess: false,
      });
      return;
    }
    setShowProfileConfirmModal(true);
  };

  const handleConfirmUpdateProfile = async () => {
    if (!teacherInfo?.id) {
      setAlertModal({
        show: true,
        title: "เกิดข้อผิดพลาด",
        message: "ไม่พบข้อมูล ID ผู้ใช้",
        isSuccess: false,
      });
      return;
    }

    const token = localStorage.getItem("teacher_token");
    setIsUpdating(true);
    try {
      const res = await fetch("/api/teacher/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: teacherInfo.id,
          firstName: editData.firstName,
          lastName: editData.lastName,
          password: editData.password,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setShowProfileConfirmModal(false);
        setIsEditModalOpen(false);

        if (editData.password && editData.password.length > 0) {
          setAlertModal({
            show: true,
            title: "เปลี่ยนรหัสผ่านสำเร็จ",
            message: "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
            isSuccess: true,
            onClose: () => executeLogout(),
          });
          return;
        }

        const newFullName = `${editData.firstName} ${editData.lastName}`.trim();
        const updatedUser = {
          ...teacherInfo,
          firstName: editData.firstName,
          lastName: editData.lastName,
          displayName: newFullName,
        };

        localStorage.setItem("teacher_user", JSON.stringify(updatedUser));
        setTeacherInfo(updatedUser);

        setAlertModal({
          show: true,
          title: "แก้ไขข้อมูลเรียบร้อย",
          message: "ข้อมูลอาจารย์ถูกแก้ไขเรียบร้อยแล้ว",
          isSuccess: true,
        });
      } else {
        setShowProfileConfirmModal(false);
        setAlertModal({
          show: true,
          title: "เกิดข้อผิดพลาด",
          message: data.error || "เกิดข้อผิดพลาดในการอัปเดตข้อมูล",
          isSuccess: false,
        });
      }
    } catch {
      setShowProfileConfirmModal(false);
      setAlertModal({
        show: true,
        title: "เกิดข้อผิดพลาด",
        message: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้",
        isSuccess: false,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenCourseConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.code.trim() || !newCourse.name.trim() || !newCourse.section.trim() || !newCourse.academicYear.trim()) {
      setAlertModal({
        show: true,
        title: "ข้อมูลไม่ครบถ้วน",
        message: "กรุณากรอกข้อมูลรายวิชาให้ครบถ้วน",
        isSuccess: false,
      });
      return;
    }
    setShowCourseConfirmModal(true);
  };

  const handleConfirmCreateCourse = async () => {
    const token = localStorage.getItem("teacher_token");
    if (!token) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseCode: newCourse.code.trim(),
          courseName: newCourse.name.trim(),
          section: newCourse.section.trim(),
          semester: newCourse.semester.trim(),
          academicYear: newCourse.academicYear.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCourseConfirmModal(false);
        setIsModalOpen(false);
        setNewCourse({ code: "", name: "", section: "1", semester: "1", academicYear: "2569" });
        loadAllCourses(token);
        setAlertModal({
          show: true,
          title: "สร้างรายวิชาสำเร็จเรียบร้อย",
          message: `รายวิชา ${newCourse.name.trim()} (กลุ่ม ${newCourse.section}) ถูกเพิ่มเข้าสู่ระบบเรียบร้อยแล้ว`,
          isSuccess: true,
        });
      } else {
        setShowCourseConfirmModal(false);
        setAlertModal({
          show: true,
          title: "เกิดข้อผิดพลาด",
          message: data.error || "สร้างรายวิชาไม่สำเร็จ",
          isSuccess: false,
        });
      }
    } catch {
      setShowCourseConfirmModal(false);
      setAlertModal({
        show: true,
        title: "เกิดข้อผิดพลาด",
        message: "เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์",
        isSuccess: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // นำวิชากลับมาเปิดสอน (Restore)
  const handleConfirmRestoreCourse = async () => {
    if (!courseToRestore) return;
    const token = localStorage.getItem("teacher_token");
    const restoredCourseName = courseToRestore.courseName;
    try {
      const res = await fetch(`/api/courses/${courseToRestore.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      if (res.ok) {
        setCourseToRestore(null);
        if (token) loadAllCourses(token);
        setAlertModal({
          show: true,
          title: "กู้คืนรายวิชาเรียบร้อย",
          message: `นำรายวิชา ${restoredCourseName} กลับมาเปิดสอนตามปกติแล้ว`,
          isSuccess: true,
        });
      } else {
        setCourseToRestore(null);
        setAlertModal({
          show: true,
          title: "เกิดข้อผิดพลาด",
          message: "ไม่สามารถกู้คืนรายวิชาได้",
          isSuccess: false,
        });
      }
    } catch {
      setCourseToRestore(null);
      setAlertModal({
        show: true,
        title: "เกิดข้อผิดพลาด",
        message: "เกิดข้อผิดพลาดในการเชื่อมต่อ",
        isSuccess: false,
      });
    }
  };

  const handleCloseAlertModal = () => {
    if (alertModal.onClose) {
      alertModal.onClose();
    }
    setAlertModal({ show: false, title: "", message: "", isSuccess: true });
  };

  const displayCourses =
    activeTab === "ACTIVE" ? activeCourses : archivedCourses;

  if (!teacherInfo) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">
      {/* 1. Header ด้านบน */}
      <header className="bg-[#0f766e] text-white py-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1 whitespace-nowrap">
              ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
            </h1>
            <p className="text-emerald-100 font-medium text-xs md:text-sm">
              อาจารย์ผู้สอน:{" "}
              <span className="font-bold text-white">
                {teacherInfo.displayName}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
            >
              แก้ไขโปรไฟล์
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all whitespace-nowrap cursor-pointer"
            >
              + สร้างวิชาใหม่
            </button>
            <button
              type="button"
              onClick={() => setShowLogoutConfirmModal(true)}
              className="bg-red-600/80 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-xs"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      {/* 2. Navigation Tabs Bar */}
      <nav className="bg-[#0d9488] shadow-inner px-4 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center justify-start gap-1 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab("ACTIVE")}
            className={`flex items-center gap-2 px-6 py-3 font-bold text-xs md:text-sm rounded-t-xl transition-all cursor-pointer ${
              activeTab === "ACTIVE"
                ? "bg-white text-slate-800 shadow"
                : "text-emerald-50 hover:bg-emerald-700/50 hover:text-white"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            กำลังเปิดสอน ({activeCourses.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ARCHIVED")}
            className={`flex items-center gap-2 px-6 py-3 font-bold text-xs md:text-sm rounded-t-xl transition-all cursor-pointer ${
              activeTab === "ARCHIVED"
                ? "bg-white text-slate-800 shadow"
                : "text-emerald-50 hover:bg-emerald-700/50 hover:text-white"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            คลังรายวิชา ({archivedCourses.length})
          </button>
        </div>
      </nav>

      {/* 3. Main Content Grid */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isCoursesLoading ? (
            <div className="col-span-full py-20 text-center text-slate-400 font-bold animate-pulse text-xs">
              กำลังโหลดรายวิชา...
            </div>
          ) : (
            displayCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200/80 hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* ส่วนหัวการ์ดรายวิชา */}
                  <div
                    className={`${activeTab === "ARCHIVED" ? "bg-slate-700" : "bg-emerald-700"} p-6 text-white relative`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-emerald-100 font-mono text-xs font-bold uppercase tracking-wider">
                        {course.courseCode}
                      </span>
                      {activeTab === "ARCHIVED" && (
                        <span className="bg-slate-800 text-slate-200 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-600">
                          ปิดคลาสแล้ว
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold truncate text-white">
                      {course.courseName}
                    </h2>
                    
                    {/* แสดงกลุ่มเรียน เทอม/ปี และ Join Code บนการ์ด */}
                    <div className="mt-2 space-y-1.5 text-xs">
                      <div className="text-emerald-100 font-medium">
                        กลุ่ม {course.section || '1'} • เทอม {course.semester || '1'}/{course.academicYear || '2569'}
                      </div>
                      <div className="inline-flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-lg font-mono font-bold tracking-wider">
                        <span>Join Code:</span>
                        <span className="select-all text-white">{course.joinCode || '-'}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="bg-white/20 px-2.5 py-0.5 rounded-lg text-xs font-medium">
                        นักศึกษา {course._count?.students || 0} คน
                      </span>
                    </div>
                  </div>

                  {/* ส่วนการจัดการ */}
                  <div className="p-5 space-y-3">
                    {activeTab === "ARCHIVED" ? (
                      <button
                        type="button"
                        onClick={() => setCourseToRestore(course)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        นำกลับมาเปิดสอน
                      </button>
                    ) : (
                      <Link
                        href={`/teacher/course/${course.id}`}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        เริ่มเช็คชื่อ
                      </Link>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href={`/teacher/report/${course.id}`}
                        className="flex items-center justify-center py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all shadow-2xs"
                      >
                        รายงาน
                      </Link>
                      <Link
                        href={`/teacher/course/${course.id}/students`}
                        className="flex items-center justify-center py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all shadow-2xs"
                      >
                        จัดการรายชื่อ
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {!isCoursesLoading && displayCourses.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-8">
              <p className="text-slate-400 font-bold text-xs">
                {activeTab === "ARCHIVED"
                  ? "ยังไม่มีรายวิชาที่ถูกจัดเก็บในคลัง"
                  : "ยังไม่มีรายวิชาที่กำลังเปิดสอน เริ่มสร้างวิชาแรกของคุณได้เลย"}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* 4. Footer ด้านล่าง */}
      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

      {/* Modal: สร้างวิชาใหม่ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 md:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-5">
              สร้างรายวิชาใหม่
            </h2>
            <form onSubmit={handleOpenCourseConfirm} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสวิชา
                  </label>
                  <input
                    required
                    type="text"
                    value={newCourse.code}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, code: e.target.value })
                    }
                    placeholder="เช่น 5141319"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อวิชา
                  </label>
                  <input
                    required
                    type="text"
                    value={newCourse.name}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, name: e.target.value })
                    }
                    placeholder="เช่น สัมมนาทางเทคโนโลยี"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                    placeholder="เช่น 1, 2"
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

              <div className="flex gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  ตกลงสร้างวิชา
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการสร้างรายวิชา */}
      {showCourseConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-1">
              ยืนยันการสร้างรายวิชา
            </h3>
            <p className="text-xs text-slate-400">
              กรุณาตรวจสอบความถูกต้องก่อนสร้างรายวิชาใหม่
            </p>

            <div className="bg-slate-50 rounded-xl p-4 my-5 text-xs text-slate-600 text-left space-y-2 border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">รหัสวิชา:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {newCourse.code.trim()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">ชื่อวิชา:</span>
                <span className="font-bold text-slate-800">
                  {newCourse.name.trim()}
                </span>
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
                <span className="font-bold text-slate-700">
                  {teacherInfo.displayName}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setShowCourseConfirmModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                แก้ไข
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleConfirmCreateCourse}
                className="flex-[2] bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 disabled:bg-slate-300 cursor-pointer"
              >
                {isLoading ? "กำลังสร้าง..." : "ยืนยันสร้างวิชา"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ตั้งค่าโปรไฟล์ */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-5">
              ตั้งค่าโปรไฟล์
            </h2>
            <form onSubmit={handleOpenProfileConfirm} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อจริง
                  </label>
                  <input
                    required
                    type="text"
                    value={editData.firstName}
                    onChange={(e) =>
                      setEditData({ ...editData, firstName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="ชื่อจริง"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    นามสกุล
                  </label>
                  <input
                    required
                    type="text"
                    value={editData.lastName}
                    onChange={(e) =>
                      setEditData({ ...editData, lastName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="นามสกุล"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เปลี่ยนรหัสผ่าน (เว้นว่างไว้หากไม่เปลี่ยน)
                </label>
                <input
                  type="password"
                  value={editData.password}
                  onChange={(e) =>
                    setEditData({ ...editData, password: e.target.value })
                  }
                  placeholder="รหัสผ่านใหม่"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  บันทึกข้อมูล
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
            <h3 className="text-xl font-black text-slate-800 mb-1">
              ยืนยันการบันทึกข้อมูล
            </h3>
            <p className="text-xs text-slate-400">
              กรุณาตรวจสอบความถูกต้องของข้อมูลส่วนตัว
            </p>

            <div className="bg-slate-50 rounded-xl p-4 my-5 text-xs text-slate-600 text-left space-y-2 border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">
                  ชื่อ - นามสกุล:
                </span>
                <span className="font-bold text-slate-800">
                  {editData.firstName} {editData.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">รหัสผ่าน:</span>
                <span
                  className={`font-bold ${editData.password ? "text-amber-700" : "text-slate-400"}`}
                >
                  {editData.password
                    ? "เปลี่ยนรหัสผ่านใหม่ (ต้องเข้าสู่ระบบใหม่)"
                    : "ใช้รหัสผ่านเดิม"}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setShowProfileConfirmModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                แก้ไข
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleConfirmUpdateProfile}
                className="flex-[2] bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 disabled:bg-slate-300 cursor-pointer"
              >
                {isUpdating ? "กำลังบันทึก..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการกู้คืนรายวิชา (Restore) */}
      {courseToRestore && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-1">
              กู้คืนรายวิชา
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              คุณต้องการนำวิชา{" "}
              <span className="font-bold text-slate-800">
                {courseToRestore.courseName}
              </span>{" "}
              ({courseToRestore.courseCode}) กลับมาเปิดสอนตามปกติหรือไม่?
            </p>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setCourseToRestore(null)}
                className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmRestoreCourse}
                className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                นำกลับมาเปิดสอน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการออกจากระบบ */}
      {showLogoutConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-1">
              ยืนยันการออกจากระบบ
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              คุณต้องการออกจากระบบการใช้งานในฐานะอาจารย์ใช่หรือไม่?
            </p>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeLogout}
                className="flex-[2] bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal: แจ้งเตือนสำเร็จ / ข้อผิดพลาด */}
      {alertModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-200">
            {alertModal.isSuccess ? (
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ) : (
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              </div>
            )}

            <h3 className="text-lg font-black text-slate-800 mb-1">
              {alertModal.title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
              {alertModal.message}
            </p>

            <button
              type="button"
              onClick={handleCloseAlertModal}
              className={`w-28 py-2.5 text-white rounded-xl text-xs md:text-sm font-bold shadow-xs transition-all mx-auto block active:scale-95 cursor-pointer ${
                alertModal.isSuccess
                  ? "bg-emerald-700 hover:bg-emerald-800"
                  : "bg-red-600 hover:bg-red-700"
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