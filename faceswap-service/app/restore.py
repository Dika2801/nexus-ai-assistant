"""
Modul face restoration menggunakan GFPGAN.
Tujuannya menghaluskan & mempertajam hasil face-swap agar terlihat lebih natural
(mengurangi blur, artifact, dan blending yang kurang mulus).
"""

import os
import urllib.request
import cv2
from gfpgan import GFPGANer

from config import GFPGAN_MODEL_PATH, GFPGAN_MODEL_URL, MODELS_DIR, USE_GPU

_restorer = None


def _ensure_model_downloaded():
    os.makedirs(MODELS_DIR, exist_ok=True)
    if not os.path.exists(GFPGAN_MODEL_PATH):
        print("Mengunduh model GFPGAN (sekali saja, ~350MB)...")
        urllib.request.urlretrieve(GFPGAN_MODEL_URL, GFPGAN_MODEL_PATH)


def load_restorer():
    global _restorer
    if _restorer is None:
        _ensure_model_downloaded()
        _restorer = GFPGANer(
            model_path=GFPGAN_MODEL_PATH,
            upscale=1,
            arch="clean",
            channel_multiplier=2,
            bg_upsampler=None,
        )
    return _restorer


def restore_face(image_bgr, enhance_strength=0.6):
    """
    Menghaluskan wajah pada hasil swap.

    Args:
        image_bgr: np.ndarray (BGR) — hasil face swap mentah.
        enhance_strength: float 0-1 — seberapa besar blending hasil enhance
            dicampur dengan gambar asli (1 = full enhance, 0 = tanpa enhance).

    Returns:
        np.ndarray (BGR) hasil yang sudah dihaluskan.
    """
    restorer = load_restorer()
    _, _, restored_img = restorer.enhance(
        image_bgr,
        has_aligned=False,
        only_center_face=False,
        paste_back=True,
    )

    if restored_img is None:
        return image_bgr

    if enhance_strength >= 1.0:
        return restored_img

    blended = cv2.addWeighted(
        restored_img, enhance_strength, image_bgr, 1 - enhance_strength, 0
    )
    return blended
