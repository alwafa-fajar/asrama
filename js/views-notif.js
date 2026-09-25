/* ==========================================================================
 * SIM ASRAMA v6.1 — WHATSAPP (FONNTE) & NOTIFIKASI
 * --------------------------------------------------------------------------
 * Tab 1  Blast WA     : pilih sasaran → deteksi nomor WA → tulis pesan →
 *                       kirim per batch 10 / 20 / 50 dengan jeda anti-banned
 * Tab 2  Antrean      : pantau pesan otomatis (WA & email) + ulangi yang gagal
 * Tab 3  Konfigurasi  : (SA) token Fonnte, saklar WA/Email, matriks event,
 *                       template pesan, tes kirim
 * ========================================================================== */

window.VIEWS = window.VIEWS || {};

window.VIEWS['notifikasi-wa'] = {
  props: ['user'],
  emits: ['pindah'],
  data: function () {
    return {
      tab: 'blast',
      cfg: null, memuatCfg: false, simpanCfg: false, tokenBaru: '', tesNomor: '', tesEmail: '', perangkat: null,
      editEvent: '',
      // --- blast ---
      ref: null,
      aud: { sumber: 'penghuni', status: '', jenisKelamin: '', gedungId: '', angkatan: '', nomorManual: '' },
      penerima: [], ringkas: null, memuatAud: false, hanyaWA: false, dipilih: {},
      cekWA: { jalan: false, selesai: 0, total: 0 },
      judul: '', pesan: 'Assalamu\'alaikum {nama},\n\n', ukuranBatch: 20, jeda: '5',
      blastAktif: null, kirimBatch: false, otomatis: false, hitungMundur: 0,
      riwayat: [],
      // --- antrean ---
      antrean: [], ringkasAntrean: null, filterAntrean: { status: '', kanal: '' }, memuatAntrean: false
    };
  },
  computed: {
    isSA: function () { return this.user.Role === 'SA'; },
    bisaAntrean: function () { return ['SA', 'PMB'].indexOf(this.user.Role) > -1; },
    tampilPenerima: function () {
      var self = this;
      return this.penerima.filter(function (x) {
        if (!x.valid || x.ganda) return true;             // tetap tampil (ditandai) agar admin tahu
        return !self.hanyaWA || x.statusWA === 'Terdaftar';
      });
    },
    siapKirim: function () {
      var self = this;
      return this.penerima.filter(function (x) {
        return x.valid && !x.ganda && self.dipilih[x.hp] !== false && (!self.hanyaWA || x.statusWA === 'Terdaftar');
      });
    },
    jumlahBatch: function () { return Math.ceil(this.siapKirim.length / this.ukuranBatch); },
    rataJeda: function () {
      var p = String(this.jeda).split('-').map(Number);
      return p.length > 1 ? (p[0] + p[1]) / 2 : (p[0] || 5);
    },
    estimasiMenit: function () {
      return Math.max(1, Math.round(this.siapKirim.length * this.rataJeda / 60));
    },
    pratinjau: function () {
      var x = this.siapKirim[0] || { nama: 'Ahmad Fauzan', nim: '2026001', kamar: 'A.101', santri: 'Ahmad Fauzan', tunggakan: 'Rp 400.000' };
      var v = Object.assign({ institusi: CONFIG.NAMA_INSTITUSI, link: APP.pengaturan.APP_URL || location.href.split('#')[0] }, x);
      return String(this.pesan || '').replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined ? v[k] : ''; });
    },
    persenBlast: function () {
      var b = this.blastAktif;
      if (!b) return 0;
      return b.Total ? Math.round((Number(b.Terkirim) + Number(b.Gagal)) / Number(b.Total) * 100) : 0;
    }
  },
  mounted: function () {
    var self = this;
    callCached('meta.ref', {}, 600000).then(function (r) { if (r.ok) self.ref = r.data; });
    if (this.isSA) this.muatCfg();
    else this.ukuranBatch = Number(APP.pengaturan.WA_BATCH_DEFAULT) || 20;
    this.muatRiwayat();
  },
  beforeUnmount: function () { this.hentikanOtomatis(); },
  methods: {
    /* ---------------- KONFIGURASI ---------------- */
    muatCfg: async function () {
      this.memuatCfg = true;
      var res = await callApi('notif.config', {});
      this.memuatCfg = false;
      if (res.ok) {
        this.cfg = res.data;
        this.ukuranBatch = res.data.batchDefault; this.jeda = res.data.jeda;
      }
    },
    simpanKonfigurasi: async function () {
      var c = this.cfg, matriks = {};
      Object.keys(c.matriks).forEach(function (k) {
        var m = c.matriks[k];
        matriks[k] = { wa: m.wa, email: m.email, pesan: m.pesan, subjek: m.subjek };
      });
      this.simpanCfg = true;
      var res = await callApi('notif.configSave', {
        waAktif: c.waAktif, emailAktif: c.emailAktif, token: this.tokenBaru || '',
        batchDefault: c.batchDefault, jeda: c.jeda, deteksiOtomatis: c.deteksiOtomatis,
        namaPengirim: c.namaPengirim, appUrl: c.appUrl, matriks: matriks
      });
      this.simpanCfg = false;
      if (res.ok) { this.cfg = res.data; this.tokenBaru = ''; toast('Konfigurasi notifikasi disimpan.', 'success'); }
    },
    hapusToken: async function () {
      var ya = await konfirmasi('Hapus token Fonnte?', 'Semua pengiriman WhatsApp akan berhenti.', 'Ya, hapus', true);
      if (!ya) return;
      var res = await callApi('notif.configSave', { token: '__HAPUS__', waAktif: false });
      if (res.ok) { this.cfg = res.data; toast('Token dihapus.', 'success'); }
    },
    cekPerangkat: async function () {
      this.perangkat = null;
      var res = await callApi('wa.device', {});
      if (res.ok) this.perangkat = res.data;
    },
    tesWA: async function () {
      if (!this.tesNomor) { toast('Isi nomor tujuan tes.', 'warning'); return; }
      var res = await callApi('wa.test', { nomor: this.tesNomor });
      if (res.ok) toast(res.message, 'success');
    },
    tesMail: async function () {
      var res = await callApi('email.test', { email: this.tesEmail || this.user.Email });
      if (res.ok) toast(res.message, 'success');
    },
    kembalikanTemplate: function (m) { m.pesan = m.pesanDefault; m.subjek = m.subjekDefault; },

    /* ---------------- BLAST ---------------- */
    muatPenerima: async function () {
      this.memuatAud = true;
      var res = await callApi('wa.audience', this.aud);
      this.memuatAud = false;
      if (res.ok) { this.penerima = res.data.rows; this.ringkas = res.data.ringkas; this.dipilih = {}; }
    },
    deteksiWA: async function () {
      var sasaran = this.penerima.filter(function (x) { return x.valid && !x.ganda; });
      if (!sasaran.length) { toast('Muat penerima terlebih dahulu.', 'warning'); return; }
      var self = this;
      this.cekWA = { jalan: true, selesai: 0, total: sasaran.length };
      var peta = await deteksiNomorWA(sasaran.map(function (x) { return x.hp; }), function (n) { self.cekWA.selesai = n; });
      this.penerima.forEach(function (x) { if (peta[x.hp] !== undefined && peta[x.hp] !== '') x.statusWA = peta[x.hp]; });
      this.cekWA.jalan = false;
    },
    togglePilih: function (x) { this.dipilih[x.hp] = this.dipilih[x.hp] === false; },
    sisip: function (v) {
      var el = this.$refs.pesan;
      if (!el) { this.pesan += v; return; }
      var a = el.selectionStart, b = el.selectionEnd;
      this.pesan = this.pesan.substring(0, a) + v + this.pesan.substring(b);
      this.$nextTick(function () { el.focus(); el.selectionStart = el.selectionEnd = a + v.length; });
    },
    mulaiBlast: async function () {
      if (!this.siapKirim.length) { toast('Belum ada penerima yang valid.', 'warning'); return; }
      if (String(this.pesan).trim().length < 5) { toast('Tulis isi pesan terlebih dahulu.', 'warning'); return; }
      var ya = await konfirmasi('Mulai blast WhatsApp?',
        this.siapKirim.length + ' penerima · ' + this.jumlahBatch + ' batch × ' + this.ukuranBatch +
        ' · jeda ' + this.jeda + ' detik/pesan (±' + this.estimasiMenit + ' menit).', 'Ya, mulai kirim');
      if (!ya) return;
      var s = this.aud.sumber;
      var res = await callApi('wa.blastCreate', {
        judul: this.judul || ('Blast ' + s + ' ' + new Date().toLocaleDateString('id-ID')),
        pesan: this.pesan, ukuranBatch: this.ukuranBatch, jeda: this.jeda,
        sasaran: s + (this.aud.status ? ' · ' + this.aud.status : '') + (this.hanyaWA ? ' · hanya WA' : ''),
        penerima: this.siapKirim.map(function (x) {
          return { id: x.id, nama: x.nama, hp: x.hp, nim: x.nim, kamar: x.kamar, santri: x.santri || x.nama, tunggakan: x.tunggakan || '' };
        })
      });
      if (!res.ok) return;
      toast(res.message, 'success');
      this.blastAktif = { BlastID: res.data.blastId, Total: res.data.total, Terkirim: 0, Gagal: 0, Status: 'Berjalan',
                          UkuranBatch: this.ukuranBatch, JedaDetik: this.jeda };
      this.otomatis = true;
      this.batchBerikut();
    },
    batchBerikut: async function () {
      if (!this.blastAktif || this.kirimBatch) return;
      this.hentikanTimer();
      this.kirimBatch = true;
      var res = await callApi('wa.blastProcess', { blastId: this.blastAktif.BlastID }, { timeout: 120000 });
      this.kirimBatch = false;
      if (!res.ok) { this.otomatis = false; return; }
      this.blastAktif = res.data.blast;
      if (res.data.selesai) {
        this.otomatis = false;
        toast('Blast selesai: ' + res.data.blast.Terkirim + ' terkirim, ' + res.data.blast.Gagal + ' gagal.', 'success');
        this.muatRiwayat();
        return;
      }
      if (this.otomatis) {
        // Tunggu kira-kira selama Fonnte mengirim batch ini (ukuran × jeda), minimal 30 detik
        this.jadwalkan(Math.max(30, Math.round(Number(this.blastAktif.UkuranBatch) * this.rataJedaDari(this.blastAktif.JedaDetik))));
      }
    },
    rataJedaDari: function (j) { var p = String(j || '5').split('-').map(Number); return p.length > 1 ? (p[0] + p[1]) / 2 : (p[0] || 5); },
    jadwalkan: function (detik) {
      var self = this;
      this.hitungMundur = detik;
      this._timer = setInterval(function () {
        self.hitungMundur--;
        if (self.hitungMundur <= 0) { self.hentikanTimer(); self.batchBerikut(); }
      }, 1000);
    },
    hentikanTimer: function () { if (this._timer) { clearInterval(this._timer); this._timer = null; } this.hitungMundur = 0; },
    hentikanOtomatis: function () { this.otomatis = false; this.hentikanTimer(); },
    stopBlast: async function (b) {
      var ya = await konfirmasi('Hentikan blast ' + b.BlastID + '?', 'Pesan yang belum terkirim akan dibatalkan.', 'Ya, hentikan', true);
      if (!ya) return;
      var res = await callApi('wa.blastStop', { blastId: b.BlastID });
      if (res.ok) {
        toast(res.message, 'success');
        if (this.blastAktif && this.blastAktif.BlastID === b.BlastID) { this.hentikanOtomatis(); this.blastAktif = null; }
        this.muatRiwayat();
      }
    },
    lanjutkan: function (b) {
      this.blastAktif = b; this.otomatis = true; this.tab = 'blast';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.batchBerikut();
    },
    muatRiwayat: async function () {
      var res = await callApi('wa.blastList', {}, { diam: true });
      if (res.ok) this.riwayat = res.data;
    },

    /* ---------------- ANTREAN ---------------- */
    muatAntrean: async function () {
      this.memuatAntrean = true;
      var res = await callApi('notif.queue', this.filterAntrean);
      this.memuatAntrean = false;
      if (res.ok) { this.antrean = res.data.rows; this.ringkasAntrean = res.data.ringkas; }
    },
    prosesSekarang: async function () {
      var res = await callApi('notif.processNow', {});
      if (res.ok) { toast(res.message, 'success'); this.muatAntrean(); }
    },
    ulangiGagal: async function () {
      var res = await callApi('notif.retry', {});
      if (res.ok) { toast(res.message, 'success'); this.muatAntrean(); }
    },
    pilihTab: function (t) {
      this.tab = t;
      if (t === 'antrean' && !this.antrean.length) this.muatAntrean();
      if (t === 'config' && !this.cfg) this.muatCfg();
    },
    waKelas: function (s) { return s === 'Terdaftar' ? 'ya' : (s === 'Tidak Terdaftar' ? 'tidak' : 'belum'); },
    waLabel: function (s) { return s === 'Terdaftar' ? '✓ WA' : (s === 'Tidak Terdaftar' ? '✕ bukan WA' : '? belum dicek'); }
  },
  template: `
  <div>
    <sa-page judul="WhatsApp &amp; Notifikasi"
             sub="Blast WhatsApp per batch via Fonnte, deteksi nomor WA, dan saklar notifikasi otomatis WA / Email."
             :jalur="['Pendukung','WhatsApp & Notifikasi']">
    </sa-page>

    <div class="tabs">
      <button class="tab" :class="{active: tab==='blast'}" @click="pilihTab('blast')">📣 Blast WhatsApp</button>
      <button class="tab" v-if="bisaAntrean" :class="{active: tab==='antrean'}" @click="pilihTab('antrean')">📬 Antrean &amp; Riwayat</button>
      <button class="tab" v-if="isSA" :class="{active: tab==='config'}" @click="pilihTab('config')">⚙️ Konfigurasi</button>
    </div>

    <!-- ===================================================== BLAST ===== -->
    <template v-if="tab==='blast'">

      <!-- Progres blast berjalan -->
      <div class="card" v-if="blastAktif" style="border-color:var(--blue)">
        <div class="card-head"><div class="t">
          <div class="card-title">🚀 {{ blastAktif.Judul || blastAktif.BlastID }} <sa-badge :teks="blastAktif.Status"></sa-badge></div>
          <div class="card-sub">Batch {{ blastAktif.UkuranBatch }} nomor · jeda {{ blastAktif.JedaDetik }} detik/pesan ·
            server tetap mengirim 1 batch/menit walau halaman ini ditutup.</div>
        </div></div>
        <div class="progress lg mb-sm"><div class="bar ok" :style="{width: persenBlast + '%'}"></div></div>
        <div class="flex justify-between fs-sm mb-md">
          <span><b>{{ blastAktif.Terkirim }}</b> terkirim · <b class="txt-danger">{{ blastAktif.Gagal }}</b> gagal ·
            {{ Math.max(0, blastAktif.Total - blastAktif.Terkirim - blastAktif.Gagal) }} sisa dari {{ blastAktif.Total }}</span>
          <b>{{ persenBlast }}%</b>
        </div>
        <div class="btn-row" v-if="blastAktif.Status === 'Berjalan'">
          <button class="btn" :disabled="kirimBatch" @click="batchBerikut">
            <span v-if="kirimBatch" class="spin"></span>{{ kirimBatch ? 'Mengirim batch…' : '▶ Kirim Batch Berikutnya Sekarang' }}</button>
          <label class="switch"><input type="checkbox" v-model="otomatis" @change="!otomatis && hentikanTimer()"><span class="trk"></span>
            Otomatis <span v-if="hitungMundur" class="txt-2 fw6">· batch berikut dalam {{ hitungMundur }} dtk</span></label>
          <button class="btn danger secondary" @click="stopBlast(blastAktif)">⏹ Hentikan</button>
        </div>
        <button v-else class="btn secondary" @click="blastAktif = null">Tutup</button>
      </div>

      <div class="grid grid-2 gap-md">
        <!-- LANGKAH 1: SASARAN -->
        <div class="card">
          <div class="card-head"><div class="t"><div class="card-title">1. Pilih Sasaran</div>
            <div class="card-sub">Nomor diperiksa format &amp; duplikatnya otomatis.</div></div></div>
          <div class="grid grid-2 gap-md">
            <div class="field"><label class="label">Sumber</label>
              <select class="select" v-model="aud.sumber">
                <option value="penghuni">Penghuni</option>
                <option value="wali">Wali / Orang Tua Penghuni</option>
                <option value="tunggakan">Penghuni dengan Tunggakan</option>
                <option value="pendaftar">Pendaftar (calon santri)</option>
                <option value="manual">Nomor manual</option>
              </select></div>
            <div class="field" v-if="aud.sumber === 'pendaftar'"><label class="label">Status Pendaftar</label>
              <select class="select" v-model="aud.status"><option value="">Semua</option><option>Baru</option>
                <option>Perlu Revisi</option><option>Diterima</option><option>Ditolak</option></select></div>
            <div class="field" v-else-if="aud.sumber !== 'manual'"><label class="label">Status Penghuni</label>
              <select class="select" v-model="aud.status"><option value="">Aktif</option><option>Alumni</option><option>Keluar</option></select></div>
            <template v-if="aud.sumber !== 'manual'">
              <div class="field"><label class="label">Jenis Kelamin</label>
                <select class="select" v-model="aud.jenisKelamin"><option value="">Semua</option><option value="L">Putra</option><option value="P">Putri</option></select></div>
              <div class="field" v-if="aud.sumber !== 'pendaftar'"><label class="label">Gedung</label>
                <select class="select" v-model="aud.gedungId"><option value="">Semua gedung</option>
                  <option v-for="g in (ref ? ref.gedung : [])" :key="g.GedungID" :value="g.GedungID">{{ g.NamaGedung }}</option></select></div>
              <div class="field" v-if="aud.sumber !== 'pendaftar'"><label class="label">Angkatan</label>
                <select class="select" v-model="aud.angkatan"><option value="">Semua</option>
                  <option v-for="a in (ref ? ref.angkatan : [])" :key="a.MasterID" :value="a.Nilai">{{ a.Nilai }}</option></select></div>
            </template>
          </div>
          <div class="field" v-if="aud.sumber === 'manual'"><label class="label">Daftar nomor (satu per baris, opsional: <code>0812…|Nama</code>)</label>
            <textarea class="input" rows="5" v-model="aud.nomorManual" placeholder="081234567890|Ahmad&#10;085712345678|Fatimah"></textarea></div>
          <div class="btn-row">
            <button class="btn secondary" :disabled="memuatAud" @click="muatPenerima"><span v-if="memuatAud" class="spin dark"></span>👥 Muat Penerima</button>
            <button class="btn secondary" :disabled="cekWA.jalan || !penerima.length" @click="deteksiWA">
              <span v-if="cekWA.jalan" class="spin dark"></span>📱 {{ cekWA.jalan ? ('Mengecek ' + cekWA.selesai + '/' + cekWA.total) : 'Deteksi Nomor WA' }}</button>
          </div>
          <div v-if="ringkas" class="flex gap-sm flex-wrap mt-md fs-xs">
            <span class="chip">{{ ringkas.total }} total</span>
            <span class="chip">{{ ringkas.valid }} valid</span>
            <span class="chip" v-if="ringkas.tidakValid">⚠️ {{ ringkas.tidakValid }} nomor tidak valid</span>
            <span class="chip" v-if="ringkas.ganda">⧉ {{ ringkas.ganda }} ganda</span>
          </div>
          <label class="check mt-sm" v-if="penerima.length"><input type="checkbox" v-model="hanyaWA"> Kirim hanya ke nomor yang <b>terdeteksi WhatsApp</b></label>

          <div class="table-wrap mt-md" v-if="penerima.length" style="max-height:340px;overflow:auto">
            <table class="tbl">
              <thead><tr><th style="width:30px"></th><th>Nama</th><th>Nomor</th><th>WhatsApp</th></tr></thead>
              <tbody>
                <tr v-for="x in tampilPenerima" :key="x.hp + x.id" :style="(!x.valid || x.ganda) ? 'opacity:.5' : ''">
                  <td><input type="checkbox" :disabled="!x.valid || x.ganda" :checked="x.valid && !x.ganda && dipilih[x.hp] !== false" @change="togglePilih(x)"></td>
                  <td><b class="fs-sm">{{ x.nama || '—' }}</b><div class="fs-xs txt-3">{{ x.kamar || x.status || x.nim }} <span v-if="x.tunggakan">· {{ x.tunggakan }}</span></div></td>
                  <td class="mono fs-sm">{{ x.hp || '—' }}<div class="fs-xs txt-danger" v-if="!x.valid">format salah</div><div class="fs-xs txt-3" v-else-if="x.ganda">ganda</div></td>
                  <td><span class="wa-badge" :class="waKelas(x.statusWA)">{{ waLabel(x.statusWA) }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- LANGKAH 2 & 3: PESAN + BATCH -->
        <div class="card">
          <div class="card-head"><div class="t"><div class="card-title">2. Tulis Pesan</div>
            <div class="card-sub">Klik variabel untuk menyisipkan — tiap penerima dapat pesan personal.</div></div></div>
          <div class="field"><label class="label">Judul (catatan internal)</label>
            <input class="input" v-model.trim="judul" placeholder="mis. Pengingat tagihan Oktober"></div>
          <div class="flex gap-sm flex-wrap mb-sm">
            <button class="btn xs secondary" v-for="v in ['{nama}','{nim}','{kamar}','{santri}','{tunggakan}','{institusi}','{link}']"
                    :key="v" @click="sisip(v)">{{ v }}</button>
          </div>
          <div class="field"><textarea ref="pesan" class="input" rows="7" v-model="pesan"
            placeholder="Assalamu'alaikum {nama}, …"></textarea>
            <div class="hint">Format WA: *tebal*, _miring_. {{ pesan.length }} karakter.</div></div>
          <div class="label">Pratinjau (penerima pertama)</div>
          <div class="wa-preview mb-md">{{ pratinjau }}</div>

          <div class="card-title mt-md mb-sm">3. Ukuran Batch &amp; Jeda</div>
          <div class="flex items-center gap-md flex-wrap">
            <div class="seg-batch">
              <button v-for="b in [10,20,50]" :key="b" :class="{on: ukuranBatch === b}" @click="ukuranBatch = b">{{ b }}</button>
            </div>
            <div class="field mb-0" style="width:150px"><input class="input" v-model.trim="jeda" placeholder="5 atau 3-8">
              <div class="hint">jeda antarpesan (detik)</div></div>
          </div>
          <div class="info-box mt-md">
            <span>📊</span><div><b>{{ siapKirim.length }}</b> penerima → <b>{{ jumlahBatch }}</b> batch × {{ ukuranBatch }} ·
              estimasi ±{{ estimasiMenit }} menit. Jeda acak (mis. <code>3-8</code>) lebih aman dari pemblokiran WhatsApp.</div>
          </div>
          <button class="btn lg block mt-md" :disabled="!siapKirim.length || !!(blastAktif && blastAktif.Status === 'Berjalan')" @click="mulaiBlast">
            🚀 Mulai Blast ({{ siapKirim.length }} nomor)</button>
        </div>
      </div>

      <!-- RIWAYAT BLAST -->
      <div class="card">
        <div class="card-head"><div class="t"><div class="card-title">Riwayat Blast</div></div>
          <button class="btn sm secondary" @click="muatRiwayat">↻</button></div>
        <div class="table-wrap" v-if="riwayat.length">
          <table class="tbl">
            <thead><tr><th>Blast</th><th>Sasaran</th><th>Batch</th><th>Progres</th><th>Status</th><th></th></tr></thead>
            <tbody>
              <tr v-for="b in riwayat" :key="b.BlastID">
                <td><b class="fs-sm">{{ b.Judul }}</b><div class="mono fs-xs txt-3">{{ b.BlastID }} · {{ tanggal(b.Tanggal,'jam') }} · {{ b.NamaPembuat }}</div></td>
                <td class="fs-sm">{{ b.Sasaran || '-' }}</td>
                <td class="fs-sm">{{ b.UkuranBatch }} · {{ b.JedaDetik }}s</td>
                <td style="min-width:150px"><div class="progress"><div class="bar ok" :style="{width: b.persen + '%'}"></div></div>
                  <div class="fs-xs txt-2 mt-sm">{{ b.Terkirim }}/{{ b.Total }} <span v-if="Number(b.Gagal)" class="txt-danger">· {{ b.Gagal }} gagal</span></div></td>
                <td><sa-badge :teks="b.Status"></sa-badge></td>
                <td><div class="flex gap-sm" v-if="b.Status === 'Berjalan'">
                  <button class="btn xs" @click="lanjutkan(b)">▶ Pantau</button>
                  <button class="btn xs ghost" @click="stopBlast(b)">⏹</button></div></td>
              </tr>
            </tbody>
          </table>
        </div>
        <sa-empty v-else judul="Belum ada blast" pesan="Blast yang dibuat akan tampil di sini." ikon="📣"></sa-empty>
      </div>
    </template>

    <!-- ===================================================== ANTREAN ===== -->
    <template v-if="tab==='antrean'">
      <div class="grid grid-4 mb-md" v-if="ringkasAntrean">
        <sa-kpi label="Menunggu Kirim" :nilai="ringkasAntrean.antri" ikon="⏳" warna="warn"></sa-kpi>
        <sa-kpi label="Terkirim" :nilai="ringkasAntrean.terkirim" ikon="✅" warna="ok"></sa-kpi>
        <sa-kpi label="Gagal" :nilai="ringkasAntrean.gagal" ikon="⚠️" warna="danger"></sa-kpi>
        <sa-kpi label="Dibatalkan" :nilai="ringkasAntrean.batal" ikon="⏹"></sa-kpi>
      </div>
      <div class="card">
        <div class="filters">
          <select class="select" v-model="filterAntrean.status" @change="muatAntrean"><option value="">Semua status</option>
            <option>Antri</option><option>Terkirim</option><option>Gagal</option><option>Batal</option></select>
          <select class="select" v-model="filterAntrean.kanal" @change="muatAntrean"><option value="">WA &amp; Email</option>
            <option value="WA">WhatsApp</option><option value="EMAIL">Email</option></select>
          <button class="btn sm secondary" @click="muatAntrean">↻ Segarkan</button>
          <button class="btn sm" @click="prosesSekarang">▶ Proses Antrean Sekarang</button>
          <button class="btn sm secondary" v-if="isSA" @click="ulangiGagal">↺ Ulangi yang Gagal</button>
        </div>
        <sa-loading v-if="memuatAntrean"></sa-loading>
        <div class="table-wrap" v-else-if="antrean.length">
          <table class="tbl">
            <thead><tr><th>Waktu</th><th>Kanal</th><th>Tujuan</th><th>Event</th><th>Pesan</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="q in antrean" :key="q.AntrianID">
                <td class="fs-xs">{{ tanggal(q.DibuatPada,'jam') }}</td>
                <td><span class="badge plain" :class="q.Kanal === 'WA' ? 'ok' : 'info'">{{ q.Kanal === 'WA' ? '💬 WA' : '✉️ Email' }}</span></td>
                <td class="fs-sm"><b>{{ q.NamaPenerima || '-' }}</b><div class="mono fs-xs txt-3">{{ q.Tujuan }}</div></td>
                <td class="fs-xs">{{ q.Event }}<div class="txt-3" v-if="q.BlastID">{{ q.BlastID }}</div></td>
                <td class="fs-xs" style="max-width:320px">{{ potong(q.Pesan, 110) }}</td>
                <td><sa-badge :teks="q.Status"></sa-badge><div class="fs-xs txt-3" v-if="q.Status !== 'Terkirim' && q.Respon">{{ potong(q.Respon, 60) }}</div></td>
              </tr>
            </tbody>
          </table>
        </div>
        <sa-empty v-else judul="Antrean kosong" pesan="Pesan otomatis & blast akan tercatat di sini." ikon="📬"></sa-empty>
      </div>
    </template>

    <!-- ===================================================== KONFIGURASI ===== -->
    <template v-if="tab==='config'">
      <sa-loading v-if="memuatCfg || !cfg"></sa-loading>
      <template v-else>
        <div class="grid grid-2 gap-md">
          <div class="card">
            <div class="card-head"><div class="t"><div class="card-title">💬 WhatsApp Gateway — Fonnte</div>
              <div class="card-sub">Token dari dashboard <a href="https://md.fonnte.com" target="_blank" rel="noopener">fonnte.com</a> → Device → Token.</div></div></div>
            <label class="switch mb-md"><input type="checkbox" v-model="cfg.waAktif"><span class="trk"></span>
              Notifikasi WhatsApp {{ cfg.waAktif ? 'AKTIF' : 'NONAKTIF' }}</label>
            <div class="field"><label class="label">Token Fonnte</label>
              <input class="input" type="password" v-model.trim="tokenBaru" autocomplete="off"
                     :placeholder="cfg.tokenTerpasang ? ('Tersimpan: ' + cfg.tokenMasked + ' — isi untuk mengganti') : 'Tempel token perangkat Fonnte'">
              <div class="hint">Disimpan di Script Properties server — tidak tertulis di spreadsheet.</div></div>
            <div class="btn-row">
              <button class="btn sm secondary" :disabled="!cfg.tokenTerpasang" @click="cekPerangkat">📡 Cek Perangkat</button>
              <button class="btn sm ghost" v-if="cfg.tokenTerpasang" @click="hapusToken">Hapus token</button>
            </div>
            <div class="info-box mt-sm" v-if="perangkat"><span>{{ perangkat.status === 'connect' ? '🟢' : '🔴' }}</span><div>
              <b>{{ perangkat.nomor }}</b> · {{ perangkat.status }} · paket {{ perangkat.paket || '-' }} · kuota {{ perangkat.kuota || '-' }}
              <span v-if="perangkat.kedaluwarsa"> · s.d. {{ perangkat.kedaluwarsa }}</span></div></div>
            <div class="flex gap-sm mt-md">
              <input class="input" v-model.trim="tesNomor" placeholder="08xx untuk tes" inputmode="tel">
              <button class="btn sm secondary" :disabled="!cfg.tokenTerpasang" @click="tesWA">Kirim Tes WA</button>
            </div>
            <hr style="border:0;border-top:1px solid var(--border);margin:18px 0">
            <div class="grid grid-2 gap-md">
              <div class="field"><label class="label">Batch blast bawaan</label>
                <div class="seg-batch"><button v-for="b in [10,20,50]" :key="b" :class="{on: cfg.batchDefault === b}" @click="cfg.batchDefault = b">{{ b }}</button></div></div>
              <div class="field"><label class="label">Jeda antarpesan (detik)</label>
                <input class="input" v-model.trim="cfg.jeda" placeholder="5 atau 3-8"></div>
            </div>
            <label class="switch"><input type="checkbox" v-model="cfg.deteksiOtomatis"><span class="trk"></span>
              Deteksi otomatis nomor pendaftar baru (terdaftar WA / tidak)</label>
          </div>

          <div class="card">
            <div class="card-head"><div class="t"><div class="card-title">✉️ Email (Gmail akun pemilik script)</div>
              <div class="card-sub">Sisa kuota hari ini: <b>{{ cfg.emailQuota === null ? '-' : cfg.emailQuota }}</b> email
                (akun Gmail biasa ±100/hari, Google Workspace ±1.500/hari).</div></div></div>
            <label class="switch mb-md"><input type="checkbox" v-model="cfg.emailAktif"><span class="trk"></span>
              Notifikasi Email {{ cfg.emailAktif ? 'AKTIF' : 'NONAKTIF' }}</label>
            <div class="field"><label class="label">Nama pengirim</label><input class="input" v-model="cfg.namaPengirim"></div>
            <div class="flex gap-sm">
              <input class="input" v-model.trim="tesEmail" :placeholder="user.Email || 'email tujuan tes'">
              <button class="btn sm secondary" @click="tesMail">Kirim Tes Email</button>
            </div>
            <hr style="border:0;border-top:1px solid var(--border);margin:18px 0">
            <div class="field"><label class="label">URL aplikasi (untuk {link} di pesan)</label>
              <input class="input" v-model.trim="cfg.appUrl" placeholder="https://username.github.io/sim-asrama/"></div>
            <div class="info-box" :class="cfg.triggerAktif ? '' : 'warn'"><span>{{ cfg.triggerAktif ? '⏱' : '⚠️' }}</span><div>
              <template v-if="cfg.triggerAktif">Trigger antrean aktif — pesan dikirim otomatis tiap 1 menit.
                Antrean: {{ cfg.antrian.antri }} menunggu, {{ cfg.antrian.gagal }} gagal.</template>
              <template v-else>Trigger antrean belum aktif. Simpan konfigurasi ini, atau jalankan <code>pasangTrigger()</code> di editor Apps Script.</template>
            </div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div class="t"><div class="card-title">Matriks Notifikasi Otomatis</div>
            <div class="card-sub">Pilih kanal untuk tiap kejadian. Nonaktifkan saklar utama di atas untuk menghentikan semua.</div></div></div>
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Kejadian</th><th class="text-center">WhatsApp</th><th class="text-center">Email</th><th>Template</th></tr></thead>
              <tbody>
                <template v-for="(m, k) in cfg.matriks" :key="k">
                  <tr>
                    <td><b class="fs-sm">{{ m.label }}</b><div class="mono fs-xs txt-3">{{ k }}</div></td>
                    <td class="text-center"><label class="switch"><input type="checkbox" v-model="m.wa" :disabled="!cfg.waAktif"><span class="trk"></span></label></td>
                    <td class="text-center"><label class="switch"><input type="checkbox" v-model="m.email" :disabled="!cfg.emailAktif"><span class="trk"></span></label></td>
                    <td><button class="btn xs secondary" @click="editEvent = editEvent === k ? '' : k">{{ editEvent === k ? 'Tutup' : '✎ Ubah' }}</button></td>
                  </tr>
                  <tr v-if="editEvent === k">
                    <td colspan="4">
                      <div class="grid grid-2 gap-md">
                        <div>
                          <div class="field"><label class="label">Subjek email</label><input class="input" v-model="m.subjek"></div>
                          <div class="field"><label class="label">Isi pesan</label><textarea class="input" rows="6" v-model="m.pesan"></textarea>
                            <div class="hint">Variabel: {nama} {nim} {kamar} {periode} {jumlah} {jatuhTempo} {rekening} {username} {sandi} {kode} {status} {catatan} {poin} {skor} {institusi} {link}</div></div>
                          <button class="btn xs ghost" @click="kembalikanTemplate(m)">↺ Kembalikan bawaan</button>
                        </div>
                        <div><div class="label">Pratinjau</div><div class="wa-preview">{{ m.pesan }}</div></div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <div class="btn-row mt-md" style="justify-content:flex-end">
            <button class="btn" :disabled="simpanCfg" @click="simpanKonfigurasi"><span v-if="simpanCfg" class="spin"></span>💾 Simpan Konfigurasi</button>
          </div>
        </div>
      </template>
    </template>
  </div>`
};
