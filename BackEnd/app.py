from datetime import datetime
import json
import os
from pathlib import Path
import uuid
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from rag_pipeline import RAGPipeline

app = FastAPI()

# === CORS ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "db.json"
DEFAULT_DB = {"orders": [], "complaints": []}

ALLOWED_ORDER_STATUSES = [
    "Menunggu Diproses",
    "Diproses",
    "Dikeringkan",
    "Disetrika",
    "Selesai",
    "Diantar",
    "Selesai & diterima",
]

# === Inisiasi RAG sekali saja ===
rag = RAGPipeline()

# Harga layanan
PRICE_MAP = {
    'reguler_lipat': 5000,
    'reguler_setrika': 7000,
    'express_lipat': 9000,
    'express_setrika': 13000,
    'kilat_lipat': 13000,
    'kilat_setrika': 18000,
    'bedcover_reguler_kecil': 30000,
    'bedcover_reguler_besar': 40000,
    'bedcover_express': 55000,
    'sprei_reguler': 12000,
    'sprei_express': 18000,
    'sprei_kilat': 25000,
    'baby_laundry': 20000,
    'baby_stroller': 150000,
}

# ================= HELPERS =================
def ensure_db_file():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not DB_PATH.exists():
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_DB, f, indent=2)

def load_db():
    ensure_db_file()
    with open(DB_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Migrasi dari format lama
    if isinstance(data, list):
        data = {"orders": data}
    for key in DEFAULT_DB.keys():
        data.setdefault(key, [])
    return data

def save_db(data):
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def generate_id(prefix: str) -> str:
    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    suffix = uuid.uuid4().hex[:4].upper()
    return f"{prefix}-{stamp}-{suffix}"

# ================= SCHEMAS =================
class OrderStatusUpdate(BaseModel):
    status: str

# ================= ORDERS =================
@app.post("/order")
async def create_order(request: Request):
    try:
        body = await request.json()
        data = load_db()
        # Validasi minimal
        if not body.get("nama"):
            raise HTTPException(status_code=400, detail="Nama pelanggan wajib diisi")
        if not body.get("layanan"):
            raise HTTPException(status_code=400, detail="Layanan wajib dipilih")
        if not body.get("metodePembayaran"):
            raise HTTPException(status_code=400, detail="Metode pembayaran wajib dipilih")

        order_id = body.get("id") or generate_id("ORD")
        timestamp = datetime.utcnow().isoformat()
        layanan_val = body.get("layanan", "")
        berat_val = float(body.get("berat", 0) or 0)
        jumlah_val = float(body.get("jumlah", berat_val) or berat_val)
        total_val = float(body.get("total", 0) or 0)

        if not total_val or total_val <= 0:
            price = PRICE_MAP.get(layanan_val)
            if price:
                total_val = price * (jumlah_val or 1)

        va_number = body.get("vaNumber")
        bank_name = body.get("bankName")
        metode = body.get("metodePembayaran", "")
        if metode == 'va' and (not va_number or va_number in [None, '', 'null', 'undefined']):
            short = str(uuid.uuid4()).replace('-', '')[:8]
            va_number = f"VA{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{short}"
            if not bank_name:
                bank_name = None

        order_record = {
            "id": order_id,
            "userName": body.get("nama", ""),
            "layanan": layanan_val,
            "jumlah": float(jumlah_val),
            "berat": float(berat_val),
            "alamat": body.get("alamat", ""),
            "catatan": body.get("catatan", ""),
            "metodePembayaran": metode,
            "statusPembayaran": body.get("statusPembayaran", ""),
            "status": "Menunggu Diproses",
            "tracking_step": "Menunggu Diproses",
            "phone": body.get("phone", ""),
            "total": float(total_val),
            "tanggal": timestamp,
            "waktu": timestamp,
            "vaNumber": va_number,
            "bankName": bank_name,
        }
        data["orders"].append(order_record)
        save_db(data)
        return {"success": True, "order": order_record, "message": f"Pesanan {order_id} berhasil dibuat."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/orders")
async def list_orders():
    data = load_db()
    return data["orders"]

@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    data = load_db()
    order = next((o for o in data["orders"] if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    return order

@app.patch("/orders/{order_id}")
async def update_order_status(order_id: str, payload: OrderStatusUpdate):
    if payload.status not in ALLOWED_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Status tidak valid")
    data = load_db()
    order = next((o for o in data["orders"] if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    order["status"] = payload.status
    order["tracking_step"] = payload.status
    if payload.status == "Selesai":
        order["selesaiPada"] = datetime.utcnow().isoformat()
    save_db(data)
    return {"success": True, "order": order}

# ================= CHATBOT =================
@app.post("/chat")
async def chat(req: Request):
    body = await req.json()
    user_query = body.get("message", "")
    if not user_query:
        return {"reply": "Mohon tuliskan pertanyaan Anda."}
    try:
        response = rag.generate_answer(user_query)
        return {"reply": response["answer"]}
    except Exception as e:
        print("❌ Error RAG:", e)
        return {"reply": "Terjadi kesalahan saat memproses pertanyaan Anda."}

# ================= COMPLAINTS =================
@app.post("/complaints/create")
async def create_complaint(
    orderId: str = Form(...),
    kategori: str = Form(...),
    deskripsi: str = Form(...),
    rating: Optional[int] = Form(None),
    foto: Optional[UploadFile] = File(None)
):
    data = load_db()
    order = next((o for o in data["orders"] if o["id"] == orderId), None)
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    ticket_id = generate_id("TKT")
    foto_filename = ""
    if foto and foto.filename:
        uploads_dir = BASE_DIR / "uploads"
        uploads_dir.mkdir(exist_ok=True)
        file_ext = Path(foto.filename).suffix
        unique_filename = f"{ticket_id}{file_ext}"
        file_path = uploads_dir / unique_filename
        contents = await foto.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        foto_filename = unique_filename
    complaint = {
        "ticketId": ticket_id,
        "orderId": orderId,
        "kategori": kategori,
        "deskripsi": deskripsi,
        "foto": foto_filename,
        "rating": rating,
        "tanggal": datetime.utcnow().isoformat(),
        "status": "Menunggu",
        "balasanAdmin": "",
    }
    data["complaints"].append(complaint)
    save_db(data)
    return {"success": True, "ticketId": ticket_id, "complaint": complaint}

@app.get("/complaints")
async def list_complaints():
    data = load_db()
    return data.get("complaints", [])

@app.patch("/complaints/{ticket_id}")
async def reply_complaint(ticket_id: str, payload: dict):
    data = load_db()
    complaint = next((c for c in data["complaints"] if c["ticketId"] == ticket_id), None)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint tidak ditemukan")
    if "balasanAdmin" in payload:
        complaint["balasanAdmin"] = payload["balasanAdmin"]
    if "status" in payload:
        complaint["status"] = payload["status"]
    save_db(data)
    return {"success": True, "complaint": complaint}

# ====================== DELETE ORDERS ======================
@app.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    data = load_db()
    order_index = next((i for i, o in enumerate(data["orders"]) if o["id"] == order_id), None)
    if order_index is None:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    deleted_order = data["orders"].pop(order_index)
    save_db(data)
    return {"success": True, "deleted_order": deleted_order}

# ====================== DELETE COMPLAINTS ======================
@app.delete("/complaints/{ticket_id}")
async def delete_complaint(ticket_id: str):
    data = load_db()
    complaint_index = next((i for i, c in enumerate(data["complaints"]) if c["ticketId"] == ticket_id), None)
    if complaint_index is None:
        raise HTTPException(status_code=404, detail="Complaint tidak ditemukan")
    deleted_complaint = data["complaints"].pop(complaint_index)
    save_db(data)
    return {"success": True, "deleted_complaint": deleted_complaint}


# ================= STATIC FILES =================
uploads_dir = BASE_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


