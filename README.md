# AI DRAMA STUDIO — Client-only BYOK

Versi HTML, CSS, JavaScript. Mendukung pilihan satu provider aktif: OpenAI, Google Gemini, atau Kie.ai.

## Fitur
- Dashboard responsif
- Generator brief drama dan storyboard
- Pilih satu provider AI pada satu waktu
- API Key dienkripsi lokal dengan AES-GCM + PBKDF2
- Key dibuka ke memori sesi hanya setelah pengguna memasukkan passphrase
- Simpan proyek lokal, salin, unduh TXT
- PWA manifest dan service worker untuk instalasi browser yang mendukung

## Menjalankan
Untuk pengembangan lokal, gunakan server statis (contoh VS Code Live Server) atau:
`python -m http.server 8080`
Kemudian buka `http://localhost:8080`.

PWA/service worker membutuhkan localhost atau HTTPS. Jangan membuka index.html langsung melalui file:// untuk menguji fitur PWA.

## Konfigurasi API
Buka menu AI & API Key:
1. Pilih satu provider.
2. Isi model ID yang tersedia di akun.
3. Tempel API Key.
4. Buat passphrase lokal minimal 10 karakter.
5. Tekan Enkripsi & simpan di perangkat.
6. Setelah reload, masukkan passphrase dan tekan Buka brankas.

Model ID dapat berubah; gunakan dokumentasi/model market provider.

## Provider endpoints
- OpenAI: `POST https://api.openai.com/v1/responses`
- Gemini: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Kie.ai chat via OpenAI Responses protocol: `POST https://api.kie.ai/openai/v1/responses`

Kie documents the OpenAI Responses-compatible base URL for Codex/chat model use. Kie image/video/audio models use their own model-specific task APIs and are not implemented in this text-generation MVP.

## Keamanan — baca sebelum distribusi
Ini adalah implementasi client-only BYOK sesuai permintaan. API key tidak dikirim ke server milik pembuat aplikasi, tetapi dikirim langsung ke provider AI saat request dibuat.

Penting:
- OpenAI dan Kie.ai memperingatkan agar API keys tidak diekspos dalam browser/mobile client. Distribusi aplikasi client-side tidak dapat menjamin key rahasia dari pemilik perangkat, browser devtools, malware, atau ekstensi.
- Enkripsi browser melindungi data tersimpan saat tidak dibuka, bukan dari kode berbahaya yang berjalan dalam origin yang sama saat vault terbuka.
- Passphrase tidak disimpan. Jika hilang, key terenkripsi tidak dapat dipulihkan.
- LocalStorage proyek bisa dihapus oleh pengguna/browser. Backup TXT hasil penting.
- Browser dapat memblokir request lintas-origin karena CORS. Jika terjadi, frontend murni tidak bisa mengatasi CORS sendiri. Solusi teknis memerlukan proxy/backend yang dikendalikan pemilik key atau provider yang mengizinkan origin tersebut.
- Jangan menyajikan aplikasi dari domain yang tidak dipercaya. Gunakan HTTPS dan lindungi domain dari XSS/skrip pihak ketiga.
- PWA bukan native APK. Untuk APK, bungkus web app dengan Capacitor/TWA setelah web app stabil; wrapper APK tidak membuat API key menjadi rahasia.

## Batasan MVP
- Generator teks brief drama tersedia.
- Kie image/video/music/voice generation belum terintegrasi. Model media Kie memakai task API asynchronous khusus per model.
- Tidak ada login, cloud sync, billing, user accounts, atau server.
- Export PDF/DOCX belum tersedia; TXT sudah tersedia.

## Dokumentasi
- OpenAI API: https://developers.openai.com/api/docs
- Gemini API: https://ai.google.dev/gemini-api/docs
- Kie.ai: https://docs.kie.ai/
