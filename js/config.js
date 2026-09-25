/* ==========================================================================
 * SIM ASRAMA v6.1 — KONFIGURASI
 * --------------------------------------------------------------------------
 * HANYA FILE INI yang perlu Anda ubah setelah backend Apps Script di-deploy.
 * ========================================================================== */

var CONFIG = {

  /* 1) URL Web App Apps Script — harus berakhiran /exec
   *    Dapatkan dari: Apps Script → Deploy → New deployment → Web app
   *    (Execute as: Me · Who has access: Anyone)                         */
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxBwKD5Xd__10qwlr09kC7RDdGeGstIAumt8fnI4KlU6x1PxhR43fmw6QSJJDfGGn2X/exec',

  /* 2) API Key — tampil di Execution log saat Anda menjalankan setup()
   *    Contoh: 'ASR-7F3A9C21B4E85D06A1C3F972'                            */
  API_KEY: 'ASR-DABC76585EA746A19531A783',

  /* 3) Google OAuth 2.0 Client ID — untuk tombol "Masuk dengan Google" (staf)
   *    Buat di: console.cloud.google.com → APIs & Services → Credentials →
   *    Create credentials → OAuth client ID → Web application
   *    Authorized JavaScript origins: https://USERNAME.github.io
   *    Contoh: '1234567890-abcdefg.apps.googleusercontent.com'
   *    Boleh dikosongkan bila sudah diisi di menu Pengaturan Sistem
   *    (GOOGLE_CLIENT_ID) — aplikasi akan mengambilnya dari server.          */
  GOOGLE_CLIENT_ID: '474065808371-8kkkbq3nkl70bg6o6cof6a3amp5uobrj.apps.googleusercontent.com',

  /* 4) Identitas tampilan (boleh diubah sesuai institusi)                */
  NAMA_INSTITUSI: 'STIS AL WAFA BOGOR',
  NAMA_APLIKASI : 'SIM ASRAMA v6.1',

  /* 5) Perilaku aplikasi                                                 */
  DEBOUNCE_MS      : 350,   // jeda pencarian (PRD §14)
  CACHE_TTL_MS     : 120000,// umur cache data di browser (2 menit)
  SCAN_COOLDOWN_MS : 2500,  // jeda scanner QR sebelum membaca kartu berikutnya
  IMPORT_MAX_MB    : 5,     // batas ukuran file .xlsx impor
  BULK_CARD_BATCH  : 10     // jumlah kartu QR per batch saat ekspor ZIP
};
