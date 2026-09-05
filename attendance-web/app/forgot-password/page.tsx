'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ForgotPasswordContent() {
    const searchParams = useSearchParams();
    const role = searchParams.get('role'); // ตรวจสอบว่าเป็น student หรือไม่
    const isStudent = role === 'student';

    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setEmail('');
            } else {
                setMessage({ type: 'error', text: data.error || 'เกิดข้อผิดพลาด' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-800">ลืมรหัสผ่าน {isStudent ? '(นักศึกษา)' : '(บุคลากร)'}</h1>
                <p className="text-sm text-gray-500 mt-1">กรอกอีเมลของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่</p>
            </div>

            {message.text && (
                <div className={`mb-6 p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">อีเมลผู้ใช้งาน</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={isStudent ? "student@mail.rmutk.ac.th" : "staff@example.com"}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#0f766e] focus:border-transparent outline-none transition text-gray-800"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#0f766e] hover:bg-[#115e59] text-white font-medium rounded-lg transition shadow-md disabled:opacity-50"
                >
                    {loading ? 'กำลังส่งข้อมูล...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
                </button>
            </form>

            <div className="text-center mt-6">
                <Link href={isStudent ? '/student/login' : '/login'} className="text-sm text-[#0f766e] hover:underline font-medium">
                    ← กลับไปหน้าเข้าสู่ระบบ
                </Link>
            </div>
        </div>
    );
}

export default function ForgotPasswordPage() {
    return (
        <div className="min-h-screen flex flex-col justify-between bg-[#0f766e]/10 py-10 px-4">
            <div className="flex-1 flex items-center justify-center">
                <Suspense fallback={<div>กำลังโหลด...</div>}>
                    <ForgotPasswordContent />
                </Suspense>
            </div>
        </div>
    );
}