/* ==========================================================================
 * SIM ASRAMA v6.1 — LAPISAN API & UTILITAS
 * --------------------------------------------------------------------------
 * • callApi()  : satu pintu ke backend GAS (fetch POST, text/plain)
 * • Cache      : window.APP.cache — hasil baca disimpan sementara di browser
 * • Optimistic : optimistic() — UI berubah 0 ms, rollback otomatis bila gagal
 * • Util       : format rupiah/tanggal, QR code, PDF kartu, ekspor .xlsx
 * • v6.1       : sesi persisten (localStorage), pustaka berat dimuat saat
 *                dibutuhkan (lazy), kompres gambar + thumbnail di browser,
 *                pemanasan (warm-up) server GAS saat halaman dibuka
 * ========================================================================== */

var APP = {
  token: null,
  user: null,
  ref: null,
  cache: {},
  pengaturan: {}
};

/* -------------------------------------------------------------------------
 * 1. PEMANGGILAN API
 * ---------------------------------------------------------------------- */

/**
 * @param {string} action  nama route, mis. 'residents.list'
 * @param {object} payload data yang dikirim
 * @param {object} opt     { diam:true } → tidak menampilkan notifikasi error
 * @returns {Promise<{ok:boolean,data:*,error:string}>}
 */
async function callApi(action, payload, opt) {
  opt = opt || {};
  var body = {
    action: action,
    apiKey: CONFIG.API_KEY,
    token: APP.token || '',
    payload: payload || {}
  };
  var ctrl = window.AbortController ? new AbortController() : null;
  var batas = ctrl ? setTimeout(function () { ctrl.abort(); }, opt.timeout || 90000) : null;
  try {
    var res = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      // WAJIB text/plain — application/json memicu CORS preflight yang diblokir GAS
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    });
    if (batas) clearTimeout(batas);
    var teks = await res.text();
    var out;
    try {
      out = JSON.parse(teks);
    } catch (e) {
      throw new Error('Balasan server bukan JSON. Pastikan deployment memakai akses "Anyone" dan URL berakhiran /exec.');
    }
    if (!out.ok) {
      if (out.code === 401 && APP.token) { sesiBerakhir(); return out; }
      if (!opt.diam) toast(out.error || 'Permintaan gagal.', 'error');
    }
    return out;
  } catch (e) {
    if (batas) clearTimeout(batas);
    var pesan = e.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : e.message;
    if (!opt.diam) toast('Koneksi gagal: ' + pesan, 'error');
    return { ok: false, error: pesan };
  }
}

/**
 * Pemanasan server — GAS "tidur" bila lama tidak dipakai (cold start 1–3 detik).
 * Ping GET ringan dikirim saat halaman dibuka, sehingga ketika pengguna selesai
 * klik "Masuk dengan Google", server sudah hangat. Tidak memicu CORS preflight.
 */
function pemanasanServer() {
  try {
    if (String(CONFIG.GAS_URL).indexOf('GANTI_DENGAN') > -1) return;
    fetch(CONFIG.GAS_URL + '?action=ping&_=' + Date.now(), { method: 'GET', redirect: 'follow' }).catch(function () {});
  } catch (e) {}
}

/**
 * Stale-while-revalidate: tampilkan data terakhir dari localStorage SEKETIKA,
 * lalu segarkan dari server di latar belakang dan panggil cb lagi bila berubah.
 */
function callSWR(action, payload, cb) {
  var kunci = 'asr_swr_' + (APP.user ? APP.user.UserID : '') + '_' + action + ':' + JSON.stringify(payload || {});
  var lama = null;
  try { lama = JSON.parse(localStorage.getItem(kunci) || 'null'); } catch (e) {}
  if (lama) cb(lama, true);
  return callApi(action, payload, { diam: !!lama }).then(function (res) {
    if (res.ok) {
      try { localStorage.setItem(kunci, JSON.stringify(res)); } catch (e) {}
      if (!lama || JSON.stringify(lama.data) !== JSON.stringify(res.data)) cb(res, false);
    } else if (!lama) cb(res, false);
    return res;
  });
}

/** Pembacaan dengan cache browser (gas-instant-ux prinsip 2 — hindari RTT berulang) */
async function callCached(action, payload, ttl) {
  var kunci = action + ':' + JSON.stringify(payload || {});
  var simpan = APP.cache[kunci];
  var umur = ttl === undefined ? CONFIG.CACHE_TTL_MS : ttl;
  if (simpan && Date.now() - simpan.t < umur) return simpan.v;
  var res = await callApi(action, payload);
  if (res.ok) APP.cache[kunci] = { t: Date.now(), v: res };
  return res;
}

function bersihkanCache(prefix) {
  Object.keys(APP.cache).forEach(function (k) {
    if (!prefix || k.indexOf(prefix) === 0) delete APP.cache[k];
  });
}

/**
 * Optimistic UI (PRD §14 — respons ≤23 ms).
 * @param {Function} terapkan  ubah state lokal SEKARANG, kembalikan fungsi rollback
 * @param {string}   action    route server
 * @param {object}   payload
 */
async function optimistic(terapkan, action, payload, pesanSukses) {
  var rollback = terapkan();
  var res = await callApi(action, payload, { diam: true });
  if (!res.ok) {
    if (typeof rollback === 'function') rollback();
    toast(res.error || 'Perubahan dibatalkan — server menolak.', 'error');
  } else {
    bersihkanCache();
    if (pesanSukses !== false) toast(res.message || pesanSukses || 'Tersimpan.', 'success');
  }
  return res;
}

function sesiBerakhir() {
  hapusSesi();
  if (window.__app && window.__app.keluarPaksa) window.__app.keluarPaksa();
}

/**
 * Sesi disimpan di localStorage (bukan sessionStorage) → membuka ulang aplikasi
 * langsung masuk ke dashboard tanpa login ulang selama sesi server (12 jam,
 * diperpanjang otomatis tiap request) masih berlaku.
 */
function simpanSesi(token, user) {
  APP.token = token; APP.user = user;
  try { localStorage.setItem('asr_sesi', JSON.stringify({ token: token, user: user, t: Date.now() })); } catch (e) {}
}

function muatSesi() {
  try {
    var s = JSON.parse(localStorage.getItem('asr_sesi') || 'null');
    if (s && s.token && s.user) { APP.token = s.token; APP.user = s.user; return true; }
  } catch (e) {}
  return false;
}

function hapusSesi() {
  APP.token = null; APP.user = null; APP.cache = {};
  try {
    localStorage.removeItem('asr_sesi');
    Object.keys(localStorage).forEach(function (k) { if (k.indexOf('asr_swr_') === 0) localStorage.removeItem(k); });
    sessionStorage.clear();
  } catch (e) {}
}

function simpanPengaturanLokal(p) {
  APP.pengaturan = p || {};
  if (window.__app) window.__app.pengVer++;
  try { localStorage.setItem('asr_pengaturan', JSON.stringify(APP.pengaturan)); } catch (e) {}
}

function muatPengaturanLokal() {
  try { APP.pengaturan = JSON.parse(localStorage.getItem('asr_pengaturan') || '{}') || {}; } catch (e) { APP.pengaturan = {}; }
  if (window.__app) window.__app.pengVer++;
  return APP.pengaturan;
}

/* -------------------------------------------------------------------------
 * 1b. PUSTAKA BERAT DIMUAT SAAT DIBUTUHKAN (lazy) — halaman login jadi ringan
 * ---------------------------------------------------------------------- */
var PUSTAKA = {
  chart: { url: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js', cek: function () { return window.Chart; } },
  xlsx:  { url: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', cek: function () { return window.XLSX; } },
  jspdf: { url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', cek: function () { return window.jspdf; } },
  jszip: { url: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', cek: function () { return window.JSZip; } },
  zxing: { url: 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', cek: function () { return window.ZXing; } },
  gsi:   { url: 'https://accounts.google.com/gsi/client', cek: function () { return window.google && window.google.accounts && window.google.accounts.id; } }
};
var _janjiPustaka = {};

function pustaka(nama) {
  var def = PUSTAKA[nama];
  if (!def) return Promise.reject(new Error('Pustaka tidak dikenal: ' + nama));
  if (def.cek()) return Promise.resolve(true);
  if (_janjiPustaka[nama]) return _janjiPustaka[nama];
  _janjiPustaka[nama] = new Promise(function (resolve, reject) {
    var el = document.createElement('script');
    el.src = def.url; el.async = true;
    el.onload = function () { resolve(true); };
    el.onerror = function () { delete _janjiPustaka[nama]; reject(new Error('Gagal memuat pustaka ' + nama + '. Periksa koneksi.')); };
    document.head.appendChild(el);
  });
  return _janjiPustaka[nama];
}

/** Muat pustaka di waktu senggang browser (setelah dashboard tampil) */
function pramuatPustaka(daftar) {
  var jalan = function () { daftar.forEach(function (n) { pustaka(n).catch(function () {}); }); };
  if (window.requestIdleCallback) requestIdleCallback(jalan, { timeout: 4000 }); else setTimeout(jalan, 1500);
}

/* -------------------------------------------------------------------------
 * 1c. NOMOR HP & DETEKSI WHATSAPP
 * ---------------------------------------------------------------------- */
function normalHp(v) {
  var s = String(v === null || v === undefined ? '' : v).replace(/\.0+$/, '').replace(/[^0-9+]/g, '').replace(/^\+/, '');
  if (!s) return '';
  if (s.indexOf('62') === 0) s = '0' + s.substring(2);
  else if (s.indexOf('8') === 0) s = '0' + s;
  return s;
}

/**
 * Cek daftar nomor terdaftar di WhatsApp — dipecah per 50 nomor per panggilan.
 * @returns {Promise<Object>} peta { '0812…': 'Terdaftar' | 'Tidak Terdaftar' | '' }
 */
async function deteksiNomorWA(daftar, onProgress) {
  var unik = [];
  daftar.map(normalHp).forEach(function (n) { if (/^08\d{8,12}$/.test(n) && unik.indexOf(n) === -1) unik.push(n); });
  var peta = {}, total = 0, terdaftar = 0;
  for (var i = 0; i < unik.length; i += 50) {
    var res = await callApi('wa.validate', { nomor: unik.slice(i, i + 50) }, { diam: true });
    if (!res.ok) { toast(res.error, 'error'); break; }
    Object.assign(peta, res.data.peta);
    total += Object.keys(res.data.peta).length; terdaftar += res.data.terdaftar;
    if (onProgress) onProgress(Math.min(unik.length, i + 50));
  }
  if (total) toast(terdaftar + ' dari ' + total + ' nomor terdaftar di WhatsApp.', 'success');
  return peta;
}

/* -------------------------------------------------------------------------
 * 2. NOTIFIKASI & DIALOG
 * ---------------------------------------------------------------------- */

function toast(pesan, tipe) {
  if (!window.Swal) { console.log('[' + (tipe || 'info') + '] ' + pesan); return; }
  Swal.fire({
    toast: true, position: 'top-end', timer: tipe === 'error' ? 5200 : 2800,
    timerProgressBar: true, showConfirmButton: false,
    icon: tipe || 'success', title: pesan,
    customClass: { popup: 'swal-asr' }
  });
}

function konfirmasi(judul, teks, tombol, bahaya) {
  return Swal.fire({
    title: judul, text: teks, icon: bahaya ? 'warning' : 'question',
    showCancelButton: true, confirmButtonText: tombol || 'Ya, lanjutkan',
    cancelButtonText: 'Batal',
    confirmButtonColor: bahaya ? '#DC2626' : '#2563EB', cancelButtonColor: '#94A3B8'
  }).then(function (r) { return r.isConfirmed; });
}

function tanya(judul, label, nilaiAwal, tipe) {
  return Swal.fire({
    title: judul, input: tipe || 'text', inputLabel: label, inputValue: nilaiAwal || '',
    showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal',
    confirmButtonColor: '#2563EB',
    inputValidator: function (v) { return !v ? 'Wajib diisi' : undefined; }
  }).then(function (r) { return r.isConfirmed ? r.value : null; });
}

/* -------------------------------------------------------------------------
 * 3. FORMAT
 * ---------------------------------------------------------------------- */

function rupiah(n, pendek) {
  n = Number(n) || 0;
  if (pendek) {
    if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1).replace('.', ',') + ' M';
    if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1).replace('.', ',') + ' Jt';
    if (n >= 1e3) return 'Rp ' + Math.round(n / 1e3) + ' rb';
  }
  return 'Rp ' + n.toLocaleString('id-ID');
}

function angka(n) { return (Number(n) || 0).toLocaleString('id-ID'); }

var BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
var HARI_ID = ['Ahad','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

function tanggal(s, gaya) {
  if (!s) return '-';
  var d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(s);
  var tgl = d.getDate(), bln = BULAN_ID[d.getMonth()], thn = d.getFullYear();
  var jam = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  if (gaya === 'pendek') return tgl + ' ' + bln.substring(0, 3) + ' ' + thn;
  if (gaya === 'jam') return tgl + ' ' + bln.substring(0, 3) + ' ' + thn + ', ' + jam + ' WIB';
  if (gaya === 'hari') return HARI_ID[d.getDay()] + ', ' + tgl + ' ' + bln + ' ' + thn;
  if (gaya === 'waktu') return jam + ' WIB';
  return tgl + ' ' + bln + ' ' + thn;
}

function periodeLabel(p) {
  if (!p) return '-';
  var x = String(p).split('-');
  return (BULAN_ID[Number(x[1]) - 1] || x[1]) + ' ' + x[0];
}

function inisial(nama) {
  return String(nama || '?').trim().split(/\s+/).slice(0, 2)
    .map(function (w) { return w[0]; }).join('').toUpperCase();
}

function kelasStatus(s) {
  s = String(s || '');
  if (/Lunas|Aktif|Selesai|Terverifikasi|Diterima|Tersedia|BERHASIL|Valid|Prima/i.test(s)) return 'ok';
  if (/Menunggu|Baru|Revisi|Pending|Diproses|Perbaikan|Override|Terlambat/i.test(s)) return 'warn';
  if (/Tunggakan|Ditolak|Belum|Nonaktif|Keluar|Penuh|GAGAL|DITOLAK|Kritis/i.test(s)) return 'danger';
  if (/Gratis|Info|Alumni/i.test(s)) return 'info';
  return '';
}

function potong(s, n) {
  s = String(s || '');
  return s.length > n ? s.substring(0, n - 1) + '…' : s;
}

function debounce(fn, ms) {
  var t;
  return function () {
    var args = arguments, self = this;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(self, args); }, ms || CONFIG.DEBOUNCE_MS);
  };
}

function waLink(nomor, pesan) {
  var n = String(nomor || '').replace(/[^0-9]/g, '');
  if (n.indexOf('0') === 0) n = '62' + n.substring(1);
  return 'https://wa.me/' + n + (pesan ? '?text=' + encodeURIComponent(pesan) : '');
}

/* -------------------------------------------------------------------------
 * 4. BERKAS: unggah (base64) & ekspor .xlsx
 * ---------------------------------------------------------------------- */

/**
 * Baca berkas untuk diunggah.
 * GAMBAR → dikompres (sisi terpanjang maks 1280 px, JPEG 82%) DAN dibuatkan
 * THUMBNAIL (320 px, JPEG 78%) di browser. Server hanya menyimpan keduanya,
 * dan seluruh tampilan (avatar, kartu, daftar) memakai thumbnail yang ringan.
 * PDF / berkas lain → dikirim apa adanya.
 * @returns {Promise<{nama, mime, ukuran, base64, thumb?, pratinjau?}>}
 */
function bacaBerkas(file, opsi) {
  opsi = opsi || {};
  var bacaDataURL = function (f) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result)); };
      fr.onerror = reject;
      fr.readAsDataURL(f);
    });
  };
  var gambar = /^image\/(jpeg|png|webp|bmp|gif|heic|heif)$/i.test(file.type) || /\.(jpe?g|png|webp|heic)$/i.test(file.name);
  if (!gambar) {
    return bacaDataURL(file).then(function (url) {
      return { nama: file.name, mime: file.type || 'application/octet-stream', ukuran: file.size, base64: url.split(',')[1] };
    });
  }
  return bacaDataURL(file).then(function (url) {
    return muatGambar(url).then(function (img) {
      var utama = kanvasJpeg(img, opsi.maks || 1280, 0.82);
      var thumb = kanvasJpeg(img, opsi.thumb || 320, 0.78);
      var namaJpg = String(file.name || 'gambar').replace(/\.[^.]+$/, '') + '.jpg';
      var out = {
        nama: namaJpg, mime: 'image/jpeg', ukuran: Math.round(utama.length * 0.75), ukuranAsli: file.size,
        base64: utama.split(',')[1], thumb: thumb.split(',')[1]
      };
      // pratinjau hanya untuk tampilan — non-enumerable agar TIDAK ikut terkirim ke server
      Object.defineProperty(out, 'pratinjau', { value: thumb, enumerable: false });
      return out;
    }).catch(function () {
      // Format yang tidak bisa digambar browser (mis. HEIC di Chrome) → kirim asli
      return { nama: file.name, mime: file.type, ukuran: file.size, base64: url.split(',')[1] };
    });
  });
}

function muatGambar(src) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

function kanvasJpeg(img, maks, kualitas) {
  var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  var skala = Math.min(1, maks / Math.max(w, h));
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * skala)); c.height = Math.max(1, Math.round(h * skala));
  var g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height);   // PNG transparan → latar putih
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', kualitas);
}

/** Ukuran berkas ramah baca */
function ukuranBaca(b) {
  b = Number(b) || 0;
  return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
}

async function bacaExcel(file) {
  await pustaka('xlsx');
  return new Promise(function (resolve, reject) {
    var fr = new FileReader();
    fr.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        var sheet = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }));
      } catch (err) { reject(err); }
    };
    fr.onerror = reject;
    fr.readAsArrayBuffer(file);
  });
}

async function unduhExcel(rows, namaFile, namaSheet) {
  if (!rows || !rows.length) { toast('Tidak ada data untuk diekspor.', 'warning'); return; }
  try { await pustaka('xlsx'); } catch (e) { toast(e.message, 'error'); return; }
  var ws = XLSX.utils.json_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (namaSheet || 'Data').substring(0, 30));
  XLSX.writeFile(wb, (namaFile || 'ekspor') + '.xlsx');
  toast(rows.length + ' baris diekspor ke Excel.', 'success');
}

/* -------------------------------------------------------------------------
 * 5. QR CODE — pembuat gambar kartu asrama makan
 *    (menggantikan barcode 1D pada PRD v5 agar mudah dipindai kamera HP)
 * ---------------------------------------------------------------------- */

/**
 * @param {string} teks    nilai QR, mis. SIM-PNG0001-a3f9c2b1
 * @param {number} sel     ukuran 1 modul (px)
 * @returns {string} data URL PNG
 */
function qrDataURL(teks, sel) {
  var qr = qrcode(0, 'M');          // tipe auto, koreksi galat M
  qr.addData(String(teks || ''));
  qr.make();
  return qr.createDataURL(sel || 6, 2);
}

function qrImgTag(teks, ukuranPx) {
  return '<img src="' + qrDataURL(teks, 6) + '" width="' + (ukuranPx || 78) +
         '" height="' + (ukuranPx || 78) + '" alt="QR Code kartu makan">';
}

/* -------------------------------------------------------------------------
 * 6. KARTU ASRAMA MAKAN — PDF (jsPDF, ukuran ID-1 85,6 × 54 mm)
 * ---------------------------------------------------------------------- */

async function buatPdfKartu(data) {
  await pustaka('jspdf');
  var jsPDFmod = window.jspdf.jsPDF;
  var doc = new jsPDFmod({ orientation: 'landscape', unit: 'mm', format: [85.6, 53.98] });

  // Header gradien (disimulasikan 2 lapis persegi)
  doc.setFillColor(0, 21, 47);  doc.rect(0, 0, 85.6, 12, 'F');
  doc.setFillColor(37, 99, 235); doc.rect(58, 0, 27.6, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
  doc.text(String(data.institusi || CONFIG.NAMA_INSTITUSI).toUpperCase(), 5, 5.2);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.4);
  doc.text('KARTU ASRAMA MAKAN · ' + (data.tahunAkademik || ''), 5, 9);

  // Badan kartu
  doc.setFillColor(255, 255, 255); doc.rect(0, 12, 85.6, 33, 'F');

  // Foto / placeholder inisial (FR-10.9)
  try {
    // FotoData = thumbnail base64 dari server (gambar Drive tidak bisa dibaca kanvas karena CORS)
    var img = data.FotoData || (data.FotoURL ? await urlKeDataURL(data.FotoURL) : null);
    if (img) {
      var fmt = /^data:image\/png/.test(img) ? 'PNG' : 'JPEG';
      doc.addImage(img, fmt, 5, 15.5, 14, 17, undefined, 'FAST');
    } else { throw new Error('tanpa foto'); }
  } catch (e) {
    doc.setFillColor(219, 234, 254); doc.rect(5, 15.5, 14, 17, 'F');
    doc.setTextColor(15, 42, 74); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(inisial(data.NamaLengkap), 12, 25, { align: 'center' });
  }

  // Data santri
  doc.setTextColor(16, 24, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.4);
  doc.text(potong(data.NamaLengkap, 26), 22, 19);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.6);
  doc.setTextColor(74, 85, 104);
  var baris = [
    'NIM       : ' + (data.NIM || '-'),
    'Prodi     : ' + potong(data.Prodi, 30),
    'Angkatan  : ' + (data.Angkatan || '-'),
    'Paket     : ' + potong(data.NamaPaket, 30),
    'Kamar     : ' + potong(data.Kamar, 30)
  ];
  baris.forEach(function (t, i) { doc.text(t, 22, 23.5 + i * 3.4); });

  // QR CODE
  try {
    doc.addImage(qrDataURL(data.qrValue, 8), 'PNG', 64, 15, 17, 17);
  } catch (e) { /* abaikan bila gagal */ }
  doc.setFontSize(3.8); doc.setTextColor(120, 130, 145);
  doc.text(String(data.qrValue || ''), 72.5, 34, { align: 'center' });

  // Footer
  doc.setFillColor(248, 250, 252); doc.rect(0, 45, 85.6, 9, 'F');
  doc.setDrawColor(226, 232, 240); doc.line(0, 45, 85.6, 45);
  doc.setFontSize(4.6); doc.setTextColor(74, 85, 104);
  doc.text('Kartu ini milik institusi · wajib dibawa saat mengambil jatah makan 3x/hari', 5, 48.6);
  doc.text('Berlaku s.d. akhir T.A. ' + (data.tahunAkademik || ''), 5, 51.6);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(37, 99, 235);
  doc.text(String(data.PenghuniID || ''), 80.6, 51.6, { align: 'right' });

  return doc;
}

function urlKeDataURL(url) {
  return new Promise(function (resolve) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.82));
      } catch (e) { resolve(null); }
    };
    img.onerror = function () { resolve(null); };
    img.src = url;
  });
}

/* -------------------------------------------------------------------------
 * 7. GRAFIK (Chart.js) — pembungkus ringkas dengan palet design system
 * ---------------------------------------------------------------------- */

var PALET = ['#2563EB', '#0F2A4A', '#16A34A', '#D97706', '#7C3AED', '#0891B2'];
var _charts = {};

async function gambarChart(idCanvas, konfig) {
  if (!window.Chart) { try { await pustaka('chart'); } catch (e) { return; } }
  var el = document.getElementById(idCanvas);
  if (!el || !window.Chart) return;
  if (_charts[idCanvas]) { _charts[idCanvas].destroy(); }
  Chart.defaults.font.family = "'Inter',system-ui,sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--text-2') || '#4A5568';
  _charts[idCanvas] = new Chart(el, konfig);
  return _charts[idCanvas];
}

function opsiDasar(extra) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,.18)' }, border: { display: false } },
      x: { grid: { display: false }, border: { display: false } }
    }
  }, extra || {});
}
