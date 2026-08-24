---
title: NEXUS Face Studio
emoji: 🎭
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# NEXUS Face Studio (Face Swap Microservice)

Microservice Python terpisah yang menjalankan fitur **Face Swap** untuk NEXUS AI Assistant.

Dipisah dari backend utama (`server.ts`, Node.js/Express) karena face-swap butuh model computer vision (**InsightFace + GFPGAN**) yang tidak tersedia lewat OpenAI API — OpenAI tidak menyediakan model face-swap (identity transfer), jadi fitur ini sengaja **tidak** memakai OpenAI maupun Gemini, melainkan model open-source gratis.

## Alur Integrasi

```
NEXUS AI Frontend (Face Swap tab)
        ↓
NEXUS AI Backend (server.ts) — /api/tools/face-swap
        ↓  (proxy, forward base64 images)
NEXUS Face Studio (microservice ini) — /api/face-swap
        ↓
InsightFace (deteksi + swap) → GFPGAN (restorasi/haluskan)
        ↓
Hasil gambar (data URL base64) dikembalikan ke backend → frontend
```

## Endpoint

`POST /api/face-swap`

Body:
```json
{
  "sourceImageBase64": "data:image/jpeg;base64,...",
  "targetImageBase64": "data:image/jpeg;base64,...",
  "enhanceStrength": 0.6
}
```

Response sukses:
```json
{ "success": true, "imageUrl": "data:image/png;base64,..." }
```

Response gagal:
```json
{ "success": false, "error": "Wajah tidak terdeteksi pada foto sumber." }
```

## Deploy ke Hugging Face Spaces (Gratis)

1. Buat Space baru: https://huggingface.co/new-space — pilih **SDK: Docker**, Visibility: Public atau Private (disarankan Private karena hanya dipanggil backend, bukan untuk publik langsung).
2. Push folder `faceswap-service/` ini sebagai isi repo Space (README.md di root sudah berisi metadata Docker yang dibutuhkan).
3. Space akan build otomatis dari `Dockerfile` dan berjalan di port 7860.
4. Setelah live, catat URL Space-nya, misalnya: `https://username-nexus-face-studio.hf.space`
5. Di backend NEXUS AI (Space/server utama), set secret:
   ```
   FACE_SWAP_SERVICE_URL=https://username-nexus-face-studio.hf.space
   ```
6. Restart backend — tab **Face Swap** di NEXUS AI akan langsung berfungsi.

## Jalankan Lokal

```bash
cd faceswap-service
pip install -r requirements.txt
python app/app.py
```

Server berjalan di `http://localhost:7860`. Model InsightFace (`inswapper_128.onnx`) dan GFPGAN (`GFPGANv1.4.pth`) diunduh otomatis saat pertama kali dijalankan (~850MB total, sekali saja).

## Catatan

- Hardware **CPU basic gratis** di Hugging Face Spaces cukup untuk demo, tapi proses bisa memakan waktu 30-90 detik per swap. Upgrade ke GPU (T4 small, berbayar) untuk hasil jauh lebih cepat.
- Endpoint ini tidak menyimpan foto secara permanen — semua diproses in-memory lalu dibuang.
- Setiap hasil otomatis diberi watermark kecil "AI Generated" (lihat `app/utils.py`) — jangan dihapus jika didistribusikan ke publik.
