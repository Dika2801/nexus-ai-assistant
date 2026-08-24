"""
Modul deteksi wajah & face swap menggunakan InsightFace (buffalo_l + inswapper_128).
Model diunduh otomatis oleh library insightface pada pemanggilan pertama.
"""

import os
import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis

from config import MODELS_DIR, FACE_ANALYSIS_MODEL, USE_GPU

_face_analyser = None
_face_swapper = None


def _get_providers():
    if USE_GPU:
        return ["CUDAExecutionProvider", "CPUExecutionProvider"]
    return ["CPUExecutionProvider"]


def load_models():
    """Lazy-load model sekali saja, dipanggil otomatis saat dibutuhkan."""
    global _face_analyser, _face_swapper

    os.makedirs(MODELS_DIR, exist_ok=True)

    if _face_analyser is None:
        _face_analyser = FaceAnalysis(
            name=FACE_ANALYSIS_MODEL,
            root=MODELS_DIR,
            providers=_get_providers(),
        )
        _face_analyser.prepare(ctx_id=0, det_size=(640, 640))

    if _face_swapper is None:
        model_path = insightface.model_zoo.get_model(
            "inswapper_128.onnx",
            root=MODELS_DIR,
            download=True,
            download_zip=True,
        )
        _face_swapper = model_path

    return _face_analyser, _face_swapper


def detect_largest_face(image_bgr):
    """Deteksi wajah terbesar (paling dominan) pada gambar. Return None jika tidak ada wajah."""
    analyser, _ = load_models()
    faces = analyser.get(image_bgr)
    if not faces:
        return None
    # Pilih wajah dengan bounding box terbesar (paling dekat ke kamera)
    faces.sort(key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
    return faces[0]


def swap_face(source_image_bgr, target_image_bgr):
    """
    Menempelkan wajah dari source_image ke target_image.

    Args:
        source_image_bgr: np.ndarray (BGR) — foto wajah yang ingin dipakai.
        target_image_bgr: np.ndarray (BGR) — foto tempat wajah akan diganti.

    Returns:
        np.ndarray (BGR) hasil swap, atau raises ValueError jika wajah tidak terdeteksi.
    """
    analyser, swapper = load_models()

    source_face = detect_largest_face(source_image_bgr)
    if source_face is None:
        raise ValueError("Wajah tidak terdeteksi pada foto sumber. Gunakan foto dengan wajah jelas dan menghadap depan.")

    target_faces = analyser.get(target_image_bgr)
    if not target_faces:
        raise ValueError("Wajah tidak terdeteksi pada foto target. Gunakan foto dengan wajah jelas dan menghadap depan.")

    result = target_image_bgr.copy()
    # Swap semua wajah yang terdeteksi di foto target dengan wajah sumber
    for target_face in target_faces:
        result = swapper.get(result, target_face, source_face, paste_back=True)

    return result
