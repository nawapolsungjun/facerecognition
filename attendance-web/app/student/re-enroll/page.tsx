// attendance-web/app/student/re-enroll/page.tsx
'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Webcam from 'react-webcam';
import Link from 'next/link';
import * as faceapi from 'face-api.js';

// URL เชื่อมต่อ AI Backend (ดึงจาก Environment Variable หรือใช้ค่าเริ่มต้น)
const AI_BASE_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000';

// ลำดับมุมและท่าทางที่ต้องการให้ตรวจจับ
const SCAN_STEPS = [
  { id: 'STRAIGHT', label: 'มองตรงไปที่กล้อง (หน้าตรง)', hint: 'กรุณามองตรงระดับสายตากับกล้อง' },
  { id: 'LEFT', label: 'หันหน้าไปทางซ้าย 45 องศา', hint: 'เอียงใบหน้าไปทางซ้ายของท่านประมาณ 45 องศา' },
  { id: 'RIGHT', label: 'หันหน้าไปทางขวา 45 องศา', hint: 'เอียงใบหน้าไปทางขวาของท่านประมาณ 45 องศา' },
  { id: 'DOWN', label: 'ก้มหน้าลงเล็กน้อย', hint: 'ก้มศีรษะลงเบาๆ ให้เห็นมุมก้ม' },
  { id: 'UP', label: 'เงยหน้าขึ้นเล็กน้อย', hint: 'เชิดคางขึ้นเบาๆ ให้เห็นมุมเงย' },
];

// ข้อมูลภาพตัวอย่างท่าทางใบหน้าแนะนำ (ดึงจากไฟล์ ex1.png ถึง ex5.png ในโฟลเดอร์ public)
const POSE_GUIDES = [
  {
    title: 'หน้าตรง',
    angle: '0°',
    desc: 'มองตรงระดับสายตา',
    imgSrc: '/ex1.png', 
  },
  {
    title: 'หันซ้าย',
    angle: '45°',
    desc: 'เอียงซ้ายพอประมาณ',
    imgSrc: '/ex2.png',
  },
  {
    title: 'หันขวา',
    angle: '45°',
    desc: 'เอียงขวาพอประมาณ',
    imgSrc: '/ex3.png',
  },
  {
    title: 'ก้มหน้า',
    angle: '15°-20°',
    desc: 'ก้มศีรษะลงเบาๆ',
    imgSrc: '/ex4.png',
  },
  {
    title: 'เงยหน้า',
    angle: '15°-20°',
    desc: 'เชิดคางขึ้นเล็กน้อย',
    imgSrc: '/ex5.png',
  },
];

export default function ReEnrollPage() {
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);
  const [user, setUser] = useState<any>(null);
  const userRef = useRef<any>(null);

  const [status, setStatus] = useState('กำลังเตรียมระบบ...');
  const [isLoading, setIsLoading] = useState(false);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [regMode, setRegMode] = useState<'upload' | 'scan'>('upload');

  const [files, setFiles] = useState<FileList | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  // States สำหรับ Face Pose Scan
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [capturedVectors, setCapturedVectors] = useState<any[]>([]);
  const [capturedThumbs, setCapturedThumbs] = useState<string[]>([]);
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [isPoseMatched, setIsPoseMatched] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const isCapturingRef = useRef(false);
  const poseHoldCounterRef = useRef(0);

  // State สำหรับ Toast Alert Message ลอยตรงกลางด้านบน
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
    onClose?: () => void;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((type: 'success' | 'error', title: string, message: string, onClose?: () => void, duration = 3500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, type, title, message, onClose });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
      if (onClose) onClose();
    }, duration);
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // โหลดโมเดล AI face-api สำหรับตรวจจับใบหน้าและ Landmark
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setIsModelsLoaded(true);
        setStatus('ระบบ AI พร้อมสำหรับการสแกนใบหน้า');
      } catch (err) {
        console.error('Failed to load face-api models:', err);
        setStatus('โหลดโมเดลตรวจจับใบหน้าไม่สำเร็จ กรุณารีเฟรชหน้าจอ');
      }
    };
    loadModels();
  }, []);

  // ดึงข้อมูลนักศึกษา
  useEffect(() => {
    const savedUser = localStorage.getItem('student_user');
    const token = localStorage.getItem('student_token');

    if (!savedUser) {
      showToast('error', 'ไม่พบเซสชัน', 'กรุณาเข้าสู่ระบบใหม่ก่อนทำรายการ', () => {
        router.push('/student/login');
      });
      return;
    }

    const userData = JSON.parse(savedUser);
    const initialName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.name || userData.displayName || 'นักศึกษา';

    setUser({ ...userData, displayName: initialName });
    setStatus(`${initialName} สามารถอัปเดตใบหน้าใหม่ได้ที่นี่`);

    const fetchLatestProfile = async () => {
      try {
        const res = await fetch(`/api/student/profile?studentId=${userData.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const resJson = await res.json();
        if (resJson.success && resJson.data) {
          const freshName = `${resJson.data.firstName || ''} ${resJson.data.lastName || ''}`.trim() || resJson.data.name || initialName;
          setUser((prev: any) => ({
            ...prev,
            ...resJson.data,
            displayName: freshName,
          }));
          setStatus(`${freshName} สามารถอัปเดตใบหน้าใหม่ได้ที่นี่`);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };

    fetchLatestProfile();
  }, [router, showToast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = e.target.files;
      if (selectedFiles.length < 3) {
        showToast('error', 'คำแนะนำการอัปโหลด', 'เพื่อความแม่นยำ กรุณาเลือกอัปโหลดอย่างน้อย 3 รูปขึ้นไป');
      }
      setFiles(selectedFiles);
      const fileArray = Array.from(selectedFiles).map(file => URL.createObjectURL(file));
      setPreviews(fileArray);
      setStatus(`เลือกรูปภาพแล้ว ${selectedFiles.length} รูป`);
    }
  };

  // ฟังก์ชันบันทึกข้อมูลใบหน้าลงฐานข้อมูล
  const handleFinalSave = async (vectorsToSave: any[]) => {
    setShowConfirmModal(false);
    setIsLoading(true);
    setStatus('ระบบกำลังประมวลผลข้อมูลใบหน้าใหม่...');

    try {
      const token = localStorage.getItem('student_token');
      const savedUserStr = localStorage.getItem('student_user');
      const currentUser = userRef.current || (savedUserStr ? JSON.parse(savedUserStr) : null);

      if (!currentUser) {
        throw new Error('ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      }

      let allFinalVectors = [...vectorsToSave];

      if (files && files.length > 0) {
        setStatus('กำลังสกัดข้อมูลจากไฟล์รูปภาพ...');
        const faceFormData = new FormData();
        Array.from(files).forEach(file => faceFormData.append('files', file));

        const aiResponse = await fetch(`${AI_BASE_URL}/api/register-face-multi`, {
          method: 'POST',
          body: faceFormData
        });

        if (!aiResponse.ok) {
          throw new Error('เซิร์ฟเวอร์ AI ประมวลผลรูปภาพไม่สำเร็จ');
        }

        const aiResult = await aiResponse.json();
        if (aiResult.success && Array.isArray(aiResult.face_vectors)) {
          allFinalVectors = [...allFinalVectors, ...aiResult.face_vectors];
        }
      }

      if (allFinalVectors.length < 3) {
        throw new Error('กรุณาอัปโหลดรูปหรือสแกนหน้า รวมกันอย่างน้อย 3 ข้อมูลขึ้นไป');
      }

      setStatus('กำลังอัปเดตข้อมูลใบหน้าลงฐานข้อมูล...');

      const targetStudentId = String(currentUser.id || currentUser.userId || '').trim();
      const targetUserId = String(currentUser.userId || currentUser.id || '').trim();

      const dbResponse = await fetch('/api/student/update-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: targetStudentId,
          userId: targetUserId,
          faceVectors: allFinalVectors
        }),
      });

      const dbResult = await dbResponse.json();
      if (dbResult.success) {
        setStatus('อัปเดตใบหน้าสำเร็จเรียบร้อย');
        showToast('success', 'อัปเดตข้อมูลสำเร็จ', 'อัปเดตข้อมูลโครงสร้างใบหน้าใหม่เรียบร้อย ระบบจะพาคุณไปที่ Dashboard', () => {
          router.replace('/student/dashboard');
        });
      } else {
        throw new Error(dbResult.error || 'ไม่สามารถอัปเดตใบหน้าได้');
      }
    } catch (err: any) {
      setStatus(`ข้อผิดพลาด: ${err.message}`);
      showToast('error', 'เกิดข้อผิดพลาด', err.message || 'ไม่สามารถอัปเดตใบหน้าได้');
      setIsScanningActive(false);
    } finally {
      setIsLoading(false);
      isCapturingRef.current = false;
    }
  };

  // ดำเนินการจับภาพเมื่อทำท่าทางสำเร็จ
  const executeStepCapture = useCallback(async (currentStepIdx: number) => {
    if (!webcamRef.current || isCapturingRef.current) return;
    isCapturingRef.current = true;

    setStatus(`กำลังประมวลผล: ${SCAN_STEPS[currentStepIdx].label}...`);
    const imageSrc = webcamRef.current.getScreenshot();

    if (!imageSrc) {
      isCapturingRef.current = false;
      return;
    }

    try {
      const res = await fetch(`${AI_BASE_URL}/api/extract-vector`, {
        method: 'POST',
        body: JSON.stringify({ image: imageSrc }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        throw new Error('AI Server responded with error');
      }

      const data = await res.json();

      if (data.success && data.vector) {
        setCapturedVectors(prev => {
          const nextVectors = [...prev, data.vector];
          const nextThumbs = [...capturedThumbs, imageSrc];
          setCapturedThumbs(nextThumbs);

          const nextStep = currentStepIdx + 1;
          const progress = Math.min(Math.round((nextStep / SCAN_STEPS.length) * 100), 100);
          setScanStepIndex(nextStep);
          setScanProgress(progress);
          setIsPoseMatched(false);
          poseHoldCounterRef.current = 0;

          if (nextStep < SCAN_STEPS.length) {
            setStatus(`บันทึกมุมที่ ${currentStepIdx + 1} เรียบร้อย กรุณาทำท่า: ${SCAN_STEPS[nextStep].label}`);
            setTimeout(() => {
              isCapturingRef.current = false;
            }, 700);
          } else {
            setIsScanningActive(false);
            setStatus('สแกนครบทุกมุมแล้ว กำลังบันทึกข้อมูลอัตโนมัติ...');
            handleFinalSave(nextVectors);
          }
          return nextVectors;
        });
      } else {
        setStatus('ไม่สามารถสกัดเวกเตอร์ใบหน้าได้ กรุณาลองใหม่อีกครั้ง');
        isCapturingRef.current = false;
      }
    } catch {
      setStatus('เกิดข้อผิดพลาดในการส่งข้อมูลไปยัง AI กรุณาลองใหม่');
      isCapturingRef.current = false;
    }
  }, [capturedThumbs]);

  // ระบบประมวลผล Pose Detection แบบเรียลไทม์
  useEffect(() => {
    if (!isScanningActive || !isModelsLoaded || regMode !== 'scan') return;

    const interval = setInterval(async () => {
      if (isCapturingRef.current) return;
      if (!webcamRef.current || !webcamRef.current.video) return;

      const video = webcamRef.current.video;
      if (video.readyState !== 4) return;

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
          .withFaceLandmarks();

        if (!detection) {
          setIsPoseMatched(false);
          poseHoldCounterRef.current = 0;
          return;
        }

        const pts = detection.landmarks.positions;
        const nose = pts[30];
        const leftJaw = pts[0];
        const rightJaw = pts[16];
        const chin = pts[8];
        const eyeMidY = (pts[36].y + pts[45].y) / 2;

        const distLeft = Math.abs(nose.x - leftJaw.x);
        const distRight = Math.abs(rightJaw.x - nose.x);
        const yawRatio = distLeft / (distRight + 0.001);

        const topDist = Math.abs(nose.y - eyeMidY);
        const bottomDist = Math.abs(chin.y - nose.y);
        const pitchRatio = topDist / (bottomDist + 0.001);

        const currentStep = SCAN_STEPS[scanStepIndex];
        if (!currentStep) return;

        let matched = false;

        if (currentStep.id === 'STRAIGHT') {
          matched = yawRatio >= 0.72 && yawRatio <= 1.38 && pitchRatio >= 0.55 && pitchRatio <= 0.95;
        } else if (currentStep.id === 'LEFT') {
          matched = yawRatio >= 1.40 || yawRatio <= 0.65;
        } else if (currentStep.id === 'RIGHT') {
          matched = yawRatio <= 0.65 || yawRatio >= 1.40;
        } else if (currentStep.id === 'DOWN') {
          matched = pitchRatio >= 0.90;
        } else if (currentStep.id === 'UP') {
          matched = pitchRatio <= 0.58;
        }

        if (matched) {
          setIsPoseMatched(true);
          poseHoldCounterRef.current += 1;

          if (poseHoldCounterRef.current >= 2) {
            executeStepCapture(scanStepIndex);
          }
        } else {
          setIsPoseMatched(false);
          poseHoldCounterRef.current = 0;
        }
      } catch (err) {
        console.error('Pose detection error:', err);
      }
    }, 140);

    return () => clearInterval(interval);
  }, [isScanningActive, isModelsLoaded, regMode, scanStepIndex, executeStepCapture]);

  const handleStartScan = () => {
    setIsScanningActive(true);
    setScanStepIndex(0);
    setScanProgress(0);
    setCapturedVectors([]);
    setCapturedThumbs([]);
    setIsPoseMatched(false);
    isCapturingRef.current = false;
    poseHoldCounterRef.current = 0;
    setStatus(`เริ่มการตรวจจับ: ${SCAN_STEPS[0].label}`);
  };

  const handleResetScan = () => {
    setIsScanningActive(false);
    setScanStepIndex(0);
    setScanProgress(0);
    setCapturedVectors([]);
    setCapturedThumbs([]);
    setIsPoseMatched(false);
    isCapturingRef.current = false;
    poseHoldCounterRef.current = 0;
    setStatus('รีเซ็ตเรียบร้อย กดปุ่มเพื่อเริ่มสแกนใหม่');
  };

  const handleOpenConfirm = () => {
    if (regMode === 'upload' && (!files || files.length < 3)) {
      showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกรูปภาพอย่างน้อย 3 รูปขึ้นไป');
      return;
    }
    setShowConfirmModal(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800 relative">

      {/* Toast Alert Message ลอยตรงกลางด้านบน (Top-Middle) */}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border bg-white animate-in slide-in-from-top-4 fade-in duration-300 min-w-[320px] max-w-md border-slate-100">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            toast.type === "success" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
          }`}>
            {toast.type === "success" ? (
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
            onClick={() => {
              setToast((prev) => ({ ...prev, show: false }));
              if (toast.onClose) toast.onClose();
            }}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Header ด้านบนตาม Style สากล */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          อัปเดตข้อมูลใบหน้า: <span className="font-bold text-white">{user?.displayName || 'กำลังโหลด...'}</span> {user?.studentCode ? `(${user.studentCode})` : ''}
        </p>
      </header>

      {/* 2. Main Content Card */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:py-8 flex flex-col justify-center">
        {/* ปุ่มย้อนกลับ */}
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
            <h2 className="text-xl font-black text-slate-800">อัปเดต <span className="text-emerald-700">ใบหน้าใหม่</span></h2>
            <p className="text-slate-400 mt-1 font-medium text-xs">
              นักศึกษา: <span className="text-slate-700 font-bold">{user?.displayName || 'กำลังโหลด...'}</span>
            </p>
          </div>

          {/* เมนูสลับวิธีลงทะเบียน */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsScanningActive(false);
                setRegMode('upload');
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                regMode === 'upload' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Upload Files (อัปโหลดรูปภาพ)
            </button>
            <button
              type="button"
              onClick={() => {
                setRegMode('scan');
                handleResetScan();
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                regMode === 'scan' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Face Scan (ตรวจจับท่าทางอัตโนมัติ)
            </button>
          </div>

          {/* 1. โหมด Upload รูปภาพ */}
          <div className={`${regMode === 'upload' ? 'block' : 'hidden'} animate-in fade-in space-y-4`}>
            
            {/* คำแนะนำและตัวอย่าง 5 มุมหน้า (พร้อมภาพตัวอย่าง ex1.png ถึง ex5.png และฟอนต์ขนาดใหญ่) */}
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <h4 className="text-sm md:text-base font-black text-emerald-950">
                  คำแนะนำ: กรุณาเลือกอัปโหลดอย่างน้อย 3 รูปขึ้นไป (แนะนำให้ครอบคลุมมุมต่างๆ)
                </h4>
              </div>
              <p className="text-xs md:text-sm text-emerald-900 mb-5 leading-relaxed font-semibold">
                เพื่อให้ระบบ AI ตรวจจับและรู้จำใบหน้าได้อย่างแม่นยำที่สุด ควรถ่ายในที่มีแสงสว่างชัดเจน ไม่สวมแว่นตาดำหรือแมสก์ ตามตัวอย่างมุมด้านล่างนี้:
              </p>

              {/* การ์ดแสดง 5 ท่าทางแนะนำ พร้อมภาพตัวอย่าง ex1.png ถึง ex5.png */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                {POSE_GUIDES.map((guide, idx) => (
                  <div key={idx} className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 text-center shadow-xs flex flex-col items-center justify-between">
                    <div className="w-full h-28 rounded-xl bg-slate-100 overflow-hidden mb-2.5 border border-slate-200 flex items-center justify-center">
                      <img 
                        src={guide.imgSrc} 
                        alt={guide.title} 
                        className="w-full h-full object-cover hover:scale-105 transition-transform" 
                      />
                    </div>
                    <div>
                      <p className="text-sm md:text-base font-black text-slate-900 leading-tight">{guide.title}</p>
                      <span className="text-xs md:text-sm font-black text-emerald-700 font-mono block mt-1">{guide.angle}</span>
                      <p className="text-xs font-bold text-slate-600 mt-1.5 leading-tight">{guide.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                disabled={isLoading}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
              {previews.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {previews.map((src, i) => (
                    <img key={i} src={src} alt={`preview-${i}`} className="w-14 h-14 object-cover rounded-xl border border-slate-200" />
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleOpenConfirm}
              disabled={isLoading || (!files || files.length < 3)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-sm active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer transition-all mt-4"
            >
              {isLoading ? 'กำลังประมวลผล...' : 'ยืนยันการอัปเดตใบหน้า'}
            </button>
          </div>

          {/* 2. โหมด Face Scan (ตรวจจับท่าทางอัตโนมัติ) */}
          <div className={`${regMode === 'scan' ? 'block' : 'hidden'} animate-in fade-in space-y-4`}>
            
            {/* กล่องคำแนะนำขั้นตอนปัจจุบัน */}
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5 text-center">
              <div className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full mb-1">
                ท่าทางที่ {Math.min(scanStepIndex + 1, SCAN_STEPS.length)} จาก {SCAN_STEPS.length}
              </div>
              <h4 className="text-xs md:text-sm font-bold text-slate-800">
                {scanStepIndex < SCAN_STEPS.length ? SCAN_STEPS[scanStepIndex].label : 'เก็บข้อมูลครบถ้วนทุกมุมแล้ว'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {scanStepIndex < SCAN_STEPS.length ? SCAN_STEPS[scanStepIndex].hint : 'ระบบกำลังบันทึกข้อมูลเข้าสู่ฐานข้อมูล...'}
              </p>
            </div>

            {/* หน้าต่างแสดงภาพกล้องพร้อมสถานะตรวจจับท่าทาง */}
            <div className="flex flex-col items-center p-5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className={`w-48 h-48 rounded-full overflow-hidden border-4 mb-4 relative shadow-sm bg-black transition-all duration-300 ${
                isPoseMatched ? 'border-emerald-500 ring-4 ring-emerald-300/50' : 'border-slate-300'
              }`}>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* Badge สถานะตรวจจับท่าทาง */}
                <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm transition-all ${
                    isPoseMatched
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900/70 text-slate-200'
                  }`}>
                    {isPoseMatched ? 'ตรวจพบท่าทางแล้ว' : 'กำลังรอตรวจจับ...'}
                  </span>
                </div>
              </div>

              {/* แถบ Progress Bar */}
              <div className="w-full bg-slate-200 h-2 rounded-full mb-4 max-w-[220px] overflow-hidden">
                <div className="bg-emerald-600 h-full transition-all duration-500" style={{ width: `${scanProgress}%` }}></div>
              </div>

              {/* ปุ่มเริ่มสแกน */}
              {!isScanningActive && scanStepIndex < SCAN_STEPS.length && (
                <button
                  type="button"
                  onClick={handleStartScan}
                  disabled={!isModelsLoaded}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer disabled:bg-slate-300"
                >
                  {isModelsLoaded ? 'เริ่มสแกนใบหน้า (ตรวจจับอัตโนมัติ)' : 'กำลังเตรียมระบบ AI...'}
                </button>
              )}

              {isScanningActive && scanStepIndex < SCAN_STEPS.length && (
                <div className="text-center py-1">
                  <p className="text-xs font-bold text-emerald-700 animate-pulse text-center">
                    กรุณาทำท่า: {SCAN_STEPS[scanStepIndex].label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    เมื่อระบบตรวจจับท่าทางถูกต้อง จะบันทึกภาพให้อัตโนมัติ
                  </p>
                </div>
              )}

              {/* ตัวอย่างภาพที่บันทึกผ่านแล้วในแต่ละมุม */}
              {capturedThumbs.length > 0 && (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60 w-full justify-center">
                  {capturedThumbs.map((thumb, idx) => (
                    <div key={idx} className="relative">
                      <img src={thumb} alt={`Step ${idx + 1}`} className="w-10 h-10 object-cover rounded-lg border border-emerald-500 shadow-2xs" />
                      <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(capturedVectors.length > 0 || isScanningActive) && !isLoading && (
              <button
                type="button"
                onClick={handleResetScan}
                className="w-full text-slate-400 hover:text-slate-600 text-center text-xs font-bold mt-3 cursor-pointer"
              >
                เริ่มสแกนใหม่อีกครั้ง
              </button>
            )}
          </div>

          {status && (
            <div className={`p-3 rounded-xl text-center text-xs font-bold mt-4 border ${
              status.includes('ข้อผิดพลาด')
                ? 'bg-red-50 text-red-600 border-red-100'
                : 'bg-emerald-50/60 text-emerald-700 border-emerald-100'
            }`}>
              {status}
            </div>
          )}
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

      {/* 4. Modal ป๊อบอัปยืนยันการอัปเดตใบหน้า (โหมดอัปโหลด) */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 animate-in zoom-in-95 duration-200 text-center">
            <h3 className="text-xl font-black text-slate-800">ยืนยันการอัปเดตใบหน้า</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              คุณต้องการบันทึกข้อมูลใบหน้าชุดใหม่สำหรับนักศึกษา <br />
              <span className="font-bold text-emerald-700 text-sm">{user?.displayName}</span> ({user?.studentCode}) หรือไม่?
            </p>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-400 hover:text-slate-600 text-xs rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleFinalSave([])}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}