// attendance-web/app/reset-password/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const router = useRouter();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // States ควบคุมการแสดงรหัสผ่าน (เปิด-ปิดตา)
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setTimeout(() => {
                    if (data.role === 'STUDENT') {
                        router.push('/student/login');
                    } else {
                        router.push('/login');
                    }
                }, 3000);
            } else {
                setMessage({ type: 'error', text: data.error || 'เกิดข้อผิดพลาด' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' });
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="text-center">
                <p className="text-red-600 mb-4">ไม่พบโทเค็นสำหรับรีเซ็ตรหัสผ่าน กรุณาตรวจสอบลิงก์อีกครั้ง</p>
                <Link href="/forgot-password" className="text-[#0f766e] underline font-medium">ขอลิงก์รีเซ็ตรหัสผ่านใหม่</Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {message.text && (
                <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านใหม่</label>
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#0f766e] focus:border-transparent outline-none transition text-gray-800"
                    />
                    <button
                        type="button"
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        onClick={() => setShowPassword(!showPassword)}
                    >
                        {showPassword ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยืนยันรหัสผ่านใหม่</label>
                <div className="relative">
                    <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#0f766e] focus:border-transparent outline-none transition text-gray-800"
                    />
                    <button
                        type="button"
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                        {showConfirmPassword ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#0f766e] hover:bg-[#115e59] text-white font-medium rounded-lg transition shadow-md disabled:opacity-50 cursor-pointer"
            >
                {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex flex-col justify-between bg-[#0f766e]/10 py-10 px-4">
            <div className="flex-1 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-gray-800">ตั้งรหัสผ่านใหม่</h1>
                        <p className="text-sm text-gray-500 mt-1">กรุณากำหนดรหัสผ่านใหม่ของคุณ</p>
                    </div>

                    <Suspense fallback={<div className="text-center py-4">กำลังโหลด...</div>}>
                        <ResetPasswordForm />
                    </Suspense>

                    <div className="text-center mt-6">
                        <Link href="/" className="text-sm text-[#0f766e] hover:underline font-medium">
                            ← กลับไปหน้าเข้าสู่ระบบ
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}