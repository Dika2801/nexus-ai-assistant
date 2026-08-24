"""Fungsi bantu: watermark hasil, validasi input."""

import cv2
import numpy as np

from config import ENABLE_WATERMARK


def add_watermark(image_bgr, text="AI Generated"):
    """Tambahkan watermark kecil transparan di pojok kanan bawah."""
    if not ENABLE_WATERMARK:
        return image_bgr

    img = image_bgr.copy()
    h, w = img.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.4, w / 1600)
    thickness = 1
    (text_w, text_h), _ = cv2.getTextSize(text, font, font_scale, thickness)

    margin = 12
    x = w - text_w - margin
    y = h - margin

    overlay = img.copy()
    cv2.rectangle(
        overlay,
        (x - 8, y - text_h - 8),
        (w - margin // 2, y + 6),
        (0, 0, 0),
        -1,
    )
    img = cv2.addWeighted(overlay, 0.45, img, 0.55, 0)
    cv2.putText(img, text, (x, y), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)
    return img


def validate_image(image):
    """Pastikan gambar valid (bukan None, punya wajah akan dicek terpisah di swap.py)."""
    if image is None:
        raise ValueError("Gambar tidak valid atau gagal dibaca.")
    if isinstance(image, np.ndarray) and image.size == 0:
        raise ValueError("Gambar kosong.")
    return True


def rgb_to_bgr(image_rgb):
    return cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)


def bgr_to_rgb(image_bgr):
    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
