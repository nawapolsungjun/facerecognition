from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List
import os
import io
import json
import numpy as np
import base64
import gc
import sqlite3
from PIL import Image, ImageOps, ImageEnhance

app = FastAPI(title="Face Attendance API")

# กำหนดสิทธิ์ CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

def get_db_connection():
    # ค้นหาตำแหน่งไฟล์ dev.db ภายในโฟลเดอร์ attendance-web ที่เป็นโปรเจกต์ Next.js จริง
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    possible_paths = [
        os.path.join(base_dir, "..", "attendance-web", "prisma", "dev.db"),
        os.path.join(base_dir, "attendance-web", "prisma", "dev.db"),
        os.path.abspath(os.path.join(base_dir, "..", "..", "attendance-web", "prisma", "dev.db")),
        os.path.join(base_dir, "prisma", "dev.db"),
        os.path.join(base_dir, "dev.db")
    ]
    
    db_path = possible_paths[0]
    for path in possible_paths:
        normalized_path = os.path.normpath(path)
        if os.path.exists(normalized_path) and os.path.getsize(normalized_path) > 0:
            db_path = normalized_path
            break
            
    print(f"-> DEBUG: Python connected to SQLite database at: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

@app.api_route("/", methods=["GET", "HEAD"])
def read_root():
    return {"status": "ok", "message": "Face Recognition API is running (SQLite Mode)"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

def process_image_to_np(contents, return_scale=False):
    img = Image.open(io.BytesIO(contents))
    img = ImageOps.exif_transpose(img)
    img = img.convert('RGB')
    
    orig_w, orig_h = img.size
    img.thumbnail((600, 600), Image.Resampling.LANCZOS)
    new_w, new_h = img.size
    
    img = ImageOps.autocontrast(img, cutoff=0.5)
    img = ImageEnhance.Brightness(img).enhance(1.1)
    img = ImageEnhance.Contrast(img).enhance(1.2)
    img = ImageEnhance.Sharpness(img).enhance(1.5)
    
    if return_scale:
        scale_x = new_w / orig_w if orig_w > 0 else 1.0
        scale_y = new_h / orig_h if orig_h > 0 else 1.0
        return np.array(img), scale_x, scale_y
        
    return np.array(img)

@app.post("/api/register-face-multi")
async def register_face_multi(files: List[UploadFile] = File(...)):
    import face_recognition
    all_vectors = []
    errors = []
    try:
        for index, file in enumerate(files):
            try:
                contents = await file.read()
                if not contents: continue
                image_np = process_image_to_np(contents)
                encodings = face_recognition.face_encodings(image_np)
                if len(encodings) > 0:
                    all_vectors.append(encodings[0].tolist())
                else:
                    errors.append(f"รูปที่ {index + 1}: ไม่พบใบหน้า")
                del contents
                del image_np
                gc.collect()
            except Exception as img_err:
                errors.append(f"รูปที่ {index + 1}: {str(img_err)}")

        if len(all_vectors) > 0:
            return {"success": True, "face_vectors": all_vectors, "vector_count": len(all_vectors), "warnings": errors}
        return JSONResponse(status_code=400, content={"success": False, "error": "ไม่พบใบหน้า", "details": errors})
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@app.post("/api/extract-vector")
async def extract_vector(data: dict):
    import face_recognition
    try:
        header, encoded = data['image'].split(",", 1)
        image_data = base64.b64decode(encoded)
        image_np = process_image_to_np(image_data)
        encodings = face_recognition.face_encodings(image_np)
        del image_data
        del image_np
        gc.collect()

        if len(encodings) > 0:
            return {"success": True, "vector": encodings[0].tolist()}
        return {"success": False, "error": "ไม่พบใบหน้า"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@app.post("/api/check-attendance-group")
async def check_attendance(
    file: UploadFile = File(...), 
    course_id: str = Form(...), 
    boxes: str = Form(...) 
):
    import face_recognition
    conn = None
    try:
        contents = await file.read()
        
        image_np, scale_x, scale_y = process_image_to_np(contents, return_scale=True)
        face_boxes_js = json.loads(boxes)
        
        img_h, img_w, _ = image_np.shape
        face_locations = []

        for box in face_boxes_js:
            scaled_x = box['x'] * scale_x
            scaled_y = box['y'] * scale_y
            scaled_w = box['width'] * scale_x
            scaled_h = box['height'] * scale_y

            top = max(0, int(scaled_y))
            right = min(img_w, int(scaled_x + scaled_w))
            bottom = min(img_h, int(scaled_y + scaled_h))
            left = max(0, int(scaled_x))
            face_locations.append((top, right, bottom, left))

        if not face_locations:
            del contents
            del image_np
            gc.collect()
            return {"success": True, "matches": []}

        current_encodings = face_recognition.face_encodings(image_np, known_face_locations=face_locations)
        del contents
        del image_np
        gc.collect()
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT s.id, s.firstName, s.lastName, s.faceVectors 
            FROM Student s
            JOIN _CourseToStudent cts ON s.id = cts.B
            WHERE cts.A = ? AND s.faceVectors IS NOT NULL
        """
        cursor.execute(query, (str(course_id).strip(),))
        raw_students = cursor.fetchall()
        
        students = []
        for s in raw_students:
            f_name = s['firstName'] or ""
            l_name = s['lastName'] or ""
            full_name = f"{f_name} {l_name}".strip() or "ไม่ระบุชื่อ"
            students.append({
                "id": s['id'],
                "name": full_name,
                "faceVectors": s['faceVectors']
            })

        final_matches = [None] * len(current_encodings)
        match_distances = [1.0] * len(current_encodings)

        for idx, current_vec in enumerate(current_encodings):
            best_student = None
            lowest_dist = 0.55

            for student in students:
                try:
                    data = student['faceVectors']
                    for _ in range(4):
                        if isinstance(data, str):
                            data = json.loads(data)
                        else:
                            break
                        
                    saved_vectors = [np.array(v) for v in data] if isinstance(data, list) else [np.array(data)]
                    distances = face_recognition.face_distance(saved_vectors, current_vec)
                    current_min = float(np.min(distances))

                    if current_min < lowest_dist:
                        lowest_dist = current_min
                        best_student = {"id": student['id'], "name": student['name']}
                except Exception as e:
                    print(f"Compare Error for {student['name']}: {str(e)}")
                    continue
            
            if best_student:
                final_matches[idx] = best_student
                match_distances[idx] = lowest_dist

        used_names = {}
        for idx, student in enumerate(final_matches):
            if student:
                name = student['name']
                dist = match_distances[idx]
                if name in used_names:
                    if dist < used_names[name]['dist']:
                        final_matches[used_names[name]['index']] = None
                        used_names[name] = {"index": idx, "dist": dist}
                    else:
                        final_matches[idx] = None
                else:
                    used_names[name] = {"index": idx, "dist": dist}

        display_names = [m['name'] if m else "Unknown" for m in final_matches]
        
        cursor.close()
        conn.close()
        return {"success": True, "matches": display_names}
        
    except Exception as e:
        print(f"Python Error: {str(e)}")
        if conn: conn.close()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, workers=1)