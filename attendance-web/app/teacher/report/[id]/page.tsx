// attendance-web/app/teacher/report/[id]/page.tsx
"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import CourseAttendanceSheetPrintForm from "@/app/components/reports/CourseAttendanceSheetPrintForm";

export const dynamic = "force-dynamic";

interface CourseStudent {
  id: string | number;
  studentCode?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  status?: string;
}

interface CourseInfo {
  courseCode?: string;
  courseName?: string;
  courseNameEn?: string;
  credits?: string;
  section?: string;
  students?: CourseStudent[];
  teacher?: { name?: string };
  teacherDisplayName?: string;
}

interface AttendanceItem {
  id: string | number;
  studentId?: string | number;
  studentCode?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  status: string;
  time?: string;
  updatedAt?: string;
  createdAt?: string;
  remark?: string;
  student?: CourseStudent;
}

interface DailyReportState {
  success: boolean;
  data: AttendanceItem[];
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    leave: number;
  };
}

interface WeekSummaryItem {
  rawDate?: string;
  dateStr?: string;
  timeStr?: string;
  sessionType?: string;
  present: number;
  late: number;
  leave: number;
  absent: number;
  totalCount?: number;
  percentage: number;
  note?: string;
}

interface EditingStudentState {
  id: string | number;
  name: string;
  studentCode?: string;
  currentStatus: string;
  newStatus: string;
  currentTime: string;
  remark: string;
}

interface EditingWeekRemarkState {
  weekNumber: number;
  date: string;
  note: string;
}

interface AlertModalState {
  show: boolean;
  title: string;
  message: string;
  isSuccess?: boolean;
}

interface HistorySession {
  id?: string | number;
  createdAt?: string;
  date?: string;
  timeSlot?: string;
  sessionType?: string;
  note?: string;
  attendances?: AttendanceItem[];
  records?: AttendanceItem[];
}

export default function AttendanceReportPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [reportMode, setReportMode] = useState<"daily" | "summary">("daily");
  const [dailyReport, setDailyReport] = useState<DailyReportState>({
    success: false,
    data: [],
    summary: { total: 0, present: 0, late: 0, absent: 0, leave: 0 },
  });
  const [weeksSummaryData, setWeeksSummaryData] = useState<WeekSummaryItem[]>([]);
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [dailyRoundsCount, setDailyRoundsCount] = useState<number>(0);

  const [filter, setFilter] = useState("ทั้งหมด");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [selectedSessionType, setSelectedSessionType] = useState<string>("");

  const [editingStudent, setEditingStudent] = useState<EditingStudentState | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [editingWeekRemark, setEditingWeekRemark] = useState<EditingWeekRemarkState | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [alertModal, setAlertModal] = useState<AlertModalState>({
    show: false,
    title: "",
    message: "",
    isSuccess: true,
  });

  const ALL_STATUSES = ["มาเรียน", "มาสาย", "ลา", "ขาดเรียน"];

  const getAuthToken = () =>
    localStorage.getItem("teacher_token") || localStorage.getItem("token");

  const cleanRemarkString = (str: string) => {
    if (!str) return "";
    return str
      .replace(/\(แก้ไข(โดยอาจารย์|โดยผู้ดูแลระบบ)?เมื่อ[^)]*?\)/gi, "")
      .replace(/\(แก้ไขเวลา[^)]*?\)/gi, "")
      .trim();
  };

  const formatDisplayRemark = (str: string) => {
    if (!str) return "";
    const match = str.match(/\(แก้ไข(โดยอาจารย์|โดยผู้ดูแลระบบ)?เมื่อ[^)]*?\)/i);
    const baseRemark = cleanRemarkString(str);
    if (match) {
      return baseRemark ? `${baseRemark} ${match[0]}` : match[0];
    }
    return baseRemark;
  };

  const formatTimeString = (timeValue: unknown) => {
    if (!timeValue) return "";
    const d = new Date(timeValue as string | number | Date);
    if (isNaN(d.getTime())) return "";
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const fetchCourseDetailsAndHistory = useCallback(async () => {
    const token = getAuthToken();
    try {
      const [resCourse, resHistory] = await Promise.all([
        fetch(`/api/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/attendance/history/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);

      const json = await resCourse.json();
      if (json.success && json.data) {
        setCourseInfo(json.data);
        setTotalStudentsCount(json.data.students?.length || 0);
      }

      if (resHistory && resHistory.ok) {
        const historyJson = await resHistory.json();
        const rawList = Array.isArray(historyJson.data)
          ? historyJson.data
          : Array.isArray(historyJson)
            ? historyJson
            : [];
        const sortedHistory = [...rawList].sort(
          (a: HistorySession, b: HistorySession) => {
            const tA = new Date(a.createdAt || a.date || 0).getTime();
            const tB = new Date(b.createdAt || b.date || 0).getTime();
            return tA - tB;
          },
        );
        setHistorySessions(sortedHistory);
      }
    } catch (err) {
      console.error("Fetch course details error:", err);
    }
  }, [courseId]);

  const fetchDailyReport = useCallback(
    async (date: string, timeSlot?: string, sessionType?: string) => {
      setLoading(true);
      const token = getAuthToken();
      try {
        const querySlot = timeSlot ? `&timeSlot=${encodeURIComponent(timeSlot)}` : "";
        const queryType = sessionType ? `&sessionType=${encodeURIComponent(sessionType)}` : "";
        const [resDaily, resHistory] = await Promise.all([
          fetch(`/api/report/${courseId}?date=${date}${querySlot}${queryType}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/attendance/history/${courseId}?date=${date}${querySlot}${queryType}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
        ]);

        const dailyJson = await resDaily.json();
        if (dailyJson.success) {
          setDailyReport(dailyJson);
          if (dailyJson.summary?.total)
            setTotalStudentsCount(dailyJson.summary.total);
        } else {
          setDailyReport({
            success: false,
            data: [],
            summary: { total: 0, present: 0, late: 0, absent: 0, leave: 0 },
          });
        }

        if (resHistory && resHistory.ok) {
          const historyJson = await resHistory.json();
          const rawList = Array.isArray(historyJson.data)
            ? historyJson.data
            : Array.isArray(historyJson)
              ? historyJson
              : [];
          setDailyRoundsCount(rawList.length);
        } else {
          setDailyRoundsCount(0);
        }
      } catch (err) {
        console.error("Fetch daily report error:", err);
      } finally {
        setLoading(false);
      }
    },
    [courseId],
  );

  const fetchWeeksSummary = useCallback(async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/report/${courseId}?mode=weeks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setWeeksSummaryData(json.data);
        if (json.totalStudents) setTotalStudentsCount(json.totalStudents);
      } else {
        setWeeksSummaryData([]);
      }
    } catch (err) {
      console.error("Fetch weeks summary error:", err);
      setWeeksSummaryData([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) {
      fetchCourseDetailsAndHistory();
      fetchWeeksSummary();
      if (reportMode === "daily") {
        fetchDailyReport(selectedDate, selectedTimeSlot, selectedSessionType);
      }
    }
  }, [
    courseId,
    selectedDate,
    selectedTimeSlot,
    selectedSessionType,
    reportMode,
    fetchCourseDetailsAndHistory,
    fetchDailyReport,
    fetchWeeksSummary,
  ]);

  const handleOpenStatusModal = (item: AttendanceItem, timeString?: string) => {
    const displayName =
      `${item.firstName || ""} ${item.lastName || ""}`.trim() ||
      item.name ||
      "ไม่ระบุชื่อ";
    const rawRemark = cleanRemarkString(item.remark || "");
    const currentStatus = item.status || "มาเรียน";

    const availableStatuses = ALL_STATUSES.filter((s) => s !== currentStatus);
    const initialNewStatus = availableStatuses[0] || "มาเรียน";

    let defaultRemark = rawRemark;
    if (!defaultRemark) {
      if (initialNewStatus === "มาสาย") defaultRemark = "มาสาย";
      else if (initialNewStatus === "ลา") defaultRemark = "ลากิจ";
      else if (initialNewStatus === "มาเรียน") defaultRemark = "มาเรียน";
      else if (initialNewStatus === "ขาดเรียน") defaultRemark = "ขาดเรียน";
    }

    setEditingStudent({
      id: item.id,
      name: displayName,
      studentCode: item.studentCode,
      currentStatus: currentStatus,
      newStatus: currentStatus,
      currentTime:
        timeString ||
        formatTimeString(item.time || item.updatedAt || item.createdAt) ||
        formatTimeString(new Date()),
      remark: defaultRemark,
    });
  };

  const handleSaveStatusModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setIsSubmittingEdit(true);
    const token = getAuthToken();

    const now = new Date();
    const dateFormatted = now.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
    const timeFormatted = now.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const cleanRemark = cleanRemarkString(editingStudent.remark);
    const timeStamp = `(แก้ไขโดยอาจารย์เมื่อ ${dateFormatted} เวลา ${timeFormatted} น.)`;
    const finalRemark = cleanRemark ? `${cleanRemark} ${timeStamp}` : timeStamp;

    try {
      const res = await fetch(`/api/attendance/direct`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: editingStudent.id,
          courseId: courseId,
          status: editingStudent.newStatus,
          date: selectedDate,
          time: editingStudent.currentTime,
          remark: finalRemark,
        }),
      });

      if (res.ok) {
        setEditingStudent(null);
        fetchDailyReport(selectedDate, selectedTimeSlot, selectedSessionType);
        fetchWeeksSummary();
        fetchCourseDetailsAndHistory();
        setAlertModal({
          show: true,
          title: "แก้ไขข้อมูลเรียบร้อย",
          message: `อัปเดตสถานะของ ${editingStudent.name} สำเร็จ`,
          isSuccess: true,
        });
      } else {
        setAlertModal({
          show: true,
          title: "เกิดข้อผิดพลาด",
          message: "ไม่สามารถอัปเดตสถานะการเข้าเรียนได้",
          isSuccess: false,
        });
      }
    } catch {
      setAlertModal({
        show: true,
        title: "เกิดข้อผิดพลาด",
        message: "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์",
        isSuccess: false,
      });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleTimeChange = async (
    studentId: string | number,
    currentStatus: string,
    newTimeStr: string,
    currentRemark: string,
  ) => {
    const token = getAuthToken();
    const now = new Date();
    const dateFormatted = now.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
    const timeFormatted = now.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const cleanRemark = cleanRemarkString(currentRemark || "");
    const timeStamp = `(แก้ไขโดยอาจารย์เมื่อ ${dateFormatted} เวลา ${timeFormatted} น.)`;
    const finalRemark = cleanRemark
      ? `${cleanRemark} ${timeStamp}`
      : `แก้ไขเวลา ${timeStamp}`;

    try {
      const res = await fetch(`/api/attendance/direct`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId,
          courseId,
          status: currentStatus,
          date: selectedDate,
          time: newTimeStr,
          remark: finalRemark,
        }),
      });

      if (res.ok) {
        fetchDailyReport(selectedDate, selectedTimeSlot, selectedSessionType);
        fetchWeeksSummary();
        fetchCourseDetailsAndHistory();
        setAlertModal({
          show: true,
          title: "แก้ไขเวลาเรียบร้อย",
          message: "อัปเดตเวลาการเช็คชื่อเรียบร้อยแล้ว",
          isSuccess: true,
        });
      } else {
        setAlertModal({
          show: true,
          title: "เกิดข้อผิดพลาด",
          message: "ไม่สามารถอัปเดตเวลาได้",
          isSuccess: false,
        });
      }
    } catch {
      setAlertModal({
        show: true,
        title: "เกิดข้อผิดพลาด",
        message: "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์",
        isSuccess: false,
      });
    }
  };

  const handleSaveWeekNote = async () => {
    if (!editingWeekRemark) return;
    setIsSavingNote(true);
    const token = getAuthToken();

    try {
      const res = await fetch(`/api/courses/${courseId}/session-note`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          weekNumber: editingWeekRemark.weekNumber,
          date: editingWeekRemark.date,
          note: editingWeekRemark.note,
        }),
      });

      if (res.ok) {
        setWeeksSummaryData((prev) =>
          prev.map((w, idx) => {
            if (idx + 1 === editingWeekRemark.weekNumber) {
              return { ...w, note: editingWeekRemark.note };
            }
            return w;
          }),
        );
        setEditingWeekRemark(null);
        setAlertModal({
          show: true,
          title: "บันทึกหมายเหตุสำเร็จ",
          message: "บันทึกข้อมูลหมายเหตุการสอนเรียบร้อยแล้ว",
          isSuccess: true,
        });
      } else {
        localStorage.setItem(
          `course_${courseId}_week_${editingWeekRemark.weekNumber}_note`,
          editingWeekRemark.note,
        );
        setWeeksSummaryData((prev) =>
          prev.map((w, idx) => {
            if (idx + 1 === editingWeekRemark.weekNumber) {
              return { ...w, note: editingWeekRemark.note };
            }
            return w;
          }),
        );
        setEditingWeekRemark(null);
        setAlertModal({
          show: true,
          title: "บันทึกหมายเหตุสำเร็จ",
          message: "บันทึกข้อมูลหมายเหตุการสอนเรียบร้อยแล้ว",
          isSuccess: true,
        });
      }
    } catch {
      localStorage.setItem(
        `course_${courseId}_week_${editingWeekRemark.weekNumber}_note`,
        editingWeekRemark.note,
      );
      setEditingWeekRemark(null);
      setAlertModal({
        show: true,
        title: "บันทึกหมายเหตุสำเร็จ",
        message: "บันทึกข้อมูลหมายเหตุการสอนเรียบร้อยแล้ว",
        isSuccess: true,
      });
    } finally {
      setIsSavingNote(false);
    }
  };

  const filteredDailyData = dailyReport.data.filter((item: AttendanceItem) => {
    if (filter === "ทั้งหมด") return true;
    return item.status === filter;
  });

  const uniqueWeeksSummaryData = useMemo(() => {
    if (!Array.isArray(weeksSummaryData)) return [];
    const map = new Map<string, WeekSummaryItem>();
    for (const item of weeksSummaryData) {
      const dateKey = item.rawDate || item.dateStr || "";
      const timeKey = item.timeStr || "00:00";
      const typeKey = item.sessionType || "REGULAR";
      const uniqueKey = `${dateKey}_${timeKey}_${typeKey}`;
      map.set(uniqueKey, item);
    }
    return Array.from(map.values());
  }, [weeksSummaryData]);

  const TOTAL_WEEKS = 15;
  const weeksList = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
    const weekNumber = i + 1;
    const weekData = uniqueWeeksSummaryData[i];
    const savedLocalNote =
      typeof window !== "undefined"
        ? localStorage.getItem(`course_${courseId}_week_${weekNumber}_note`)
        : "";

    if (weekData) {
      return {
        weekNumber,
        dateStr: weekData.dateStr,
        rawDate: weekData.rawDate,
        timeStr: weekData.timeStr || "",
        sessionType: weekData.sessionType || "REGULAR",
        present: weekData.present,
        late: weekData.late,
        leave: weekData.leave,
        absent: weekData.absent,
        totalCount: weekData.totalCount || totalStudentsCount,
        percentage: weekData.percentage,
        note: weekData.note || savedLocalNote || "",
        isChecked: true,
      };
    }

    return {
      weekNumber,
      dateStr: "ยังไม่บันทึก",
      rawDate: "",
      timeStr: "",
      sessionType: "REGULAR",
      present: 0,
      late: 0,
      leave: 0,
      absent: 0,
      totalCount: totalStudentsCount || 0,
      percentage: 0,
      note: savedLocalNote || "",
      isChecked: false,
    };
  });

  const handleSelectWeek = (week: { rawDate?: string; timeStr?: string; sessionType?: string }) => {
    if (week.rawDate) {
      setSelectedDate(week.rawDate);
      setSelectedTimeSlot(week.timeStr || "");
      setSelectedSessionType(week.sessionType || "REGULAR");
      fetchDailyReport(week.rawDate, week.timeStr, week.sessionType);
    }
    setReportMode("daily");
  };

  const getTimeSlotLabel = (slot: string) => {
    if (!slot) return "";
    if (
      slot.includes("09:") ||
      slot.includes("08:") ||
      slot.includes("10:") ||
      slot.includes("11:") ||
      slot.includes("12:")
    ) {
      return `คาบเช้า (${slot} น.)`;
    }
    if (
      slot.includes("13:") ||
      slot.includes("14:") ||
      slot.includes("15:") ||
      slot.includes("16:")
    ) {
      return `คาบบ่าย (${slot} น.)`;
    }
    if (
      slot.includes("17:") ||
      slot.includes("18:") ||
      slot.includes("19:") ||
      slot.includes("20:")
    ) {
      return `คาบพิเศษ (${slot} น.)`;
    }
    return `รอบเวลา ${slot} น.`;
  };

  // แมปลงเอกสารพิมพ์ PDF (ตั้งลำดับ Priority ให้ 'มาสาย' สูงกว่า 'มาเรียน')
  const printStudentsData = useMemo(() => {
    const baseStudents =
      courseInfo?.students && courseInfo.students.length > 0
        ? courseInfo.students
        : dailyReport.data;
    if (!baseStudents || baseStudents.length === 0) return [];

    const uniqueSlots = new Map<string, any>();

    historySessions.forEach((sess: HistorySession) => {
      const d = new Date(sess.date || sess.createdAt || 0);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${day}`;

      let timeSlot = sess.timeSlot || "";
      const fullText = `${sess.note || ""} ${sess.timeSlot || ""}`;
      const timeMatch = fullText.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);

      if (timeMatch) {
        timeSlot = `${timeMatch[1]}-${timeMatch[2]}`.replace(/\s+/g, "");
      } else {
        const hr = d.getHours();
        timeSlot = hr < 12 ? "09:00-12:00" : "13:00-16:00";
      }

      const isComp =
        sess.sessionType === "COMPENSATION" || fullText.includes("สอนชดเชย");
      const sessionType = isComp ? "COMPENSATION" : "REGULAR";
      const slotKey = `${dateStr}_${timeSlot}_${sessionType}`;

      if (!uniqueSlots.has(slotKey)) {
        uniqueSlots.set(slotKey, {
          dateStr,
          timeSlot,
          sessionType,
          sessionIds: sess.id ? [String(sess.id)] : [],
          rawTimestamp: d.getTime(),
        });
      } else {
        const existing = uniqueSlots.get(slotKey);
        if (sess.id && !existing.sessionIds.includes(String(sess.id))) {
          existing.sessionIds.push(String(sess.id));
        }
      }
    });

    const standardWeeks = Array.from(uniqueSlots.values()).sort(
      (a, b) => a.rawTimestamp - b.rawTimestamp,
    );

    return baseStudents.map((student: CourseStudent | AttendanceItem) => {
      const studentName =
        `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
        student.name ||
        "ไม่ระบุชื่อ";
      const studentId = String(student.id || "");
      const studentCode = String(student.studentCode || "").trim();
      const recordsMap: { [weekNumber: number]: string } = {};

      standardWeeks.forEach((weekSession: any, wIdx: number) => {
        const weekNum = wIdx + 1;
        const matchedStatuses: string[] = [];

        historySessions.forEach((session: HistorySession) => {
          const d = new Date(session.date || session.createdAt || 0);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const sessionDateStr = `${y}-${m}-${day}`;

          const isSessionMatch =
            session.id && weekSession.sessionIds.includes(String(session.id));
          const isDateMatch = sessionDateStr === weekSession.dateStr;

          if (isSessionMatch || isDateMatch) {
            const records = session.attendances || session.records || [];
            const r = records.find((item: AttendanceItem) => {
              const rId = String(item.studentId || item.student?.id || item.id || "");
              const rCode = String(item.studentCode || item.student?.studentCode || "").trim();
              const rName =
                `${item.firstName || item.student?.firstName || ""} ${item.lastName || item.student?.lastName || ""}`.trim() ||
                item.name ||
                item.student?.name;

              const matchId = studentId && rId && rId === studentId;
              const matchCode = studentCode && rCode && rCode === studentCode;
              const matchName = studentName && rName && rName === studentName;

              return matchId || matchCode || matchName;
            });

            if (r?.status) {
              matchedStatuses.push(r.status);
            }
          }
        });

        if (matchedStatuses.length > 0) {
          const priority: Record<string, number> = {
            มาสาย: 5,   // กำหนดน้ำหนักความสำคัญให้ 'มาสาย' สูงสุด
            มาเรียน: 4,  
            ลา: 3,
            ขาดเรียน: 1,
          };
          matchedStatuses.sort((a, b) => (priority[b] || 0) - (priority[a] || 0));
          recordsMap[weekNum] = matchedStatuses[0];
        } else {
          recordsMap[weekNum] = "ขาดเรียน";
        }
      });

      const recordedStatuses = Object.values(recordsMap);
      const presentCount = recordedStatuses.filter((v) => v === "มาเรียน").length;
      const lateCount = recordedStatuses.filter((v) => v === "มาสาย").length;
      const leaveCount = recordedStatuses.filter((v) => v === "ลา").length;
      const absentCount = recordedStatuses.filter((v) => v === "ขาดเรียน").length;
      const totalRecordedWeeks = standardWeeks.length;
      const percent =
        totalRecordedWeeks > 0
          ? Math.round(((presentCount + lateCount) / totalRecordedWeeks) * 100)
          : 0;

      return {
        id: student.id,
        studentCode: studentCode,
        name: studentName,
        records: recordsMap,
        totalPresent: presentCount,
        totalLate: lateCount,
        totalLeave: leaveCount,
        totalAbsent: absentCount,
        percentage: percent,
      };
    });
  }, [historySessions, courseInfo, dailyReport.data]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f7f4] font-sans text-slate-800">
      {/* 1. ส่วนหน้าจอปกติ (ซ่อนอัตโนมัติเมื่อสั่งพิมพ์) */}
      <div className="print:hidden flex flex-col flex-1">
        {/* Header */}
        <header className="bg-[#0f766e] text-white pt-8 pb-6 px-4 text-center shadow-sm relative">
          <div className="absolute top-6 left-6">
            <Link
              href="/teacher/dashboard"
              className="text-emerald-100 hover:text-white font-bold inline-flex items-center gap-2 text-xs uppercase tracking-wider transition-all"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
            ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
          </h1>
          <p className="text-emerald-100 font-medium text-xs md:text-sm mt-1">
            วิชา:{" "}
            <span className="font-bold text-white">
              {courseInfo?.courseCode || "กำลังโหลด..."}{" "}
            </span>{" "}
            {courseInfo?.courseName ? `${courseInfo.courseName}` : ""}
          </p>
        </header>

        {/* Navigation Tabs Bar */}
        <nav className="bg-[#0d9488] shadow-inner px-4 overflow-x-auto">
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-1 min-w-max">
            <Link
              href={`/teacher/course/${courseId}`}
              className="flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm text-emerald-50 hover:bg-emerald-700/50 hover:text-white rounded-t-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              เช็คชื่อสแกนใบหน้า
            </Link>

            <div className="flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm bg-white text-slate-800 shadow rounded-t-xl">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              รายงานการเข้าเรียน
            </div>

            <Link
              href={`/teacher/course/${courseId}/students`}
              className="flex items-center gap-2 px-5 py-3 font-bold text-xs md:text-sm text-emerald-50 hover:bg-emerald-700/50 hover:text-white rounded-t-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              จัดการรายชื่อนักศึกษา
            </Link>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-slate-200/80 p-1 rounded-xl shadow-inner border border-slate-300/60">
              <button
                type="button"
                onClick={() => setReportMode("daily")}
                className={`px-6 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  reportMode === "daily"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                รายละเอียดรายวัน
              </button>
              <button
                type="button"
                onClick={() => setReportMode("summary")}
                className={`px-6 py-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  reportMode === "summary"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                สถิติรวมทุกสัปดาห์ (15 สัปดาห์)
              </button>
            </div>
          </div>

          {/* 1. โหมดรายงานประจำวัน */}
          {reportMode === "daily" && (
            <div className="animate-in fade-in duration-300 space-y-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-700">
                        เลือกวันที่
                      </label>
                      {selectedTimeSlot && (
                        <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          {getTimeSlotLabel(selectedTimeSlot)}
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setSelectedTimeSlot("");
                        setSelectedSessionType("");
                      }}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      รายวิชา
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`${courseInfo?.courseCode || "กำลังโหลด..."} ${courseInfo?.courseName ? `${courseInfo.courseName}` : ""}`}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold outline-none"
                    />
                  </div>

                  <div>
                    <Link
                      href={`/teacher/course/${courseId}/history?date=${selectedDate}${selectedTimeSlot ? `&timeSlot=${selectedTimeSlot}` : ""}`}
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-sm transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      ประวัติการบันทึก ({dailyRoundsCount} รอบ)
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-100">
                  {[
                    { label: "ทั้งหมด", count: dailyReport.summary?.total || 0, color: "text-slate-600", bg: "bg-slate-50" },
                    { label: "มาเรียน", count: dailyReport.summary?.present || 0, color: "text-emerald-600", bg: "bg-emerald-50/50" },
                    { label: "มาสาย", count: dailyReport.summary?.late || 0, color: "text-amber-600", bg: "bg-amber-50/50" },
                    { label: "ลา", count: dailyReport.summary?.leave || 0, color: "text-blue-600", bg: "bg-blue-50/50" },
                    { label: "ขาดเรียน", count: dailyReport.summary?.absent || 0, color: "text-red-600", bg: "bg-red-50/50" },
                  ].map((stat, i) => (
                    <div key={i} className={`${stat.bg} p-3.5 rounded-xl border border-slate-100 text-center`}>
                      <p className="text-[11px] font-bold text-slate-500 mb-1">{stat.label}</p>
                      <p className={`text-xl font-black ${stat.color}`}>{stat.count}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ตารางรายชื่อประจำวัน */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex gap-2 overflow-x-auto">
                  {["ทั้งหมด", "มาเรียน", "มาสาย", "ลา", "ขาดเรียน"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        filter === f
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200/60"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/60">
                        <th className="p-4 text-xs font-bold text-slate-600 w-14 text-center">ลำดับ</th>
                        <th className="p-4 text-xs font-bold text-slate-600 w-36">เวลาเช็คชื่อ</th>
                        <th className="p-4 text-xs font-bold text-slate-600 w-36">รหัสประจำตัว</th>
                        <th className="p-4 text-xs font-bold text-slate-600">ชื่อ - นามสกุล</th>
                        <th className="p-4 text-xs font-bold text-slate-600 text-center w-28">สถานะ</th>
                        <th className="p-4 text-xs font-bold text-slate-600 text-left">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="p-14 text-center font-bold text-slate-400 animate-pulse">
                            กำลังโหลดข้อมูลประจำวัน...
                          </td>
                        </tr>
                      ) : filteredDailyData.length > 0 ? (
                        filteredDailyData.map((item: AttendanceItem, index: number) => {
                          const timeString = formatTimeString(item.time || item.updatedAt || item.createdAt);
                          const displayName = `${item.firstName || ""} ${item.lastName || ""}`.trim() || item.name || "ไม่ระบุชื่อ";
                          const displayRemark = formatDisplayRemark(item.remark || "");

                          const getStatusBadge = (status: string) => {
                            switch (status) {
                              case "มาเรียน": return "bg-emerald-50 text-emerald-700 border-emerald-200";
                              case "มาสาย": return "bg-amber-50 text-amber-700 border-amber-200";
                              case "ลา": return "bg-blue-50 text-blue-700 border-blue-200";
                              case "ขาดเรียน": return "bg-red-50 text-red-700 border-red-200";
                              default: return "bg-slate-50 text-slate-600 border-slate-200";
                            }
                          };

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="p-4 text-xs font-bold text-slate-400 text-center">{index + 1}</td>
                              <td className="p-4 text-xs font-medium text-slate-600">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="time"
                                    value={timeString}
                                    onChange={(e) =>
                                      handleTimeChange(item.id, item.status, e.target.value, item.remark || "")
                                    }
                                    className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                  />
                                  <span className="text-[11px] text-slate-400">น.</span>
                                </div>
                              </td>
                              <td className="p-4 text-xs font-bold font-mono text-emerald-700">{item.studentCode}</td>
                              <td className="p-4">
                                <div className="text-xs font-bold text-slate-800">{displayName}</div>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`inline-flex items-center justify-center px-3 py-1 rounded-xl text-xs font-bold border ${getStatusBadge(item.status)}`}>
                                  {item.status || "-"}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-between gap-3 w-full">
                                  <div className="flex-1">
                                    {displayRemark ? (
                                      <span className="text-xs font-bold text-slate-700 break-word leading-relaxed">
                                        {displayRemark}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-slate-300 italic">- ไม่มีหมายเหตุ -</span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenStatusModal(item, timeString)}
                                    className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 active:scale-95 rounded-xl border border-transparent hover:border-emerald-200 transition-all cursor-pointer shrink-0"
                                    title="แก้ไขสถานะ / หมายเหตุ"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-16 text-center text-slate-400 font-bold text-xs">
                            ไม่พบข้อมูลการเช็คชื่อสำหรับวันที่เลือก
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. โหมดสรุปภาพรวม 15 สัปดาห์ */}
          {reportMode === "summary" && (
            <div className="animate-in fade-in duration-300">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="p-6 bg-emerald-700 text-white flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-black">ตารางสรุปสถิติภาพรวมทุกสัปดาห์</h2>
                    <p className="text-emerald-100 text-xs mt-0.5">
                      รวมสถิติการเช็คชื่อทั้ง 15 สัปดาห์ตลอดภาคการศึกษา (รวมคาบสอนชดเชย)
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-800 text-white px-3.5 py-1.5 rounded-xl font-bold">
                    ทั้งหมด 15 สัปดาห์
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/60">
                        <th className="p-4 text-xs font-bold text-slate-600 w-16 text-center">สัปดาห์ที่</th>
                        <th className="p-4 text-xs font-bold text-slate-600 w-44">วันที่และช่วงเวลา</th>
                        <th className="p-4 text-xs font-bold text-slate-600 text-center w-20">นศ.</th>
                        <th className="p-4 text-xs font-bold text-slate-600 text-center w-72">สรุปการเข้าเรียน</th>
                        <th className="p-4 text-xs font-bold text-slate-600 text-center w-28">อัตราเข้าเรียน (%)</th>
                        <th className="p-4 text-xs font-bold text-slate-600 text-left">หมายเหตุ / คาบชดเชย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="p-14 text-center font-bold text-slate-400 animate-pulse">
                            กำลังประมวลผลสถิติรายสัปดาห์...
                          </td>
                        </tr>
                      ) : (
                        weeksList.map((week) => (
                          <tr
                            key={week.weekNumber}
                            className={`transition-colors ${week.isChecked ? "hover:bg-emerald-50/30 bg-white" : "hover:bg-slate-50/80 bg-slate-50/20"}`}
                          >
                            <td
                              className="p-4 text-center cursor-pointer"
                              onClick={() => handleSelectWeek(week)}
                              title="คลิกเพื่อดูรายชื่อนักศึกษาในรอบนี้"
                            >
                              <span
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-bold text-xs ${
                                  week.isChecked
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {week.weekNumber}
                              </span>
                            </td>

                            <td
                              className="p-4 text-xs font-bold text-slate-700 cursor-pointer"
                              onClick={() => handleSelectWeek(week)}
                              title="คลิกเพื่อดูรายชื่อนักศึกษาในรอบนี้"
                            >
                              {week.dateStr !== "ยังไม่บันทึก" ? (
                                <div>
                                  <span className="text-emerald-800 font-bold block">
                                    {week.dateStr}{" "}
                                    {week.sessionType === "COMPENSATION" && (
                                      <span className="text-amber-600 text-[10px] ml-1">(ชดเชย)</span>
                                    )}
                                  </span>
                                  {week.timeStr && (
                                    <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                                      {getTimeSlotLabel(week.timeStr)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 font-medium">ยังไม่บันทึก</span>
                              )}
                            </td>

                            <td
                              className="p-4 text-center font-bold font-mono text-emerald-700 text-xs cursor-pointer"
                              onClick={() => handleSelectWeek(week)}
                            >
                              {week.isChecked ? week.totalCount : "-"}
                            </td>

                            <td
                              className="p-4 text-center cursor-pointer"
                              onClick={() => handleSelectWeek(week)}
                            >
                              {week.isChecked ? (
                                <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold">
                                    มา {week.present}
                                  </span>
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-xs font-bold">
                                    สาย {week.late}
                                  </span>
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-bold">
                                    ลา {week.leave}
                                  </span>
                                  <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-lg text-xs font-bold">
                                    ขาด {week.absent}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-center text-slate-300 text-xs font-medium italic whitespace-nowrap">
                                  - ยังไม่มีการเช็คชื่อ -
                                </div>
                              )}
                            </td>

                            <td
                              className="p-4 cursor-pointer"
                              onClick={() => handleSelectWeek(week)}
                            >
                              {week.isChecked ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-xs font-mono font-bold text-emerald-700">
                                    {week.percentage}%
                                  </span>
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full transition-all"
                                      style={{ width: `${week.percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center opacity-30">
                                  <span className="text-xs font-mono font-bold text-slate-400">0%</span>
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1"></div>
                                </div>
                              )}
                            </td>

                            <td className="p-4">
                              <div className="flex items-center justify-between gap-3 w-full">
                                <div className="flex-1">
                                  {week.note ? (
                                    <span className="text-xs font-bold text-slate-700 break-word leading-relaxed">
                                      {week.note}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-300 italic">- ไม่มีหมายเหตุ -</span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingWeekRemark({
                                      weekNumber: week.weekNumber,
                                      date: week.rawDate || selectedDate,
                                      note: week.note || "",
                                    });
                                  }}
                                  className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 active:scale-95 rounded-xl border border-transparent hover:border-emerald-200 transition-all cursor-pointer shrink-0"
                                  title="แก้ไขหมายเหตุ / บันทึกการสอนชดเชย"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ปุ่ม Print */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z" />
              </svg>
              พิมพ์แบบฟอร์ม มทร.กรุงเทพ (PDF)
            </button>
          </div>
        </main>

        <footer className="bg-[#0f766e] text-emerald-100 py-4 px-4 text-center text-xs font-medium md:text-sm">
          © 2026 ระบบตรวจสอบรายชื่อด้วยการรู้จำใบหน้า
          <p className="text-emerald-100 font-medium text-xs md:text-sm">
            สาขาวิชานวัตกรรมระบบสารสนเทศ คณะบริหารธุรกิจ มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
          </p>
        </footer>

        {/* Modal แก้ไขสถานะ */}
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
                    <option value={editingStudent.currentStatus} hidden>{editingStudent.currentStatus}</option>
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
                    placeholder="เช่น ลากิจ, ลาป่วย, มาสาย, เช็คชื่อรอบที่ 2"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1.5">ตัวเลือกด่วน:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {["ลากิจ", "ลาป่วย", "มาสาย", "เช็คชื่อรอบที่ 2", "เช็ครอบเก็บตก", "สอนชดเชย"].map((tag) => (
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
                    disabled={isSubmittingEdit}
                    className="flex-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:bg-slate-300 cursor-pointer"
                  >
                    {isSubmittingEdit ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal แก้ไขหมายเหตุสัปดาห์ */}
        {editingWeekRemark && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl border border-slate-100 animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-black text-slate-800 mb-1">
                บันทึกหมายเหตุ สัปดาห์ที่ {editingWeekRemark.weekNumber}
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                บันทึกช่วยจำหรือระบุวันสอนชดเชย เช่น <i>สอนชดเชย คาบบ่าย 13:00-16:00 น.</i>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ข้อความหมายเหตุ</label>
                  <textarea
                    rows={3}
                    value={editingWeekRemark.note}
                    onChange={(e) => setEditingWeekRemark({ ...editingWeekRemark, note: e.target.value })}
                    placeholder="ระบุข้อความ เช่น สอนชดเชยแทนวันที่ 15 ส.ค., คาบชดเชยบ่าย..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1.5">ตัวเลือกด่วน:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "สอนชดเชย คาบเช้า (09:00-12:00)",
                      "สอนชดเชย คาบบ่าย (13:00-16:00)",
                      "สอนชดเชยเสาร์-อาทิตย์",
                      "คาบเรียนปกติ",
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setEditingWeekRemark({ ...editingWeekRemark, note: tag })}
                        className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg font-bold text-slate-600 transition-all border border-slate-200/60 cursor-pointer"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingWeekRemark(null)}
                    className="flex-1 py-2.5 font-bold text-slate-400 hover:text-slate-600 text-xs rounded-xl bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={isSavingNote}
                    onClick={handleSaveWeekNote}
                    className="flex-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:bg-slate-300 cursor-pointer"
                  >
                    {isSavingNote ? "กำลังบันทึก..." : "บันทึกหมายเหตุ"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal แจ้งเตือน */}
        {alertModal.show && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-80 animate-in fade-in duration-200">
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
              <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">{alertModal.message}</p>

              <button
                type="button"
                onClick={() => setAlertModal({ show: false, title: "", message: "", isSuccess: true })}
                className={`w-28 py-2.5 text-white rounded-xl text-xs md:text-sm font-bold shadow-sm transition-all mx-auto block active:scale-95 cursor-pointer ${
                  alertModal.isSuccess ? "bg-[#16a34a] hover:bg-[#15803d]" : "bg-[#dc2626] hover:bg-[#b91c1c]"
                }`}
              >
                ตกลง
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. แบบฟอร์มพิมพ์เอกสาร มทร.กรุงเทพ */}
      <CourseAttendanceSheetPrintForm
        courseInfo={{
          courseCode: courseInfo?.courseCode || "",
          courseName: courseInfo?.courseName || "",
          courseNameEn: courseInfo?.courseNameEn || "",
          teacherName:
            courseInfo?.teacher?.name ||
            courseInfo?.teacherDisplayName ||
            "อาจารย์ผู้สอน",
          credits: courseInfo?.credits || "3 (3-0-6)",
          section: courseInfo?.section || "1",
          academicYear: "2569",
          semester: "1",
          faculty: "คณะบริหารธุรกิจ",
          department: "สาขาวิชานวัตกรรมระบบสารสนเทศ",
        }}
        students={printStudentsData}
        totalWeeks={15}
      />
    </div>
  );
}