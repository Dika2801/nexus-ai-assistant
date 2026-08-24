---
title: NEXUS AI Assistant
emoji: ⚡
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: AI Assistant bertenaga OpenAI GPT-5.6 & DALL-E 3
---

# ⚡ NEXUS AI Assistant (OpenAI GPT-5.6 Flagship)

NEXUS AI adalah aplikasi asisten kecerdasan buatan mutakhir bertenaga arsitektur OpenAI GPT-5.6 dengan fitur lengkap setara ChatGPT:
- **Keluarga Model NEXUS 5.6**: NEXUS 5.6 Sol (Frontier Reasoning), NEXUS 5.6 Terra (Multimodal Workload), NEXUS 5.6 Luna (Ultra Fast), NEXUS 4.5 Omni (Vision & Documents), dan NEXUS Reasoning Pro[...]
- **Format Tabel Markdown Rapi**: Render tabel otomatis rapi dan presisi tinggi setara ChatGPT dengan visual modern.
- **Canvas Document & Code Workspace**: Editor split-screen interaktif untuk coding & penulisan naskah.
- **DALL-E 3 Studio**: Pembuatan & editing gambar resolusi tinggi dengan berbagai preset gaya seni dan rasio aspek.
- **Live Voice Mode & TTS Natural**: Sintesis suara alami pria bertenaga OpenAI TTS-1 (`onyx`/`echo`) dan pengenalan suara Web Speech.
- **Web Search Grounding**: Penelusuran web langsung dengan tautan sumber terverifikasi.
- **Panel Admin & Telemetri**: Monitoring error, kuota token, manajemen pengguna, dan penyesuaian model default.

---

## 🚀 Panduan Deploy Gratis di Hugging Face Spaces (Tanpa Bayar Server)

Aplikasi ini 100% siap di-deploy langsung ke **Hugging Face Spaces** gratis:

### Langkah 1: Buat Space Baru di Hugging Face
1. Buka [Hugging Face Spaces](https://huggingface.co/spaces) dan login/daftar akun gratis.
2. Klik tombol **Create new Space**.
3. Isi kolom:
   - **Space name**: `nexus-ai` (atau nama pilihan Anda)
   - **License**: `mit`
   - **Space SDK**: Pilih **Docker** (Blank template)
   - **Space hardware**: Pilih **CPU Basic (Free - 2 vCPU, 16GB RAM)**

### Langkah 2: Unggah Source Code
Anda dapat menggunakan Git atau tombol Upload Files di Hugging Face:
```bash
# Inisialisasi Git di repositori lokal jika belum
git remote add space https://huggingface.co/spaces/USERNAME_ANDA/nexus-ai
git push --force space main
```
*Atau unggah seluruh file project (termasuk `Dockerfile`, `package.json`, `server.ts`, `src/`) melalui tab Files di Hugging Face Space.*

### Langkah 3: Tambahkan Secrets API Key
1. Pada halaman Space Anda, buka tab **Settings** > **Variables and secrets**.
2. Di bagian **New secret**, tambahkan:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-proj-xxxxxxxxxxxxxxxxxxxx` (API Key OpenAI Anda)
3. *(Opsional)* Jika ingin menambahkan Gemini sebagai backup fallback:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: `AIzaxxxxxxxxxxxxxxxxxxxx`

### Langkah 4: Selesai & Jalankan!
Hugging Face Spaces akan secara otomatis membangun (*building container*) dan menjalankan server pada port `7860`. Aplikasi Anda langsung aktif dan dapat diakses publik 24/7 tanpa biaya server!

---

## 📱 Membungkus Menjadi APK Android (Capacitor / PWA)
Aplikasi ini dioptimalkan untuk perangkat mobile dengan tampilan responsif, touch targets 44px, dan tata letak single-view adaptif. Anda dapat membungkusnya menggunakan Capacitor:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "NEXUS AI" "com.nexus.ai"
npm run build
npx cap add android
npx cap sync
npx cap open android
```
Buka di Android Studio dan klik **Build APK / Bundle**.

---

## 🛠️ Lisensi
Didistribusikan di bawah lisensi MIT.
