from datetime import datetime
import json
import os
from pathlib import Path
import uuid
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag_pipeline import RAGPipeline

app = FastAPI()

# === FIX CORS ===
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


# --- INISIASI RAG SEKALI SAJA ---
rag = RAGPipeline()

# Harga layanan (untuk menghitung total jika tidak dikirim oleh client)
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


# ====================== HELPERS ======================
def ensure_db_file():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not DB_PATH.exists():
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_DB, f, indent=2)


def load_db():
    ensure_db_file()
    with open(DB_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Migrasi dari format lama (list)
    if isinstance(data, list):
        data = {"orders": data,}

    changed = False

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

# ====================== SCHEMAS ======================
class OrderCreateRequest(BaseModel):
    nama: str
    layanan: str
    jumlah: float
    alamat: str
    catatan: Optional[str] = ""
    metodePembayaran: str
    statusPembayaran: str
    total: float
    vaNumber: Optional[str] = None
    bankName: Optional[str] = None
    phone: Optional[str] = ""

    model_config = {
        "populate_by_name": True,
    }


class OrderStatusUpdate(BaseModel):
    status: str


class ComplaintCreateRequest(BaseModel):
    orderId: str
    kategori: str
    deskripsi: str
    rating: Optional[int] = None


# ====================== ORDERS ======================
@app.post("/order")
async def create_order(request: Request):
    """
    Create order endpoint - accepts any JSON body without strict validation
    userId is optional and can be null/None/missing
    """
    try:
        # Parse JSON manually - completely bypass Pydantic validation
        body_bytes = await request.body()
        body = json.loads(body_bytes.decode('utf-8'))
        
        print(f"📦 Received order request: {json.dumps(body, indent=2)}")
        
        data = load_db()
        
        # No authentication system: treat all orders as guest orders
        user_id = None
        
        # Validate required fields
        if not body.get("nama"):
            raise HTTPException(status_code=400, detail="Nama pelanggan wajib diisi")
        if not body.get("layanan"):
            raise HTTPException(status_code=400, detail="Layanan wajib dipilih")
        if not body.get("metodePembayaran"):
            raise HTTPException(status_code=400, detail="Metode pembayaran wajib dipilih")
        
        # Create order record
        order_id = body.get("id") or generate_id("ORD")
        timestamp = datetime.utcnow().isoformat()

        # Normalize numeric inputs
        layanan_val = body.get("layanan", "")
        berat_val = 0.0
        try:
            berat_val = float(body.get("berat", 0) or 0)
        except Exception:
            berat_val = 0.0
        jumlah_val = 0.0
        try:
            # if client supplied jumlah use it, otherwise fall back to berat
            jumlah_val = float(body.get("jumlah", berat_val) or berat_val)
        except Exception:
            jumlah_val = berat_val

        # Determine total: use provided total if valid, otherwise compute from PRICE_MAP
        total_val = 0.0
        try:
            total_val = float(body.get("total", 0) or 0)
        except Exception:
            total_val = 0.0

        if not total_val or total_val <= 0:
            price = PRICE_MAP.get(layanan_val)
            if price:
                # Prefer berat when >0 for per-kg services
                if berat_val and berat_val > 0:
                    total_val = price * berat_val
                else:
                    total_val = price * (jumlah_val or 1)

        # If VA payment and no vaNumber provided, generate one
        va_number = body.get("vaNumber")
        bank_name = body.get("bankName")
        metode = body.get("metodePembayaran", "")
        if metode == 'va' and (not va_number or va_number in [None, '', 'null', 'undefined']):
            # simple VA generation: prefix + timestamp + short uuid
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
        
        print(f"✅ Order created successfully: {order_id}")
        print(f"📁 Data saved to: {DB_PATH}")
        print(f"📊 Total orders in db.json: {len(data['orders'])}")

        return {"success": True, "order": order_record, "message": f"Pesanan {order_id} berhasil dibuat."}
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating order: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/orders")
async def list_orders(userId: Optional[str] = None):
    data = load_db()
    orders = data["orders"]
    if userId:
        orders = [o for o in orders if o.get("userId") == userId]
    return orders


@app.get("/orders/user/{user_id}")
async def list_orders_by_user(user_id: str):
    return await list_orders(userId=user_id)


@app.get("/orders/{order_id}")
async def get_order_by_id(order_id: str):
    data = load_db()
    order = next((o for o in data["orders"] if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    return order


@app.patch("/orders/{order_id}/status")
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


# ====================== CHATBOT ======================
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
        print("❌ Error pada RAG:", e)
        return {"reply": "Terjadi kesalahan saat memproses pertanyaan Anda."}


@app.post("/complaints/create")
async def create_complaint(
    orderId: str = Form(...),
    kategori: str = Form(...),
    deskripsi: str = Form(...),
    rating: Optional[int] = Form(None),
    foto: Optional[UploadFile] = File(None)
):
    data = load_db()
    # find order by id
    order = next((o for o in data["orders"] if o["id"] == orderId), None)
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")

    ticket_id = generate_id("TKT")
    
    # Handle file upload
    foto_filename = ""
    if foto and foto.filename:
        try:
            # Create uploads directory if doesn't exist
            uploads_dir = BASE_DIR / "uploads"
            uploads_dir.mkdir(exist_ok=True)
            
            # Save file with unique name
            file_ext = Path(foto.filename).suffix
            unique_filename = f"{ticket_id}{file_ext}"
            file_path = uploads_dir / unique_filename
            
            contents = await foto.read()
            with open(file_path, "wb") as f:
                f.write(contents)
            
            foto_filename = unique_filename
        except Exception as e:
            print(f"❌ Error saving file: {e}")
            # Continue even if file upload fails
    
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
