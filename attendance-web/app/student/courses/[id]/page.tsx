// attendance-web/app/student/courses/[id]/page.tsx
'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface UserProfile {
    id: string;
    studentCode?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    role?: string;
}

interface AttendanceRecord {
    id?: string;
    date?: string;
    createdAt?: string;
    time?: string;
    status: 'มาเรียน' | 'มาสาย' | 'ลา' | 'ขาดเรียน' | string;
    timeSlot?: string;
    remark?: string;
    sessionType?: string;
    weekNumber?: number;
    week?: number;
}

interface FriendProfile {
    id?: string;
    studentCode?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
}

interface CourseData {
    courseCode?: string;
    courseName?: string;
    teacherName?: string;
    attendance?: AttendanceRecord[];
    friends?: FriendProfile[];
}

export default function StudentCourseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.id as string;

    const [user, setUser] = useState<UserProfile | null>(null);
    const [courseData, setCourseData] = useState<CourseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'attendance' | 'friends'>('attendance');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const fetchDetails = useCallback(async (studentId: string, token: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/student/courses/details?courseId=${courseId}&studentId=${studentId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const json = await res.json();
            if (json.success && json.data) {
                setCourseData(json.data);
            } else {
                console.warn('Load course error:', json);
                alert(json.error || 'ไม่สามารถโหลดข้อมูลรายวิชาได้');
                router.push('/student/dashboard');
            }
        } catch (err) {
            console.error('Fetch course detail error:', err);
        } finally {
            setLoading(false);
        }
    }, [courseId, router]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const savedUserStr = localStorage.getItem('student_user') || localStorage.getItem('user');
        const token = localStorage.getItem('student_token') || localStorage.getItem('token') || '';

        if (!savedUserStr) {
            router.replace('/student/login');
            return;
        }

        try {
            const parsedUser: UserProfile = JSON.parse(savedUserStr);

            if (parsedUser.role && parsedUser.role.toUpperCase() !== 'STUDENT') {
                router.replace('/student/login');
                return;
            }

            const displayName = `${parsedUser.firstName || ''} ${parsedUser.lastName || ''}`.trim() || parsedUser.name || 'นักศึกษา';
            setUser({ ...parsedUser, displayName } as UserProfile);

            if (parsedUser.id) {
                fetchDetails(parsedUser.id, token);
            }
        } catch {
            router.replace('/student/login');
        }
    }, [fetchDetails, router]);

    // กรองและเรียงลำดับรายการตามวันที่/เวลา โดยแสดงผลครบถ้วนทุกสัปดาห์ที่บันทึก
    const studentAttendanceList = useMemo(() => {
        if (!courseData?.attendance) return [];

        return [...courseData.attendance].sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0).getTime();
            const dateB = new Date(b.date || b.createdAt || 0).getTime();
            return dateA - dateB;
        });
    }, [courseData]);

    const summary = useMemo(() => {
        const total = studentAttendanceList.length;
        const present = studentAttendanceList.filter((a) => a.status === 'มาเรียน').length;
        const late = studentAttendanceList.filter((a) => a.status === 'มาสาย').length;
        const leave = studentAttendanceList.filter((a) => a.status === 'ลา').length;
        const absent = studentAttendanceList.filter((a) => a.status === 'ขาดเรียน').length;

        const attendancePercentage = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
        const MAX_ALLOWED_ABSENT = 3;
        const remainingAbsentQuota = Math.max(0, MAX_ALLOWED_ABSENT - absent);
        const isExamEligible = absent <= MAX_ALLOWED_ABSENT;

        return {
            total,
            present,
            late,
            leave,
            absent,
            percentage: attendancePercentage,
            maxAllowedAbsent: MAX_ALLOWED_ABSENT,
            remainingAbsentQuota,
            isExamEligible
        };
    }, [studentAttendanceList]);

    const filteredAndSortedFriends = useMemo(() => {
        if (!courseData?.friends) return [];
        return [...courseData.friends]
            .filter((f) => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase().trim();
                const code = (f.studentCode || '').toLowerCase();
                const firstName = (f.firstName || '').toLowerCase();
                const lastName = (f.lastName || '').toLowerCase();
                const fullName = `${f.firstName || ''} ${f.lastName || ''} ${f.name || ''}`.toLowerCase();
                return code.includes(term) || firstName.includes(term) || lastName.includes(term) || fullName.includes(term);
            })
            .sort((a, b) => {
                const codeA = a.studentCode || '';
                const codeB = b.studentCode || '';
                if (sortOrder === 'asc') {
                    return codeA.localeCompare(codeB, undefined, { numeric: true });
                } else {
                    return codeB.localeCompare(codeA, undefined, { numeric: true });
                }
            });
    }, [courseData?.friends, searchTerm, sortOrder]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f0f7f4] flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-emerald-800 font-bold text-xs animate-pulse tracking-wider">กำลังดึงข้อมูลรายวิชา...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800 print:bg-white print:p-0">
            <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative print:hidden">
                <div className="absolute top-6 left-6">
                    <Link
                        href="/student/dashboard"
                        className="text-emerald-100 hover:text-white font-bold inline-flex items-center gap-2 text-xs uppercase tracking-wider transition-all"
                    >
                        ← Back to Dashboard
                    </Link>
                </div>

                <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
                    ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
                </h1>
                <p className="text-emerald-100 font-medium text-xs md:text-sm">
                    วิชา: <span className="font-bold text-white">{courseData?.courseCode}</span> : <span className="text-white font-medium">{courseData?.courseName}</span>
                </p>
            </header>

            <nav className="bg-[#0d9488] shadow-inner px-4 overflow-x-auto print:hidden">
                <div className="max-w-5xl mx-auto flex items-center justify-center gap-1 min-w-max">
                    <button
                        type="button"
                        onClick={() => setActiveTab('attendance')}
                        className={`flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm rounded-t-xl transition-all cursor-pointer ${
                            activeTab === 'attendance'
                                ? 'bg-white text-slate-800 shadow'
                                : 'text-emerald-50 hover:bg-emerald-700/50 hover:text-white'
                        }`}
                    >
                        ประวัติการเข้าเรียนของฉัน
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('friends')}
                        className={`flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm rounded-t-xl transition-all cursor-pointer ${
                            activeTab === 'friends'
                                ? 'bg-white text-slate-800 shadow'
                                : 'text-emerald-50 hover:bg-emerald-700/50 hover:text-white'
                        }`}
                    >
                        รายชื่อนักศึกษาในชั้นเรียน
                    </button>
                </div>
            </nav>

            <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">รายวิชา</span>
                        <h2 className="text-2xl font-black text-slate-800">
                            {courseData?.courseCode} : {courseData?.courseName}
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                            อาจารย์ผู้สอน: <span className="text-slate-800 font-bold">{courseData?.teacherName || 'อาจารย์ประจำวิชา'}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="bg-slate-50 text-slate-600 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-slate-200/60">
                            นักศึกษาทั้งหมด {courseData?.friends?.length || 0} คน
                        </span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200/80">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">เกณฑ์เวลาเรียน (ไม่ต่ำกว่า 80%)</span>
                            <div className="flex items-baseline gap-2 mt-0.5">
                                <span className={`text-3xl font-black font-mono ${
                                    summary.percentage >= 80 ? 'text-emerald-700' : summary.percentage >= 70 ? 'text-amber-700' : 'text-red-700'
                                }`}>
                                    {summary.percentage}%
                                </span>
                                <span className="text-xs font-bold text-slate-500">เวลาเรียนสะสม</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {summary.isExamEligible ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span>สถานะ: มีสิทธิ์สอบ</span>
                                    <span className="text-slate-400 font-normal">|</span>
                                    <span className="text-emerald-700 font-normal">ขาดได้อีก {summary.remainingAbsentQuota} ครั้ง</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                                    <span>สถานะ: ขาดเรียนเกินเกณฑ์ (หมดสิทธิ์สอบ)</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60 text-center">
                        <p className="text-[11px] font-bold text-slate-500 mb-1">ทั้งหมด</p>
                        <p className="text-2xl font-black text-slate-800">{summary.total}</p>
                    </div>
                    <div className="bg-[#ecfdf5] p-3.5 rounded-2xl border border-emerald-100 text-center">
                        <p className="text-[11px] font-bold text-emerald-800 mb-1">มาเรียน</p>
                        <p className="text-2xl font-black text-[#16a34a]">{summary.present}</p>
                    </div>
                    <div className="bg-[#fffbeb] p-3.5 rounded-2xl border border-amber-100 text-center">
                        <p className="text-[11px] font-bold text-amber-800 mb-1">มาสาย</p>
                        <p className="text-2xl font-black text-[#d97706]">{summary.late}</p>
                    </div>
                    <div className="bg-[#eff6ff] p-3.5 rounded-2xl border border-blue-100 text-center">
                        <p className="text-[11px] font-bold text-blue-800 mb-1">ลา</p>
                        <p className="text-2xl font-black text-[#2563eb]">{summary.leave}</p>
                    </div>
                    <div className="bg-[#fef2f2] p-3.5 rounded-2xl border border-red-100 text-center">
                        <p className="text-[11px] font-bold text-red-700 mb-1">ขาดเรียน</p>
                        <p className="text-2xl font-black text-[#dc2626]">{summary.absent}</p>
                    </div>
                </div>

                {activeTab === 'attendance' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200/60">
                                        <th className="p-4 text-xs font-bold text-slate-600 w-24 text-center">ครั้งที่</th>
                                        <th className="p-4 text-xs font-bold text-slate-600 w-44">วันที่และเวลา</th>
                                        <th className="p-4 text-xs font-bold text-slate-600 w-40 text-left">รายละเอียด</th>
                                        <th className="p-4 text-xs font-bold text-slate-600 text-left">หมายเหตุ</th>
                                        <th className="p-4 text-xs font-bold text-slate-600 text-center w-28">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {studentAttendanceList.length > 0 ? (
                                        studentAttendanceList.map((a, index) => {
                                            const isComp = (a.remark || '').includes('[สอนชดเชย]') || a.sessionType === 'COMPENSATION';
                                            const timeStr = a.time
                                                ? new Date(a.time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                                                : '';
                                            const displayRemark = (a.remark || '').trim();

                                            return (
                                                <tr key={a.id || index} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="p-4 text-xs font-bold text-slate-700 text-center align-middle">
                                                        {index + 1}
                                                    </td>
                                                    <td className="p-4 text-xs font-bold text-slate-700 whitespace-nowrap align-middle">
                                                        <div>{new Date(a.date || a.createdAt || Date.now()).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</div>
                                                        {timeStr && <div className="text-[11px] text-slate-400 font-medium mt-0.5">{timeStr} น.</div>}
                                                    </td>
                                                    <td className="p-4 text-xs font-bold text-slate-700 align-middle">
                                                        {isComp ? 'คาบสอนชดเชย' : 'คาบเรียนปกติ'}
                                                    </td>
                                                    <td className="p-4 text-xs text-slate-600 align-middle">
                                                        {displayRemark ? (
                                                            <span className="text-xs text-slate-600 leading-relaxed font-medium">
                                                                {displayRemark}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-slate-300 italic">
                                                                - ไม่มีหมายเหตุ -
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center whitespace-nowrap align-middle">
                                                        <span
                                                            className={`px-3 py-1 rounded-xl text-xs font-bold inline-block border ${
                                                                a.status === 'มาเรียน'
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                    : a.status === 'มาสาย'
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : a.status === 'ลา'
                                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                    : 'bg-red-50 text-red-700 border-red-200'
                                                            }`}
                                                        >
                                                            {a.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="p-14 text-center text-slate-400 font-bold text-xs">
                                                ยังไม่มีประวัติการเช็คชื่อในรายวิชานี้
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'friends' && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between gap-3">
                            <div className="relative w-full max-w-sm">
                                <input
                                    type="text"
                                    placeholder="ค้นหารหัส หรือ ชื่อ, นามสกุล..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                            </div>
                            <span className="text-xs text-slate-500 font-bold">
                                แสดง <span className="text-emerald-700 font-black">{filteredAndSortedFriends.length}</span> จากทั้งหมด {courseData?.friends?.length || 0} คน
                            </span>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-200/60">
                                            <th className="p-4 text-xs font-bold text-slate-600 w-16 text-center">ลำดับ</th>
                                            <th
                                                className="p-4 text-xs font-bold text-slate-600 w-48 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                            >
                                                <div className="inline-flex items-center gap-1.5">
                                                    <span>รหัสประจำตัว</span>
                                                    <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.5 rounded font-black">
                                                        {sortOrder === 'asc' ? '▲' : '▼'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="p-4 text-xs font-bold text-slate-600 w-1/3">ชื่อ</th>
                                            <th className="p-4 text-xs font-bold text-slate-600">นามสกุล</th>
                                            <th className="p-4 text-xs font-bold text-slate-600 text-center w-36">สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredAndSortedFriends.length > 0 ? (
                                            filteredAndSortedFriends.map((f, index) => {
                                                const firstName = f.firstName || '-';
                                                const lastName = f.lastName || '-';
                                                const isMe = f.id === user?.id || f.studentCode === user?.studentCode;

                                                return (
                                                    <tr key={f.id || index} className={`hover:bg-slate-50/60 transition-colors ${isMe ? 'bg-emerald-50/40' : ''}`}>
                                                        <td className="p-4 text-xs font-bold text-slate-400 text-center align-middle">
                                                            {index + 1}
                                                        </td>
                                                        <td className="p-4 font-mono font-bold text-emerald-700 text-xs md:text-sm align-middle">
                                                            {f.studentCode}
                                                        </td>
                                                        <td className="p-4 font-bold text-slate-800 text-xs md:text-sm align-middle">
                                                            {firstName} {isMe && <span className="text-[11px] text-emerald-700 font-bold ml-1.5">(ฉัน)</span>}
                                                        </td>
                                                        <td className="p-4 font-bold text-slate-700 text-xs md:text-sm align-middle">
                                                            {lastName}
                                                        </td>
                                                        <td className="p-4 text-center align-middle">
                                                            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/60 inline-block">
                                                                ลงทะเบียนแล้ว
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="text-center p-14 text-slate-400 font-bold text-xs">
                                                    {searchTerm ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา' : 'ยังไม่มีนักศึกษาเข้าร่วมรายวิชานี้'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm mt-auto print:hidden">
                © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
                <p className="text-emerald-100 font-medium text-xs md:text-sm">
                    สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
                </p>
            </footer>
        </div>
    );
}