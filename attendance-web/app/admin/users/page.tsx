// attendance-web/app/admin/users/page.tsx
'use client';
import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function AdminUsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // กำหนดค่าเริ่มต้นตาม Query Parameter ใน URL
  const [activeTab, setActiveTab] = useState<'STUDENT' | 'TEACHER'>(
    tabParam === 'TEACHER' ? 'TEACHER' : 'STUDENT'
  );

  useEffect(() => {
    if (tabParam === 'TEACHER') {
      setActiveTab('TEACHER');
    } else if (tabParam === 'STUDENT') {
      setActiveTab('STUDENT');
    }
  }, [tabParam]);

  const handleTabChange = (newTab: 'STUDENT' | 'TEACHER') => {
    setActiveTab(newTab);
    setCurrentPage(1); // รีเซ็ตกลับไปหน้า 1 เมื่อสลับแท็บ
    router.replace(`/admin/users?tab=${newTab}`, { scroll: false });
  };

  // State การค้นหา และการจัดเรียง
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // State สำหรับ Pagination (แบ่งหน้า) กำหนดค่าเริ่มต้นเป็น 40 คน
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(40);

  // State สำหรับ Dropdown Filter รวม (หลักสูตร + ชั้นปี)
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]); // ['4YEAR', 'TRANSFER']
  const [selectedYears, setSelectedYears] = useState<number[]>([]); // [1, 2, 3, 4, 5]
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // State สำหรับ Modal แก้ไขข้อมูล
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    studentCode: '',
    email: '',
    password: '',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // State สำหรับการลบข้อมูล
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States สำหรับ Custom Popups
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

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

  const showToast = useCallback((type: 'success' | 'error', title: string, message: string, duration = 3500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, type, title, message });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, duration);
  }, []);

  // ปิด Dropdown เมื่อคลิกนอกพื้นที่
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getAuthToken = () => localStorage.getItem('admin_token') || localStorage.getItem('token');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUsers(json.data);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // ฟังก์ชันคำนวณชั้นปี (อิงปีการศึกษาปัจจุบัน 2569)
  const getStudentYear = (rawCode: any): number => {
    const code = (rawCode || '').toString().trim();
    if (code.length >= 2) {
      const entryYear = parseInt(code.substring(0, 2), 10);
      if (!isNaN(entryYear)) {
        const calculatedYear = 69 - entryYear + 1;
        return calculatedYear > 0 ? calculatedYear : 1;
      }
    }
    return 1;
  };

  // ฟังก์ชันตรวจเช็กประเภทหลักสูตรจากตัวเลขหลักที่ 3 (5: 4 ปีปกติ, 6: เทียบโอน)
  const getProgramType = (rawCode: any): '4YEAR' | 'TRANSFER' | 'OTHER' => {
    const code = (rawCode || '').toString().trim();
    if (code.length >= 3) {
      const thirdDigit = code.charAt(2);
      if (thirdDigit === '5') return '4YEAR';
      if (thirdDigit === '6') return 'TRANSFER';
    }
    return 'OTHER';
  };

  // ควบคุม Checkbox หลักสูตร
  const handleProgramToggle = (program: '4YEAR' | 'TRANSFER') => {
    setSelectedPrograms((prev) =>
      prev.includes(program) ? prev.filter((p) => p !== program) : [...prev, program]
    );
    setCurrentPage(1);
  };

  const handleSelectAllPrograms = () => {
    if (selectedPrograms.length === 2) {
      setSelectedPrograms([]);
    } else {
      setSelectedPrograms(['4YEAR', 'TRANSFER']);
    }
    setCurrentPage(1);
  };

  // ควบคุม Checkbox ชั้นปี
  const handleYearToggle = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
    setCurrentPage(1);
  };

  const handleSelectAllYears = () => {
    if (selectedYears.length === 5) {
      setSelectedYears([]);
    } else {
      setSelectedYears([1, 2, 3, 4, 5]);
    }
    setCurrentPage(1);
  };

  // รีเซ็ตการกรองทั้งหมด
  const handleResetFilters = () => {
    setSelectedPrograms([]);
    setSelectedYears([]);
    setCurrentPage(1);
  };

  // กรองข้อมูลตามเงื่อนไข
  const processedUsers = useMemo(() => {
    return users
      .filter((u) => {
        if (u.role !== activeTab) return false;

        const code = (u.studentCode || u.username || '').toString().trim();

        if (activeTab === 'STUDENT') {
          // 1. กรองประเภทหลักสูตร
          if (selectedPrograms.length > 0) {
            const program = getProgramType(code);
            if (!selectedPrograms.includes(program)) return false;
          }

          // 2. กรองชั้นปี
          if (selectedYears.length > 0) {
            const year = getStudentYear(code);
            if (!selectedYears.includes(year)) return false;
          }
        }

        if (!searchTerm.trim()) return true;

        const term = searchTerm.toLowerCase().trim();
        const codeLower = code.toLowerCase();
        const firstName = (u.firstName || '').toLowerCase();
        const lastName = (u.lastName || '').toLowerCase();
        const fullName = (u.name || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase();
        const email = (u.email || '').toLowerCase();

        return (
          codeLower.includes(term) ||
          firstName.includes(term) ||
          lastName.includes(term) ||
          fullName.includes(term) ||
          email.includes(term)
        );
      })
      .sort((a, b) => {
        if (activeTab === 'STUDENT') {
          const codeA = (a.studentCode || a.username || '').toString();
          const codeB = (b.studentCode || b.username || '').toString();
          return sortOrder === 'asc'
            ? codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' })
            : codeB.localeCompare(codeA, undefined, { numeric: true, sensitivity: 'base' });
        } else {
          const nameA = (a.firstName || a.name || '').toString();
          const nameB = (b.firstName || b.name || '').toString();
          return sortOrder === 'asc'
            ? nameA.localeCompare(nameB, 'th')
            : nameB.localeCompare(nameA, 'th');
        }
      });
  }, [users, activeTab, selectedPrograms, selectedYears, searchTerm, sortOrder]);

  // คำนวณจำนวนหน้าทั้งหมดและตัดข้อมูลแบ่งตามหน้า
  const totalPages = useMemo(() => {
    if (itemsPerPage === -1) return 1;
    return Math.max(1, Math.ceil(processedUsers.length / itemsPerPage));
  }, [processedUsers.length, itemsPerPage]);

  const paginatedUsers = useMemo(() => {
    if (itemsPerPage === -1) return processedUsers;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [processedUsers, currentPage, itemsPerPage]);

  const teacherCount = users.filter((u) => u.role === 'TEACHER').length;
  const studentCount = users.filter((u) => u.role === 'STUDENT').length;

  const count4Year = useMemo(() => {
    return users.filter((u) => u.role === 'STUDENT' && (u.studentCode || u.username || '').toString().trim().charAt(2) === '5').length;
  }, [users]);

  const countTransfer = useMemo(() => {
    return users.filter((u) => u.role === 'STUDENT' && (u.studentCode || u.username || '').toString().trim().charAt(2) === '6').length;
  }, [users]);

  // ข้อความแสดงบนปุ่ม Dropdown
  const filterButtonLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedPrograms.length === 1) {
      parts.push(selectedPrograms[0] === '4YEAR' ? '4 ปี ปกติ' : 'เทียบโอน');
    }
    if (selectedYears.length > 0 && selectedYears.length < 5) {
      parts.push(selectedYears.sort().map((y) => `ชั้นปีที่ ${y}`).join(', '));
    }
    if (parts.length === 0) return 'ตัวกรอง: ทั้งหมด';
    return `ตัวกรอง: ${parts.join(' | ')}`;
  }, [selectedPrograms, selectedYears]);

  const handleOpenEditModal = (user: any) => {
    setEditingUser(user);
    setEditFormData({
      firstName: user.firstName || (user.name ? user.name.split(' ')[0] : ''),
      lastName: user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : ''),
      studentCode: user.studentCode || '',
      email: user.email || '',
      password: '',
    });
  };

  const handleOpenDeleteModal = (user: any) => {
    setUserToDelete(user);
    setShowDeleteConfirmModal(true);
  };

  const handleOpenSaveConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSaveConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!editingUser) return;

    setIsSubmittingEdit(true);
    const token = getAuthToken();
    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingUser.id,
          role: editingUser.role,
          ...editFormData
        })
      });

      const json = await res.json();
      if (json.success) {
        setShowSaveConfirmModal(false);
        setEditingUser(null);
        showToast(
          'success',
          'แก้ไขข้อมูลเรียบร้อย',
          `${editingUser.role === 'STUDENT' ? 'ข้อมูลนักเรียน' : 'ข้อมูลอาจารย์'}ถูกแก้ไขเรียบร้อยแล้ว`
        );
        fetchUsers();
      } else {
        setShowSaveConfirmModal(false);
        showToast('error', 'เกิดข้อผิดพลาด', json.error || 'ไม่สามารถแก้ไขข้อมูลได้');
      }
    } catch {
      setShowSaveConfirmModal(false);
      showToast('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/admin/users?id=${userToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setShowDeleteConfirmModal(false);
        setUserToDelete(null);
        showToast('success', 'ลบข้อมูลสำเร็จ', 'บัญชีผู้ใช้งานถูกลบออกจากระบบเรียบร้อยแล้ว');
        fetchUsers();
      } else {
        setShowDeleteConfirmModal(false);
        showToast('error', 'เกิดข้อผิดพลาด', json.error || 'ไม่สามารถลบบัญชีผู้ใช้ได้');
      }
    } catch {
      setShowDeleteConfirmModal(false);
      showToast('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setIsDeleting(false);
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

      {/* Header */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm print:hidden">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
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

        {/* กล่องหัวเรื่อง + ตัวสลับแท็บ */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200/80 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">รายชื่อผู้ใช้งาน</h2>
            <p className="text-slate-400 font-medium text-xs mt-1">ตรวจสอบและจัดการสิทธิ์การเข้าใช้งานระบบ</p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => handleTabChange('TEACHER')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'TEACHER'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              อาจารย์ ({teacherCount})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('STUDENT')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'STUDENT'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              นักศึกษา ({studentCount})
            </button>
          </div>
        </div>

        {/* แถบค้นหาข้อมูล, Dropdown Filter, และตัวเลือกจำนวนรายการต่อหน้า */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:max-w-xl">
            {/* ช่องค้นหา */}
            <div className="relative w-full sm:flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder={activeTab === 'STUDENT' ? "ค้นหารหัสนักศึกษา, ชื่อ-นามสกุล หรือ อีเมล..." : "ค้นหาชื่อ-นามสกุล หรือ อีเมล..."}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Dropdown Checkbox เดียว (รวมหลักสูตร + ชั้นปี) */}
            {activeTab === 'STUDENT' && (
              <div className="relative w-full sm:w-auto" ref={filterDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="w-full sm:w-auto inline-flex items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer transition-all whitespace-nowrap"
                >
                  <span>{filterButtonLabel}</span>
                  <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* เมนู Dropdown Popover */}
                {isFilterDropdownOpen && (
                  <div className="absolute right-0 sm:left-0 mt-1.5 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl z-30 p-3 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                    
                    {/* หมวดที่ 1: หลักสูตร */}
                    <div>
                      <div className="flex justify-between items-center px-1 mb-1.5">
                        <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">หลักสูตร</span>
                        <button
                          type="button"
                          onClick={handleSelectAllPrograms}
                          className="text-[10px] font-bold text-slate-400 hover:text-emerald-700 cursor-pointer"
                        >
                          {selectedPrograms.length === 2 ? 'ล้าง' : 'เลือกทั้งหมด'}
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-50 rounded-xl cursor-pointer select-none text-xs font-bold text-slate-700">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedPrograms.includes('4YEAR')}
                              onChange={() => handleProgramToggle('4YEAR')}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                            <span>4 ปี ปกติ</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">({count4Year})</span>
                        </label>

                        <label className="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-50 rounded-xl cursor-pointer select-none text-xs font-bold text-slate-700">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedPrograms.includes('TRANSFER')}
                              onChange={() => handleProgramToggle('TRANSFER')}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                            <span>เทียบโอน</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">({countTransfer})</span>
                        </label>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* หมวดที่ 2: ชั้นปี */}
                    <div>
                      <div className="flex justify-between items-center px-1 mb-1.5">
                        <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">ชั้นปี</span>
                        <button
                          type="button"
                          onClick={handleSelectAllYears}
                          className="text-[10px] font-bold text-slate-400 hover:text-emerald-700 cursor-pointer"
                        >
                          {selectedYears.length === 5 ? 'ล้าง' : 'เลือกทั้งหมด'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        {[1, 2, 3, 4, 5].map((year) => (
                          <label key={year} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 rounded-xl cursor-pointer select-none text-xs font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedYears.includes(year)}
                              onChange={() => handleYearToggle(year)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                            <span>ชั้นปีที่ {year}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* ปุ่มรีเซ็ตการกรองทั้งหมด */}
                    {(selectedPrograms.length > 0 || selectedYears.length > 0) && (
                      <div className="pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="w-full py-1.5 text-center text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          ล้างตัวกรองทั้งหมด
                        </button>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}
          </div>

          {/* ฝั่งขวา: เลือกจำนวนรายการ + สรุปจำนวนทั้งหมด */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">แสดง:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>ทั้งหมด</option>
              </select>
              <span className="text-xs font-bold text-slate-500">คน/หน้า</span>
            </div>

            <div className="text-xs text-slate-500 font-bold whitespace-nowrap">
              พบข้อมูลทั้งหมด <span className="text-emerald-700 font-black">{processedUsers.length}</span> รายการ
            </div>
          </div>
        </div>

        {/* ตารางรายชื่อทั้งหมด */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed sm:table-auto">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/60">
                  <th className="py-4 px-3 text-xs font-bold text-slate-600 w-16 text-center">ลำดับ</th>

                  {activeTab === 'STUDENT' && (
                    <th
                      className="py-4 px-4 text-xs font-bold text-slate-600 w-48 text-left cursor-pointer select-none hover:bg-slate-100/80 transition-colors"
                      onClick={toggleSortOrder}
                      title="คลิกเพื่อสลับการเรียงลำดับจากน้อยไปมาก / มากไปน้อย"
                    >
                      <div className="inline-flex items-center gap-1.5 group">
                        <span>รหัสนักศึกษา</span>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-200/60 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors text-[10px] font-black">
                          {sortOrder === 'asc' ? '▲' : '▼'}
                        </span>
                      </div>
                    </th>
                  )}

                  <th className="py-4 px-4 text-xs font-bold text-slate-600 text-left w-36 sm:w-44">ชื่อ</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-600 text-left w-36 sm:w-44">นามสกุล</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-600 text-left">อีเมล</th>
                  <th className="py-4 px-3 text-xs font-bold text-slate-600 text-center w-40">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={activeTab === 'STUDENT' ? 6 : 5} className="p-14 text-center font-bold text-slate-400 animate-pulse text-xs">
                      กำลังโหลดข้อมูลผู้ใช้...
                    </td>
                  </tr>
                ) : paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user, index) => {
                    const firstName = user.firstName || (user.name ? user.name.split(' ')[0] : '-');
                    const lastName = user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : '-');
                    const studentCode = (user.studentCode || user.username || '').toString().trim();
                    const globalIndex = itemsPerPage === -1 ? index + 1 : (currentPage - 1) * itemsPerPage + index + 1;

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-3 text-xs font-bold text-slate-400 text-center">
                          {globalIndex}
                        </td>

                        {activeTab === 'STUDENT' && (
                          <td className="py-4 px-4 text-xs font-bold font-mono text-left">
                            <span className="text-emerald-700">{studentCode || '-'}</span>
                          </td>
                        )}

                        <td className="py-4 px-4 text-xs font-bold text-slate-800 text-left truncate">
                          {firstName}
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-slate-800 text-left truncate">
                          {lastName}
                        </td>
                        <td className="py-4 px-4 text-xs font-medium text-slate-500 font-mono text-left truncate">
                          {user.email || '-'}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {/* 1. ปุ่มแก้ไข สีเหลือง */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(user)}
                              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-[#eab308] hover:bg-[#ca8a04] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              <span>แก้ไข</span>
                            </button>

                            {/* 2. ปุ่มลบ สีแดง */}
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(user)}
                              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-[#dc2626] hover:bg-[#b91c1c] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                              <span>ลบ</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={activeTab === 'STUDENT' ? 6 : 5} className="p-16 text-center text-slate-400 font-bold text-xs">
                      {searchTerm || selectedPrograms.length > 0 || selectedYears.length > 0
                        ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา/กรอง'
                        : 'ไม่พบข้อมูลผู้ใช้ในบทบาทนี้'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* แถบเปลี่ยนหน้า Pagination สไตล์เรียบง่าย ด้านล่างของตาราง */}
          {itemsPerPage !== -1 && totalPages > 1 && (
            <div className="py-3 px-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
              <div>
                แสดง {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, processedUsers.length)} จาก {processedUsers.length} คน
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 text-slate-600 hover:text-emerald-700 disabled:text-slate-300 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
                >
                  ← ก่อนหน้า
                </button>

                <span className="font-bold text-slate-700">
                  หน้า {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 text-slate-600 hover:text-emerald-700 disabled:text-slate-300 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
                >
                  ถัดไป →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

      {/* 1. Modal Popup ฟอร์มแก้ไขข้อมูลผู้ใช้ */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 relative">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 text-xl font-bold transition-colors cursor-pointer"
            >
              &times;
            </button>

            <div className="mb-5">
              <h3 className="text-xl font-black text-slate-800">
                {editingUser.role === 'STUDENT' ? 'แก้ไขข้อมูลนักเรียน' : 'แก้ไขข้อมูลอาจารย์'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                บทบาท: <span className="font-bold text-emerald-700">{editingUser.role === 'STUDENT' ? 'นักศึกษา' : 'อาจารย์'}</span>
              </p>
            </div>

            <form onSubmit={handleOpenSaveConfirm} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อจริง</label>
                  <input
                    type="text"
                    required
                    value={editFormData.firstName}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-800 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">นามสกุล</label>
                  <input
                    type="text"
                    required
                    value={editFormData.lastName}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-800 transition-all"
                  />
                </div>
              </div>

              {editingUser.role === 'STUDENT' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">รหัสนักศึกษา</label>
                  <input
                    type="text"
                    required
                    value={editFormData.studentCode}
                    onChange={(e) => setEditFormData({ ...editFormData, studentCode: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold font-mono text-black transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">อีเมล</label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-800 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  รหัสผ่านใหม่ <span className="text-slate-400 font-normal">(เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน)</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-800 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 font-bold bg-[#4b5563] hover:bg-[#374151] text-white transition-all text-xs rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:bg-slate-300 cursor-pointer"
                >
                  <span>บันทึก</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Custom Modal: ยืนยันการแก้ไข/บันทึกข้อมูล */}
      {showSaveConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>

            <h3 className="text-xl font-black text-slate-800 mb-2">ตรวจสอบความถูกต้อง</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
              คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูล{editingUser?.role === 'STUDENT' ? 'นักเรียน' : 'อาจารย์'}นี้ใช่หรือไม่?
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowSaveConfirmModal(false)}
                className="flex-1 py-2.5 bg-[#4b5563] hover:bg-[#374151] active:scale-95 text-white rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSubmittingEdit}
                onClick={handleConfirmSave}
                className="flex-1 py-2.5 bg-[#16a34a] hover:bg-[#15803d] active:scale-95 text-white rounded-xl text-xs md:text-sm font-bold shadow-sm transition-all disabled:bg-slate-300 cursor-pointer"
              >
                {isSubmittingEdit ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Custom Modal: ยืนยันการลบ */}
      {showDeleteConfirmModal && userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>

            <h3 className="text-xl font-black text-slate-800 mb-2">ยืนยันการลบ</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
              คุณต้องการลบข้อมูล <span className="font-bold text-slate-700">{userToDelete.firstName || userToDelete.name || userToDelete.studentCode}</span> ({userToDelete.role === 'STUDENT' ? 'นักเรียน' : 'อาจารย์'}) นี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setUserToDelete(null);
                }}
                className="flex-1 py-2.5 bg-[#4b5563] hover:bg-[#374151] active:scale-95 text-white rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-[#dc2626] hover:bg-[#b91c1c] active:scale-95 text-white rounded-xl text-xs md:text-sm font-bold shadow-sm transition-all disabled:bg-slate-300 cursor-pointer"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f0f7f4]">
        <div className="text-center font-bold text-emerald-700 animate-pulse text-sm">กำลังโหลดข้อมูล...</div>
      </div>
    }>
      <AdminUsersContent />
    </Suspense>
  );
}