# api.py
# api.py
import os
import gc
import io
import json
import base64
import math
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import numpy as np
import cv2
import face_recognition
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI(title="Face Recognition AI Service - Optimized")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db_connection():
    if not DATABASE_URL:
        return None
    return psycopg2.connect(DATABASE_URL)

def get_students_vectors_by_course(course_id: str):
    conn = get_db_connection()
    if not conn:
        print("DATABASE_URL not set or cannot connect")
        return []
    
    known_students = []
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT s.id, s."studentCode", s."firstName", s."lastName", s."faceVectors"
                FROM "Student" s
                JOIN "_CourseToStudent" cs ON cs."B" = s.id
                WHERE cs."A" = %s AND s."faceVectors" IS NOT NULL
            """
            cur.execute(query, (course_id,))
            rows = cur.fetchall()

            for row in rows:
                raw_vectors = row.get("faceVectors")
                if not raw_vectors:
                    continue
                
                vectors = json.loads(raw_vectors) if isinstance(raw_vectors, str) else raw_vectors
                first_name = (row.get("firstName") or "").strip()
                last_name = (row.get("lastName") or "").strip()
                display_name = f"{first_name} {last_name}".strip() or row.get("studentCode")
                
                for vec in vectors:
                    known_students.append({
                        "name": display_name,
                        "student_code": row.get("studentCode"),
                        "vector": np.array(vec, dtype=np.float64)
                    })
    except Exception as e:
        print(f"Database query error: {e}")
    finally:
        conn.close()

    return known_students

# -------------------------------------------------------------------
# Helper Functions: Image Enhancement, Blur Detection & Alignment
# -------------------------------------------------------------------

def apply_clahe(rgb_img: np.ndarray) -> np.ndarray:
    """ปรับสมดุลแสงและความคมชัดเฉพาะจุดด้วย CLAHE"""
    lab = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    merged = cv2.merge((cl, a, b))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)

def check_blur_and_resolution(face_crop: np.ndarray, min_size: int = 80, blur_thresh: float = 40.0):
    """ตรวจสอบขนาดใบหน้าขั้นต่ำและความคมชัดของภาพด้วย Laplacian Variance"""
    h, w = face_crop.shape[:2]
    if h < min_size or w < min_size:
        return False, f"ขนาดใบหน้าเล็กเกินไป ({w}x{h} px) แนะนำให้อย่างน้อย {min_size}x{min_size} px"

    gray = cv2.cvtColor(face_crop, cv2.COLOR_RGB2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    if variance < blur_thresh:
        return False, f"ภาพใบหน้าเบลอเกินไป (ความคมชัด: {variance:.1f} < {blur_thresh})"

    return True, ""

def align_face(rgb_img: np.ndarray, landmarks: dict) -> np.ndarray:
    """หมุนภาพให้ระนาบดวงตาสองข้างขนานกับแนวระนาบพอดี"""
    left_eye = landmarks.get("left_eye")
    right_eye = landmarks.get("right_eye")
    if not left_eye or not right_eye:
        return rgb_img

    left_center = np.mean(left_eye, axis=0)
    right_center = np.mean(right_eye, axis=0)

    d_y = right_center[1] - left_center[1]
    d_x = right_center[0] - left_center[0]
    angle = math.degrees(math.atan2(d_y, d_x))

    # ปรับหมุนเฉพาะเมื่อเอียงเกิน 3 องศา และไม่เกิน 45 องศา
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
    return {"status": "ok", "service": "Face Recognition API (Optimized)"}

# -------------------------------------------------------------------
# 1. สกัดเวกเตอร์ทีละรูปจาก Webcam (Single Shot Base64)
# -------------------------------------------------------------------
@app.post("/api/extract-vector")
async def extract_vector(payload: ImageBase64Request):
    pil_img = None
    rgb_img = None
    try:
        header, encoded = payload.image.split(",", 1) if "," in payload.image else ("", payload.image)
        image_data = base64.b64decode(encoded)
        pil_img = Image.open(io.BytesIO(image_data)).convert("RGB")
        rgb_img = np.array(pil_img)

        # ปรับเกลี่ยแสงเฉพาะจุด
        enhanced_img = apply_clahe(rgb_img)

        # ค้นหาตำแหน่งใบหน้า (ขยายภาพ 1 ครั้งเพื่อความแม่นยำ)
        face_locations = face_recognition.face_locations(enhanced_img, number_of_times_to_upsample=1, model="hog")
        if not face_locations:
            return {"success": False, "message": "ไม่พบใบหน้าในภาพ"}

        top, right, bottom, left = face_locations[0]
        face_crop = enhanced_img[top:bottom, left:right]

        # ตรวจสอบความคมชัดและขนาดภาพ
        is_ok, reason = check_blur_and_resolution(face_crop, min_size=80, blur_thresh=40.0)
        if not is_ok:
            return {"success": False, "message": reason}

        # หา Landmarks 68 จุดและปรับระนาบดวงตา
        landmarks = face_recognition.face_landmarks(enhanced_img, [face_locations[0]], model="large")
        aligned_img = align_face(enhanced_img, landmarks[0]) if landmarks else enhanced_img

        # สกัดเวกเตอร์คุณภาพสูงด้วย num_jitters=10
        face_encodings = face_recognition.face_encodings(aligned_img, [face_locations[0]], num_jitters=10)
        if not face_encodings:
            return {"success": False, "message": "ไม่สามารถสกัดเวกเตอร์ใบหน้าได้"}

        return {"success": True, "vector": face_encodings[0].tolist()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        del pil_img
        del rgb_img
        gc.collect()

# -------------------------------------------------------------------
# 2. ลงทะเบียนใบหน้าหลายรูป (Multi-Upload)
# -------------------------------------------------------------------
@app.post("/api/register-face-multi")
async def register_face_multi(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="ไม่พบไฟล์รูปภาพ")

    face_vectors = []

    for file in files:
        pil_img = None
        rgb_img = None
        try:
            image_bytes = await file.read()
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            rgb_img = np.array(pil_img)

            # ปรับเกลี่ยแสง
            enhanced_img = apply_clahe(rgb_img)

            face_locations = face_recognition.face_locations(enhanced_img, number_of_times_to_upsample=1, model="hog")
            if not face_locations:
                continue

            top, right, bottom, left = face_locations[0]
            face_crop = enhanced_img[top:bottom, left:right]

            # ตรวจสอบคุณภาพความคมชัดและขนาด
            is_ok, _ = check_blur_and_resolution(face_crop, min_size=80, blur_thresh=35.0)
            if not is_ok:
                continue

            # Align Face
            landmarks = face_recognition.face_landmarks(enhanced_img, [face_locations[0]], model="large")
            aligned_img = align_face(enhanced_img, landmarks[0]) if landmarks else enhanced_img

            # สกัดเวกเตอร์ด้วย num_jitters=10
            encodings = face_recognition.face_encodings(aligned_img, [face_locations[0]], num_jitters=10)
            if encodings:
                face_vectors.append(encodings[0].tolist())

        except Exception as err:
            print(f"Error processing {file.filename}: {err}")
        finally:
            del pil_img
            del rgb_img
            gc.collect()

    if not face_vectors:
        return {"success": False, "message": "ไม่สามารถสกัดเวกเตอร์ใบหน้าได้ กรุณาใช้รูปที่ชัดเจนและไม่เบลอ"}

    return {
        "success": True,
        "message": f"สกัดข้อมูลใบหน้าสำเร็จ {len(face_vectors)} รูป",
        "face_vectors": face_vectors
    }

# -------------------------------------------------------------------
# 3. เช็คชื่อจากภาพถ่ายกลุ่ม (Group Attendance Verification แบบ 1 คน 1 กรอบ)
# -------------------------------------------------------------------
@app.post("/api/check-attendance-group")
async def check_attendance_group(
    file: UploadFile = File(...),
    boxes: str = Form(...),
    course_id: str = Form(...)
):
    pil_img = None
    rgb_img = None
    try:
        image_bytes = await file.read()
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        rgb_img = np.array(pil_img)

        # ปรับเกลี่ยแสงของรูปภาพกลุ่มด้วย CLAHE
        enhanced_img = apply_clahe(rgb_img)

        # ดึงเวกเตอร์นักศึกษาในรายวิชา
        known_students = get_students_vectors_by_course(course_id)
        print(f"DEBUG: พบเวกเตอร์นักศึกษาในรายวิชา {course_id} จำนวน: {len(known_students)} ชุด")

        parsed_boxes = json.loads(boxes)
        face_locations = []
        img_h, img_w = enhanced_img.shape[:2]

        # ขยายกรอบ Bounding Box ออกไป 12% (Padding) เพื่อให้ได้โครงหน้าครบถ้วน
        for b in parsed_boxes:
            x, y, w, h = int(b["x"]), int(b["y"]), int(b["width"]), int(b["height"])
            pad_x = int(w * 0.12)
            pad_y = int(h * 0.12)

            top = max(0, y - pad_y)
            right = min(img_w, x + w + pad_x)
            bottom = min(img_h, y + h + pad_y)
            left = max(0, x - pad_x)

            face_locations.append((top, right, bottom, left))

        tolerance = 0.50
        match_candidates = []

        if len(known_students) > 0:
            known_vectors = [s["vector"] for s in known_students]

            # สกัดเวกเตอร์ภาพกลุ่มโดยใช้ num_jitters=2
            for idx, loc in enumerate(face_locations):
                enc = face_recognition.face_encodings(enhanced_img, known_face_locations=[loc], num_jitters=2)
                
                if not enc:
                    continue

                current_vec = enc[0]
                distances = face_recognition.face_distance(known_vectors, current_vec)
                best_match_idx = int(np.argmin(distances))
                min_dist = distances[best_match_idx]

                print(f"DEBUG: กรอบใบหน้าที่ {idx + 1} ระยะห่างต่ำสุด: {min_dist:.4f} กับ: {known_students[best_match_idx]['name']}")

                if min_dist <= tolerance:
                    match_candidates.append({
                        "distance": float(min_dist),
                        "box_index": idx,
                        "student_name": known_students[best_match_idx]["name"]
                    })

        # จับคู่แบบ 1 คน 1 กรอบ (Best Match Assignment) เรียงจาก Distance ต่ำสุด
        match_candidates.sort(key=lambda x: x["distance"])
        
        final_matches = ["Unknown"] * len(face_locations)
        assigned_students = set()

        for cand in match_candidates:
            b_idx = cand["box_index"]
            s_name = cand["student_name"]

            if s_name not in assigned_students and final_matches[b_idx] == "Unknown":
                final_matches[b_idx] = s_name
                assigned_students.add(s_name)
                print(f"MATCH: มอบชื่อ {s_name} ให้กรอบที่ {b_idx + 1} (Distance: {cand['distance']:.4f})")

        return {
            "success": True,
            "matches": final_matches,
            "total_detected": len(final_matches)
        }

    except Exception as e:
        print(f"Error in check_attendance_group: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        del pil_img
        del rgb_img
        gc.collect()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=False)