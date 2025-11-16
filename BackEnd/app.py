from datetime import datetime
import json
import os
from pathlib import Path
import uuid
from typing import Optional, Union, Any, Dict

import bcrypt
from fastapi import FastAPI, Request, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

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
DEFAULT_DB = {"users": [], "orders": [], "complaints": []}
DEFAULT_ADMIN = {
    "nama": "Admin Laundry",
    "email": "admin@laundry.com",
    "password": "Admin123!",
    "phone": "0800000000",
    "alamat": "Laundry HQ",
}
ALLOWED_ORDER_STATUSES = [
    "Menunggu Diproses",
    "Diproses",
    "Dikeringkan",
    "Disetrika",
    "Selesai",
    "Diantar",
    "Selesai & diterima",
]
ALLOWED_COMPLAINT_STATUSES = ["Menunggu", "Diproses", "Selesai"]


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
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


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
        data = {"users": [], "orders": data, "complaints": []}

    changed = False

    for key in DEFAULT_DB.keys():
        data.setdefault(key, [])

    # Seed default admin if missing
    if not any(u.get("role") == "admin" for u in data["users"]):
        admin_user = {
            "id": generate_id("USR"),
            "nama": DEFAULT_ADMIN["nama"],
            "email": DEFAULT_ADMIN["email"],
            "phone": DEFAULT_ADMIN["phone"],
            "alamat": DEFAULT_ADMIN["alamat"],
            "role": "admin",
            "password": hash_password(DEFAULT_ADMIN["password"]),
            "avatar": "",
            "created_at": datetime.utcnow().isoformat(),
        }
        data["users"].append(admin_user)
        changed = True

    if changed:
        save_db(data)

    return data


def save_db(data):
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def generate_id(prefix: str) -> str:
    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    suffix = uuid.uuid4().hex[:4].upper()
    return f"{prefix}-{stamp}-{suffix}"


# ====================== SCHEMAS ======================
class RegisterRequest(BaseModel):
    nama: str
    email: EmailStr
    phone: Optional[str] = ""
    password: str
    alamat: Optional[str] = ""
    role: str = "user"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdateRequest(BaseModel):
    id: str
    nama: str
    email: EmailStr
    phone: Optional[str] = ""
    alamat: Optional[str] = ""


class OrderCreateRequest(BaseModel):
    userId: Optional[str] = None
    nama: str
    layanan: str
    jumlah: float
    alamat: str
    catatan: Optional[str] = ""
    metodePembayaran: str
    statusPembayaran: str
    total: float
    id: Optional[str] = None
    vaNumber: Optional[str] = None
    bankName: Optional[str] = None
    phone: Optional[str] = ""

    model_config = {
        "populate_by_name": True,
    }
        
    @model_validator(mode='before')
    @classmethod
    def validate_user_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Ensure userId is None if not provided or if null
            if 'userId' not in data or data.get('userId') is None:
                data['userId'] = None
        return data


class OrderStatusUpdate(BaseModel):
    status: str


class ComplaintCreateRequest(BaseModel):
    order_id: str = Field(..., alias="orderId")
    user_id: Optional[str] = Field(None, alias="userId")
    kategori: str
    deskripsi: str
    foto: Optional[str] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    is_review: Optional[bool] = False  # True untuk review positif, False untuk complaint

    class Config:
        populate_by_name = True


class ComplaintUpdateRequest(BaseModel):
    status: Optional[str] = None
    balasanAdmin: Optional[str] = None


# ====================== AUTH ======================
@app.post("/auth/register")
async def register_user(payload: RegisterRequest):
    data = load_db()
    if any(u["email"].lower() == payload.email.lower() for u in data["users"]):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")

    user = {
        "id": generate_id("USR"),
        "nama": payload.nama,
        "email": payload.email.lower(),
        "phone": payload.phone or "",
        "alamat": payload.alamat or "",
        "role": payload.role if payload.role in ["user", "admin"] else "user",
        "password": hash_password(payload.password),
        "avatar": "",
        "created_at": datetime.utcnow().isoformat(),
    }
    data["users"].append(user)
    save_db(data)

    user_copy = user.copy()
    user_copy.pop("password")
    return {"success": True, "user": user_copy}


@app.post("/auth/login")
async def login_user(payload: LoginRequest):
    data = load_db()
    user = next((u for u in data["users"] if u["email"].lower() == payload.email.lower()), None)
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")

    user_copy = user.copy()
    user_copy.pop("password", None)
    return {"success": True, "user": user_copy}


@app.post("/auth/update-profile")
async def update_profile(payload: ProfileUpdateRequest):
    data = load_db()
    user = next((u for u in data["users"] if u["id"] == payload.id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    user.update(
        {
            "nama": payload.nama,
            "email": payload.email.lower(),
            "phone": payload.phone or "",
            "alamat": payload.alamat or "",
        }
    )
    save_db(data)

    user_copy = user.copy()
    user_copy.pop("password", None)
    return {"success": True, "user": user_copy}


# ====================== ORDERS ======================
@app.api_route("/order", methods=["POST"], response_model=None)
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
        
        # Extract userId - can be None, null, empty string, or missing
        # userId is completely optional - never required
        user_id = body.get("userId")
        if user_id is None or user_id == "" or user_id == "null" or user_id == "undefined" or "userId" not in body:
            user_id = None
        else:
            # Validate user if userId is provided and is a valid string
            if isinstance(user_id, str) and user_id.strip():
                user = next((u for u in data["users"] if u["id"] == user_id), None)
                if not user:
                    raise HTTPException(status_code=404, detail="User tidak ditemukan")
            else:
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
            "userId": user_id,
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


# ====================== COMPLAINTS ======================
@app.post("/complaints/create")
async def create_complaint(payload: ComplaintCreateRequest):
    data = load_db()
    # Cari order by ID, bisa dengan atau tanpa userId (untuk guest orders)
    if payload.user_id:
        order = next((o for o in data["orders"] if o["id"] == payload.order_id and o.get("userId") == payload.user_id), None)
    else:
        order = next((o for o in data["orders"] if o["id"] == payload.order_id), None)
    
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")

    # Bisa review/complaint jika status sudah "Selesai" atau "Selesai & diterima"
    if order.get("status") not in ["Selesai", "Selesai & diterima"]:
        raise HTTPException(status_code=400, detail="Review/keluhan hanya bisa dibuat untuk pesanan yang sudah selesai")

    ticket_id = generate_id("TKT")
    complaint = {
        "ticketId": ticket_id,
        "orderId": payload.order_id,
        "userId": payload.user_id,
        "kategori": payload.kategori,
        "deskripsi": payload.deskripsi,
        "foto": payload.foto or "",
        "rating": payload.rating,
        "isReview": payload.is_review or False,
        "tanggal": datetime.utcnow().isoformat(),
        "status": "Menunggu" if not payload.is_review else "Selesai",
        "balasanAdmin": "",
    }
    data["complaints"].append(complaint)
    save_db(data)
    return {"success": True, "complaint": complaint}


@app.get("/complaints")
async def list_complaints(userId: Optional[str] = None):
    data = load_db()
    complaints = data["complaints"]
    if userId:
        complaints = [c for c in complaints if c.get("userId") == userId]
    return complaints


@app.get("/complaints/user/{user_id}")
async def list_user_complaints(user_id: str):
    return await list_complaints(userId=user_id)


@app.get("/orders/tracking/{order_id}")
async def track_order(order_id: str):
    """Endpoint untuk tracking pesanan (bisa diakses tanpa login untuk guest orders)"""
    data = load_db()
    order = next((o for o in data["orders"] if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    
    # Return minimal info untuk tracking
    return {
        "id": order["id"],
        "status": order.get("status", "Menunggu Diproses"),
        "tracking_step": order.get("tracking_step", "Menunggu Diproses"),
        "tanggal": order.get("tanggal"),
        "layanan": order.get("layanan"),
    }


@app.patch("/complaints/{ticket_id}")
async def update_complaint(ticket_id: str, payload: ComplaintUpdateRequest):
    data = load_db()
    complaint = next((c for c in data["complaints"] if c["ticketId"] == ticket_id), None)
    if not complaint:
        raise HTTPException(status_code=404, detail="Keluhan tidak ditemukan")

    if payload.status:
        if payload.status not in ALLOWED_COMPLAINT_STATUSES:
            raise HTTPException(status_code=400, detail="Status keluhan tidak valid")
        complaint["status"] = payload.status

    if payload.balasanAdmin is not None:
        complaint["balasanAdmin"] = payload.balasanAdmin

    save_db(data)
    return {"success": True, "complaint": complaint}


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
