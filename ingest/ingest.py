# ingest/ingest.py

import os
from dotenv import load_dotenv

# Import terbaru untuk menghilangkan peringatan (deprecation warnings)
from langchain_community.document_loaders import DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma  # Ganti dari langchain_community.vectorstores
from langchain_huggingface import HuggingFaceEmbeddings  # Ganti dari langchain_community.embeddings

# --- Konfigurasi Jalur (Relatif terhadap root proyek) ---
# Jalur ke folder dokumen (naik satu level ke 'data')
DATA_PATH = "../data" 
# Folder tempat ChromaDB akan menyimpan data
CHROMA_PATH = "../chroma_data" 
# Nama koleksi
COLLECTION_NAME = "docs" 

# Muat variabel lingkungan
load_dotenv()

def ingest_documents():
    """Memuat, membagi, dan menyimpan dokumen dari folder 'data' ke ChromaDB."""
    print(">> Memuat dokumen...")
    
    # Memuat semua file .txt dari folder DATA_PATH
    loader = DirectoryLoader(DATA_PATH, glob="**/*.txt") 
    
    try:
        docs = loader.load()
    except FileNotFoundError:
        print(f"ERROR: Folder dokumen tidak ditemukan di jalur: '{DATA_PATH}'")
        print("Pastikan Anda memiliki folder 'data' di root proyek Anda.")
        return

    if not docs:
        print(f"Peringatan: Tidak ada dokumen ditemukan di folder '{DATA_PATH}'. Pastikan folder tersebut tidak kosong.")
        return

    # 1. Membagi dokumen menjadi chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    texts = text_splitter.split_documents(docs)
    print(f"Memproses {len(texts)} chunks...")

    # 2. Inisialisasi Embeddings (Menggunakan model HuggingFace)
    # Pemeriksaan OPENAI_API_KEY dihapus karena tidak relevan untuk HuggingFaceEmbeddings
    embedder = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    # 3. Membuat dan menyimpan Vector Store
    print(f">> Membuat dan menyimpan Vector Store di ChromaDB ke folder '{CHROMA_PATH}'...")
    Chroma.from_documents(
        texts, 
        embedder, 
        collection_name=COLLECTION_NAME,
        persist_directory=CHROMA_PATH 
    )
    print(f"✅ Vectorstore '{COLLECTION_NAME}' berhasil dibuat dan disimpan secara lokal!")

if __name__ == "__main__":
    ingest_documents()