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
            model="gpt-4.1-mini",
            temperature=0
        )

        self.context_data = self.load_data_from_folder(DATA_FOLDER)

        system_template = (
            "Anda adalah asisten AI yang cerdas dan berpengalaman untuk layanan laundry dan kebersihan pakaian. "
            "Gunakan informasi berikut sebagai referensi untuk menjawab pertanyaan pelanggan:\n\n"
            "{context}\n\n"
            "PENTING:\n"
            "- Berikan jawaban yang ramah, jelas, dan informatif, BUKAN sekadar copy-paste dari dokumen.\n"
            "- Interpretasikan dan jelaskan informasi sesuai dengan pertanyaan spesifik pelanggan.\n"
            "- Gunakan bahasa yang natural dan mudah dipahami.\n"
            "- Jika pelanggan menanyakan tentang harga, waktu, atau layanan spesifik, berikan detail yang relevan saja (tidak semua).\n"
            "- Tambahkan saran atau rekomendasi jika sesuai dengan konteks pertanyaan.\n"
            "Jika pertanyaan tidak relevan dengan laundry, jawab: "
            "'Maaf, saya hanya bisa menjawab pertanyaan yang berhubungan dengan laundry dan kebersihan pakaian.'"
        )

        self.prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template(system_template),
            HumanMessagePromptTemplate.from_template("{question}")
        ])

    def load_data_from_folder(self, folder_path):
        all_texts = []
        # Convert to Path object if string
        if isinstance(folder_path, str):
            folder_path = pathlib.Path(folder_path)
        
        if folder_path.exists() and folder_path.is_dir():
            for filename in os.listdir(folder_path):
                file_path = folder_path / filename
                if filename.endswith(".txt") and file_path.is_file():
                    # Coba berbagai encoding
                    encodings = ['utf-8', 'utf-16', 'utf-16-le', 'utf-16-be', 'latin-1', 'cp1252']
                    content = None
                    
                    for encoding in encodings:
                        try:
                            with open(file_path, "r", encoding=encoding) as f:
                                content = f.read().strip()
                            break  # Berhasil membaca, keluar dari loop
                        except (UnicodeDecodeError, UnicodeError):
                            continue  # Coba encoding berikutnya
                        except Exception as e:
                            print(f"⚠️ Error membaca file {filename} dengan encoding {encoding}: {e}")
                            continue
                    
                    if content:
                        all_texts.append(f"{filename}:\n{content}")
                    else:
                        print(f"⚠️ Tidak dapat membaca file {filename} dengan encoding apapun")
        else:
            print(f"⚠️ Folder tidak ditemukan: {folder_path}")
        
        return "\n\n---\n\n".join(all_texts) if all_texts else "Tidak ada data."

    def generate_answer(self, query: str):
        keywords = ["laundry", "cuci","history", "baju","detergent","jam","telp","wa","link","proses","alamat", "setrika", "kering","jam","layanan","services","service","dry cleaning","wash and fold","wash & fold","paket laundry","promo laundry","diskon laundry","cuci kering","cuci basah","antar jemput laundry","biaya antar jemput laundry","harga antar jemput laundry","estimasi antar jemput laundry","durasi antar jemput laundry","proses antar jemput laundry","status antar jemput laundry","tracking antar jemput laundry","status order antar jemput laundry","kontak","contact","contac","no","wa","tracking order antar jemput laundry","?","link","RnB","rnb","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z",
                     "karpet", "selimut","sprei", "handuk", "pakaian", "jasa laundry","cuci pakaian","cuci karpet", "cuci selimut", "cuci sprei", "cuci handuk","cuci baju","biaya cuci pakaian","harga cuci pakaian","estimasi cuci pakaian","durasi cuci pakaian","proses cuci pakaian","status cuci pakaian","tracking cuci pakaian","status order cuci pakaian","tracking order cuci pakaian","biaya cuci karpet","harga cuci karpet","estimasi cuci karpet","durasi cuci karpet","proses cuci karpet","status cuci karpet","tracking cuci karpet","status order cuci karpet","tracking order cuci karpet","metode pembayaran","cara pembayaran","payment method","payment","bayar","pembayaran","makasih","terimah kasih",
                       "layanan laundry", "harga laundry", "waktu pengerjaan laundry","estimasi laundry","biaya laundry","durasi laundry","proses laundry","status laundry","tracking laundry","status order laundry","tracking order laundry","pengambilan pakaian","pengantaran pakaian","jenis layanan pakaian", "alamat pakaian", "lokasi pakaian", "jam operasional pakaian", "promo pakaian", "diskon pakaian", "paket pakaian","jasa pakaian","layanan laundry", "harga laundry", "waktu pengerjaan laundry","estimasi laundry","biaya laundry","durasi laundry","proses laundry","status laundry","tracking laundry","status order laundry","tracking order laundry",
                       "pengambilan laundry", "pengantaran laundry", "jenis layanan laundry", "alamat laundry", "lokasi laundry", "jam operasional laundry", "promo laundry", "diskon laundry", "paket laundry", "jasa laundry","layanan kebersihan pakaian", "harga kebersihan pakaian", "waktu pengerjaan kebersihan pakaian","estimasi kebersihan pakaian","biaya kebersihan pakaian","durasi kebersihan pakaian","proses kebersihan pakaian","status kebersihan pakaian","tracking kebersihan pakaian","status order kebersihan pakaian","tracking order kebersihan pakaian"]
        if not any(k in query.lower() for k in keywords):
            return {
                "answer": "Maaf, saya hanya bisa menjawab pertanyaan yang berhubungan dengan laundry dan kebersihan pakaian.",
                "sources": []
            }

        # Use the smart RAG/LLM chain for all queries
        # The LLM will generate contextual, intelligent answers based on the provided context
        # rather than just copying raw text from docs
        chain = self.prompt | self.llm
        response = chain.invoke({
            "context": self.context_data,
            "question": query
        })

        return {"answer": response.content, "sources": [f"Data dari folder: {DATA_FOLDER}"]}


# ✅ Tambahkan fungsi ini agar bisa diimport dari app.py
rag_instance = None

def get_generate_answer(query: str):
    global rag_instance
    if rag_instance is None:
        rag_instance = RAGPipeline()
    result = rag_instance.generate_answer(query)
    return result["answer"]
