/* ==========================================================================
 * SIM ASRAMA v6.0 — VIEW SUPER ADMIN & LAPORAN
 * import data agregat · backup data · laporan eksekutif ·
 * pengguna · master data · pengaturan · audit log · arsip & pengumuman
 * ========================================================================== */

window.VIEWS = window.VIEWS || {};

/* =========================================================================
 * IMPORT DATA AGREGAT (SA only) — 5 langkah: template → unggah → pratinjau → commit → riwayat
 * ======================================================================= */
window.VIEWS['import'] = {
  props: ['user'],
  data: function () {
    return {
      langkah: 1, tabel: 'Penghuni', template: null, file: null, rows: [],
      pratinjau: null, riwayat: [], proses: false, lewatiGagal: true, hasil: null,
      urutan: ['Gedung','Kamar','Paket','Pendaftar','Penghuni','Penempatan','Tagihan','Pembayaran'],
      seret: false, progres: 0
    };
  },
  mounted: function () { this.muatRiwayat(); this.muatTemplate(); },
  methods: {
    muatTemplate: async function () {
      var res = await callApi('import.template', { tabel: this.tabel });
      if (res.ok) this.template = res.data;
    },
    gantiTabel: function () {
      this.reset(); this.muatTemplate();
    },
    unduhTemplate: function () {
      if (!this.template) return;
      var baris = {};
      this.template.kolom.forEach(function (k) { baris[k] = ''; });
      var contoh = Object.assign({}, baris, this.template.contoh);
      unduhExcel([contoh], 'Template_Import_' + this.tabel, this.tabel);
    },
    pilihFile: async function (ev) {
      var f = (ev.target.files || ev.dataTransfer.files)[0];
      this.seret = false;
      if (!f) return;
      if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { toast('Format harus .xlsx / .csv', 'warning'); return; }
      if (f.size > CONFIG.IMPORT_MAX_MB * 1024 * 1024) {
        toast('Ukuran berkas melebihi ' + CONFIG.IMPORT_MAX_MB + ' MB.', 'warning'); return;
      }
      this.file = { nama: f.name, ukuran: (f.size / 1024 / 1024).toFixed(2) };
      try {
        this.rows = await bacaExcel(f);          // parsing di browser (SheetJS) — server hanya terima JSON
        this.langkah = 2;
        toast(this.rows.length + ' baris terbaca dari berkas.', 'success');
      } catch (e) { toast('Gagal membaca berkas: ' + e.message, 'error'); }
    },
    jalankanPratinjau: async function () {
      if (!this.rows.length) { toast('Unggah berkas terlebih dahulu.', 'warning'); return; }
      this.proses = true;
      var res = await callApi('import.preview', { tabel: this.tabel, rows: this.rows });
      this.proses = false;
      if (res.ok) { this.pratinjau = res.data; this.langkah = 3; }
    },
    commit: async function () {
      if (!this.pratinjau || !this.pratinjau.valid) { toast('Tidak ada baris valid untuk diimpor.', 'warning'); return; }
      var ya = await konfirmasi('Impor ' + this.pratinjau.valid + ' baris ke tabel ' + this.tabel + '?',
        'Baris bermasalah akan dilewati. ID dari berkas dipertahankan agar relasi antartabel tetap konsisten.', 'Ya, impor sekarang');
      if (!ya) return;
      this.proses = true; this.progres = 0;
      var res = await callApi('import.commit', {
        tabel: this.tabel, rowsValid: this.pratinjau.rowsValid,
        totalBaris: this.pratinjau.totalBaris, gagalSebelumnya: this.pratinjau.gagalJumlah
      });
      this.proses = false;
      if (res.ok) { this.hasil = res.data; this.langkah = 4; this.muatRiwayat(); bersihkanCache(); }
    },
    unduhError: function () {
      if (!this.pratinjau || !this.pratinjau.gagal.length) return;
      unduhExcel(this.pratinjau.gagal, 'LogError_Import_' + this.tabel, 'Error');
    },
    muatRiwayat: async function () {
      var res = await callApi('import.history', {});
      if (res.ok) this.riwayat = res.data;
    },
    reset: function () {
      this.langkah = 1; this.file = null; this.rows = []; this.pratinjau = null; this.hasil = null;
    }
  },
  template: `
  <div>
    <sa-page judul="Import Data Agregat (Migrasi Excel)"
             sub="Migrasi data historis massal dari spreadsheet lama ke database SIM Asrama v6.0 dengan validasi Foreign Key real-time."
             :jalur="['Super Admin','Import Data Agregat']">
      <template #aksi>
        <span class="badge danger">🔒 SA-ONLY (Super Admin Restrict)</span>
        <button class="btn secondary" @click="reset">↻ Sesi Baru</button>
      </template>
    </sa-page>

    <div class="grid grid-4 mb-md">
      <sa-kpi label="Status Engine" nilai="Siap Menerima Data" ikon="⚡" warna="ok" catatan="Worker IO idle"></sa-kpi>
      <sa-kpi label="Batas Maksimum" :nilai="template ? angka(template.maxRows) : '2.000'" satuan="baris/sesi" ikon="📐"
              catatan="Konfigurasi IMPORT_MAX_ROWS"></sa-kpi>
      <sa-kpi label="Total Riwayat Impor" :nilai="riwayat.length" satuan="sesi" ikon="🗂"
              :catatan="totalSukses + ' baris berhasil commit'"></sa-kpi>
      <sa-kpi label="Berkas Terunggah" :nilai="file ? file.nama : '—'" ikon="📄"
              :catatan="file ? (file.ukuran + ' MB · ' + rows.length + ' baris terbaca') : 'Belum ada berkas'"></sa-kpi>
    </div>

    <!-- URUTAN DEPENDENSI -->
    <div class="card tight mb-md">
      <div class="flex items-center gap-md flex-wrap">
        <b class="fs-sm">🔗 Urutan Dependensi Migrasi Relasional (FK Cascade Guard):</b>
        <div class="stepper" style="margin:0">
          <template v-for="(t,i) in urutan" :key="t">
            <span class="step" :class="{active: tabel === t}" @click="tabel = t; gantiTabel()" style="cursor:pointer">
              <span class="n">{{ i+1 }}</span>{{ t }}
            </span>
            <span class="step-arrow" v-if="i < urutan.length-1">›</span>
          </template>
        </div>
      </div>
      <p class="fs-xs txt-2 mt-sm">Pastikan tabel induk diimpor sebelum tabel anak — baris dengan referensi yang belum ada akan ditolak otomatis pada tahap pratinjau (BR-33).</p>
    </div>

    <!-- LANGKAH 1 & 2 -->
    <div class="card">
      <div class="card-head">
        <div class="kpi-icon">1</div>
        <div class="t"><div class="card-title">Tentukan Target Skema &amp; Unduh Template</div>
          <div class="card-sub">Header kolom wajib persis sama dengan template resmi (case-sensitive — BR-32).</div></div>
        <span class="badge plain">Langkah {{ langkah }} dari 4</span>
      </div>
      <div class="flex gap-md flex-wrap items-center">
        <select class="select" v-model="tabel" @change="gantiTabel" style="max-width:340px">
          <option v-for="t in urutan" :key="t" :value="t">Tabel: {{ t }}</option>
        </select>
        <button class="btn secondary" @click="unduhTemplate">⬇ Unduh Template Excel Resmi (.xlsx)</button>
        <span class="chip" v-if="template">{{ template.kolom.length }} kolom skema</span>
      </div>
      <div class="scroll-x mt-md" v-if="template">
        <div class="flex gap-sm" style="padding-bottom:6px">
          <span class="facil" v-for="k in template.kolom" :key="k">{{ k }}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="kpi-icon">2</div>
        <div class="t"><div class="card-title">Unggah Berkas Spreadsheet Migrasi</div>
          <div class="card-sub">Format .xlsx / .csv · maksimal {{ IMPORT_MAX_MB }} MB · parsing dilakukan di browser (SheetJS)</div></div>
      </div>

      <div v-if="!file" class="dropzone" :class="{over: seret}"
           @click="$refs.berkas.click()"
           @dragover.prevent="seret = true" @dragleave.prevent="seret = false" @drop.prevent="pilihFile($event)">
        <div class="ic">📁</div>
        <b>Tarik berkas ke sini atau klik untuk memilih</b>
        <p class="fs-sm txt-2 mt-sm">Gunakan template resmi agar pencocokan kolom otomatis berjalan tanpa mapping manual.</p>
        <input ref="berkas" type="file" accept=".xlsx,.xls,.csv" class="hide" @change="pilihFile">
      </div>

      <div v-else class="file-chip">
        <div class="ic">📊</div>
        <div class="flex-1">
          <b>{{ file.nama }}</b>
          <div class="fs-xs txt-2">{{ file.ukuran }} MB · {{ rows.length }} baris terdeteksi · SheetJS parsing berhasil</div>
        </div>
        <span class="badge ok">{{ rows.length }} baris terbaca</span>
        <button class="btn sm ghost" @click="reset">✕ Ganti File</button>
        <button class="btn" :disabled="proses" @click="jalankanPratinjau">
          <span v-if="proses" class="spin"></span>Validasi &amp; Pratinjau →
        </button>
      </div>
    </div>

    <!-- LANGKAH 3: PRATINJAU -->
    <div class="card" v-if="pratinjau">
      <div class="card-head">
        <div class="kpi-icon">3</div>
        <div class="t"><div class="card-title">Pratinjau &amp; Hasil Validasi Skema Relasi</div>
          <div class="card-sub">Tidak ada data yang ditulis ke database pada tahap ini.</div></div>
        <span class="badge ok">● Validasi Skema Selesai</span>
      </div>

      <div class="grid grid-3 gap-md mb-md">
        <div class="kpi" style="margin:0">
          <div class="kpi-top"><div><div class="kpi-label">Total Baris Terbaca</div>
            <div class="kpi-value">{{ angka(pratinjau.totalBaris) }}</div></div><div class="kpi-icon">📋</div></div>
        </div>
        <div class="kpi" style="margin:0">
          <div class="kpi-top"><div><div class="kpi-label">Siap Diimpor (Valid FK)</div>
            <div class="kpi-value txt-ok">{{ angka(pratinjau.valid) }}</div></div><div class="kpi-icon ok">✅</div></div>
        </div>
        <div class="kpi" style="margin:0">
          <div class="kpi-top"><div><div class="kpi-label">Baris Bermasalah</div>
            <div class="kpi-value txt-danger">{{ angka(pratinjau.gagalJumlah) }}</div></div><div class="kpi-icon danger">⚠️</div></div>
        </div>
      </div>

      <template v-if="pratinjau.gagal.length">
        <div class="label">Daftar Baris Tidak Lolos Validasi ({{ pratinjau.gagalJumlah }} data)</div>
        <div class="table-wrap" style="max-height:320px">
          <table class="tbl">
            <thead><tr><th>No. Baris Excel</th><th>Kolom Target</th><th>Nilai Input</th><th>Penyebab Kegagalan</th><th>Klasifikasi</th></tr></thead>
            <tbody>
              <tr v-for="(g,i) in pratinjau.gagal" :key="i">
                <td class="mono">Baris #{{ g.baris }}</td>
                <td class="txt-blue fw6">{{ g.kolom }}</td>
                <td class="mono fs-xs">{{ g.nilai || '(KOSONG / NULL)' }}</td>
                <td class="fs-sm">{{ g.alasan }}</td>
                <td><span class="badge" :class="g.klasifikasi === 'Ditolak' ? 'warn' : 'danger'">{{ g.klasifikasi }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <div class="info-box ok" v-else><span>✅</span><div>Seluruh baris lolos validasi skema, tipe data, duplikasi ID, dan referensi FK.</div></div>

      <div class="flex gap-md items-center flex-wrap mt-md">
        <label class="check"><input type="checkbox" v-model="lewatiGagal" disabled checked>
          <span>Lewati baris bermasalah dan impor <b>{{ pratinjau.valid }} baris valid</b> saja</span></label>
        <button class="btn sm secondary" v-if="pratinjau.gagal.length" @click="unduhError">⬇ Unduh Log Error (.xlsx)</button>
      </div>

      <div class="info-box mt-md"><span>🛡</span><div>Transaksi atomik: server memvalidasi ulang seluruh baris sebelum menulis
        (tidak mempercayai flag dari browser), lalu menulis per batch {{ 200 }} baris agar tidak menyentuh batas eksekusi 6 menit.</div></div>

      <div class="btn-row mt-md" style="justify-content:flex-end">
        <button class="btn secondary" @click="reset">Batalkan Sesi</button>
        <button class="btn dark" :disabled="proses || !pratinjau.valid" @click="commit">
          <span v-if="proses" class="spin"></span>☁ Commit &amp; Impor {{ pratinjau.valid }} Baris Valid Sekarang
        </button>
      </div>
    </div>

    <!-- LANGKAH 4: HASIL -->
    <div class="card" v-if="hasil">
      <div class="info-box ok">
        <span>🎉</span>
        <div><b>{{ hasil.sukses }} baris berhasil diimpor ke tabel {{ hasil.tabel }}</b>
          {{ hasil.gagal ? (', ' + hasil.gagal + ' baris dilewati.') : '.' }}
          <br>ID sesi impor: <span class="mono">{{ hasil.importId }}</span>
        </div>
      </div>
      <div class="btn-row mt-md">
        <button class="btn secondary" @click="reset">Impor Tabel Lain</button>
      </div>
    </div>

    <!-- RIWAYAT -->
    <div class="card">
      <div class="card-head">
        <div class="t"><div class="card-title">Riwayat Sesi Impor Sebelumnya</div>
          <div class="card-sub">Rekam jejak audit migrasi data agregat</div></div>
        <button class="btn sm secondary" @click="muatRiwayat">↻ Muat ulang</button>
      </div>
      <div class="table-wrap" v-if="riwayat.length">
        <table class="tbl">
          <thead><tr><th>Import ID</th><th>Tanggal &amp; Waktu</th><th>Tabel Tujuan</th>
            <th class="num">Total</th><th class="num">Sukses</th><th class="num">Gagal</th><th>Operator</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="r in riwayat" :key="r.ImportID">
              <td class="mono txt-blue">{{ r.ImportID }}</td>
              <td class="fs-sm">{{ tanggal(r.Tanggal,'jam') }}</td>
              <td><span class="badge info plain">{{ r.Tabel }}</span></td>
              <td class="num">{{ r.TotalBaris }}</td>
              <td class="num txt-ok fw6">{{ r.BarisSukses }}</td>
              <td class="num" :class="Number(r.BarisGagal) ? 'txt-danger' : ''">{{ r.BarisGagal }}</td>
              <td class="fs-sm">{{ r.NamaOperator }}</td>
              <td><span class="badge" :class="Number(r.BarisGagal) ? 'warn' : 'ok'">
                {{ Number(r.BarisGagal) ? 'Sukses Parsial' : 'Sukses Penuh' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <sa-empty v-else judul="Belum ada riwayat impor" pesan="Sesi impor pertama Anda akan tercatat di sini."></sa-empty>
    </div>
  </div>`,
  computed: {
    totalSukses: function () {
      return this.riwayat.reduce(function (s, r) { return s + Number(r.BarisSukses || 0); }, 0);
    },
    IMPORT_MAX_MB: function () { return CONFIG.IMPORT_MAX_MB; }
  }
};

/* =========================================================================
 * BACKUP & CADANGAN DATA (SA only)
 * ======================================================================= */
window.VIEWS['backup'] = {
  props: ['user'],
  data: function () {
    return { d: null, memuat: true, label: '', verifikasi: true, proses: false, hasil: null, cari: '' };
  },
  mounted: function () { this.muat(); },
  computed: {
    tampil: function () {
      var q = this.cari.toLowerCase();
      return (this.d ? this.d.rows : []).filter(function (r) {
        return !q || String(r.Label).toLowerCase().indexOf(q) > -1 || String(r.BackupID).toLowerCase().indexOf(q) > -1;
      });
    },
    tahunAkademik: function () { return APP.pengaturan.TAHUN_AKADEMIK || ''; }
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('backup.list', {});
      this.memuat = false;
      if (res.ok) this.d = res.data;
    },
    preset: function (t) { this.label = t; },
    jalankan: async function () {
      if (!this.label.trim()) { toast('Label backup wajib diisi (BR-35).', 'warning'); return; }
      var ya = await konfirmasi('Jalankan backup sekarang?',
        'Seluruh spreadsheet akan diduplikasi ke folder arsip Drive. Data produksi tidak akan berubah.', 'Ya, backup sekarang');
      if (!ya) return;
      this.proses = true;
      Swal.fire({ title: 'Sedang memproses backup…',
        html: 'Menduplikasi seluruh sheet ke Google Drive.<br><b>Jangan tutup halaman ini.</b>',
        allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
      var res = await callApi('backup.run', { label: this.label.trim() });
      this.proses = false;
      Swal.close();
      if (res.ok) { this.hasil = res.data; this.label = ''; this.muat(); }
    }
  },
  template: `
  <div>
    <sa-page judul="Backup &amp; Cadangan Data Sistem"
             sub="Duplikasi penuh seluruh database spreadsheet &amp; konfigurasi ke folder arsip Google Drive tanpa gangguan layanan live."
             :jalur="['Super Admin','Backup &amp; Cadangan Data']">
      <template #aksi>
        <span class="badge danger">🔒 SA-ONLY</span>
        <a class="btn" v-if="d && d.folderArsip" :href="d.folderArsip" target="_blank">🗄 Akses Vault Drive</a>
      </template>
    </sa-page>

    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="d">
      <div class="grid grid-4 mb-md">
        <sa-kpi label="Database Master Aktif" :nilai="d.jumlahSheet" satuan="sheet" ikon="🗃" warna="ok"
                catatan="Terhubung &amp; normal"></sa-kpi>
        <sa-kpi label="Total Cadangan Arsip" :nilai="d.total" satuan="arsip" ikon="📦"
                catatan="Tersimpan di Google Drive"></sa-kpi>
        <sa-kpi label="Backup Terakhir" :nilai="d.terakhir ? tanggal(d.terakhir.Tanggal,'pendek') : '—'" ikon="🕐"
                :catatan="d.terakhir ? d.terakhir.Label : 'Belum pernah backup'"
                :warna="d.terakhir ? 'ok' : 'warn'"></sa-kpi>
        <sa-kpi label="Metode Replikasi" nilai="makeCopy()" ikon="⚡"
                catatan="Drive API native · zero-downtime"></sa-kpi>
      </div>

      <!-- PROTOKOL -->
      <div class="card tight mb-md">
        <div class="flex items-center gap-sm mb-md">
          <span class="badge navy">🛡 PROTOKOL KEAMANAN REPLIKASI &amp; BACKUP DATA V6.0</span>
          <span class="fs-xs txt-3" style="margin-left:auto">Standar Dokumen PRD §18</span>
        </div>
        <div class="grid grid-3 gap-md">
          <div class="info-box"><span>📑</span><div><b>Protokol 1: Duplikasi Total</b><br>
            Menyalin seluruh sheet termasuk arsip LogMakan terpartisi bulanan beserta formula, tanpa menghentikan sistem aktif.</div></div>
          <div class="info-box"><span>✏️</span><div><b>Protokol 2: Penamaan Terstandar</b><br>
            Format kanonikal <span class="mono">Backup_SIM_Asrama_[Label]_[Timestamp]</span> guna menjaga auditabilitas.</div></div>
          <div class="info-box"><span>↩️</span><div><b>Protokol 3: Restorasi Terkendali</b><br>
            Pemulihan dilakukan manual oleh SA melalui penyesuaian SPREADSHEET_ID atau penyalinan selektif cell-level.</div></div>
        </div>
      </div>

      <div class="grid grid-23">
        <!-- FORM BACKUP -->
        <div class="card">
          <div class="card-head">
            <div class="t"><div class="card-title">Buat Cadangan Baru (Manual Snapshot)</div>
              <div class="card-sub">Inisiasi duplikasi atomik database ke cloud vault Drive secara langsung.</div></div>
            <span class="badge plain">Operasi Manual</span>
          </div>

          <div class="field">
            <label class="label">Label Backup (Wajib) <span class="req">*</span>
              <span class="txt-3 fw6" style="float:right">Maks. 60 karakter</span></label>
            <input class="input" v-model="label" maxlength="60"
                   placeholder="mis. Akhir Semester Ganjil 2026/2027 &amp; Persiapan TA Baru">
          </div>
          <div class="label">Preset Tag Cepat</div>
          <div class="flex gap-sm flex-wrap mb-md">
            <span class="chip" style="cursor:pointer" @click="preset('Akhir Semester Ganjil ' + tahunAkademik)">Akhir Semester Ganjil</span>
            <span class="chip" style="cursor:pointer" @click="preset('Akhir Tahun Ajaran ' + tahunAkademik)">Akhir Tahun Ajaran</span>
            <span class="chip" style="cursor:pointer" @click="preset('Pra-Migrasi Schema')">Pra-Migrasi Schema</span>
            <span class="chip" style="cursor:pointer" @click="preset('Audit Tahunan')">Audit Tahunan</span>
            <span class="chip" style="cursor:pointer" @click="preset('Pra-Import Data Agregat')">Pra-Import Data</span>
          </div>

          <label class="check mb-md"><input type="checkbox" v-model="verifikasi">
            <span><b>Verifikasi integritas setelah duplikasi</b><br>
            <span class="fs-xs txt-2">Membandingkan jumlah sheet dan ukuran berkas hasil salinan (disarankan).</span></span></label>

          <button class="btn dark block lg" :disabled="proses" @click="jalankan">
            <span v-if="proses" class="spin"></span>⚡ Jalankan Backup Sekarang
            <span class="badge plain" style="background:rgba(255,255,255,.18);color:#fff;margin-left:8px">ZERO-DOWNTIME</span>
          </button>
          <p class="fs-xs txt-2 mt-sm">✅ Proses tidak akan mengganggu santri yang sedang bertransaksi atau memindai kartu makan di dapur (atomic spreadsheet snapshot).</p>
        </div>

        <!-- PANDUAN PEMULIHAN -->
        <div class="card">
          <div class="card-head"><div class="t">
            <div class="card-title">🔧 Panduan Pemulihan (Disaster Recovery)</div>
            <div class="card-sub">Jika terjadi kehilangan integritas atau kesalahan massal operator.</div>
          </div></div>
          <div class="timeline">
            <div class="tl-item">
              <div class="tl-title">1. Buka File Arsip di Google Drive</div>
              <div class="tl-desc">Gunakan tautan pada tabel riwayat di bawah, atau buka folder vault arsip.</div>
            </div>
            <div class="tl-item">
              <div class="tl-title">2. Verifikasi Data Lembar Kerja</div>
              <div class="tl-desc">Validasi baris master santri, status kamar, riwayat transaksi katering, dan log audit.</div>
            </div>
            <div class="tl-item">
              <div class="tl-title">3. Perbarui SPREADSHEET_ID &amp; jalankan setup()</div>
              <div class="tl-desc">Ganti Script Property <span class="mono">SPREADSHEET_ID</span> di Apps Script agar menunjuk berkas salinan, lalu jalankan <span class="mono">setup()</span> untuk sinkronisasi skema.</div>
            </div>
          </div>
          <div class="info-box warn mt-md"><span>⚠️</span><div>Sistem <b>tidak menghapus backup lama otomatis</b> (BR-37).
            Pengelolaan retensi arsip dilakukan manual oleh Super Admin melalui Google Drive.</div></div>
        </div>
      </div>

      <!-- RIWAYAT -->
      <div class="card">
        <div class="card-head">
          <div class="t"><div class="card-title">Riwayat Snapshot Cadangan Data</div>
            <div class="card-sub">Seluruh arsip replikasi tersimpan aman di Google Drive Vault</div></div>
          <input class="input" v-model="cari" placeholder="🔍 Cari label / ID…" style="width:auto;min-width:200px">
          <span class="badge plain">{{ d.total }} Arsip</span>
        </div>
        <div class="table-wrap" v-if="tampil.length">
          <table class="tbl">
            <thead><tr><th>Backup ID</th><th>Tanggal &amp; Waktu</th><th>Label &amp; Deskripsi</th>
              <th class="num">Ukuran</th><th>Operator</th><th>Status</th><th>Tindakan</th></tr></thead>
            <tbody>
              <tr v-for="r in tampil" :key="r.BackupID">
                <td><span class="badge navy plain mono">{{ r.BackupID }}</span></td>
                <td class="fs-sm">{{ tanggal(r.Tanggal,'jam') }}</td>
                <td><b class="fs-sm">{{ r.Label }}</b>
                  <div class="mono fs-xs txt-3">Backup_SIM_Asrama_{{ potong(r.Label, 18) }}</div></td>
                <td class="num fs-sm">{{ r.UkuranMB }} MB</td>
                <td class="fs-sm">{{ r.NamaOperator }}</td>
                <td><span class="badge ok">Sukses — Tersimpan</span></td>
                <td><a class="btn xs secondary" :href="r.LinkDrive" target="_blank">🔗 Buka di Drive</a></td>
              </tr>
            </tbody>
          </table>
        </div>
        <sa-empty v-else judul="Belum ada arsip cadangan"
                  pesan="Jalankan backup pertama Anda sebelum melakukan import data massal atau migrasi skema." ikon="🗄"></sa-empty>
      </div>
    </template>

    <sa-modal v-if="hasil" judul="Backup Berhasil Dibuat" :sub="hasil.nama" ikon="✅" @tutup="hasil = null">
      <div class="info-box ok"><span>🎉</span><div>Seluruh <b>{{ hasil.jumlahSheet }} sheet</b> berhasil diduplikasi
        ke folder arsip Drive ({{ hasil.ukuranMB }} MB).</div></div>
      <sa-kv k="Backup ID" :v="hasil.backupId"></sa-kv>
      <sa-kv k="File ID" :v="hasil.fileId"></sa-kv>
      <template #aksi>
        <button class="btn secondary" @click="hasil = null">Tutup</button>
        <a class="btn" :href="hasil.linkDrive" target="_blank">🔗 Buka Berkas Backup</a>
      </template>
    </sa-modal>
  </div>`
};

/* =========================================================================
 * LAPORAN EKSEKUTIF (4 tab)
 * ======================================================================= */
window.VIEWS['laporan'] = {
  props: ['user'],
  data: function () { return { d: null, memuat: true, tab: 'okupansi', f: { dari: '', sampai: '' } }; },
  mounted: function () { this.muat(); },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('reports.executive', this.f);
      this.memuat = false;
      if (res.ok) { this.d = res.data; this.$nextTick(this.gambar); }
    },
    gambar: function () {
      if (!this.d) return;
      if (this.tab === 'okupansi') {
        gambarChart('chartProdi', {
          type: 'doughnut',
          data: {
            labels: this.d.komposisiProdi.map(function (x) { return x.prodi; }),
            datasets: [{ data: this.d.komposisiProdi.map(function (x) { return x.jumlah; }),
                         backgroundColor: PALET, borderWidth: 0 }]
          },
          options: { responsive: true, maintainAspectRatio: false, cutout: '62%',
            plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 9, usePointStyle: true } } } }
        });
      }
      if (this.tab === 'kas') {
        gambarChart('chartKas', {
          type: 'bar',
          data: {
            labels: this.d.arusKas.perPaket.map(function (x) { return potong(x.NamaPaket, 18); }),
            datasets: [
              { label: 'Target', data: this.d.arusKas.perPaket.map(function (x) { return x.target; }),
                backgroundColor: '#CBD5E1', borderRadius: 5 },
              { label: 'Realisasi', data: this.d.arusKas.perPaket.map(function (x) { return x.realisasi; }),
                backgroundColor: '#2563EB', borderRadius: 5 }
            ]
          },
          options: opsiDasar({ plugins: { legend: { display: true, position: 'top', align: 'end',
            labels: { boxWidth: 10, usePointStyle: true } } } })
        });
      }
      if (this.tab === 'konsumsi') {
        gambarChart('chartKonsumsi', {
          type: 'bar',
          data: {
            labels: this.d.konsumsi.perSesi.map(function (x) { return 'Makan ' + x.sesi; }),
            datasets: [{ label: 'Rata-rata tap', data: this.d.konsumsi.perSesi.map(function (x) { return x.rataTap; }),
                         backgroundColor: PALET, borderRadius: 6, maxBarThickness: 60 }]
          },
          options: opsiDasar()
        });
      }
    },
    gantiTab: function (t) { this.tab = t; this.$nextTick(this.gambar); },
    ekspor: function (jenis) {
      if (jenis === 'okupansi') unduhExcel(this.d.okupansi, 'Rekap_Okupansi', 'Okupansi');
      if (jenis === 'kas') unduhExcel(this.d.arusKas.perPaket, 'Rekap_ArusKas', 'ArusKas');
      if (jenis === 'konsumsi') unduhExcel(this.d.konsumsi.perSesi, 'Rekap_Konsumsi', 'Konsumsi');
      if (jenis === 'disiplin') unduhExcel(this.d.kedisiplinan.kategori, 'Rekap_Kedisiplinan', 'Disiplin');
    }
  },
  template: `
  <div>
    <sa-page judul="Laporan Eksekutif &amp; Rekapitulasi Operasional Asrama"
             sub="Ringkasan analitik komprehensif kinerja okupansi, realisasi keuangan, konsumsi katering, dan kedisiplinan mahasantri."
             :jalur="['Laporan &amp; Analitika','Laporan Eksekutif']">
      <template #aksi>
        <input class="input" type="date" v-model="f.dari" @change="muat" style="width:auto">
        <input class="input" type="date" v-model="f.sampai" @change="muat" style="width:auto">
        <button class="btn secondary" @click="cetak()">🖨 Cetak Ringkasan</button>
      </template>
    </sa-page>

    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="d">
      <div class="grid grid-4 mb-md">
        <sa-kpi label="Tingkat Okupansi Kamar" :nilai="d.kpi.okupansi" satuan="%" ikon="🏢"
                :persen="d.kpi.okupansi" :catatan="angka(d.kpi.terisi) + ' / ' + angka(d.kpi.totalBed) + ' bed terisi'"></sa-kpi>
        <sa-kpi label="Realisasi Penerimaan Tagihan" :nilai="d.kpi.realisasiPersen" satuan="%" ikon="💳" warna="ok"
                :persen="d.kpi.realisasiPersen" persenWarna="ok"
                :catatan="rupiah(d.kpi.totalRealisasi, true) + ' terkumpul'"></sa-kpi>
        <sa-kpi label="Distribusi Porsi Katering" :nilai="angka(d.kpi.porsiKatering)" satuan="porsi" ikon="🍽"
                :catatan="'Rata-rata ' + angka(d.kpi.rataPorsiHarian) + ' porsi/hari'"></sa-kpi>
        <sa-kpi label="Indeks Kedisiplinan Santri" :nilai="d.kpi.indeksDisiplin" satuan="/100" ikon="🛡"
                :warna="d.kpi.indeksDisiplin >= 95 ? 'ok' : 'warn'" :persen="d.kpi.indeksDisiplin"
                :persenWarna="d.kpi.indeksDisiplin >= 95 ? 'ok' : 'warn'" catatan="Status kepatuhan asrama"></sa-kpi>
      </div>

      <div class="tabs">
        <button class="tab" :class="{active: tab==='okupansi'}" @click="gantiTab('okupansi')">🏢 Rekap Okupansi Gedung</button>
        <button class="tab" :class="{active: tab==='kas'}" @click="gantiTab('kas')">💳 Arus Kas &amp; Pembayaran</button>
        <button class="tab" :class="{active: tab==='konsumsi'}" @click="gantiTab('konsumsi')">🍽 Presensi &amp; Konsumsi</button>
        <button class="tab" :class="{active: tab==='disiplin'}" @click="gantiTab('disiplin')">🛡 Kedisiplinan &amp; Pelanggaran</button>
      </div>

      <!-- TAB OKUPANSI -->
      <template v-if="tab==='okupansi'">
        <div class="grid grid-23">
          <div class="card">
            <div class="card-head">
              <div class="t"><div class="card-title">Rekap Okupansi &amp; Kapasitas per Gedung</div>
                <div class="card-sub">Monitoring ketersediaan tempat tidur menurut struktur gedung</div></div>
              <button class="btn sm secondary" @click="ekspor('okupansi')">⬇ Ekspor</button>
            </div>
            <div class="table-wrap">
              <table class="tbl">
                <thead><tr><th>Gedung &amp; Identitas</th><th>Gender</th><th class="num">Kamar</th>
                  <th class="num">Kapasitas</th><th class="num">Terisi</th><th class="num">Kosong</th><th>Okupansi</th></tr></thead>
                <tbody>
                  <tr v-for="g in d.okupansi" :key="g.GedungID">
                    <td><b>{{ g.NamaGedung }}</b><div class="mono fs-xs txt-3">{{ g.GedungID }}</div></td>
                    <td><span class="badge plain" :class="g.Tipe === 'Putra' ? 'info' : 'danger'">{{ g.Tipe }}</span></td>
                    <td class="num">{{ g.jumlahKamar }}</td>
                    <td class="num">{{ angka(g.kapasitas) }}</td>
                    <td class="num txt-blue fw6">{{ angka(g.terisi) }}</td>
                    <td class="num">{{ angka(g.kosong) }}</td>
                    <td style="min-width:140px"><sa-progress :nilai="g.persen"></sa-progress></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="panel-dark mt-md">
              <div class="it"><small>Total kamar</small><b>{{ d.okupansi.reduce((s,g)=>s+g.jumlahKamar,0) }} unit</b></div>
              <div class="it"><small>Kapasitas</small><b>{{ angka(d.kpi.totalBed) }} bed</b></div>
              <div class="it"><small>Terisi</small><b>{{ angka(d.kpi.terisi) }} bed</b></div>
              <div class="it"><small>Rata-rata okupansi</small><b>{{ d.kpi.okupansi }}%</b></div>
            </div>
          </div>

          <div class="card">
            <div class="card-head"><div class="t"><div class="card-title">Komposisi Program Studi</div>
              <div class="card-sub">Distribusi mahasantri aktif</div></div></div>
            <div style="height:230px"><canvas id="chartProdi"></canvas></div>
            <div class="mt-md">
              <div class="kv" v-for="p in d.komposisiProdi" :key="p.prodi">
                <span>{{ potong(p.prodi, 28) }}</span><b>{{ p.jumlah }} <span class="txt-3 fw6">({{ p.persen }}%)</span></b>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- TAB ARUS KAS -->
      <template v-else-if="tab==='kas'">
        <div class="card">
          <div class="card-head">
            <div class="t"><div class="card-title">Breakdown Penerimaan Kas &amp; Rekonsiliasi per Paket</div>
              <div class="card-sub">Perbandingan target tagihan terhadap realisasi kas masuk</div></div>
            <button class="btn sm secondary" @click="ekspor('kas')">⬇ Ekspor .xlsx</button>
          </div>
          <div style="height:230px" class="mb-md"><canvas id="chartKas"></canvas></div>
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Kategori / Paket Tagihan</th><th class="num">Santri</th><th class="num">Target</th>
                <th class="num">Realisasi Kas</th><th>Capaian</th><th class="num">Tunggakan</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-for="p in d.arusKas.perPaket" :key="p.PaketID">
                  <td><b>{{ p.NamaPaket }}</b><div class="fs-xs txt-3">{{ rupiah(p.harga) }}/bulan</div></td>
                  <td class="num">{{ p.jumlahSantri }}</td>
                  <td class="num">{{ rupiah(p.target, true) }}</td>
                  <td class="num txt-ok fw6">{{ rupiah(p.realisasi, true) }}</td>
                  <td style="min-width:130px"><sa-progress :nilai="p.persen" :warna="p.persen >= 90 ? 'ok' : 'warn'"></sa-progress></td>
                  <td class="num txt-danger">{{ rupiah(p.tunggakan, true) }}
                    <div class="fs-xs txt-3">{{ p.santriTunggak }} santri</div></td>
                  <td><span class="badge" :class="p.persen >= 90 ? 'ok' : (p.persen >= 70 ? 'warn' : 'danger')">
                    {{ p.persen >= 90 ? 'Optimal' : (p.persen >= 70 ? 'Terkendali' : 'Perlu Follow-up') }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="panel-dark mt-md">
            <div class="it"><small>Target anggaran</small><b>{{ rupiah(d.kpi.totalTarget) }}</b></div>
            <div class="it"><small>Kas masuk riil</small><b>{{ rupiah(d.kpi.totalRealisasi) }}</b></div>
            <div class="it"><small>Sisa piutang</small><b>{{ rupiah(d.kpi.tunggakan) }}</b></div>
            <div class="it"><small>Menunggu verifikasi</small><b>{{ d.arusKas.menungguVerifikasi }} bukti</b></div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-head"><div class="t"><div class="card-title">⏳ Penuaan Piutang (Aging Schedule)</div>
              <div class="card-sub">Kolektibilitas tunggakan santri</div></div></div>
            <div class="kv"><span>🔵 &lt; 15 hari (baru jatuh tempo) — {{ d.arusKas.aging.baruJml }} tagihan</span>
              <b>{{ rupiah(d.arusKas.aging.baru) }}</b></div>
            <div class="kv"><span>🟡 16–30 hari (pengingat 1) — {{ d.arusKas.aging.sedangJml }} tagihan</span>
              <b class="txt-warn">{{ rupiah(d.arusKas.aging.sedang) }}</b></div>
            <div class="kv"><span>🔴 &gt; 30 hari (mendesak) — {{ d.arusKas.aging.mendesakJml }} tagihan</span>
              <b class="txt-danger">{{ rupiah(d.arusKas.aging.mendesak) }}</b></div>
            <div class="info-box warn mt-md"><span>📣</span><div>Kirim pengingat massal via WhatsApp kepada santri dengan
              tunggakan &gt; 30 hari melalui menu Tagihan &amp; Pembayaran.</div></div>
          </div>

          <div class="card">
            <div class="card-head"><div class="t"><div class="card-title">🏦 Rekonsiliasi Kanal Pembayaran</div>
              <div class="card-sub">Sebaran metode transaksi terverifikasi</div></div></div>
            <div class="kv" v-for="(v,k) in d.arusKas.kanal" :key="k"><span>{{ k }}</span><b>{{ rupiah(v) }}</b></div>
            <div class="kv"><span>Menunggu rekonsiliasi kasir</span>
              <b class="txt-warn">{{ rupiah(d.arusKas.nominalMenunggu) }}</b></div>
          </div>
        </div>
      </template>

      <!-- TAB KONSUMSI -->
      <template v-else-if="tab==='konsumsi'">
        <div class="card">
          <div class="card-head">
            <div class="t"><div class="card-title">Distribusi &amp; Efisiensi Konsumsi per Sesi Makan</div>
              <div class="card-sub">Rata-rata harian aktual vs alokasi baku katering</div></div>
            <button class="btn sm secondary" @click="ekspor('konsumsi')">⬇ Ekspor .xlsx</button>
          </div>
          <div style="height:220px" class="mb-md"><canvas id="chartKonsumsi"></canvas></div>
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Sesi &amp; Jam Makan</th><th class="num">Target Harian</th><th class="num">Rata-rata Tap</th>
                <th>Serapan</th><th class="num">Total Bulan Ini</th><th>Performa</th></tr></thead>
              <tbody>
                <tr v-for="s in d.konsumsi.perSesi" :key="s.sesi">
                  <td><b>Makan {{ s.sesi }}</b><div class="mono fs-xs txt-3">{{ s.mulai }} — {{ s.selesai }} WIB</div></td>
                  <td class="num">{{ angka(s.target) }}</td>
                  <td class="num fw6">{{ angka(s.rataTap) }}</td>
                  <td style="min-width:140px"><sa-progress :nilai="s.persen" :warna="s.persen >= 95 ? 'ok' : 'warn'"></sa-progress></td>
                  <td class="num">{{ angka(s.total) }}</td>
                  <td><span class="badge" :class="s.persen >= 95 ? 'ok' : 'warn'">
                    {{ s.persen >= 95 ? 'Optimal' : 'Evaluasi' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="panel-dark mt-md">
            <div class="it"><small>Total kuota harian</small><b>{{ angka(d.konsumsi.santriBerhak * 3) }} porsi/hari</b></div>
            <div class="it"><small>Total bulan ini</small><b>{{ angka(d.konsumsi.totalBulanIni) }} porsi</b></div>
            <div class="it"><small>Santri berhak</small><b>{{ angka(d.konsumsi.santriBerhak) }} jiwa</b></div>
            <div class="it"><small>Sesi aktif</small><b>{{ d.konsumsi.sesiAktif.sesi }}</b></div>
          </div>
        </div>
      </template>

      <!-- TAB DISIPLIN -->
      <template v-else>
        <div class="card">
          <div class="card-head">
            <div class="t"><div class="card-title">Rekapitulasi Kategori Pelanggaran &amp; Poin Penalti</div>
              <div class="card-sub">Indeks rata-rata {{ d.kedisiplinan.kpi.rataSkor }} / 100 poin</div></div>
            <button class="btn sm secondary" @click="ekspor('disiplin')">⬇ Ekspor .xlsx</button>
          </div>
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Kategori Pelanggaran</th><th class="num">Bobot</th><th class="num">Frekuensi</th>
                <th class="num">Putra</th><th class="num">Putri</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-for="k in d.kedisiplinan.kategori" :key="k.kode">
                  <td><b>{{ k.nama }}</b><div class="mono fs-xs txt-3">{{ k.kode }} · {{ k.tingkat }}</div></td>
                  <td class="num txt-danger fw6">−{{ k.poin }}</td>
                  <td class="num">{{ k.frekuensi }}</td>
                  <td class="num">{{ k.putra }}</td>
                  <td class="num">{{ k.putri }}</td>
                  <td><span class="badge" :class="k.frekuensi === 0 ? 'ok' : (k.poin >= 30 ? 'danger' : 'warn')">
                    {{ k.frekuensi === 0 ? 'Nihil' : (k.poin >= 30 ? 'Pengawasan' : 'Terkendali') }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="panel-dark mt-md">
            <div class="it"><small>Total kasus</small><b>{{ d.kedisiplinan.kpi.totalKasus }}</b></div>
            <div class="it"><small>Dalam pembinaan</small><b>{{ d.kedisiplinan.kpi.dalamPembinaan }} santri</b></div>
            <div class="it"><small>Skor sempurna</small><b>{{ d.kedisiplinan.distribusi.sempurna }} santri</b></div>
            <div class="it"><small>Rata-rata penalti</small><b>{{ d.kedisiplinan.kpi.rataPenalti }} poin/kasus</b></div>
          </div>
        </div>
      </template>

      <div class="card">
        <div class="card-head"><div class="t"><div class="card-title">🔐 Jejak Audit &amp; Integritas Data</div></div></div>
        <sa-kv k="Laporan dibuat" :v="tanggal(d.periode.dibuat,'jam')"></sa-kv>
        <sa-kv k="Oleh" :v="d.periode.oleh"></sa-kv>
        <sa-kv k="Rentang periode" :v="(d.periode.dari || 'awal') + ' s.d. ' + (d.periode.sampai || 'sekarang')"></sa-kv>
      </div>
    </template>
  </div>`,
  created: function () { this.window = window; }
};

/* =========================================================================
 * MANAJEMEN PENGGUNA
 * ======================================================================= */
window.VIEWS['users'] = {
  props: ['user'],
  data: function () { return { rows: [], memuat: true, form: null, proses: false, cari: '' }; },
  mounted: function () { this.muat(); },
  computed: {
    tampil: function () {
      var q = this.cari.toLowerCase();
      return this.rows.filter(function (r) {
        return !q || String(r.NamaLengkap).toLowerCase().indexOf(q) > -1 || String(r.Username).indexOf(q) > -1 ||
               String(r.Email).toLowerCase().indexOf(q) > -1;
      });
    },
    daftarRole: function () {
      return [['SA','Super Admin'],['PMB','Admin PMB'],['KEU','Admin Keuangan'],['PA','Admin Asrama Putra'],
              ['PI','Admin Asrama Putri'],['PTG','Petugas Makan'],['PIM','Pimpinan'],['PNG','Penghuni'],['PDF','Pendaftar']];
    }
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('users.list', {});
      this.memuat = false;
      if (res.ok) this.rows = res.data;
    },
    baru: function () { this.form = { Username: '', NamaLengkap: '', Email: '', Role: 'PTG', NoHP: '', JenisKelamin: '', Status: 'Aktif' }; },
    staf: function (role) { return ['SA','PMB','KEU','PA','PI','PTG','PIM'].indexOf(role) > -1; },
    resetGoogle: async function (r) {
      var ya = await konfirmasi('Lepas tautan Google ' + r.NamaLengkap + '?',
        'Pengguna dapat menautkan ulang dengan akun Google (email sama) saat login berikutnya.', 'Ya, lepas');
      if (!ya) return;
      var res = await callApi('users.update', { id: r.UserID, data: { resetGoogle: true } });
      if (res.ok) { toast('Tautan Google dilepas.', 'success'); this.muat(); }
    },
    sunting: function (r) { this.form = Object.assign({}, r); },
    simpan: async function () {
      if (this.staf(this.form.Role) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.form.Email || '')) {
        toast('Role staf wajib punya email Google — dipakai untuk login Google OAuth.', 'warning'); return;
      }
      this.proses = true;
      var res = this.form.UserID
        ? await callApi('users.update', { id: this.form.UserID, data: this.form })
        : await callApi('users.create', { data: this.form });
      this.proses = false;
      if (res.ok) {
        if (res.data && res.data.sandiAwal) {
          Swal.fire({ icon: 'success', title: 'Pengguna dibuat',
            html: 'Username: <code>' + this.form.Username + '</code><br>Sandi awal: <code>' + res.data.sandiAwal + '</code>',
            confirmButtonColor: '#2563EB' });
        } else { toast(res.message, 'success'); }
        this.form = null; this.muat();
      }
    },
    resetSandi: async function (r) {
      var ya = await konfirmasi('Reset kata sandi ' + r.NamaLengkap + '?', 'Sandi baru akan ditampilkan sekali.', 'Ya, reset', true);
      if (!ya) return;
      var res = await callApi('auth.resetPassword', { userId: r.UserID });
      if (res.ok) Swal.fire({ icon: 'info', title: 'Sandi baru', html: '<code>' + res.data.sandiBaru + '</code>', confirmButtonColor: '#2563EB' });
    }
  },
  template: `
  <div>
    <sa-page judul="Manajemen Pengguna &amp; Hak Akses"
             sub="Kelola akun staf, petugas dapur, pimpinan, dan santri beserta peran RBAC-nya."
             :jalur="['Super Admin','Manajemen Pengguna']">
      <template #aksi><button class="btn" @click="baru">＋ Tambah Pengguna</button></template>
    </sa-page>

    <div class="card">
      <div class="filters">
        <input class="input flex-1" v-model="cari" placeholder="🔍 Cari nama, username, atau email…" style="min-width:240px">
        <span class="chip">{{ tampil.length }} akun</span>
      </div>
      <sa-loading v-if="memuat"></sa-loading>
      <div class="table-wrap" v-else>
        <table class="tbl">
          <thead><tr><th>Pengguna</th><th>Username</th><th>Peran (RBAC)</th><th>Metode Login</th><th>Status</th><th>Sandi Awal</th><th>Tindakan</th></tr></thead>
          <tbody>
            <tr v-for="r in tampil" :key="r.UserID">
              <td>
                <div class="person">
                  <sa-avatar :nama="r.NamaLengkap" :foto="r.FotoGoogle" ukuran="sm"></sa-avatar>
                  <div class="nm"><b>{{ r.NamaLengkap }}</b><span class="mono">{{ r.UserID }} · {{ r.Email || '-' }}</span></div>
                </div>
              </td>
              <td class="mono fs-sm">{{ r.Username }}</td>
              <td><span class="badge info plain">{{ r.RoleNama }}</span></td>
              <td class="fs-xs">
                <template v-if="r.WajibGoogle">
                  <span class="wa-badge" :class="r.GoogleTertaut ? 'ya' : 'belum'">{{ r.GoogleTertaut ? '🔐 Google tertaut' : 'Google — belum login' }}</span>
                  <div class="txt-3" v-if="r.LastLogin">terakhir {{ tanggal(r.LastLogin,'jam') }}</div>
                </template>
                <span v-else class="txt-3">Username &amp; sandi</span>
              </td>
              <td><sa-badge :teks="r.Status"></sa-badge></td>
              <td><span class="mono fs-xs" :class="r.SandiAwal ? 'txt-warn' : 'txt-3'">{{ r.SandiAwal || '— sudah diganti' }}</span></td>
              <td><div class="flex gap-sm">
                <button class="btn xs secondary" @click="sunting(r)">Ubah</button>
                <button class="btn xs ghost" v-if="!r.WajibGoogle || r.Role === 'SA'" @click="resetSandi(r)" title="Reset sandi">🔑</button>
                <button class="btn xs ghost" v-if="r.GoogleTertaut" @click="resetGoogle(r)" title="Lepas tautan Google">⛓</button>
              </div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <sa-modal v-if="form" :judul="form.UserID ? 'Ubah Pengguna' : 'Tambah Pengguna'" ikon="👤" @tutup="form = null">
      <div class="grid grid-2 gap-md">
        <div class="field"><label class="label">Username <span class="req">*</span></label>
          <input class="input" v-model.trim="form.Username" :readonly="!!form.UserID"></div>
        <div class="field"><label class="label">Nama Lengkap <span class="req">*</span></label>
          <input class="input" v-model.trim="form.NamaLengkap"></div>
        <div class="field"><label class="label">Email <span class="req" v-if="staf(form.Role)">* akun Google</span></label>
          <input class="input" type="email" v-model.trim="form.Email" :placeholder="staf(form.Role) ? 'nama@gmail.com / nama@stisalwafa.ac.id' : ''"></div>
        <div class="field"><label class="label">No. HP</label><input class="input" v-model.trim="form.NoHP"></div>
        <div class="field"><label class="label">Peran (Role)</label>
          <select class="select" v-model="form.Role">
            <option v-for="r in daftarRole" :key="r[0]" :value="r[0]">{{ r[0] }} — {{ r[1] }}</option>
          </select></div>
        <div class="field"><label class="label">Status</label>
          <select class="select" v-model="form.Status"><option>Aktif</option><option>Nonaktif</option></select></div>
      </div>
      <div class="field" v-if="form.UserID"><label class="label">Ganti Kata Sandi (opsional)</label>
        <input class="input" v-model="form.password" placeholder="Kosongkan bila tidak diubah"></div>
      <div class="info-box" v-if="staf(form.Role)"><span>🔐</span><div>Role staf masuk dengan <b>Google OAuth 2.0</b> memakai email di atas —
        tidak perlu sandi. Pastikan email sama persis dengan akun Google yang dipakai.</div></div>
      <div class="info-box"><span>🛡</span><div>Peran menentukan akses modul. Perubahan berlaku pada sesi login berikutnya.</div></div>
      <template #aksi>
        <button class="btn secondary" @click="form = null">Batal</button>
        <button class="btn" :disabled="proses" @click="simpan"><span v-if="proses" class="spin"></span>Simpan</button>
      </template>
    </sa-modal>
  </div>`
};

/* =========================================================================
 * MASTER DATA
 * ======================================================================= */
window.VIEWS['master'] = {
  props: ['user'],
  data: function () { return { data: {}, memuat: true, tipe: 'PROGRAM_KELAS', form: null, proses: false }; },
  mounted: function () { this.muat(); },
  computed: {
    daftarTipe: function () {
      return [['PROGRAM_KELAS','Program Kelas'],['PRODI','Program Studi'],['ANGKATAN','Angkatan'],
              ['PELANGGARAN','Jenis Pelanggaran'],['KATEGORI_ADUAN','Kategori Aduan'],
              ['PJ_PUTRA','PJ Asrama Putra'],['PJ_PUTRI','PJ Asrama Putri']];
    },
    rows: function () { return this.data[this.tipe] || []; }
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('master.listAll', {});
      this.memuat = false;
      if (res.ok) this.data = res.data;
    },
    baru: function () { this.form = { Tipe: this.tipe, Kode: '', Nilai: '', Induk: '', Poin: '' }; },
    sunting: function (r) { this.form = Object.assign({}, r); },
    simpan: async function () {
      this.proses = true;
      var res = this.form.MasterID
        ? await callApi('master.update', { id: this.form.MasterID, data: this.form })
        : await callApi('master.create', { data: this.form });
      this.proses = false;
      if (res.ok) { toast(res.message, 'success'); this.form = null; bersihkanCache(); this.muat(); }
    },
    hapus: async function (r) {
      var ya = await konfirmasi('Nonaktifkan "' + r.Nilai + '"?', 'Data tidak dihapus permanen, hanya dinonaktifkan.', 'Ya', true);
      if (!ya) return;
      var res = await callApi('master.delete', { id: r.MasterID });
      if (res.ok) { toast(res.message, 'success'); bersihkanCache(); this.muat(); }
    }
  },
  template: `
  <div>
    <sa-page judul="Master Data Referensi"
             sub="Program kelas, prodi, angkatan, jenis pelanggaran, kategori aduan, dan penanggung jawab asrama."
             :jalur="['Super Admin','Master Data']">
      <template #aksi><button class="btn" @click="baru">＋ Tambah Data</button></template>
    </sa-page>

    <div class="tabs">
      <button v-for="t in daftarTipe" :key="t[0]" class="tab" :class="{active: tipe === t[0]}" @click="tipe = t[0]">
        {{ t[1] }} <span class="cnt">{{ (data[t[0]] || []).length }}</span>
      </button>
    </div>

    <div class="card">
      <sa-loading v-if="memuat"></sa-loading>
      <div class="table-wrap" v-else-if="rows.length">
        <table class="tbl">
          <thead><tr><th>Kode</th><th>Nilai</th><th>Induk / Relasi</th><th class="num">Poin</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.MasterID">
              <td class="mono">{{ r.Kode }}</td>
              <td><b>{{ r.Nilai }}</b></td>
              <td class="fs-sm">{{ r.Induk || '—' }}</td>
              <td class="num">{{ r.Poin || '—' }}</td>
              <td><sa-badge :teks="r.Status"></sa-badge></td>
              <td><div class="flex gap-sm">
                <button class="btn xs secondary" @click="sunting(r)">Ubah</button>
                <button class="btn xs ghost" @click="hapus(r)">🗑</button>
              </div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <sa-empty v-else judul="Belum ada data" pesan="Tambahkan data referensi untuk kategori ini."></sa-empty>

      <div class="info-box mt-md" v-if="tipe === 'PJ_PUTRA' || tipe === 'PJ_PUTRI'">
        <span>💬</span><div>Format nilai PJ Asrama: <span class="mono">Nama Lengkap|+628xxxxxxxxxx</span> —
        tombol WhatsApp di menu aduan santri dibuat otomatis dari nomor ini.</div>
      </div>
      <div class="info-box mt-md" v-if="tipe === 'PRODI'">
        <span>🔗</span><div>Kolom <b>Induk</b> diisi kode Program Kelas agar daftar prodi tersaring otomatis pada formulir pendaftaran.</div>
      </div>
    </div>

    <sa-modal v-if="form" :judul="form.MasterID ? 'Ubah Master Data' : 'Tambah Master Data'" ikon="🗂" @tutup="form = null">
      <div class="field"><label class="label">Tipe</label>
        <select class="select" v-model="form.Tipe">
          <option v-for="t in daftarTipe" :key="t[0]" :value="t[0]">{{ t[1] }}</option>
        </select></div>
      <div class="grid grid-2 gap-md">
        <div class="field"><label class="label">Kode</label><input class="input" v-model="form.Kode" placeholder="mis. PLG-06"></div>
        <div class="field"><label class="label">Poin (khusus pelanggaran)</label><input type="number" class="input" v-model="form.Poin"></div>
      </div>
      <div class="field"><label class="label">Nilai <span class="req">*</span></label>
        <input class="input" v-model="form.Nilai" placeholder="Nama/teks yang ditampilkan"></div>
      <div class="field"><label class="label">Induk / Relasi</label>
        <input class="input" v-model="form.Induk" placeholder="Kode induk atau tingkat (Ringan/Sedang/Berat)"></div>
      <template #aksi>
        <button class="btn secondary" @click="form = null">Batal</button>
        <button class="btn" :disabled="proses" @click="simpan"><span v-if="proses" class="spin"></span>Simpan</button>
      </template>
    </sa-modal>
  </div>`
};

/* =========================================================================
 * PENGATURAN SISTEM
 * ======================================================================= */
window.VIEWS['pengaturan'] = {
  props: ['user'],
  data: function () { return { rows: [], memuat: true, proses: false }; },
  mounted: function () { this.muat(); },
  computed: {
    grup: function () {
      var out = { 'Login Google OAuth 2.0': [], 'Identitas & Akademik': [], 'Jadwal Makan': [], 'Keuangan': [], 'Sistem & Batasan': [] };
      this.rows.forEach(function (r) {
        var k = String(r.Kunci);
        if (/^(NOTIF_|WA_|EMAIL_)/.test(k)) return;              // diatur di menu WhatsApp & Notifikasi
        if (/^GOOGLE_|LOGIN_DARURAT/.test(k)) out['Login Google OAuth 2.0'].push(r);
        else if (/JAM_MAKAN|MAKAN_OVERRIDE/.test(k)) out['Jadwal Makan'].push(r);
        else if (/REKENING|JATUH_TEMPO/.test(k)) out['Keuangan'].push(r);
        else if (/IMPORT|SCHEMA|BACKUP|AKSES|APP_URL/.test(k)) out['Sistem & Batasan'].push(r);
        else out['Identitas & Akademik'].push(r);
      });
      return out;
    }
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('settings.list', {});
      this.memuat = false;
      if (res.ok) this.rows = res.data;
    },
    yaTidak: function (r) { return r.Nilai === 'YA' || r.Nilai === 'TIDAK'; },
    simpan: async function () {
      this.proses = true;
      var items = this.rows.filter(function (r) { return !/^(NOTIF_|WA_|EMAIL_)/.test(String(r.Kunci)); });
      var res = await callApi('settings.save', { items: items });
      this.proses = false;
      if (res.ok) { toast(res.message, 'success'); bersihkanCache(); }
    }
  },
  template: `
  <div>
    <sa-page judul="Pengaturan Sistem"
             sub="Konfigurasi identitas institusi, jadwal makan, kebijakan keuangan, dan batasan teknis aplikasi."
             :jalur="['Super Admin','Pengaturan']">
      <template #aksi>
        <button class="btn" :disabled="proses" @click="simpan"><span v-if="proses" class="spin"></span>💾 Simpan Semua</button>
      </template>
    </sa-page>

    <sa-loading v-if="memuat"></sa-loading>
    <template v-else>
      <div class="card" v-for="(items, nama) in grup" :key="nama" v-show="items.length">
        <div class="card-head"><div class="t"><div class="card-title">{{ nama }}</div></div></div>
        <div class="grid grid-2 gap-md">
          <div class="field" v-for="r in items" :key="r.Kunci">
            <label class="label">{{ r.Kunci }}</label>
            <select v-if="yaTidak(r)" class="select" v-model="r.Nilai"><option>YA</option><option>TIDAK</option></select>
            <input v-else class="input" v-model="r.Nilai" :readonly="r.Kunci === 'SCHEMA_VERSION'"
                   :placeholder="r.Kunci === 'GOOGLE_CLIENT_ID' ? 'xxxxxxxx.apps.googleusercontent.com' : ''">
            <div class="hint">{{ r.Keterangan }}</div>
          </div>
        </div>
      </div>
      <div class="info-box mb-md"><span>🔐</span><div><b>Login Google:</b> buat OAuth Client ID tipe <i>Web application</i> di
        Google Cloud Console → APIs &amp; Services → Credentials, tambahkan <i>Authorized JavaScript origins</i> =
        alamat GitHub Pages Anda (mis. <code>https://username.github.io</code>), lalu tempel Client ID di atas.
        Matikan <b>LOGIN_DARURAT_SA</b> setelah login Google Super Admin berhasil diuji.</div></div>
      <div class="info-box mb-md"><span>💬</span><div>Pengaturan WhatsApp (Fonnte), Email, dan blast ada di menu
        <a href="#" @click.prevent="$emit('pindah','notifikasi-wa')"><b>WhatsApp &amp; Notifikasi</b></a>.</div></div>
      <div class="info-box warn"><span>⏰</span><div>Format jam makan wajib <b>HH:MM</b> dan jam mulai harus lebih awal
        dari jam selesai — divalidasi ulang di server (BR-28).</div></div>
    </template>
  </div>`
};

/* =========================================================================
 * AUDIT LOG
 * ======================================================================= */
window.VIEWS['audit'] = {
  props: ['user'],
  data: function () { return { rows: [], memuat: true, cari: '' }; },
  mounted: async function () {
    var res = await callApi('audit.list', {});
    this.memuat = false;
    if (res.ok) this.rows = res.data;
  },
  computed: {
    tampil: function () {
      var q = this.cari.toLowerCase();
      return this.rows.filter(function (r) {
        return !q || String(r.NamaUser).toLowerCase().indexOf(q) > -1 || String(r.Aksi).toLowerCase().indexOf(q) > -1;
      });
    }
  },
  template: `
  <div>
    <sa-page judul="Jejak Audit Aktivitas Sistem"
             sub="Seluruh operasi tulis (create/update/delete/verify/scan) tercatat permanen untuk kebutuhan audit yayasan."
             :jalur="['Super Admin','Audit Log']"></sa-page>
    <div class="card">
      <div class="filters">
        <input class="input flex-1" v-model="cari" placeholder="🔍 Cari pengguna atau aksi…" style="min-width:240px">
        <button class="btn sm secondary" @click="unduhExcel(tampil,'AuditLog','Audit')">⬇ Ekspor</button>
      </div>
      <sa-loading v-if="memuat"></sa-loading>
      <div class="table-wrap" v-else-if="tampil.length">
        <table class="tbl">
          <thead><tr><th>Waktu</th><th>Pengguna</th><th>Peran</th><th>Aksi</th><th>Target</th><th>Detail</th></tr></thead>
          <tbody>
            <tr v-for="r in tampil.slice(0,200)" :key="r.AuditID">
              <td class="mono fs-xs">{{ tanggal(r.Tanggal,'jam') }}</td>
              <td class="fs-sm fw6">{{ r.NamaUser }}</td>
              <td><span class="badge plain info">{{ r.Role }}</span></td>
              <td class="mono fs-xs">{{ r.Aksi }}</td>
              <td class="mono fs-xs">{{ r.Target || '—' }}</td>
              <td class="fs-xs txt-3">{{ potong(r.Detail, 60) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <sa-empty v-else judul="Belum ada aktivitas tercatat"></sa-empty>
    </div>
  </div>`
};

/* =========================================================================
 * ARSIP DOKUMEN & PENGUMUMAN
 * ======================================================================= */
window.VIEWS['arsip'] = {
  props: ['user'],
  data: function () {
    return { d: null, memuat: true, unggah: false, berkas: null, judul: '', kategori: 'Umum', deskripsi: '',
             siar: false, pengumuman: { judul: '', isi: '', target: 'SEMUA' }, proses: false };
  },
  mounted: function () { this.muat(); },
  computed: {
    bolehKelola: function () { return ['SA','PMB','PA','PI'].indexOf(this.user.Role) > -1; }
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('archive.list', {});
      this.memuat = false;
      if (res.ok) this.d = res.data;
    },
    pilihBerkas: async function (ev) {
      var f = ev.target.files[0];
      if (f) { this.berkas = await bacaBerkas(f); this.judul = this.judul || f.name; }
    },
    kirimBerkas: async function () {
      if (!this.berkas) { toast('Pilih berkas terlebih dahulu.', 'warning'); return; }
      this.proses = true;
      var res = await callApi('archive.upload',
        { berkas: this.berkas, judul: this.judul, kategori: this.kategori, deskripsi: this.deskripsi });
      this.proses = false;
      if (res.ok) { toast(res.message, 'success'); this.unggah = false; this.berkas = null; this.judul = ''; this.muat(); }
    },
    kirimSiar: async function () {
      if (!this.pengumuman.judul || !this.pengumuman.isi) { toast('Judul dan isi wajib diisi.', 'warning'); return; }
      this.proses = true;
      var res = await callApi('archive.broadcast', this.pengumuman);
      this.proses = false;
      if (res.ok) { toast(res.message, 'success'); this.siar = false; this.pengumuman = { judul: '', isi: '', target: 'SEMUA' }; this.muat(); }
    }
  },
  template: `
  <div>
    <sa-page judul="Arsip Dokumen &amp; Pengumuman"
             sub="Dokumen resmi asrama, SOP, dan siaran informasi kepada mahasantri."
             :jalur="['Pendukung','Arsip &amp; Pengumuman']">
      <template #aksi v-if="bolehKelola">
        <button class="btn secondary" @click="unggah = true">⬆ Unggah Dokumen</button>
        <button class="btn" @click="siar = true">📢 Kirim Pengumuman</button>
      </template>
    </sa-page>

    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="d">
      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><div class="t"><div class="card-title">📢 Pengumuman Terbaru</div></div></div>
          <div class="timeline" v-if="d.pengumuman.length">
            <div class="tl-item" v-for="p in d.pengumuman.slice(0,8)" :key="p.PengumumanID">
              <div class="tl-time">{{ tanggal(p.TanggalKirim,'jam') }} · target {{ p.Target }}</div>
              <div class="tl-title">{{ p.Judul }}</div>
              <div class="tl-desc">{{ p.Isi }}</div>
            </div>
          </div>
          <sa-empty v-else judul="Belum ada pengumuman" ikon="📢"></sa-empty>
        </div>

        <div class="card">
          <div class="card-head"><div class="t"><div class="card-title">📁 Arsip Dokumen</div></div></div>
          <div class="table-wrap" v-if="d.dokumen.length">
            <table class="tbl">
              <thead><tr><th>Judul</th><th>Kategori</th><th class="num">Ukuran</th><th>Tanggal</th><th></th></tr></thead>
              <tbody>
                <tr v-for="k in d.dokumen" :key="k.DokumenID">
                  <td><b class="fs-sm">{{ k.Judul }}</b><div class="fs-xs txt-3">{{ potong(k.Deskripsi, 40) }}</div></td>
                  <td><span class="badge plain">{{ k.Kategori }}</span></td>
                  <td class="num fs-sm">{{ k.UkuranKB }} KB</td>
                  <td class="fs-sm">{{ tanggal(k.Tanggal,'pendek') }}</td>
                  <td><a class="btn xs secondary" :href="k.URL" target="_blank">Buka</a></td>
                </tr>
              </tbody>
            </table>
          </div>
          <sa-empty v-else judul="Belum ada dokumen" ikon="📁"></sa-empty>
        </div>
      </div>
    </template>

    <sa-modal v-if="unggah" judul="Unggah Dokumen Arsip" ikon="⬆" @tutup="unggah = false">
      <div class="field"><label class="label">Berkas (maks 2 MB)</label>
        <input type="file" class="input" @change="pilihBerkas" style="padding:8px"></div>
      <div class="field"><label class="label">Judul</label><input class="input" v-model="judul"></div>
      <div class="field"><label class="label">Kategori</label>
        <select class="select" v-model="kategori">
          <option>Umum</option><option>SOP</option><option>Tata Tertib</option><option>Surat Keputusan</option><option>Laporan</option>
        </select></div>
      <div class="field"><label class="label">Deskripsi</label><textarea class="input" v-model="deskripsi"></textarea></div>
      <template #aksi>
        <button class="btn secondary" @click="unggah = false">Batal</button>
        <button class="btn" :disabled="proses" @click="kirimBerkas"><span v-if="proses" class="spin"></span>Unggah</button>
      </template>
    </sa-modal>

    <sa-modal v-if="siar" judul="Kirim Pengumuman" sub="Notifikasi akan muncul di lonceng seluruh penerima." ikon="📢" @tutup="siar = false">
      <div class="field"><label class="label">Judul</label><input class="input" v-model="pengumuman.judul"></div>
      <div class="field"><label class="label">Isi Pengumuman</label>
        <textarea class="input" v-model="pengumuman.isi" style="min-height:120px"></textarea></div>
      <div class="field"><label class="label">Target Penerima</label>
        <select class="select" v-model="pengumuman.target">
          <option value="SEMUA">Semua pengguna</option>
          <option value="PNG">Santri / penghuni</option>
          <option value="PA">Admin Asrama Putra</option>
          <option value="PI">Admin Asrama Putri</option>
          <option value="PTG">Petugas makan</option>
        </select></div>
      <template #aksi>
        <button class="btn secondary" @click="siar = false">Batal</button>
        <button class="btn" :disabled="proses" @click="kirimSiar"><span v-if="proses" class="spin"></span>Kirim Sekarang</button>
      </template>
    </sa-modal>
  </div>`
};
