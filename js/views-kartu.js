/* ==========================================================================
 * SIM ASRAMA v6.0 — VIEW MODUL KARTU & MAKAN (QR CODE)
 * scanner QR · kelola kartu (ekspor ZIP) · kartu makan saya · log konsumsi
 * --------------------------------------------------------------------------
 * CATATAN: seluruh mekanisme "barcode" pada PRD v5 diganti QR CODE 2D.
 * Pemindaian memakai ZXing BrowserQRCodeReader (kamera HP/tablet dapur),
 * pembuatan gambar QR memakai qrcode-generator (lihat api.js).
 * ========================================================================== */

window.VIEWS = window.VIEWS || {};

/* =========================================================================
 * SCANNER QR KARTU MAKAN (role PTG/PA/PI/SA)
 * ======================================================================= */
window.VIEWS['scanner'] = {
  props: ['user'],
  data: function () {
    return {
      kpi: null, memuat: true, kameraAktif: false, reader: null, perangkat: [], perangkatId: '',
      manual: '', hasil: null, riwayat: [], proses: false, jamSekarang: '', timer: null, beep: true
    };
  },
  mounted: function () {
    this.muat();
    this.jam();
    this.timer = setInterval(this.jam, 1000);
  },
  beforeUnmount: function () {
    this.stopKamera();
    if (this.timer) clearInterval(this.timer);
  },
  methods: {
    jam: function () {
      var d = new Date();
      this.jamSekarang = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
    },
    muat: async function () {
      this.memuat = true;
      var res = await callApi('meal.dashboardKPI', {});
      this.memuat = false;
      if (res.ok) { this.kpi = res.data; this.riwayat = (res.data.riwayat || []).slice(0, 20); }
    },
    mulaiKamera: async function () {
      try { await pustaka('zxing'); } catch (e) { toast('Pustaka pemindai QR gagal dimuat. Periksa koneksi internet.', 'error'); return; }
      try {
        this.reader = new ZXing.BrowserQRCodeReader();
        var devices = [];
        try {
          // API berbeda antar versi ZXing — coba tiga jalur yang umum
          if (ZXing.BrowserCodeReader && ZXing.BrowserCodeReader.listVideoInputDevices) {
            devices = await ZXing.BrowserCodeReader.listVideoInputDevices();
          } else if (this.reader.listVideoInputDevices) {
            devices = await this.reader.listVideoInputDevices();
          } else {
            await navigator.mediaDevices.getUserMedia({ video: true });
            var semua = await navigator.mediaDevices.enumerateDevices();
            devices = semua.filter(function (d) { return d.kind === 'videoinput'; });
          }
        } catch (e) { devices = []; }
        this.perangkat = devices;
        if (!this.perangkatId && devices.length) {
          var belakang = devices.filter(function (d) { return /back|rear|belakang|environment/i.test(d.label); })[0];
          this.perangkatId = (belakang || devices[devices.length - 1]).deviceId;
        }
        this.kameraAktif = true;
        this.$nextTick(this.loopScan);
      } catch (e) {
        toast('Kamera tidak dapat diakses: ' + e.message + ' (wajib HTTPS).', 'error');
        this.kameraAktif = false;
      }
    },
    loopScan: function () {
      var self = this;
      this.reader.decodeFromVideoDevice(this.perangkatId || null, 'videoScan', function (result, err) {
        if (result && !self.proses) {
          self.reader.reset();
          self.kirimScan(result.getText());
        }
      });
    },
    stopKamera: function () {
      try { if (this.reader) this.reader.reset(); } catch (e) {}
      this.kameraAktif = false;
    },
    gantiKamera: function () {
      if (!this.kameraAktif) return;
      try { this.reader.reset(); } catch (e) {}
      this.$nextTick(this.loopScan);
    },
    kirimManual: function () {
      if (!this.manual) return;
      this.kirimScan(this.manual.trim());
      this.manual = '';
    },
    kirimScan: async function (nilai) {
      if (this.proses) return;
      this.proses = true;
      var res = await callApi('meal.scan', { qrValue: nilai }, { diam: true });
      this.proses = false;

      if (res.ok) {
        this.hasil = res.data;
        if (res.data.status === 'BERHASIL') {
          this.bunyi(true);
          this.riwayat.unshift({
            LogID: res.data.logId, NamaLengkap: res.data.penghuni.NamaLengkap,
            PenghuniID: res.data.penghuni.PenghuniID, Kamar: res.data.penghuni.Kamar,
            WaktuMakan: res.data.waktuMakan, Timestamp: res.data.waktuScan, Status: res.data.statusLog
          });
          this.riwayat = this.riwayat.slice(0, 20);
          if (this.kpi) { this.kpi.sudahTapSesiIni++; this.kpi.sisaKuota = Math.max(0, this.kpi.sisaKuota - 1); }
        } else {
          this.bunyi(false);
          this.riwayat.unshift({
            LogID: '-', NamaLengkap: res.data.penghuni ? res.data.penghuni.NamaLengkap : 'Tidak dikenal',
            PenghuniID: res.data.penghuni ? res.data.penghuni.PenghuniID : '-',
            Kamar: res.data.penghuni ? res.data.penghuni.Kamar : '-',
            WaktuMakan: res.data.waktuMakan || '-', Timestamp: new Date().toISOString(),
            Status: res.data.status, alasan: res.data.alasan
          });
        }
      } else {
        this.hasil = { status: 'GAGAL', alasan: res.error };
        this.bunyi(false);
      }

      // Jeda lalu lanjutkan pemindaian otomatis
      var self = this;
      setTimeout(function () {
        self.hasil = null;
        if (self.kameraAktif) self.loopScan();
      }, CONFIG.SCAN_COOLDOWN_MS);
    },
    bunyi: function (sukses) {
      if (!this.beep) return;
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = sukses ? 1180 : 320;
        gain.gain.setValueAtTime(0.16, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start(); osc.stop(ctx.currentTime + 0.22);
      } catch (e) {}
    }
  },
  template: `
  <div>
    <sa-page judul="Scanner QR Code Kartu Makan"
             sub="Pemindaian kartu asrama makan santri secara real-time di terminal dapur. Satu santri = satu jatah per sesi makan."
             :jalur="['Modul Kartu &amp; Makan','Scanner QR']">
      <template #aksi>
        <span class="badge ok">● Live Kitchen Sync</span>
        <button class="btn secondary" @click="beep = !beep">{{ beep ? '🔊 Beeper Aktif' : '🔇 Beeper Mati' }}</button>
        <button class="btn secondary" @click="muat">↻ Sinkron Ulang</button>
      </template>
    </sa-page>

    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="kpi">
      <!-- BANNER SESI -->
      <div class="hero" style="padding:20px 28px">
        <div class="kpi-icon" style="background:rgba(255,255,255,.14);color:#fff;width:48px;height:48px;flex-basis:48px">🍽</div>
        <div class="txt">
          <span class="hero-tag" :style="kpi.sesiAktif.dalamJam ? '' : 'background:rgba(217,119,6,.3)'">
            {{ kpi.sesiAktif.dalamJam ? '● SESI MAKAN AKTIF' : '○ DI LUAR JAM MAKAN' }}: {{ kpi.sesiAktif.sesi.toUpperCase() }}
          </span>
          <h2 style="font-size:21px">Makan {{ kpi.sesiAktif.sesi }} · {{ kpi.sesiAktif.mulai }} — {{ kpi.sesiAktif.selesai }} WIB</h2>
          <p>Petugas: {{ user.NamaLengkap }} · Waktu server lokal {{ jamSekarang }} WIB</p>
        </div>
        <div class="hero-actions">
          <div class="text-center">
            <div class="fs-xs" style="color:#93AECF">SANTRI SUDAH TAP SESI INI</div>
            <div style="font-size:28px;font-weight:700" class="num">{{ kpi.sudahTapSesiIni }} / {{ kpi.santriBerhak }}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-23">
        <!-- KAMERA -->
        <div>
          <div class="card">
            <div class="card-head">
              <div class="t"><div class="card-title">📷 Optical Lens Viewport</div>
                <div class="card-sub">Auto-detect QR Code · arahkan kamera ke kartu santri</div></div>
              <select class="select" v-model="perangkatId" @change="gantiKamera" style="width:auto;min-width:180px" v-if="perangkat.length > 1">
                <option v-for="p in perangkat" :key="p.deviceId" :value="p.deviceId">{{ p.label || 'Kamera' }}</option>
              </select>
            </div>

            <div class="scanner">
              <video id="videoScan" v-show="kameraAktif" autoplay muted playsinline></video>
              <div v-if="!kameraAktif" class="placeholder">
                <div style="font-size:36px">⬚</div>
                <p class="mt-sm">Kamera belum aktif.<br>Klik tombol di bawah untuk mulai memindai QR Code.</p>
                <button class="btn mt-md" @click="mulaiKamera">▶ Aktifkan Kamera</button>
              </div>
              <template v-if="kameraAktif">
                <div class="scan-frame"><i></i><i></i><i></i><i></i></div>
                <div class="scan-line"></div>
                <div class="scan-meta"><span>● ZXing QR Engine</span><span>Stateless · HTTPS</span></div>
              </template>
            </div>

            <div class="btn-row mt-md">
              <button class="btn secondary" v-if="kameraAktif" @click="stopKamera">■ Hentikan Kamera</button>
              <span class="fs-sm txt-2 flex items-center" style="gap:6px">
                ℹ️ Kamera wajib HTTPS (GitHub Pages sudah HTTPS).
              </span>
            </div>
          </div>

          <!-- INPUT MANUAL -->
          <div class="card">
            <div class="card-head"><div class="t">
              <div class="card-title">⌨️ Input Manual / Pemindai Handheld</div>
              <div class="card-sub">Cadangan bila kamera tidak tersedia — ketik NIM, PenghuniID, atau tempel nilai QR.</div>
            </div></div>
            <form class="flex gap-sm flex-wrap" @submit.prevent="kirimManual">
              <input class="input flex-1 mono" v-model="manual" placeholder="mis. 202401088 atau SIM-PNG0001-a3f9c2b1"
                     style="min-width:240px" autofocus>
              <button class="btn dark" :disabled="proses">
                <span v-if="proses" class="spin"></span>✔ Verifikasi Manual
              </button>
            </form>
          </div>

          <!-- HASIL -->
          <div v-if="hasil" class="card tight">
            <div class="result" :class="hasil.status === 'BERHASIL' ? 'ok' : (hasil.status === 'DITOLAK' ? 'warn' : 'bad')">
              <div style="font-size:30px">{{ hasil.status === 'BERHASIL' ? '✅' : (hasil.status === 'DITOLAK' ? '⛔' : '❌') }}</div>
              <div class="flex-1">
                <div class="big">
                  {{ hasil.status === 'BERHASIL' ? 'VERIFIKASI BERHASIL — SILAKAN AMBIL PORSI' :
                     (hasil.status === 'DITOLAK' ? 'DITOLAK — JATAH SUDAH DIGUNAKAN' : 'VERIFIKASI GAGAL') }}
                </div>
                <small>{{ hasil.alasan || ('Jatah makan ' + hasil.waktuMakan + ' · ' + (hasil.statusLog || 'Valid')) }}</small>
              </div>
              <span class="badge plain" style="background:rgba(255,255,255,.2);color:#fff" v-if="hasil.waktuMakan">
                {{ hasil.waktuMakan }}
              </span>
            </div>

            <div class="flex items-center gap-md mt-md" v-if="hasil.penghuni">
              <sa-avatar :nama="hasil.penghuni.NamaLengkap" :foto="hasil.penghuni.FotoURL" ukuran="lg"></sa-avatar>
              <div class="flex-1">
                <div class="fw7" style="font-size:19px">{{ hasil.penghuni.NamaLengkap }}</div>
                <div class="mono fs-sm txt-2">{{ hasil.penghuni.NIM }} · {{ hasil.penghuni.Prodi }}</div>
                <div class="flex gap-sm mt-sm flex-wrap">
                  <span class="chip">🏠 {{ hasil.penghuni.Kamar }}</span>
                  <span class="chip">🍽 {{ hasil.penghuni.NamaPaket }}</span>
                  <span class="chip" v-if="hasil.waktuScan">⏱ {{ tanggal(hasil.waktuScan,'waktu') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PROGRES & LOG -->
        <div>
          <div class="card">
            <div class="card-head"><div class="t">
              <div class="card-title">📊 Progres Sesi {{ kpi.sesiAktif.sesi }}</div>
              <div class="card-sub">Kuota terverifikasi hari ini</div>
            </div></div>
            <div class="grid grid-3 gap-sm text-center mb-md">
              <div><div class="fs-xs txt-2">TOTAL KUOTA</div><div class="kpi-value" style="font-size:22px">{{ angka(kpi.santriBerhak) }}</div></div>
              <div style="background:var(--sky-soft);border-radius:var(--r);padding:8px">
                <div class="fs-xs txt-blue">SUDAH TAP</div><div class="kpi-value txt-blue" style="font-size:22px">{{ angka(kpi.sudahTapSesiIni) }}</div></div>
              <div><div class="fs-xs txt-2">SISA KUOTA</div><div class="kpi-value" style="font-size:22px">{{ angka(kpi.sisaKuota) }}</div></div>
            </div>
            <sa-progress :nilai="kpi.santriBerhak ? (kpi.sudahTapSesiIni / kpi.santriBerhak * 100) : 0"
                         :label="'Kapasitas saji terserap'"></sa-progress>
            <div class="grid grid-3 gap-sm mt-md text-center fs-xs">
              <div class="chip" style="justify-content:center">Pagi {{ kpi.pagi }}</div>
              <div class="chip" style="justify-content:center">Siang {{ kpi.siang }}</div>
              <div class="chip" style="justify-content:center">Malam {{ kpi.malam }}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-head"><div class="t">
              <div class="card-title">🕘 Log Pemindaian Langsung</div>
              <div class="card-sub">20 transaksi terakhir</div>
            </div><span class="badge ok">Live</span></div>
            <div class="scan-log">
              <div class="scan-row" v-for="(r,i) in riwayat" :key="i">
                <span class="tm">{{ tanggal(r.Timestamp,'waktu') }}</span>
                <div class="flex-1" style="min-width:0">
                  <b class="fs-sm">{{ potong(r.NamaLengkap, 24) }}</b>
                  <div class="fs-xs txt-3">{{ r.Kamar || r.PenghuniID }} · {{ r.WaktuMakan }}</div>
                </div>
                <span class="badge" :class="r.Status === 'Valid' || r.Status === 'BERHASIL' ? 'ok' : (r.Status === 'Override' ? 'warn' : 'danger')">
                  {{ r.Status === 'Valid' ? 'BERHASIL' : r.Status }}
                </span>
              </div>
              <sa-empty v-if="!riwayat.length" judul="Belum ada pemindaian"
                        pesan="Log akan muncul setelah santri pertama melakukan tap." ikon="⬚"></sa-empty>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>`
};

/* =========================================================================
 * KELOLA KARTU MAKAN (admin) — cetak & ekspor ZIP
 * ======================================================================= */
window.VIEWS['kelola-kartu'] = {
  props: ['user'],
  data: function () {
    return { rows: [], memuat: true, ref: null, f: { angkatan: '', paketId: '', hanyaEligible: false },
             cari: '', pratinjau: null, prosesZip: false, progres: 0, totalZip: 0 };
  },
  mounted: async function () {
    var r = await callCached('meta.ref', {});
    if (r.ok) this.ref = r.data;
    this.muat();
  },
  computed: {
    tampil: function () {
      var q = this.cari.toLowerCase();
      return this.rows.filter(function (r) {
        return !q || String(r.NamaLengkap).toLowerCase().indexOf(q) > -1 || String(r.NIM).indexOf(q) > -1;
      });
    },
    statistik: function () {
      return {
        total: this.rows.length,
        eligible: this.rows.filter(function (r) { return r.EligibleKartu; }).length,
        belum: this.rows.filter(function (r) { return r.IncludeMakan && !r.EligibleKartu; }).length
      };
    }
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('card.list', this.f);
      this.memuat = false;
      if (res.ok) this.rows = res.data;
    },
    toggle: async function (r) {
      await optimistic(function () {
        var lama = r.EligibleKartu;
        r.EligibleKartu = !lama;
        if (r.EligibleKartu && !r.qrValue) r.qrValue = '(diperbarui setelah muat ulang)';
        return function () { r.EligibleKartu = lama; };
      }, 'card.approveEligible', { penghuniId: r.PenghuniID, eligible: !r.EligibleKartu });
      this.muat();
    },
    lihat: async function (r) {
      var res = await callApi('card.generate', { penghuniId: r.PenghuniID });
      if (res.ok) this.pratinjau = res.data;
    },
    unduhPdf: async function (data) {
      var doc = await buatPdfKartu(data);
      doc.save('KartuMakan_' + (data.NIM || data.PenghuniID) + '_' + data.NamaLengkap.replace(/\s+/g, '_') + '.pdf');
      toast('Kartu PDF diunduh.', 'success');
    },
    eksporZip: async function () {
      var ya = await konfirmasi('Ekspor semua kartu ke ZIP?',
        'Kartu dibuat per batch 10 santri. Jangan tutup halaman sampai proses selesai.', 'Ya, mulai');
      if (!ya) return;
      this.prosesZip = true; this.progres = 0;
      try { await Promise.all([pustaka('jszip'), pustaka('jspdf')]); } catch (e) { toast(e.message, 'error'); this.prosesZip = false; return; }
      var zip = new JSZip(), offset = 0, selesai = false, total = 0;
      try {
        while (!selesai) {
          var res = await callApi('card.bulkExport',
            { angkatan: this.f.angkatan, paketId: this.f.paketId, offset: offset, limit: CONFIG.BULK_CARD_BATCH });
          if (!res.ok) break;
          total = res.data.total; this.totalZip = total;
          for (var i = 0; i < res.data.batch.length; i++) {
            var k = res.data.batch[i];
            k.institusi = res.data.institusi; k.tahunAkademik = res.data.tahunAkademik;
            var doc = await buatPdfKartu(k);
            zip.file((k.NIM || k.PenghuniID) + '_' + k.NamaLengkap.replace(/[\\/:*?"<>|]/g, '') + '.pdf',
                     doc.output('blob'));
            this.progres++;
          }
          offset += CONFIG.BULK_CARD_BATCH;
          selesai = res.data.selesai;
        }
        if (this.progres) {
          var blob = await zip.generateAsync({ type: 'blob' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = 'KartuAsramaMakan_' + new Date().toISOString().substring(0, 10) + '.zip';
          a.click(); URL.revokeObjectURL(url);
          toast(this.progres + ' kartu diekspor ke ZIP.', 'success');
        } else { toast('Tidak ada kartu yang memenuhi filter.', 'warning'); }
      } catch (e) {
        toast('Ekspor gagal: ' + e.message, 'error');
      }
      this.prosesZip = false;
    }
  },
  template: `
  <div>
    <sa-page judul="Kelola Kartu Asrama Makan (QR Code)"
             sub="Persetujuan hak kartu, pratinjau desain, cetak individu, dan ekspor massal PDF dalam satu berkas ZIP."
             :jalur="['Modul Kartu &amp; Makan','Kelola Kartu']">
      <template #aksi>
        <button class="btn secondary" @click="muat">↻ Segarkan</button>
        <button class="btn dark" :disabled="prosesZip" @click="eksporZip">
          <span v-if="prosesZip" class="spin"></span>
          {{ prosesZip ? ('Memproses ' + progres + '/' + totalZip + '…') : '📦 Ekspor ZIP Semua Kartu' }}
        </button>
      </template>
    </sa-page>

    <div class="grid grid-3 mb-md">
      <sa-kpi label="Santri Terdaftar" :nilai="angka(statistik.total)" ikon="👥"></sa-kpi>
      <sa-kpi label="Kartu QR Aktif" :nilai="angka(statistik.eligible)" ikon="⬚" warna="ok"
              catatan="Berhak jatah katering 3x/hari"></sa-kpi>
      <sa-kpi label="Menunggu Persetujuan" :nilai="statistik.belum" ikon="⏳" warna="warn"
              catatan="Paket katering belum di-approve admin"></sa-kpi>
    </div>

    <div class="card">
      <div class="filters">
        <input class="input flex-1" v-model="cari" placeholder="🔍 Cari nama atau NIM…" style="min-width:220px">
        <select class="select" v-model="f.angkatan" @change="muat" v-if="ref">
          <option value="">Semua angkatan</option>
          <option v-for="a in ref.angkatan" :key="a.MasterID" :value="a.Nilai">{{ a.Nilai }}</option>
        </select>
        <select class="select" v-model="f.paketId" @change="muat" v-if="ref">
          <option value="">Semua paket</option>
          <option v-for="p in ref.paket" :key="p.PaketID" :value="p.PaketID">{{ p.NamaPaket }}</option>
        </select>
        <label class="check"><input type="checkbox" v-model="f.hanyaEligible" @change="muat"> Hanya kartu aktif</label>
      </div>

      <div class="progress lg mb-md" v-if="prosesZip">
        <div class="bar" :style="{width: (totalZip ? (progres/totalZip*100) : 0) + '%'}"></div>
      </div>

      <sa-loading v-if="memuat"></sa-loading>
      <div class="table-wrap" v-else-if="tampil.length">
        <table class="tbl">
          <thead><tr><th>Mahasantri</th><th>Kamar</th><th>Paket</th><th>Nilai QR</th><th>Status Kartu</th><th>Tindakan</th></tr></thead>
          <tbody>
            <tr v-for="r in tampil.slice(0,100)" :key="r.PenghuniID">
              <td>
                <div class="person">
                  <sa-avatar :nama="r.NamaLengkap" :foto="r.FotoURL" ukuran="sm"></sa-avatar>
                  <div class="nm"><b>{{ r.NamaLengkap }}</b><span class="mono">{{ r.NIM }} · {{ r.Prodi }}</span></div>
                </div>
              </td>
              <td class="fs-sm">{{ r.NomorKamar }}</td>
              <td class="fs-sm">{{ r.NamaPaket }}</td>
              <td class="mono fs-xs">{{ r.qrValue || '—' }}</td>
              <td>
                <span class="badge" :class="r.EligibleKartu ? 'ok' : (r.IncludeMakan ? 'warn' : '')">
                  {{ r.EligibleKartu ? 'Aktif' : (r.IncludeMakan ? 'Belum disetujui' : 'Non-katering') }}
                </span>
              </td>
              <td>
                <div class="flex gap-sm">
                  <button class="btn xs secondary" :disabled="!r.EligibleKartu" @click="lihat(r)">Pratinjau</button>
                  <button class="btn xs" v-if="r.IncludeMakan" @click="toggle(r)">
                    {{ r.EligibleKartu ? 'Nonaktifkan' : 'Aktifkan' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <sa-empty v-else judul="Belum ada santri" pesan="Tidak ada data pada filter ini."></sa-empty>
    </div>

    <sa-modal v-if="pratinjau" judul="Pratinjau Kartu Asrama Makan"
              :sub="pratinjau.NamaLengkap + ' · ' + pratinjau.PenghuniID" ikon="⬚" @tutup="pratinjau = null">
      <div class="idcard" style="margin:0 auto">
        <div class="idcard-head">
          <div style="width:22px;height:22px;border-radius:5px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center">🏛</div>
          <div><small>{{ pratinjau.institusi }}</small><b>KARTU KONSUMSI MAHASANTRI</b></div>
          <span style="margin-left:auto;font-size:9px;background:rgba(255,255,255,.18);padding:2px 7px;border-radius:999px">
            {{ pratinjau.tahunAkademik }}</span>
        </div>
        <div class="idcard-body">
          <div class="idcard-photo">
            <img v-if="pratinjau.FotoURL" :src="pratinjau.FotoData || pratinjau.FotoURL" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:8px">
            <template v-else>{{ inisial(pratinjau.NamaLengkap) }}</template>
          </div>
          <div class="idcard-info">
            <div class="nm">{{ pratinjau.NamaLengkap }}</div>
            <div class="rw"><span>NIM</span><b>{{ pratinjau.NIM || '-' }}</b></div>
            <div class="rw"><span>Prodi</span><b>{{ potong(pratinjau.Prodi, 22) }}</b></div>
            <div class="rw"><span>Angkatan</span><b>{{ pratinjau.Angkatan }}</b></div>
            <div class="rw"><span>Kamar</span><b>{{ potong(pratinjau.Kamar, 22) }}</b></div>
          </div>
          <div class="idcard-qr">
            <div v-html="qrImgTag(pratinjau.qrValue, 78)"></div>
            <span>{{ pratinjau.qrValue }}</span>
          </div>
        </div>
        <div class="idcard-foot">
          <span>{{ pratinjau.NamaPaket }}</span>
          <span>Berlaku s.d. T.A. {{ pratinjau.berlakuSampai }}</span>
        </div>
      </div>
      <div class="info-box mt-md"><span>🔐</span><div>Nilai QR dibentuk dari <b>SIM-{PenghuniID}-HMAC</b> dan diverifikasi
        di server saat pemindaian. Kartu otomatis tidak berlaku setelah santri checkout (BR-24).</div></div>
      <template #aksi>
        <button class="btn secondary" @click="pratinjau = null">Tutup</button>
        <button class="btn" @click="unduhPdf(pratinjau)">⬇ Unduh Kartu PDF (HD)</button>
      </template>
    </sa-modal>
  </div>`
};

/* =========================================================================
 * KARTU MAKAN SAYA (penghuni)
 * ======================================================================= */
window.VIEWS['kartu-saya'] = {
  props: ['user'],
  data: function () { return { kartu: null, riwayat: null, memuat: true, bulan: '' }; },
  mounted: function () {
    var d = new Date();
    this.bulan = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    this.muat();
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var a = await callApi('card.generate', {}, { diam: true });
      var b = await callApi('meal.myHistory', { bulan: this.bulan });
      this.memuat = false;
      if (a.ok) this.kartu = a.data;
      if (b.ok) this.riwayat = b.data;
    },
    unduh: async function () {
      var doc = await buatPdfKartu(this.kartu);
      doc.save('KartuMakan_' + (this.kartu.NIM || this.kartu.PenghuniID) + '.pdf');
      toast('Kartu berhasil diunduh.', 'success');
    },
    qrPenuh: function () {
      Swal.fire({
        title: 'QR Kartu Makan', html: '<div style="padding:10px">' + qrImgTag(this.kartu.qrValue, 260) +
          '<div style="font-family:monospace;font-size:11px;margin-top:10px;color:#4A5568">' + this.kartu.qrValue + '</div></div>',
        showConfirmButton: true, confirmButtonText: 'Tutup', confirmButtonColor: '#2563EB', width: 360
      });
    }
  },
  template: `
  <div>
    <sa-page judul="Kartu Asrama Makan &amp; Riwayat Konsumsi"
             sub="Identitas digital resmi hak konsumsi makanan mahasantri. Tunjukkan QR kepada petugas dapur."
             :jalur="['Layanan Mandiri','Kartu Makan Saya']"></sa-page>

    <sa-loading v-if="memuat"></sa-loading>

    <div class="info-box warn" v-else-if="!kartu">
      <span>ℹ️</span><div><b>Anda belum memiliki kartu makan.</b> Kartu hanya diterbitkan untuk santri dengan paket
      termasuk katering dan telah disetujui admin asrama.</div>
    </div>

    <template v-else>
      <div class="grid grid-23">
        <div class="card">
          <div class="card-head">
            <div class="t"><div class="card-title">Kartu Konsumsi Mahasantri</div>
              <div class="card-sub">Standar ISO/IEC 7810 ID-1 · CR80 (85,6 × 54 mm)</div></div>
            <span class="badge ok">Kartu Aktif &amp; Terverifikasi</span>
          </div>

          <div class="idcard" style="margin:0 auto">
            <div class="idcard-head">
              <div style="width:22px;height:22px;border-radius:5px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center">🏛</div>
              <div><small>{{ kartu.institusi }}</small><b>KARTU KONSUMSI MAHASANTRI</b></div>
              <span style="margin-left:auto;font-size:9px;background:rgba(255,255,255,.18);padding:2px 7px;border-radius:999px">
                {{ kartu.tahunAkademik }}</span>
            </div>
            <div class="idcard-body">
              <div class="idcard-photo">
                <img v-if="kartu.FotoURL" :src="kartu.FotoData || kartu.FotoURL" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:8px">
                <template v-else>{{ inisial(kartu.NamaLengkap) }}</template>
              </div>
              <div class="idcard-info">
                <div class="nm">{{ kartu.NamaLengkap }}</div>
                <div class="rw"><span>NIM</span><b>{{ kartu.NIM || '-' }}</b></div>
                <div class="rw"><span>Prodi</span><b>{{ potong(kartu.Prodi, 22) }}</b></div>
                <div class="rw"><span>Angkatan</span><b>{{ kartu.Angkatan }}</b></div>
                <div class="rw"><span>Kamar</span><b>{{ potong(kartu.Kamar, 22) }}</b></div>
              </div>
              <div class="idcard-qr" @click="qrPenuh" style="cursor:pointer">
                <div v-html="qrImgTag(kartu.qrValue, 78)"></div>
                <span>{{ kartu.qrValue }}</span>
              </div>
            </div>
            <div class="idcard-foot">
              <span>{{ kartu.NamaPaket }}</span>
              <span>Berlaku s.d. T.A. {{ kartu.berlakuSampai }}</span>
            </div>
          </div>

          <div class="btn-row mt-lg" style="justify-content:center">
            <button class="btn dark" @click="unduh">⬇ Unduh Kartu Digital (PDF HD)</button>
            <button class="btn secondary" @click="qrPenuh">⬚ Tampilkan QR Layar Penuh</button>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="card-head"><div class="t"><div class="card-title">🕐 Jadwal Sesi &amp; SOP Makan</div></div></div>
            <div v-for="j in kartu.jadwalMakan" :key="j.sesi" class="kv">
              <span>{{ j.sesi === 'Pagi' ? '🌅' : (j.sesi === 'Siang' ? '☀️' : '🌙') }} Makan {{ j.sesi }}</span>
              <b class="mono">{{ j.mulai }} – {{ j.selesai }}</b>
            </div>
            <div class="info-box warn mt-md"><span>⚠️</span><div>
              <b>Ketentuan penting:</b><br>
              • Jatah maksimal <b>1 kali tap</b> per sesi makan.<br>
              • Kartu bersifat pribadi &amp; amanah — dilarang dipinjamkan.<br>
              • Izin puasa sunnah diinput H-1 agar porsi dialihkan menjadi donasi.
            </div></div>
          </div>

          <div class="card" v-if="riwayat">
            <div class="card-head"><div class="t">
              <div class="card-title">Kehadiran Konsumsi Bulan Ini</div></div></div>
            <div class="text-center">
              <div class="kpi-value txt-blue">{{ riwayat.persen }}%</div>
              <div class="fs-sm txt-2">{{ riwayat.totalTerambil }} jatah terambil</div>
            </div>
            <sa-progress :nilai="riwayat.persen" warna="ok" class="mt-md"></sa-progress>
          </div>
        </div>
      </div>

      <div class="card" v-if="riwayat">
        <div class="card-head">
          <div class="t"><div class="card-title">Riwayat Presensi Konsumsi Santri</div>
            <div class="card-sub">Rekam jejak pengambilan jatah makanan harian di Dapur Pusat</div></div>
          <input class="input" type="month" v-model="bulan" @change="muat" style="width:auto">
          <button class="btn sm secondary" @click="unduhExcel(riwayat.rows,'RiwayatMakan_' + bulan,'Konsumsi')">⬇ Unduh Rekap</button>
        </div>
        <div class="table-wrap" v-if="riwayat.rows.length">
          <table class="tbl">
            <thead><tr><th>Tanggal &amp; Hari</th><th>Makan Pagi</th><th>Makan Siang</th><th>Makan Malam</th><th>Total Harian</th></tr></thead>
            <tbody>
              <tr v-for="r in riwayat.rows" :key="r.tanggal">
                <td>{{ tanggal(r.tanggal,'hari') }}</td>
                <td><span class="badge" :class="r.Pagi ? 'ok' : ''">{{ r.Pagi ? '✔ ' + r.Pagi + ' WIB' : 'Tidak diambil' }}</span></td>
                <td><span class="badge" :class="r.Siang ? 'ok' : ''">{{ r.Siang ? '✔ ' + r.Siang + ' WIB' : 'Tidak diambil' }}</span></td>
                <td><span class="badge" :class="r.Malam ? 'ok' : ''">{{ r.Malam ? '✔ ' + r.Malam + ' WIB' : 'Tidak diambil' }}</span></td>
                <td class="fw6">{{ [r.Pagi,r.Siang,r.Malam].filter(x=>x).length }} / 3 sesi</td>
              </tr>
            </tbody>
          </table>
        </div>
        <sa-empty v-else judul="Belum ada riwayat" pesan="Belum ada pemindaian kartu pada bulan ini."></sa-empty>
      </div>
    </template>
  </div>`
};

/* =========================================================================
 * LOG & LAPORAN KONSUMSI MAKAN (admin)
 * ======================================================================= */
window.VIEWS['log-makan'] = {
  props: ['user'],
  data: function () {
    return { d: null, log: [], memuat: true, bulan: '', f: { tanggal: '', waktuMakan: '' } };
  },
  mounted: function () {
    var d = new Date();
    this.bulan = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    this.muat();
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var a = await callApi('meal.dashboardKPI', {});
      var b = await callApi('meal.list', Object.assign({ bulan: this.bulan }, this.f));
      this.memuat = false;
      if (a.ok) this.d = a.data;
      if (b.ok) this.log = b.data.rows;
    },
    ekspor: function () {
      unduhExcel(this.log, 'LogMakan_' + this.bulan, 'LogMakan');
    }
  },
  template: `
  <div>
    <sa-page judul="Laporan Presensi &amp; Konsumsi Makan Santri"
             sub="Audit analitik distribusi katering harian 3x makan, serapan kuota, dan performa terminal pemindai dapur."
             :jalur="['Laporan &amp; Analitika','Presensi &amp; Konsumsi Makan']">
      <template #aksi>
        <input class="input" type="month" v-model="bulan" @change="muat" style="width:auto">
        <button class="btn" @click="ekspor">⬇ Ekspor Log Makan (.xlsx)</button>
      </template>
    </sa-page>

    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="d">
      <div class="grid grid-4 mb-md">
        <sa-kpi label="Total Porsi Terdistribusi" :nilai="angka(d.totalBulanIni)" satuan="porsi" ikon="🍽"
                :catatan="'Bulan ' + periodeLabel(bulan)"></sa-kpi>
        <sa-kpi label="Santri Berhak Makan" :nilai="angka(d.santriBerhak)" satuan="santri" ikon="👥" warna="ok"
                catatan="Paket katering aktif &amp; terverifikasi"></sa-kpi>
        <sa-kpi label="Konsumsi Hari Ini" :nilai="angka(d.totalHariIni)" satuan="porsi" ikon="📅"
                :catatan="'Pagi ' + d.pagi + ' · Siang ' + d.siang + ' · Malam ' + d.malam"></sa-kpi>
        <sa-kpi label="Sesi Aktif Sekarang" :nilai="d.sesiAktif.sesi" ikon="⏱"
                :warna="d.sesiAktif.dalamJam ? 'ok' : 'warn'"
                :catatan="d.sesiAktif.mulai + ' – ' + d.sesiAktif.selesai + ' WIB'"></sa-kpi>
      </div>

      <div class="card">
        <div class="card-head"><div class="t">
          <div class="card-title">Distribusi &amp; Efisiensi Konsumsi per Sesi Makan</div>
          <div class="card-sub">Rata-rata harian aktual dibanding alokasi baku katering</div>
        </div></div>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Sesi &amp; Jam Makan</th><th class="num">Target Harian</th><th class="num">Rata-rata Tap Hadir</th>
              <th>Serapan</th><th class="num">Total Bulan Ini</th><th>Performa Layanan</th></tr></thead>
            <tbody>
              <tr v-for="s in d.perSesi" :key="s.sesi">
                <td><b>{{ s.sesi === 'Pagi' ? '🌅' : (s.sesi === 'Siang' ? '☀️' : '🌙') }} Makan {{ s.sesi }}</b>
                  <div class="mono fs-xs txt-3">{{ s.mulai }} — {{ s.selesai }} WIB</div></td>
                <td class="num">{{ angka(s.target) }} porsi</td>
                <td class="num fw6">{{ angka(s.rataTap) }}</td>
                <td style="min-width:150px"><sa-progress :nilai="s.persen" :warna="s.persen >= 95 ? 'ok' : 'warn'"></sa-progress></td>
                <td class="num">{{ angka(s.total) }}</td>
                <td><span class="badge" :class="s.persen >= 95 ? 'ok' : (s.persen >= 85 ? 'warn' : 'danger')">
                  {{ s.persen >= 95 ? 'Optimal' : (s.persen >= 85 ? 'Cukup' : 'Perlu Evaluasi') }} ({{ s.persen }}%)
                </span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="t"><div class="card-title">Log Pemindaian Kartu QR</div>
            <div class="card-sub">{{ log.length }} transaksi pada periode terpilih</div></div>
          <select class="select" v-model="f.waktuMakan" @change="muat" style="width:auto">
            <option value="">Semua sesi</option><option>Pagi</option><option>Siang</option><option>Malam</option>
          </select>
          <input class="input" type="date" v-model="f.tanggal" @change="muat" style="width:auto">
        </div>
        <div class="table-wrap" v-if="log.length">
          <table class="tbl">
            <thead><tr><th>Waktu</th><th>Santri</th><th>Sesi</th><th>Status</th><th>Petugas</th></tr></thead>
            <tbody>
              <tr v-for="l in log.slice(0,200)" :key="l.LogID">
                <td class="mono fs-xs">{{ tanggal(l.Timestamp,'jam') }}</td>
                <td><b class="fs-sm">{{ l.NamaLengkap }}</b><div class="mono fs-xs txt-3">{{ l.PenghuniID }}</div></td>
                <td>{{ l.WaktuMakan }}</td>
                <td><span class="badge" :class="l.Status === 'Valid' ? 'ok' : 'warn'">{{ l.Status }}</span></td>
                <td class="fs-sm">{{ l.ScannedBy }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <sa-empty v-else judul="Belum ada log" pesan="Belum ada pemindaian pada periode ini."></sa-empty>
      </div>
    </template>
  </div>`
};
