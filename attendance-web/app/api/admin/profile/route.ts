// attendance-web/app/api/admin/profile/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET: ดึงข้อมูลโปรไฟล์ผู้ดูแลระบบล่าสุด
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('adminId');

        if (!adminId) {
            return NextResponse.json(
                { success: false, error: 'ไม่พบ ID ของผู้ดูแลระบบ' },
                { status: 400 }
            );
        }

        // ค้นหา User พร้อมดึงข้อมูลจาก relation 'admin'
        const user = await prisma.user.findUnique({
            where: { id: adminId },
            select: {
                id: true,
                email: true,
                role: true,
                admin: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json(
                { success: false, error: 'ไม่พบบัญชีผู้ดูแลระบบในระบบ' },
                { status: 404 }
            );
        }

        // รวมข้อมูลให้รูปแบบเรียบง่ายสำหรับ Frontend ใช้งาน
        return NextResponse.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.admin?.firstName || '',
                lastName: user.admin?.lastName || '',
            },
        });
    } catch (error: any) {
        console.error('Fetch Admin Profile Error:', error);
        return NextResponse.json(
            { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' },
            { status: 500 }
        );
    }
}

// PUT: แก้ไขข้อมูลส่วนตัว, อีเมล และเปลี่ยนรหัสผ่าน
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, firstName, lastName, email, oldPassword, password } = body;

        if (!id || !firstName?.trim() || !lastName?.trim() || !email?.trim()) {
            return NextResponse.json(
                { success: false, error: 'กรุณากรอกชื่อ นามสกุล และอีเมลให้ครบถ้วน' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id },
            include: { admin: true },
        });

        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json(
                { success: false, error: 'ไม่พบบัญชีผู้ดูแลระบบ' },
                { status: 404 }
            );
        }

        // ตรวจสอบว่าอีเมลใหม่ซ้ำกับบัญชีอื่นหรือไม่
        const targetEmail = email.trim().toLowerCase();
        if (targetEmail !== user.email?.toLowerCase()) {
            const existingEmail = await prisma.user.findUnique({
                where: { email: targetEmail },
            });
            if (existingEmail) {
                return NextResponse.json(
                    { success: false, error: 'อีเมลนี้ถูกใช้งานโดยบัญชีอื่นแล้ว' },
                    { status: 400 }
                );
            }
        }

        const userUpdateData: { email: string; password?: string } = {
            email: targetEmail,
        };

        // ตรวจสอบกรณีเปลี่ยนรหัสผ่าน
        if (password && password.trim().length > 0) {
            if (!oldPassword) {
                return NextResponse.json(
                    { success: false, error: 'กรุณากรอกรหัสผ่านเดิมเพื่อยืนยัน' },
                    { status: 400 }
                );
            }

            if (password.length < 6) {
                return NextResponse.json(
                    { success: false, error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' },
                    { status: 400 }
                );
            }

            const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
            if (!isPasswordValid) {
                return NextResponse.json(
                    { success: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' },
                    { status: 400 }
                );
            }

            userUpdateData.password = await bcrypt.hash(password, 10);
        }

        // บันทึก User (email, password) และอัปเดตตาราง Admin (firstName, lastName) พร้อมกัน
        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                ...userUpdateData,
                admin: {
                    upsert: {
                        create: {
                            firstName: firstName.trim(),
                            lastName: lastName.trim(),
                        },
                        update: {
                            firstName: firstName.trim(),
                            lastName: lastName.trim(),
                        },
                    },
                },
            },
            select: {
                id: true,
                email: true,
                role: true,
                admin: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            message: 'บันทึกข้อมูลเรียบร้อยแล้ว',
            data: {
                id: updatedUser.id,
                email: updatedUser.email,
                role: updatedUser.role,
                firstName: updatedUser.admin?.firstName || '',
                lastName: updatedUser.admin?.lastName || '',
            },
        });
    } catch (error: any) {
        console.error('Update Admin Profile Error:', error);
        return NextResponse.json(
            { success: false, error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' },
            { status: 500 }
        );
    }
}