// attendance-web/app/teacher/course/[id]/page.tsx
'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as faceapi from 'face-api.js';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const AI_BASE_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000';

interface ScanResult {
  url: string;
  boxes: any[];
  matches: string[];
}

interface StudentInCourse {
  id: number;
  studentCode: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export default function AttendancePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [courseInfo, setCourseInfo] = useState<{
    courseName: string;
    courseCode: string;
    section?: string;
    semester?: string;
    academicYear?: string;
    joinCode?: string;
  } | null>(null);

  const [courseStudents, setCourseStudents] = useState<StudentInCourse[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [detectedStudents, setDetectedStudents] = useState<string[]>([]);
  const [status, setStatus] = useState('กำลังโหลดโมเดล AI...');
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [sessionType, setSessionType] = useState<'REGULAR' | 'COMPENSATION'>('REGULAR');
  const [slotMode, setSlotMode] = useState<'MORNING' | 'AFTERNOON' | 'SPECIAL'>('MORNING');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [sessionRemark, setSessionRemark] = useState('');

  const [dailyRoundNumber, setDailyRoundNumber] = useState<number>(1);
  const [previousRoundAttendance, setPreviousRoundAttendance] = useState<any[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [allDateSessions, setAllDateSessions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ทั้งหมด' | 'มาเรียน' | 'มาสาย' | 'รอตรวจสอบ' | 'ขาดเรียน'>('ทั้งหมด');
  const [zoomedImageIdx, setZoomedImageIdx] = useState<number | null>(null);

  // State สำหรับเก็บการแก้ไขสถานะด้วยมือ (Manual Status Overrides)
  const [statusOverrides, setStatusOverrides] = useState<Record<number, string>>({});
  // State สำหรับเก็บเวลาที่แก้ไขแยกตามรายบุคคล
  const [timeOverrides, setTimeOverrides] = useState<Record<number, string>>({});
  // State สำหรับ Modal แก้ไขสถานะขั้นสูง (แบบหน้า Report)
  const [editingStudent, setEditingStudent] = useState<{
    id: number;
    name: string;
    studentCode: string;
    currentStatus: string;
    newStatus: string;
    currentTime: string;
    remark: string;
  } | null>(null);

  // Toast Alert Message State
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

  const ALL_STATUSES = ['มาเรียน', 'มาสาย', 'ลา', 'รอตรวจสอบ', 'ขาดเรียน'];

  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const zoomImgRef = useRef<HTMLImageElement | null>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const getAuthToken = () => localStorage.getItem('teacher_token') || localStorage.getItem('token');

  const handleSlotChange = (mode: 'MORNING' | 'AFTERNOON' | 'SPECIAL') => {
    setSlotMode(mode);
    if (mode === 'MORNING') { setStartTime('09:00'); setEndTime('12:00'); }
    else if (mode === 'AFTERNOON') { setStartTime('13:00'); setEndTime('16:00'); }
    else if (mode === 'SPECIAL') { setStartTime('17:00'); setEndTime('20:00'); }
  };

  const fetchInitialData = useCallback(async () => {
    const token = getAuthToken();

    try {
      const resCourse = await fetch(`/api/courses/${courseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const courseJson = await resCourse.json();
      if (courseJson.success && courseJson.data) {
        setCourseInfo({
          courseName: courseJson.data.courseName,
          courseCode: courseJson.data.courseCode,
          section: courseJson.data.section,
          semester: courseJson.data.semester,
          academicYear: courseJson.data.academicYear,
          joinCode: courseJson.data.joinCode
        });
        if (courseJson.data.students) {
          const sorted = [...courseJson.data.students].sort((a, b) =>
            (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true })
          );
          setCourseStudents(sorted);
        }
      }

      const resHistory = await fetch(
        `/api/attendance/history/${courseId}?date=${selectedDate}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      ).catch(() => null);

      let recordedRoundsCount = 0;
      let allPreviousRecords: any[] = [];
      let foundTimeSlot = '';
      let rawSessionsList: any[] = [];

      if (resHistory && resHistory.ok) {
        const historyJson = await resHistory.json();
        if (historyJson?.success && Array.isArray(historyJson.data)) {
          rawSessionsList = historyJson.data;
          setAllDateSessions(rawSessionsList);

          const isMorning = (ts: string) => /^(0[0-9]|1[0-2])/.test(ts);
          const isAfternoon = (ts: string) => /^(1[3-6])/.test(ts);
          const isSpecial = (ts: string) => /^(1[7-9]|2[0-3])/.test(ts);

          const matchedSessions = rawSessionsList.filter((item: any) => {
            const isTypeMatch = item.sessionType
              ? item.sessionType === sessionType
              : item.note?.includes(sessionType === 'COMPENSATION' ? 'สอนชดเชย' : 'คาบปกติ');
            if (!isTypeMatch) return false;

            const ts = item.timeSlot || item.note || '';
            if (slotMode === 'MORNING') return isMorning(ts);
            if (slotMode === 'AFTERNOON') return isAfternoon(ts);
            if (slotMode === 'SPECIAL') return isSpecial(ts);
            return false;
          });

          recordedRoundsCount = matchedSessions.length;
          if (matchedSessions.length > 0) {
            allPreviousRecords = matchedSessions;
            const latest = matchedSessions[matchedSessions.length - 1];
            foundTimeSlot = latest.timeSlot;
          }
        }
      }

      if (foundTimeSlot) {
        const [exStart, exEnd] = foundTimeSlot.split('-');
        if (exStart && exEnd) {
          setStartTime(exStart);
          setEndTime(exEnd);
        }
      } else {
        if (slotMode === 'MORNING') { setStartTime('09:00'); setEndTime('12:00'); }
        else if (slotMode === 'AFTERNOON') { setStartTime('13:00'); setEndTime('16:00'); }
        else if (slotMode === 'SPECIAL') { setStartTime('17:00'); setEndTime('20:00'); }
      }

      setDailyRoundNumber(recordedRoundsCount + 1);
      setPreviousRoundAttendance(allPreviousRecords);

    } catch (err) {
      console.error('Fetch initial data error:', err);
    }
  }, [courseId, selectedDate, sessionType, slotMode]);

  useEffect(() => {
    setIsMounted(true);
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setIsLoading(false);
        setStatus('ระบบพร้อมใช้งาน');
      } catch {
        setStatus('โหลดโมเดลไม่สำเร็จ');
        setIsLoading(false);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (courseId) {
      fetchInitialData();
    }
  }, [courseId, fetchInitialData]);

  const isRoundLimitReached = dailyRoundNumber > 3;

  const timeSlotConflict = useMemo(() => {
    const currentSlotStr = `${startTime}-${endTime}`;
    const oppositeType = sessionType === 'REGULAR' ? 'COMPENSATION' : 'REGULAR';
    const oppositeLabel = oppositeType === 'COMPENSATION' ? 'คาบเรียนชดเชย' : 'คาบเรียนปกติ';

    const conflictSession = allDateSessions.find((session: any) => {
      const isOpposite = session.sessionType
        ? session.sessionType === oppositeType
        : session.note?.includes(oppositeType === 'COMPENSATION' ? 'สอนชดเชย' : 'คาบปกติ');

      const isSameTime = (session.timeSlot && session.timeSlot.includes(currentSlotStr)) ||
        (session.note && session.note.includes(currentSlotStr));

      return isOpposite && isSameTime;
    });

    if (conflictSession) {
      return {
        hasConflict: true,
        conflictedTypeLabel: oppositeLabel,
        timeSlot: currentSlotStr,
      };
    }

    return { hasConflict: false, conflictedTypeLabel: '', timeSlot: '' };
  }, [allDateSessions, sessionType, startTime, endTime]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setSelectedFiles(files);
      const results = Array.from(files).map(file => ({
        url: URL.createObjectURL(file),
        boxes: [],
        matches: []
      }));
      setScanResults(results);
      setDetectedStudents([]);
      setStatus(`เลือกรูปภาพ ${files.length} รูป พร้อมเช็คชื่อ`);
    }
  };

  const drawBoxes = (image: HTMLImageElement, canvas: HTMLCanvasElement, boxes: any[], matches: any[]) => {
    const displayWidth = image.clientWidth;
    const displayHeight = image.clientHeight;

    if (displayWidth === 0 || displayHeight === 0) return;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = displayWidth / image.naturalWidth;
    const scaleY = displayHeight / image.naturalHeight;

    boxes.forEach((box, index) => {
      const name = matches[index];
      const isMatched = name && name !== "Unknown";

      const dx = box.x * scaleX;
      const dy = box.y * scaleY;
      const dw = box.width * scaleX;
      const dh = box.height * scaleY;

      ctx.strokeStyle = isMatched ? '#10b981' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(dx, dy, dw, dh);

      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = isMatched ? '#10b981' : '#ef4444';
      ctx.fillText(name || 'Unknown', dx, dy > 15 ? dy - 5 : dy + 15);
    });
  };

  const handleScanAttendance = async () => {
    if (timeSlotConflict.hasConflict) {
      showToast('error', 'ไม่สามารถสแกนได้', `ช่วงเวลา ${timeSlotConflict.timeSlot} น. มีการบันทึกของ "${timeSlotConflict.conflictedTypeLabel}" อยู่แล้ว กรุณาเลือกช่วงเวลาหรือประเภทคาบเรียนที่ถูกต้อง`);
      return;
    }

    if (isRoundLimitReached) {
      showToast('error', 'เกินขีดจำกัดการเช็คชื่อ', 'ในคาบเรียนนี้ได้มีการเช็คชื่อครบ 3 รอบแล้ว ไม่สามารถสแกนเพิ่มได้');
      return;
    }

    if (!selectedFiles || !courseId) return;
    setIsLoading(true);
    const uniqueDetected = new Set<string>();
    const updatedResults: ScanResult[] = [];
    setStatusOverrides({});
    setTimeOverrides({});

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setStatus(`กำลังวิเคราะห์รูปที่ ${i + 1}/${selectedFiles.length}...`);

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        await img.decode();

        const detections = await faceapi.detectAllFaces(
          img,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6, maxResults: 20 })
        ).withFaceLandmarks();

        let currentBoxes: any[] = [];
        let currentMatches: string[] = [];

        if (detections.length > 0) {
          currentBoxes = detections.map((d: any) => ({
            x: d.detection.box.x,
            y: d.detection.box.y,
            width: d.detection.box.width,
            height: d.detection.box.height
          }));

          const formData = new FormData();
          formData.append('file', file);
          formData.append('boxes', JSON.stringify(currentBoxes));
          formData.append('course_id', courseId);

          const response = await fetch(`${AI_BASE_URL}/api/check-attendance-group`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('AI Server ประมวลผลรูปภาพไม่สำเร็จ');
          }

          const apiResult = await response.json();
          currentMatches = Array.isArray(apiResult.matches) ? apiResult.matches : [];

          currentMatches.forEach(name => {
            if (name && name !== "Unknown") uniqueDetected.add(name);
          });
        }

        updatedResults.push({ url: objectUrl, boxes: currentBoxes, matches: currentMatches });
      }

      setScanResults(updatedResults);
      setDetectedStudents(Array.from(uniqueDetected));
      setStatus(`ตรวจเสร็จสิ้น: พบนักศึกษา ${uniqueDetected.size} คน จากทั้งหมด ${courseStudents.length} คนในคลาส`);

      setTimeout(() => {
        updatedResults.forEach((res, idx) => {
          const img = imageRefs.current[idx];
          const canvas = canvasRefs.current[idx];
          if (img && canvas) drawBoxes(img, canvas, res.boxes, res.matches);
        });
      }, 200);

    } catch (err: any) {
      setStatus(`ข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderZoomBoxes = useCallback(() => {
    if (zoomedImageIdx !== null && scanResults[zoomedImageIdx]) {
      if (zoomImgRef.current && zoomCanvasRef.current) {
        drawBoxes(
          zoomImgRef.current,
          zoomCanvasRef.current,
          scanResults[zoomedImageIdx].boxes,
          scanResults[zoomedImageIdx].matches
        );
      }
    }
  }, [zoomedImageIdx, scanResults]);

  useEffect(() => {
    if (zoomedImageIdx !== null) {
      const timer = setTimeout(renderZoomBoxes, 80);
      window.addEventListener('resize', renderZoomBoxes);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', renderZoomBoxes);
      };
    }
  }, [zoomedImageIdx, renderZoomBoxes]);

  const handleOpenStatusModal = (item: any) => {
    const currentStatus = item.finalStatus || 'มาเรียน';
    const availableStatuses = ALL_STATUSES.filter((s) => s !== currentStatus);
    const initialNewStatus = availableStatuses[0] || 'มาเรียน';

    setEditingStudent({
      id: item.studentId,
      name: item.displayName,
      studentCode: item.studentCode,
      currentStatus: currentStatus,
      newStatus: initialNewStatus,
      currentTime: timeOverrides[item.studentId] || '12:00',
      remark: item.remark || ''
    });
  };

  const handleSaveStatusModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setStatusOverrides(prev => ({
      ...prev,
      [editingStudent.id]: editingStudent.newStatus
    }));

    setEditingStudent(null);
  };

  const attendanceEvaluationList = useMemo(() => {
    const cleanedDetected = detectedStudents.map(s => s.replace(/\s+/g, ' ').trim());

    return courseStudents.map(student => {
      const fullName = `${student.firstName || ''} ${student.lastName || ''}`.replace(/\s+/g, ' ').trim();
      const displayName = fullName || student.name || 'ไม่ระบุชื่อ';

      const isDetectedInCurrentScan = cleanedDetected.includes(fullName) ||
        (student.name && cleanedDetected.includes(student.name.trim())) ||
        (student.firstName && cleanedDetected.includes(student.firstName.trim()));

      const timeSlotStr = `[${startTime}-${endTime} น.] `;
      const customRemarkPrefix = sessionRemark ? `[${sessionRemark}] ` : '';
      const typePrefix = sessionType === 'COMPENSATION' ? '[สอนชดเชย] ' : '';
      const sessionPrefix = `${timeSlotStr}${typePrefix}${customRemarkPrefix}`;

      const patternArray: number[] = previousRoundAttendance.map((session: any) => {
         const records = session.records || session.attendances || [];
         const prevRecord = records.find((p: any) => p.studentId === student.id || p.id === student.id || p.studentCode === student.studentCode);
         if (prevRecord && prevRecord.status !== 'ขาดเรียน' && prevRecord.status !== 'รอตรวจสอบ') {
           return 1;
         }
         return 0;
      });

      patternArray.push(isDetectedInCurrentScan ? 1 : 0);
      const patternStr = patternArray.join('');

      let computedStatus: 'มาเรียน' | 'มาสาย' | 'รอตรวจสอบ' | 'ขาดเรียน' = 'ขาดเรียน';
      let autoRemark = '';

      if (patternArray.length === 3) {
        if (['111', '101'].includes(patternStr)) computedStatus = 'มาเรียน';
        else if (['110', '100', '010'].includes(patternStr)) computedStatus = 'รอตรวจสอบ';
        else if (['011', '001'].includes(patternStr)) computedStatus = 'มาสาย';
        else computedStatus = 'ขาดเรียน';
      } 
      else if (patternArray.length === 2) {
        if (patternStr === '11') computedStatus = 'มาเรียน';
        else if (patternStr === '10') computedStatus = 'รอตรวจสอบ';
        else if (patternStr === '01') computedStatus = 'มาสาย';
        else computedStatus = 'ขาดเรียน';
      } 
      else if (patternArray.length === 1) {
        computedStatus = patternStr === '1' ? 'มาเรียน' : 'ขาดเรียน';
      }

      if (isDetectedInCurrentScan) {
        autoRemark = `${sessionPrefix}ตรวจพบใบหน้าในรอบที่ ${dailyRoundNumber}`;
      } else {
        autoRemark = `${sessionPrefix}ไม่พบในการเช็คชื่อรอบที่ ${dailyRoundNumber}`;
      }

      const finalStatus = statusOverrides[student.id] !== undefined ? statusOverrides[student.id] : computedStatus;
      const finalRemark = statusOverrides[student.id] !== undefined
        ? `${autoRemark} (แก้ไขโดยอาจารย์)`
        : autoRemark;

      return {
        studentId: student.id,
        studentCode: student.studentCode,
        displayName,
        isDetectedInCurrentScan,
        finalStatus,
        remark: finalRemark
      };
    });
  }, [detectedStudents, courseStudents, previousRoundAttendance, startTime, endTime, sessionRemark, sessionType, dailyRoundNumber, statusOverrides]);

  const counts = useMemo(() => {
    const present = attendanceEvaluationList.filter(s => s.finalStatus === 'มาเรียน').length;
    const late = attendanceEvaluationList.filter(s => s.finalStatus === 'มาสาย').length;
    const pending = attendanceEvaluationList.filter(s => s.finalStatus === 'รอตรวจสอบ').length;
    const absent = attendanceEvaluationList.filter(s => s.finalStatus === 'ขาดเรียน').length;
    return { total: attendanceEvaluationList.length, present, late, pending, absent };
  }, [attendanceEvaluationList]);

  const filteredAttendanceList = useMemo(() => {
    return attendanceEvaluationList.filter(item => {
      if (statusFilter === 'ทั้งหมด') return true;
      return item.finalStatus === statusFilter;
    });
  }, [attendanceEvaluationList, statusFilter]);

  const generateImagesWithBurnedBoxes = async (): Promise<string[]> => {
    if (scanResults.length === 0) return [];

    return Promise.all(
      scanResults.map((res) => {
        return new Promise<string>((resolve) => {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            const maxDim = 1200;

            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }

            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(img.src);
              return;
            }

            ctx.drawImage(img, 0, 0, w, h);

            const scaleX = w / img.width;
            const scaleY = h / img.height;

            if (Array.isArray(res.boxes) && res.boxes.length > 0) {
              res.boxes.forEach((box, bIdx) => {
                const name = res.matches[bIdx];
                const isMatched = name && name !== 'Unknown';

                const dx = box.x * scaleX;
                const dy = box.y * scaleY;
                const dw = box.width * scaleX;
                const dh = box.height * scaleY;

                ctx.strokeStyle = isMatched ? '#10b981' : '#ef4444';
                ctx.lineWidth = Math.max(3, Math.round(w / 350));
                ctx.strokeRect(dx, dy, dw, dh);

                const labelText = isMatched ? name : 'Unknown';
                const fontSize = Math.max(14, Math.round(w / 65));
                ctx.font = `bold ${fontSize}px sans-serif`;

                const textWidth = ctx.measureText(labelText).width;
                const pad = 6;
                const labelY = dy > fontSize + 10 ? dy - 6 : dy + dh + fontSize + 4;

                ctx.fillStyle = isMatched ? '#10b981' : '#ef4444';
                ctx.fillRect(dx, labelY - fontSize, textWidth + pad * 2, fontSize + pad);

                ctx.fillStyle = '#ffffff';
                ctx.fillText(labelText, dx + pad, labelY - 2);
              });
            }

            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.src = res.url;
        });
      })
    );
  };

  const handleConfirmAndSave = async () => {
    if (timeSlotConflict.hasConflict) {
      setShowConfirmModal(false);
      showToast('error', 'ไม่สามารถบันทึกได้', `ช่วงเวลา ${timeSlotConflict.timeSlot} น. มีการบันทึกของ "${timeSlotConflict.conflictedTypeLabel}" อยู่แล้ว ไม่สามารถบันทึกซ้ำช่วงเวลาเดียวกันได้`);
      return;
    }

    if (isRoundLimitReached) return;

    setIsSaving(true);
    setStatus('กำลังบันทึกข้อมูลเข้าเรียนและจัดเก็บภาพสแกน...');
    const token = getAuthToken();

    try {
      const attendanceData = attendanceEvaluationList.map(item => ({
        studentId: item.studentId,
        status: item.finalStatus,
        remark: item.remark
      }));

      const imagesBase64WithBoxes = await generateImagesWithBurnedBoxes();

      const timeSlotStr = `${startTime}-${endTime}`;
      const res = await fetch('/api/attendance/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          courseId: courseId,
          date: selectedDate,
          sessionType: sessionType,
          timeSlot: timeSlotStr,
          imageUrl: imagesBase64WithBoxes[0] || null,
          imageUrls: imagesBase64WithBoxes,
          attendanceData: attendanceData,
          detectedNames: detectedStudents,
          round: dailyRoundNumber,
          sessionNote: sessionRemark
        })
      });

      const data = await res.json();

      if (data.success) {
        setShowConfirmModal(false);
        const roundTitle = `รอบที่ ${dailyRoundNumber}`;
        const typeText = sessionType === 'COMPENSATION' ? '(คาบเรียนชดเชย)' : '(คาบปกติ)';
        showToast('success', 'บันทึกสำเร็จเรียบร้อย', `บันทึกการเช็คชื่อวันที่ ${selectedDate} [${timeSlotStr} น.] ${typeText} ${roundTitle} เรียบร้อยแล้ว`, () => {
          router.push(`/teacher/report/${courseId}`);
        });
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setShowConfirmModal(false);
      showToast('error', 'บันทึกไม่สำเร็จ', err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setStatus('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted) return <div className="p-20 text-center font-bold text-slate-400">กำลังเริ่มระบบ...</div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800 relative">

      {/* Toast Alert Message ลอยตรงกลางด้านบน */}
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

      {/* Header */}
      <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative print:hidden">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
          ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        </h1>
        <div className="text-emerald-100 font-medium text-xs md:text-sm space-y-0.5">
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <nav className="bg-[#0d9488] shadow-inner px-4 overflow-x-auto print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-1 min-w-max">
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm bg-white text-slate-800 shadow rounded-t-xl"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            เช็คชื่อสแกนใบหน้า
          </button>

          <Link
            href={`/teacher/report/${courseId}`}
            className="flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm text-emerald-50 hover:bg-emerald-700/50 hover:text-white rounded-t-xl transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            รายงานการเข้าเรียน
          </Link>

          <Link
            href={`/teacher/course/${courseId}/students`}
            className="flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm text-emerald-50 hover:bg-emerald-700/50 hover:text-white rounded-t-xl transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            จัดการรายวิชา
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col items-center">
        {/* ปุ่มย้อนกลับ */}
        <div className="w-full mb-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0f766e] transition-colors cursor-pointer"
          >
            ← ย้อนกลับ
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200/80 w-full mb-6 space-y-5">

          {timeSlotConflict.hasConflict && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3.5 animate-in fade-in duration-200">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 font-black text-sm">
                !
              </div>
              <div className="flex-1">
                <h4 className="text-xs md:text-sm font-black text-amber-900">
                  พบช่วงเวลาการสอนชนกันในระบบ
                </h4>
                <p className="text-[11px] md:text-xs text-amber-700 mt-0.5 leading-relaxed">
                  ช่วงเวลา <span className="font-mono font-bold text-amber-950">[{timeSlotConflict.timeSlot} น.]</span> ของวันที่เลือกนี้ เคยถูกบันทึกเป็น <span className="font-bold underline text-amber-950">&quot;{timeSlotConflict.conflictedTypeLabel}&quot;</span> ไว้แล้ว ไม่สามารถเลือกบันทึกซ้ำในช่วงเวลาเดิมได้
                </p>
              </div>
            </div>
          )}

          {/* แจ้งเตือนการเกินขีดจำกัดจำนวนรอบ */}
          {isRoundLimitReached && (
            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3.5 animate-in fade-in duration-200">
              <div className="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 font-black text-sm">
                !
              </div>
              <div className="flex-1">
                <h4 className="text-xs md:text-sm font-black text-red-900">
                  เกินขีดจำกัดการเช็คชื่อ
                </h4>
                <p className="text-[11px] md:text-xs text-red-700 mt-0.5 leading-relaxed">
                  ช่วงเวลา <span className="font-mono font-bold text-red-950">[{startTime}-{endTime} น.]</span> ในคาบเรียนนี้มีการบันทึกการเช็คชื่อครบ <span className="font-bold">3 รอบ</span> แล้ว ไม่สามารถสแกนเพิ่มในคาบนี้ได้อีก
                </p>
              </div>
            </div>
          )}

          {/* ส่วนที่ 1: เลือกประเภทคาบเรียน */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-800 block">ประเภทคาบเรียน</span>
              <span className="text-[11px] text-slate-500">เลือกรูปแบบการเรียนการสอน</span>
            </div>
            <div className="inline-flex bg-slate-200/70 p-1 rounded-lg w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSessionType('REGULAR')}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${sessionType === 'REGULAR'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                คาบเรียนปกติ
              </button>
              <button
                type="button"
                onClick={() => setSessionType('COMPENSATION')}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${sessionType === 'COMPENSATION'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                คาบเรียนชดเชย
              </button>
            </div>
          </div>

          {/* ช่วงเวลาคาบเรียน */}
          <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-800 block">ช่วงเวลาคาบเรียน</span>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'MORNING', label: 'คาบเช้า' },
                { id: 'AFTERNOON', label: 'คาบบ่าย' },
                { id: 'SPECIAL', label: 'คาบพิเศษ' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSlotChange(m.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${slotMode === m.id
                    ? 'bg-[#0f766e] text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500/20 [color-scheme:light]"
              />
              <span className="text-xs font-bold text-slate-500">ถึง</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500/20 [color-scheme:light]"
              />
              <span className="text-xs font-bold text-slate-500">น.</span>
            </div>
          </div>

          {/* หมายเหตุคาบเรียน */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              หมายเหตุ
            </label>
            <input
              type="text"
              value={sessionRemark}
              onChange={(e) => setSessionRemark(e.target.value)}
              placeholder="ระบุหมายเหตุเพิ่มเติม หรือสัปดาห์ที่สอนชดเชย..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['สอนชดเชยสัปดาห์ที่ 1', 'สอนชดเชยสัปดาห์ที่ 2', 'สอนชดเชยสัปดาห์ที่ 3', 'สอนชดเชยเสาร์-อาทิตย์'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSessionRemark(tag)}
                  className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 rounded-lg font-bold text-slate-600 transition-all border border-slate-200 cursor-pointer"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* ส่วนที่ 2: วันที่ */}
          <div className="pb-4 border-b border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              เลือกวันที่
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            />
          </div>

          {/* ส่วนที่ 3: สถานะรอบการเช็คชื่อ */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl border bg-slate-50 border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-700 block">
                สถานะ: {
                  dailyRoundNumber === 1 ? 'การเช็คชื่อรอบที่ 1 (เริ่มคาบ)' :
                  dailyRoundNumber === 2 ? 'การเช็คชื่อรอบที่ 2' :
                  dailyRoundNumber === 3 ? 'การเช็คชื่อรอบที่ 3 (รอบสุดท้าย)' :
                  'เกินขีดจำกัด (ครบ 3 รอบแล้ว)'
                }
              </span>
              {dailyRoundNumber > 1 && !isRoundLimitReached && (
                <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
                  (พบประวัติรอบก่อนหน้า ระบบเชื่อมโยงข้อมูลเวลาเข้าด้วยกันอัตโนมัติ)
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700">
              [{startTime}-{endTime} น.] {sessionType === 'COMPENSATION' ? '[สอนชดเชย]' : '[คาบปกติ]'} {selectedDate}
            </span>
          </div>

          {/* ส่วนที่ 4: อัปโหลดรูปภาพ */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">อัปโหลดรูปภาพกลุ่ม:</label>
            <input
              type="file" multiple accept="image/*"
              onChange={handleFileChange}
              disabled={isRoundLimitReached}
              className={`block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold transition-all border border-slate-200 rounded-xl p-1 ${
                isRoundLimitReached
                  ? 'opacity-50 cursor-not-allowed file:bg-slate-200 file:text-slate-400 bg-slate-50'
                  : 'cursor-pointer file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 bg-white'
              }`}
            />
          </div>

          <button
            onClick={handleScanAttendance}
            disabled={isLoading || !selectedFiles || timeSlotConflict.hasConflict || isRoundLimitReached}
            className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white py-3 rounded-xl font-bold text-sm shadow-xs disabled:bg-slate-200 disabled:text-slate-400 transition-all cursor-pointer"
          >
            {timeSlotConflict.hasConflict
              ? 'ไม่สามารถสแกนได้เนื่องจากเวลาชนกัน'
              : isRoundLimitReached
                ? 'เกินขีดจำกัดการเช็คชื่อ (สูงสุด 3 รอบต่อคาบ)'
                : isLoading
                  ? 'กำลังประมวลผลใบหน้า...'
                  : 'เริ่มสแกนใบหน้า'}
          </button>

          <div className={`text-center py-2.5 px-4 rounded-xl font-bold text-xs border ${
            timeSlotConflict.hasConflict || isRoundLimitReached
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : status.includes('ข้อผิดพลาด')
                ? 'bg-red-50 text-red-600 border-red-100'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}>
            {timeSlotConflict.hasConflict
              ? `แจ้งเตือน: ช่วงเวลานี้มีการบันทึก "${timeSlotConflict.conflictedTypeLabel}" อยู่แล้ว`
              : isRoundLimitReached
                ? `แจ้งเตือน: คาบเรียนนี้ถูกบันทึกการเช็คชื่อครบโควต้า 3 รอบแล้ว`
                : status}
          </div>
        </div>

        {/* ตารางแสดงผลการตรวจ */}
        {scanResults.length > 0 && !isRoundLimitReached && (
          <div className="w-full bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80 mb-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-800">
                  รายชื่อนักศึกษาในชั้นเรียน ({attendanceEvaluationList.length} คน)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  สถานะการคำนวณเบื้องต้นจากการตรวจพบใบหน้ารอบปัจจุบัน ร่วมกับประวัติเดิม
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1 rounded-lg border bg-slate-50 text-slate-700 border-slate-200">
                  {startTime}-{endTime} น.
                </span>
                <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${sessionType === 'COMPENSATION' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>
                  {sessionType === 'COMPENSATION' ? 'คาบเรียนชดเชย' : 'คาบเรียนปกติ'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {[
                { id: 'ทั้งหมด', label: 'ทั้งหมด', count: counts.total, bg: 'bg-slate-100 text-slate-700' },
                { id: 'มาเรียน', label: 'มาเรียน', count: counts.present, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { id: 'มาสาย', label: 'มาสาย', count: counts.late, bg: 'bg-amber-50 text-amber-700 border-amber-200' },
                { id: 'รอตรวจสอบ', label: 'รอตรวจสอบ', count: counts.pending, bg: 'bg-purple-50 text-purple-700 border-purple-200' },
                { id: 'ขาดเรียน', label: 'ขาดเรียน', count: counts.absent, bg: 'bg-red-50 text-red-700 border-red-200' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${statusFilter === tab.id
                    ? 'bg-[#0f766e] text-white border-[#0f766e] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2.5 mb-6">
              {filteredAttendanceList.length > 0 ? (
                filteredAttendanceList.map((item, i) => {
                  const isFound = item.isDetectedInCurrentScan;
                  const statusColor =
                    item.finalStatus === 'มาเรียน' ? 'bg-emerald-50/60 border-emerald-200' :
                      item.finalStatus === 'มาสาย' ? 'bg-amber-50/60 border-amber-200' :
                        item.finalStatus === 'รอตรวจสอบ' ? 'bg-purple-50/60 border-purple-200' :
                        'bg-red-50/60 border-red-200';

                  const getStatusBadge = (status: string) => {
                    switch (status) {
                      case 'มาเรียน': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      case 'มาสาย': return 'bg-amber-50 text-amber-700 border-amber-200';
                      case 'ลา': return 'bg-blue-50 text-blue-700 border-blue-200';
                      case 'รอตรวจสอบ': return 'bg-purple-50 text-purple-700 border-purple-200';
                      case 'ขาดเรียน': return 'bg-red-50 text-red-700 border-red-200';
                      default: return 'bg-slate-50 text-slate-600 border-slate-200';
                    }
                  };

                  return (
                    <div
                      key={item.studentId}
                      className={`border rounded-xl px-4 py-3 flex items-center justify-between transition-all ${statusColor}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center border ${isFound ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'
                          }`}>
                          {i + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-800 text-xs md:text-sm">
                            {item.displayName}
                          </span>
                          {!isFound && (
                            <span className="ml-2 text-[10px] text-red-500 font-medium">
                              (ไม่พบในรูปสแกน)
                            </span>
                          )}
                          {item.remark && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {item.remark}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-xs text-slate-600 hidden sm:inline-block">
                          {item.studentCode}
                        </span>

                        <span className={`px-3 py-1 rounded-xl text-xs font-bold border whitespace-nowrap ${getStatusBadge(item.finalStatus)}`}>
                          {item.finalStatus}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleOpenStatusModal(item)}
                          className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-white active:scale-95 rounded-xl border border-slate-200/80 transition-all cursor-pointer shrink-0 shadow-2xs"
                          title="แก้ไขสถานะ / หมายเหตุ"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 font-bold text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  ไม่พบนักศึกษาที่มีสถานะ &quot;{statusFilter}&quot;
                </div>
              )}
            </div>

            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={timeSlotConflict.hasConflict}
              className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold text-sm shadow-xs transition-all cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {timeSlotConflict.hasConflict
                ? 'ไม่สามารถบันทึกได้เนื่องจากเวลาชนกัน'
                : `ยืนยันการบันทึกเข้าเรียนรอบที่ ${dailyRoundNumber}`}
            </button>
          </div>
        )}

        {/* ส่วนแสดงภาพวิเคราะห์ใบหน้า */}
        {scanResults.length > 0 && !isRoundLimitReached && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {scanResults.map((res, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    รูปภาพที่ {idx + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => setZoomedImageIdx(idx)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    คลิกเพื่อขยายภาพ
                  </button>
                </div>

                <div
                  onClick={() => setZoomedImageIdx(idx)}
                  className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-100 cursor-zoom-in group hover:ring-2 hover:ring-emerald-500 transition-all"
                  title="คลิกเพื่อดูภาพขยายขนาดใหญ่"
                >
                  <img
                    ref={(el) => { imageRefs.current[idx] = el; }}
                    src={res.url}
                    className="block w-full h-auto"
                    alt="Scan"
                  />
                  <canvas ref={(el) => { canvasRefs.current[idx] = el; }} className="absolute top-0 left-0 pointer-events-none" />
                  <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="bg-slate-900/80 text-white text-xs font-bold px-3 py-1.5 rounded-xl backdrop-blur-sm shadow">
                      คลิกเพื่อขยายภาพ
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm">
        © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
        <p className="text-emerald-100 font-medium text-xs md:text-sm">
          สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
        </p>
      </footer>

      {/* Modal Popup: ขยายรูปภาพ */}
      {zoomedImageIdx !== null && scanResults[zoomedImageIdx] && (
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setZoomedImageIdx(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[92vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col p-4 md:p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-800">
                  รูปภาพที่ {zoomedImageIdx + 1} (มุมมองขนาดขยาย)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  ตรวจพบใบหน้าทั้งหมด {scanResults[zoomedImageIdx].boxes?.length || 0} ตำแหน่ง
                </p>
              </div>
              <button
                type="button"
                onClick={() => setZoomedImageIdx(null)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold p-1 cursor-pointer"
                title="ปิด"
              >
                &times;
              </button>
            </div>

            <div className="relative overflow-auto max-h-[78vh] flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-200 p-2">
              <div className="relative inline-block leading-none">
                <img
                  ref={zoomImgRef}
                  src={scanResults[zoomedImageIdx].url}
                  alt="Zoomed Scan Result"
                  className="max-h-[72vh] w-auto max-w-full object-contain block rounded-lg"
                  onLoad={renderZoomBoxes}
                />
                <canvas
                  ref={zoomCanvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: แก้ไขสถานะ */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 mb-1">แก้ไขสถานะการเข้าเรียน</h3>
            <p className="text-xs text-slate-400 mb-4">
              นักศึกษา: <span className="font-bold text-slate-700">{editingStudent.name}</span> ({editingStudent.studentCode})
            </p>

            <form onSubmit={handleSaveStatusModal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">สถานะใหม่</label>
                <select
                  value={editingStudent.newStatus}
                  onChange={(e) => {
                    const nextStatus = e.target.value;
                    let nextRemark = editingStudent.remark;
                    if (nextStatus === "มาสาย") nextRemark = "มาสาย";
                    else if (nextStatus === "ลา") nextRemark = "ลากิจ";
                    else if (nextStatus === "รอตรวจสอบ") nextRemark = "รอตรวจสอบ";
                    else if (nextStatus === "มาเรียน") nextRemark = "มาเรียน";
                    else if (nextStatus === "ขาดเรียน") nextRemark = "ขาดเรียน";

                    setEditingStudent({
                      ...editingStudent,
                      newStatus: nextStatus,
                      remark: nextRemark,
                    });
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                >
                  {ALL_STATUSES.filter((s) => s !== editingStudent.currentStatus).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">หมายเหตุ / เหตุผลการแก้ไข</label>
                <input
                  type="text"
                  required
                  value={editingStudent.remark}
                  onChange={(e) => setEditingStudent({ ...editingStudent, remark: e.target.value })}
                  placeholder="เช่น ลากิจ, ลาป่วย, มาสาย, รอตรวจสอบ"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1.5">ตัวเลือกด่วน:</span>
                <div className="flex flex-wrap gap-1.5">
                  {["ลากิจ", "ลาป่วย", "มาสาย", "รอตรวจสอบ", "เช็คชื่อรอบที่ 2", "เช็ครอบเก็บตก"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setEditingStudent({ ...editingStudent, remark: tag })}
                      className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg font-bold text-slate-600 transition-all border border-slate-200/60 cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 py-2.5 font-bold text-slate-400 hover:text-slate-600 text-xs rounded-xl bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Popup: ยืนยันการเช็คชื่อ */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 animate-in zoom-in-95 duration-200 text-center">
            <h3 className="text-xl font-black text-slate-800 mb-1">ยืนยันการบันทึกเช็คชื่อ</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              บันทึกผลประจำวันที่ <span className="font-bold text-slate-700">{selectedDate}</span><br />
              <span className="font-bold text-emerald-800">
                เวลา: {startTime}-{endTime} น. | รูปแบบ: {sessionType === 'COMPENSATION' ? 'คาบสอนชดเชย' : 'คาบเรียนปกติ'}
              </span>
              {sessionRemark && (
                <span className="block text-slate-600 mt-1 font-bold">
                  หมายเหตุ: {sessionRemark}
                </span>
              )}
            </p>

            <div className="bg-slate-50 rounded-xl p-4 my-5 text-xs text-slate-600 text-left space-y-2 border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">นักศึกษาทั้งหมด:</span>
                <span className="font-bold text-slate-800">{attendanceEvaluationList.length} คน</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">มาเรียน:</span>
                <span className="font-bold text-emerald-700">
                  {counts.present} คน
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">มาสาย:</span>
                <span className="font-bold text-amber-700">
                  {counts.late} คน
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">รอตรวจสอบ:</span>
                <span className="font-bold text-purple-700">
                  {counts.pending} คน
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">ขาดเรียน:</span>
                <span className="font-bold text-red-700">
                  {counts.absent} คน
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-500 hover:text-slate-700 transition-all text-xs rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmAndSave}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 disabled:bg-slate-300 cursor-pointer"
              >
                {isSaving ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}