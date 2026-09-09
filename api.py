# api.py
import os
import io
import json
import base64
import math
import sqlite3
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import numpy as np
import cv2
import face_recognition

app = FastAPI(title="Face Recognition AI Service - Local SQLite Mode")

# -------------------------------------------------------------------
# ตั้งค่า CORS
# -------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------
# ตำแหน่งไฟล์ dev.db ของ Next.js / Prisma
# -------------------------------------------------------------------
SQLITE_DB_PATH = r"C:\Users\SB_PC\Documents\GitHub\facerecognition\attendance-web\prisma\dev.db"

# ตรวจสอบการมีอยู่ของไฟล์ทันทีตอนเริ่มแอป
if os.path.exists(SQLITE_DB_PATH):
    print(f"✅ [DATABASE CONNECTED] พบไฟล์ SQLite: {SQLITE_DB_PATH}")
else:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    alt_path = os.path.normpath(os.path.join(current_dir, "attendance-web", "prisma", "dev.db"))
    if os.path.exists(alt_path):
        SQLITE_DB_PATH = alt_path
        print(f"✅ [DATABASE CONNECTED] พบไฟล์ SQLite สำรอง: {SQLITE_DB_PATH}")
    else:
        print(f"❌ [DATABASE NOT FOUND] ไม่พบไฟล์ที่ {SQLITE_DB_PATH}")

def get_db_connection():
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"[SQLITE ERROR] ไม่สามารถเชื่อมต่อ dev.db ได้: {e}")
        return None

def get_students_vectors_by_course(course_id: str):
    conn = get_db_connection()
    if not conn:
        print("[WARN] SQLite DB connection ไม่พร้อมใช้งาน")
        return []

    known_students = []
    try:
        cur = conn.cursor()
        clean_course_id = str(course_id).strip()

        print(f"\n[SQLITE QUERY] กำลังดึงข้อมูลนักศึกษาสำหรับวิชา ID: {clean_course_id}")

        # 1. Query ตามโครงสร้าง _CourseToStudent ของ Prisma (A = Course.id, B = Student.id)
        query = """
            SELECT s.id, s.studentCode, s.firstName, s.lastName, s.faceVectors
            FROM Student s
            JOIN _CourseToStudent cs ON cs.B = s.id
            WHERE cs.A = ? 
              AND s.faceVectors IS NOT NULL 
              AND s.faceVectors != '' 
              AND s.faceVectors != '[]'
        """
        cur.execute(query, (clean_course_id,))
        rows = cur.fetchall()
        print(f"[DB QUERY] พบนักศึกษาที่ผูกกับวิชา {clean_course_id}: {len(rows)} คน")

        # 2. Fallback อัตโนมัติ: หากไม่มีข้อมูลผูกคอร์ส หรือเป็น 0 ให้ดึงนักศึกษาทั้งหมดที่มีเวกเตอร์มาสแกนเทียบทันที
        if len(rows) == 0:
            print(f"[AUTO FALLBACK] ดึงนักศึกษาทั้งหมดที่มีเวกเตอร์ในระบบมาใช้เทียบ")
            cur.execute("""
                SELECT id, studentCode, firstName, lastName, faceVectors
                FROM Student
                WHERE faceVectors IS NOT NULL 
                  AND faceVectors != '' 
                  AND faceVectors != '[]'
            """)
            rows = cur.fetchall()
            print(f"   -> ดึงจากตาราง Student ทั้งหมดได้: {len(rows)} คน")

        for row in rows:
            raw_vectors = row["faceVectors"]
            if not raw_vectors:
                continue

            try:
                vectors = json.loads(raw_vectors) if isinstance(raw_vectors, str) else raw_vectors
            except Exception:
                continue

            f_name = (row["firstName"] or "").strip()
            l_name = (row["lastName"] or "").strip()
            display_name = f"{f_name} {l_name}".strip() or row["studentCode"]

            if isinstance(vectors, list):
                for vec in vectors:
                    if isinstance(vec, list) and len(vec) > 0:
                        known_students.append({
                            "name": display_name,
                            "student_code": row["studentCode"],
                            "vector": np.array(vec, dtype=np.float64)
                        })

        print(f"[SQLITE READY] รวมชุดเวกเตอร์อ้างอิงที่พร้อมใช้งาน: {len(known_students)} ชุด\n")

    except Exception as e:
        print(f"[SQLITE QUERY ERROR] เกิดข้อผิดพลาดในการอ่านฐานข้อมูล: {e}")
    finally:
        if conn:
            conn.close()

    return known_students

# -------------------------------------------------------------------
# Helper: CLAHE แสง & คมชัด
# -------------------------------------------------------------------
def apply_clahe(rgb_img: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    merged = cv2.merge((cl, a, b))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)

def check_blur_and_resolution(face_crop: np.ndarray, min_size: int = 40, blur_thresh: float = 20.0):
    h, w = face_crop.shape[:2]
    if h < min_size or w < min_size:
        return False, f"ขนาดใบหน้าเล็กเกินไป ({w}x{h} px)"

    gray = cv2.cvtColor(face_crop, cv2.COLOR_RGB2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    if variance < blur_thresh:
        return False, f"ภาพใบหน้าเบลอเกินไป ({variance:.1f})"

    return True, ""

def align_face(rgb_img: np.ndarray, landmarks: dict) -> np.ndarray:
    left_eye = landmarks.get("left_eye")
    right_eye = landmarks.get("right_eye")
    if not left_eye or not right_eye:
        return rgb_img

    left_center = np.mean(left_eye, axis=0)
    right_center = np.mean(right_eye, axis=0)

    d_y = right_center[1] - left_center[1]
    d_x = right_center[0] - left_center[0]
    angle = math.degrees(math.atan2(d_y, d_x))

    if 3.0 < abs(angle) < 45.0:
        center = tuple(np.mean([left_center, right_center], axis=0))
        rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
        h, w = rgb_img.shape[:2]
        return cv2.warpAffine(rgb_img, rot_mat, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)

    return rgb_img

class ImageBase64Request(BaseModel):
    image: str

@app.get("/")
def read_root():
    exists = os.path.exists(SQLITE_DB_PATH)
    total_students = 0
    if exists:
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM Student WHERE faceVectors IS NOT NULL")
            total_students = cur.fetchone()[0]
            conn.close()
        except Exception:
            pass

    return {
        "status": "ready",
        "service": "Face Recognition AI Service (SQLite dev.db Mode)",
        "db_path": SQLITE_DB_PATH,
        "db_exists": exists,
        "students_with_vectors": total_students
    }

@app.post("/api/extract-vector")
async def extract_vector(payload: ImageBase64Request):
    try:
        header, encoded = payload.image.split(",", 1) if "," in payload.image else ("", payload.image)
        image_data = base64.b64decode(encoded)
        pil_img = Image.open(io.BytesIO(image_data)).convert("RGB")
        rgb_img = np.array(pil_img)

        enhanced_img = apply_clahe(rgb_img)
        face_locations = face_recognition.face_locations(enhanced_img, number_of_times_to_upsample=1, model="hog")
        if not face_locations:
            return {"success": False, "message": "ไม่พบใบหน้าในภาพ"}

        top, right, bottom, left = face_locations[0]
        face_crop = enhanced_img[top:bottom, left:right]

        is_ok, reason = check_blur_and_resolution(face_crop, min_size=40, blur_thresh=15.0)
        if not is_ok:
            return {"success": False, "message": reason}

        landmarks = face_recognition.face_landmarks(enhanced_img, [face_locations[0]], model="large")
        aligned_img = align_face(enhanced_img, landmarks[0]) if landmarks else enhanced_img

        face_encodings = face_recognition.face_encodings(aligned_img, [face_locations[0]], num_jitters=3)
        if not face_encodings:
            return {"success": False, "message": "ไม่สามารถสกัดเวกเตอร์ใบหน้าได้"}

        return {"success": True, "vector": face_encodings[0].tolist()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/register-face-multi")
async def register_face_multi(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="ไม่พบไฟล์รูปภาพ")

    face_vectors = []
    for file in files:
        try:
            image_bytes = await file.read()
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            rgb_img = np.array(pil_img)

            enhanced_img = apply_clahe(rgb_img)
            face_locations = face_recognition.face_locations(enhanced_img, number_of_times_to_upsample=1, model="hog")
            if not face_locations:
                continue

            top, right, bottom, left = face_locations[0]
            face_crop = enhanced_img[top:bottom, left:right]

            is_ok, _ = check_blur_and_resolution(face_crop, min_size=35, blur_thresh=15.0)
            if not is_ok:
                continue

            landmarks = face_recognition.face_landmarks(enhanced_img, [face_locations[0]], model="large")
            aligned_img = align_face(enhanced_img, landmarks[0]) if landmarks else enhanced_img

            encodings = face_recognition.face_encodings(aligned_img, [face_locations[0]], num_jitters=3)
            if encodings:
                face_vectors.append(encodings[0].tolist())
        except Exception as err:
            print(f"[REGISTER ERROR] รูป {file.filename}: {err}")

    if not face_vectors:
        return {"success": False, "message": "ไม่สามารถสกัดเวกเตอร์ใบหน้าได้"}

    return {
        "success": True,
        "message": f"สกัดข้อมูลใบหน้าสำเร็จ {len(face_vectors)} รูป",
        "face_vectors": face_vectors
    }

def match_faces_with_known_students(enhanced_img: np.ndarray, parsed_boxes: list, known_students: list, tolerance: float = 0.52):
    img_h, img_w = enhanced_img.shape[:2]
    face_locations = []

    for b in parsed_boxes:
        x, y, w, h = int(b["x"]), int(b["y"]), int(b["width"]), int(b["height"])
        pad_x = int(w * 0.15)
        pad_y = int(h * 0.15)
        top = max(0, y - pad_y)
        right = min(img_w, x + w + pad_x)
        bottom = min(img_h, y + h + pad_y)
        left = max(0, x - pad_x)
        face_locations.append((top, right, bottom, left))

    match_candidates = []
    if len(known_students) > 0 and len(face_locations) > 0:
        known_vectors = [s["vector"] for s in known_students]

        for idx, loc in enumerate(face_locations):
            enc = face_recognition.face_encodings(enhanced_img, known_face_locations=[loc], num_jitters=1)
            if not enc:
                continue

            current_vec = enc[0]
            distances = face_recognition.face_distance(known_vectors, current_vec)
            best_match_idx = int(np.argmin(distances))
            min_dist = distances[best_match_idx]

            matched_name = known_students[best_match_idx]["name"]
            print(f"  [COMPARE] กรอบ {idx + 1}: ระยะห่าง = {min_dist:.4f} กับ [{matched_name}] (เกณฑ์ <= {tolerance})")

            if min_dist <= tolerance:
                match_candidates.append({
                    "distance": float(min_dist),
                    "box_index": idx,
                    "student_name": matched_name
                })

    match_candidates.sort(key=lambda x: x["distance"])
    final_matches = ["Unknown"] * len(face_locations)
    assigned_students = set()

    for cand in match_candidates:
        b_idx = cand["box_index"]
        s_name = cand["student_name"]

        if s_name not in assigned_students and final_matches[b_idx] == "Unknown":
            final_matches[b_idx] = s_name
            assigned_students.add(s_name)
            print(f"  ✅ [MATCH CONFIRMED] '{s_name}' แมตช์กับกรอบที่ {b_idx + 1} (dist={cand['distance']:.4f})")

    return final_matches

@app.post("/api/check-attendance-group-batch")
async def check_attendance_group_batch(
    files: List[UploadFile] = File(...),
    boxes_list: str = Form(...),
    course_id: str = Form(...)
):
    try:
        known_students = get_students_vectors_by_course(course_id)
        all_boxes = json.loads(boxes_list)
        results = []

        for idx, file in enumerate(files):
            image_bytes = await file.read()
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            rgb_img = np.array(pil_img)

            enhanced_img = apply_clahe(rgb_img)
            current_boxes = all_boxes[idx] if idx < len(all_boxes) else []
            matches = match_faces_with_known_students(enhanced_img, current_boxes, known_students, tolerance=0.58)

            results.append({
                "file_name": file.filename,
                "matches": matches,
                "total_detected": len(matches)
            })

        return {"success": True, "results": results}

    except Exception as e:
        print(f"[ERROR check_attendance_group_batch]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/check-attendance-group")
async def check_attendance_group(
    file: UploadFile = File(...),
    boxes: str = Form(...),
    course_id: str = Form(...)
):
    try:
        image_bytes = await file.read()
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        rgb_img = np.array(pil_img)
        enhanced_img = apply_clahe(rgb_img)

        known_students = get_students_vectors_by_course(course_id)
        parsed_boxes = json.loads(boxes)
        matches = match_faces_with_known_students(enhanced_img, parsed_boxes, known_students, tolerance=0.58)

        return {"success": True, "matches": matches, "total_detected": len(matches)}
    except Exception as e:
        print(f"[ERROR check_attendance_group]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"🚀 AI Server รันโหมด SQLite ที่ http://localhost:{port}")
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=True)