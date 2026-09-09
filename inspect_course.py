import sqlite3

db_path = r"C:\Users\SB_PC\Documents\GitHub\facerecognition\attendance-web\prisma\dev.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

course_id = 'cmtq1wbui000wv08ci2onjy67'

print("=== 1. ตรวจสอบตาราง Course ===")
cur.execute("SELECT id, courseName, courseCode FROM Course WHERE id = ?", (course_id,))
print("ผลลัพธ์ Course:", cur.fetchall())

print("\n=== 2. ตรวจสอบตารางเชื่อม _CourseToStudent ===")
cur.execute("SELECT sql FROM sqlite_master WHERE name = '_CourseToStudent'")
print("โครงสร้างตาราง:", cur.fetchone())

cur.execute("SELECT A, B FROM _CourseToStudent WHERE A = ? OR B = ?", (course_id, course_id))
links = cur.fetchall()
print(f"พบการเชื่อมโยงกับวิชา {course_id} ทั้งหมด: {len(links)} รายการ")
print("ข้อมูลที่เชื่อม (A, B):", links)

print("\n=== 3. ตรวจสอบ Student ที่ผูกกับ ID ข้างต้น ===")
if links:
    student_ids = [r[1] if str(r[0]) == course_id else r[0] for r in links]
    placeholders = ','.join('?' * len(student_ids))
    cur.execute(f"SELECT id, studentCode, firstName, lastName, (faceVectors IS NOT NULL AND faceVectors != '') FROM Student WHERE id IN ({placeholders})", student_ids)
    for s in cur.fetchall():
        print(f" - ID: {s[0]} | รหัส: {s[1]} | ชื่อ: {s[2]} {s[3]} | มีเวกเตอร์หรือไม่: {bool(s[4])}")
else:
    print("⚠️ ไม่พบข้อมูลผูกวิชาในตารางนี้เลย")

conn.close()