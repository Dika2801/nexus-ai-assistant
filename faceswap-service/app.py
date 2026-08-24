"""
NEXUS Face Studio — Microservice Face Swap (REST API).
Dipanggil oleh backend NEXUS AI (server.ts) lewat endpoint /api/tools/face-swap.

Jalankan lokal: python app.py
Endpoint: POST /api/face-swap
Body JSON: { sourceImageBase64, targetImageBase64, enhanceStrength? }
Response: { success, imageUrl } atau { success: false, error }
"""

import base64
import io

import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image

from swap import swap_face
from restore import restore_face
from utils import validate_image, add_watermark

app = Flask(__name__)
CORS(app)  # Backend NEXUS AI memanggil dari domain berbeda


def decode_base64_image(b64_string: str) -> np.ndarray:
    """Ubah data URL/base64 menjadi array gambar BGR (OpenCV)."""
    if ',' in b64_string:
        b64_string = b64_string.split(',', 1)[1]
    img_bytes = base64.b64decode(b64_string)
    pil_img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    rgb_array = np.array(pil_img)
    return cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)


def encode_image_to_data_url(image_bgr: np.ndarray) -> str:
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    buffer = io.BytesIO()
    pil_img.save(buffer, format='PNG')
    b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f'data:image/png;base64,{b64}'


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'NEXUS Face Studio'})


@app.route('/api/face-swap', methods=['POST'])
def face_swap_endpoint():
    try:
        data = request.get_json(force=True)
        source_b64 = data.get('sourceImageBase64')
        target_b64 = data.get('targetImageBase64')
        enhance_strength = float(data.get('enhanceStrength', 0.6))

        if not source_b64 or not target_b64:
            return jsonify({'success': False, 'error': 'Foto sumber dan foto target wajib disertakan.'}), 400

        source_bgr = decode_base64_image(source_b64)
        target_bgr = decode_base64_image(target_b64)

        validate_image(source_bgr)
        validate_image(target_bgr)

        swapped_bgr = swap_face(source_bgr, target_bgr)
        restored_bgr = restore_face(swapped_bgr, enhance_strength=enhance_strength)
        final_bgr = add_watermark(restored_bgr)

        image_url = encode_image_to_data_url(final_bgr)
        return jsonify({'success': True, 'imageUrl': image_url})

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        print(f'[Face Swap Service] Error: {e}')
        return jsonify({'success': False, 'error': 'Terjadi kesalahan saat memproses gambar di server face-swap.'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7860)
