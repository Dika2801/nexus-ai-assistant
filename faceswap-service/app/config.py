"""
Konfigurasi microservice NEXUS Face Studio.
Layanan ini murni computer-vision (InsightFace + GFPGAN), TIDAK memakai
OpenAI maupun Gemini — OpenAI tidak menyediakan model face-swap.
"""

import os

# Direktori tempat model InsightFace & GFPGAN disimpan/diunduh otomatis.
MODELS_DIR = os.environ.get("MODELS_DIR", "models")

# Nama model swap InsightFace (diunduh otomatis oleh library insightface).
FACE_SWAP_MODEL = "inswapper_128.onnx"

# Model deteksi wajah InsightFace.
FACE_ANALYSIS_MODEL = "buffalo_l"

# Gunakan GPU jika tersedia (CUDAExecutionProvider). Default false karena
# tier gratis Hugging Face Spaces (CPU basic) tidak punya GPU — set ke
# "true" lewat environment variable jika kamu upgrade ke hardware GPU.
USE_GPU = os.environ.get("USE_GPU", "false").lower() == "true"

# Path model GFPGAN untuk face restoration (diunduh otomatis saat pertama run).
GFPGAN_MODEL_URL = (
    "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth"
)
GFPGAN_MODEL_PATH = os.path.join(MODELS_DIR, "GFPGANv1.4.pth")

# Aktifkan/nonaktifkan watermark kecil pada hasil (disarankan tetap aktif).
ENABLE_WATERMARK = os.environ.get("ENABLE_WATERMARK", "true").lower() == "true"
