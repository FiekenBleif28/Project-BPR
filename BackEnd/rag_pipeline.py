import os
import pathlib
from langchain_openai import ChatOpenAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate

# Path ke folder docs di root project (parent directory dari BackEnd)
BASE_DIR = pathlib.Path(__file__).parent.parent
DATA_FOLDER = BASE_DIR / "docs"


class RAGPipeline:
    def __init__(self):
        # Pastikan API Key tersedia
        if not os.getenv("OPENAI_API_KEY"):
            raise Exception("ERROR: OPENAI_API_KEY belum diatur!")

        # Model embeddings dan LLM
        self.embed = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        self.llm = ChatOpenAI(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            model="gpt-4o-mini",
            temperature=0
        )

        # Muat seluruh data dari folder docs
        self.context_data = self.load_data_from_folder(DATA_FOLDER)

        # Template prompt untuk memastikan jawaban informatif dan relevan
        system_template = (
            "Anda adalah asisten AI yang cerdas dan berpengalaman untuk layanan laundry dan kebersihan pakaian. "
            "Gunakan informasi berikut sebagai referensi untuk menjawab pertanyaan pelanggan:\n\n"
            "{context}\n\n"
            "PENTING:\n"
            "- Berikan jawaban yang ramah, jelas, dan informatif, bukan copy-paste dokumen.\n"
            "- Sesuaikan jawaban dengan pertanyaan spesifik pelanggan.\n"
            "- Berikan detail hanya jika diminta (harga, durasi, layanan).\n"
            "- Tambahkan saran jika diperlukan.\n"
            "Jika pertanyaan tidak relevan dengan laundry, jawab: "
            "'Maaf, saya hanya bisa menjawab pertanyaan yang berhubungan dengan laundry dan kebersihan pakaian.'"
        )

        self.prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template(system_template),
            HumanMessagePromptTemplate.from_template("{question}")
        ])

    def load_data_from_folder(self, folder_path):
        """Membaca seluruh file teks dalam folder docs dan menggabungkannya sebagai konteks RAG."""
        all_texts = []

        if isinstance(folder_path, str):
            folder_path = pathlib.Path(folder_path)

        if folder_path.exists() and folder_path.is_dir():
            for filename in os.listdir(folder_path):
                file_path = folder_path / filename

                if filename.endswith(".txt") and file_path.is_file():
                    encodings = ['utf-8', 'utf-16', 'utf-16-le', 'utf-16-be', 'latin-1', 'cp1252']
                    content = None

                    for encoding in encodings:
                        try:
                            with open(file_path, "r", encoding=encoding) as f:
                                content = f.read().strip()
                            break
                        except Exception:
                            continue

                    if content:
                        all_texts.append(f"{filename}:\n{content}")
                    else:
                        print(f"⚠️ Tidak dapat membaca file: {filename}")

        return "\n\n---\n\n".join(all_texts) if all_texts else "Tidak ada data."

    def generate_answer(self, query: str):
        """
        Menjawab pertanyaan user. Bila pertanyaan tidak relevan dengan laundry,
        balas menggunakan aturan pembatasan domain.
        """
        keywords = [
            "laundry", "cuci", "baju", "karpet", "selimut", "sprei", "handuk", "dry cleaning",
            "wash and fold", "layanan", "paket", "harga", "estimasi", "durasi", "proses",
            "status", "tracking", "pengambilan", "pengantaran", "alamat", "lokasi",
            "bayar", "pembayaran", "va", "promo", "diskon"
        ]

        if not any(k in query.lower() for k in keywords):
            return {
                "answer": "Maaf, saya hanya bisa menjawab pertanyaan yang berhubungan dengan laundry dan kebersihan pakaian.",
                "sources": []
            }

        chain = self.prompt | self.llm
        response = chain.invoke({
            "context": self.context_data,
            "question": query
        })

        return {"answer": response.content, "sources": [f"Data dari folder: {DATA_FOLDER}"]}


# 🔥 Interface agar bisa dipakai dari `app.py`
rag_instance = None

def get_generate_answer(query: str):
    """Dipanggil dari route /chat di app.py"""
    global rag_instance
    if rag_instance is None:
        rag_instance = RAGPipeline()
    result = rag_instance.generate_answer(query)
    return result["answer"]
