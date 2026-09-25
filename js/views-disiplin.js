/* ==========================================================================
 * SIM ASRAMA v6.0 — VIEW PENGASUHAN & KEDISIPLINAN
 * laporan kedisiplinan · penerbitan SP & BAP · notifikasi wali · skor saya
 * ========================================================================== */

window.VIEWS = window.VIEWS || {};

/* =========================================================================
 * LAPORAN KEDISIPLINAN & POIN PELANGGARAN
 * ======================================================================= */
window.VIEWS['disiplin'] = {
  props: ['user'],
  emits: ['pindah'],
  data: function () {
    return { d: null, memuat: true, rows: [], f: { dari: '', sampai: '', kode: '' }, tabelBuka: false };
  },
  mounted: function () { this.muat(); },
  methods: {
    muat: async function () {
      this.memuat = true;
      var a = await callApi('discipline.rekap', this.f);
      var b = await callApi('discipline.list', this.f);
      this.memuat = false;
      if (a.ok) this.d = a.data;
      if (b.ok) this.rows = b.data;
    },
    ekspor: function () {
      unduhExcel(this.rows.map(function (t) {
        return { Tanggal: t.TanggalKejadian, Santri: t.NamaLengkap, NIM: t.NIM, Kamar: t.NomorKamar,
                 Kode: t.KodePelanggaran, Pelanggaran: t.JenisPelanggaran, Poin: t.Poin,
                 SP: t.JenisSP, SkorAkhir: t.SkorSesudah, Sanksi: t.Sanksi, Petugas: t.DiterbitkanOleh };
      }), 'Buku_Pelanggaran_' + new Date().toISOString().substring(0, 10), 'Pelanggaran');
    },
    kelasSkor: function (s) { return s >= 90 ? 'ok' : (s >= 75 ? 'warn' : 'danger'); }
  },
  template: `
  <div>
    <sa-page judul="Laporan Kedisiplinan &amp; Poin Pelanggaran Santri"
             sub="Audit kepatuhan tata tertib asrama, tracking skor kedisiplinan (baseline 100 poin), dan penanganan kasus pembinaan santri."
             :jalur="['Pengasuhan &amp; Kedisiplinan','Laporan Kedisiplinan']">
      <template #aksi>
        <button class="btn secondary" @click="ekspor">⬇ Ekspor Buku Pelanggaran (.xlsx)</button>
        <button class="btn" @click="$emit('pindah','sp-bap')">⚖️ Terbitkan SP &amp; BAP</button>
      </template>
    </sa-page>

    <div class="card tight mb-md">
      <div class="filters" style="margin:0">
        <select class="select" v-model="f.kode" @change="muat">
          <option value="">Semua kategori</option>
          <option value="PLG-01">PLG-01 · Jam Malam &amp; Shalat</option>
          <option value="PLG-02">PLG-02 · Kebersihan Kamar</option>
          <option value="PLG-03">PLG-03 · Perangkat Elektronik</option>
          <option value="PLG-04">PLG-04 · Keluar Tanpa Tasreh</option>
          <option value="PLG-05">PLG-05 · Pelanggaran Berat</option>
        </select>
        <input class="input" type="date" v-model="f.dari" @change="muat">
        <input class="input" type="date" v-model="f.sampai" @change="muat">
        <button class="btn sm secondary" @click="muat">↻ Sinkronisasi</button>
      </div>
    </div>

    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="d">
      <div class="grid grid-4 mb-md">
        <sa-kpi label="Indeks Rata-rata Disiplin" :nilai="d.kpi.rataSkor" satuan="/100" ikon="🛡"
                :warna="d.kpi.rataSkor >= 95 ? 'ok' : 'warn'" :persen="d.kpi.rataSkor"
                :persenWarna="d.kpi.rataSkor >= 95 ? 'ok' : 'warn'" catatan="Target ≥ 95,0"></sa-kpi>
        <sa-kpi label="Total Kasus Pelanggaran" :nilai="d.kpi.totalKasus" satuan="kasus" ikon="⚠️" warna="warn"
                :catatan="'Rata-rata ' + d.kpi.rataPenalti + ' poin/kasus'"></sa-kpi>
        <sa-kpi label="Santri Dalam Pembinaan / SP" :nilai="d.kpi.dalamPembinaan" satuan="santri" ikon="🚩" warna="danger"
                :catatan="d.kpi.sp1 + ' SP-1 · ' + d.kpi.sp2 + ' SP-2 · ' + d.kpi.sp3 + ' SP-3'"></sa-kpi>
        <sa-kpi label="Santri Skor Sempurna" :nilai="d.distribusi.sempurna" satuan="santri" ikon="🌟" warna="ok"
                catatan="Kandidat Santri Teladan"></sa-kpi>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="t">
            <div class="card-title">Rekapitulasi Kategori Pelanggaran &amp; Poin Penalti</div>
            <div class="card-sub">Dihitung berdasarkan matriks standar Buku Panduan Disiplin Mahasantri STIS Al Wafa.</div>
          </div>
          <span class="badge navy plain">Regulasi BR-9 / BR-10</span>
        </div>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Kategori Pelanggaran</th><th class="num">Bobot Penalti</th><th class="num">Frekuensi</th>
              <th>Distribusi Gedung</th><th class="num">Selesai</th><th>Status Resolusi</th>
            </tr></thead>
            <tbody>
              <tr v-for="k in d.kategori" :key="k.kode">
                <td>
                  <b>{{ k.nama }}</b>
                  <div class="mono fs-xs txt-3">Kode: {{ k.kode }} · Kategori {{ k.tingkat }}</div>
                </td>
                <td class="num txt-danger fw7">−{{ k.poin }} Poin</td>
                <td class="num fw6">{{ k.frekuensi }} kasus</td>
                <td style="min-width:150px">
                  <div class="fs-xs txt-2 mb-0">{{ k.putra }} Putra · {{ k.putri }} Putri</div>
                  <div class="progress" style="margin-top:4px">
                    <div class="bar" :style="{width: (k.frekuensi ? (k.putra / k.frekuensi * 100) : 0) + '%'}"></div>
                  </div>
                </td>
                <td class="num">{{ k.selesai }}</td>
                <td>
                  <span class="badge" :class="k.frekuensi === 0 ? 'ok' : (k.poin >= 30 ? 'danger' : 'warn')">
                    {{ k.frekuensi === 0 ? 'Nihil' : (k.poin >= 30 ? 'Pengawasan Khusus' : 'Terkendali') }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="panel-dark mt-md">
          <div class="it"><small>Total kasus</small><b>{{ d.kpi.totalKasus }} kasus</b></div>
          <div class="it"><small>Rata-rata penalti</small><b>{{ d.kpi.rataPenalti }} poin/kasus</b></div>
          <div class="it"><small>Santri terpantau</small><b>{{ d.kpi.dalamPembinaan }} dalam pembinaan</b></div>
          <div class="it"><small>Verifikasi musyrif</small><b>100% tervalidasi</b></div>
        </div>
      </div>

      <div class="grid grid-3">
        <div class="card">
          <div class="card-head"><div class="t">
            <div class="card-title">📊 Distribusi Skor Santri</div>
            <div class="card-sub">Kurva evaluasi kepatuhan tata tertib</div>
          </div></div>
          <div style="margin-bottom:14px">
            <div class="flex justify-between fs-sm"><span>Skor 100 (Sempurna / Teladan)</span><b class="txt-ok">{{ d.distribusi.sempurna }}</b></div>
            <div class="progress"><div class="bar ok" :style="{width: persen(d.distribusi.sempurna) + '%'}"></div></div>
          </div>
          <div style="margin-bottom:14px">
            <div class="flex justify-between fs-sm"><span>Skor 90–99 (Prima)</span><b class="txt-blue">{{ d.distribusi.prima }}</b></div>
            <div class="progress"><div class="bar" :style="{width: persen(d.distribusi.prima) + '%'}"></div></div>
          </div>
          <div style="margin-bottom:14px">
            <div class="flex justify-between fs-sm"><span>Skor 75–89 (Pengawasan)</span><b class="txt-warn">{{ d.distribusi.cukup }}</b></div>
            <div class="progress"><div class="bar warn" :style="{width: persen(d.distribusi.cukup) + '%'}"></div></div>
          </div>
          <div>
            <div class="flex justify-between fs-sm"><span>Skor &lt; 75 (Peringatan &amp; SP)</span><b class="txt-danger">{{ d.distribusi.peringatan }}</b></div>
            <div class="progress"><div class="bar danger" :style="{width: persen(d.distribusi.peringatan) + '%'}"></div></div>
          </div>
          <div class="info-box mt-lg"><span>🏅</span><div>Program Santri Teladan akhir semester siap digelar untuk
            <b>{{ d.distribusi.sempurna }} santri</b> dengan rekor sempurna.</div></div>
        </div>

        <div class="card">
          <div class="card-head"><div class="t">
            <div class="card-title">🚨 SLA Konseling Intensif</div>
            <div class="card-sub">Prioritas santri di bawah ambang 75 poin</div>
          </div><span class="badge danger">{{ d.perluTindakan.length }} Butuh Tindakan</span></div>
          <div v-for="p in d.perluTindakan" :key="p.PenghuniID" class="scan-row">
            <sa-avatar :nama="p.NamaLengkap" ukuran="sm"></sa-avatar>
            <div class="flex-1">
              <b class="fs-sm">{{ p.NamaLengkap }}</b>
              <div class="mono fs-xs txt-3">{{ p.NIM }} · {{ p.JenisKelamin === 'L' ? 'Putra' : 'Putri' }}</div>
            </div>
            <span class="badge" :class="kelasSkor(p.Skor)">{{ p.Skor }} Poin</span>
            <a class="btn xs secondary" :href="waLink(p.NoHPWali, 'Assalamu alaikum Bapak/Ibu ' + p.NamaWali)" target="_blank">💬 Wali</a>
          </div>
          <sa-empty v-if="!d.perluTindakan.length" judul="Semua santri di atas ambang"
                    pesan="Tidak ada yang memerlukan konseling intensif." ikon="✅"></sa-empty>
          <button class="btn block mt-md" @click="$emit('pindah','sp-bap')">📋 Buka Form Berita Acara Konseling</button>
        </div>

        <div class="card">
          <div class="card-head"><div class="t">
            <div class="card-title">🗂 Log Aktivitas Penegakan</div>
            <div class="card-sub">Pembaruan status kedisiplinan terbaru</div>
          </div><span class="badge ok">Live Feed</span></div>
          <div class="timeline" v-if="rows.length">
            <div :class="['tl-item','danger']" v-for="t in rows.slice(0,8)" :key="t.TeguranID">
              <div class="tl-time">{{ tanggal(t.TanggalTerbit,'jam') }}</div>
              <div class="tl-title">{{ t.NamaLengkap }} <span class="txt-danger">−{{ t.Poin }} poin</span></div>
              <div class="tl-desc">{{ t.JenisPelanggaran }} · {{ t.JenisSP || 'Teguran' }} · skor {{ t.SkorSebelum }} → {{ t.SkorSesudah }}</div>
            </div>
          </div>
          <sa-empty v-else judul="Belum ada pelanggaran tercatat" ikon="🌿"></sa-empty>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="t"><div class="card-title">Buku Pelanggaran Santri</div>
            <div class="card-sub">{{ rows.length }} catatan pada rentang filter aktif</div></div>
          <button class="btn sm secondary" @click="tabelBuka = !tabelBuka">{{ tabelBuka ? 'Sembunyikan' : 'Tampilkan' }} tabel detail</button>
        </div>
        <div class="table-wrap" v-if="tabelBuka && rows.length">
          <table class="tbl">
            <thead><tr><th>Tanggal</th><th>Santri</th><th>Pelanggaran</th><th class="num">Poin</th>
              <th>SP</th><th>Skor</th><th>Nomor Surat</th></tr></thead>
            <tbody>
              <tr v-for="t in rows" :key="t.TeguranID">
                <td class="fs-sm">{{ tanggal(t.TanggalKejadian,'pendek') }}</td>
                <td><b class="fs-sm">{{ t.NamaLengkap }}</b><div class="mono fs-xs txt-3">{{ t.NIM }} · Kmr {{ t.NomorKamar }}</div></td>
                <td class="fs-sm">{{ t.JenisPelanggaran }}<div class="fs-xs txt-3">{{ t.KodePelanggaran }}</div></td>
                <td class="num txt-danger fw6">−{{ t.Poin }}</td>
                <td><span class="badge plain" :class="t.JenisSP ? 'danger' : ''">{{ t.JenisSP || 'Teguran' }}</span></td>
                <td class="num fs-sm">{{ t.SkorSebelum }} → <b>{{ t.SkorSesudah }}</b></td>
                <td class="mono fs-xs">{{ t.NomorSurat }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>`,
  created: function () {
    var self = this;
    this.persen = function (n) {
      if (!self.d) return 0;
      var tot = self.d.distribusi.sempurna + self.d.distribusi.prima + self.d.distribusi.cukup + self.d.distribusi.peringatan;
      return tot ? Math.round(n / tot * 100) : 0;
    };
  }
};

/* =========================================================================
 * PENERBITAN SP & BERITA ACARA PEMBINAAN (BAP)
 * ======================================================================= */
window.VIEWS['sp-bap'] = {
  props: ['user'],
  emits: ['pindah'],
  data: function () {
    return {
      ref: null, memuat: true, cari: '', kandidat: [], santri: null, profil: null,
      f: {
        kodePelanggaran: '', tanggalKejadian: new Date().toISOString().substring(0, 10),
        lokasi: '', deskripsi: '', sanksi: [], tindakLanjut: '', notifWali: true
      },
      berkas: null, proses: false, hasil: null
    };
  },
  mounted: async function () {
    var r = await callCached('meta.ref', {});
    if (r.ok) this.ref = r.data;
    this.memuat = false;
  },
  computed: {
    pelanggaranTerpilih: function () {
      var k = this.f.kodePelanggaran;
      return (this.ref ? this.ref.pelanggaran : []).filter(function (p) { return p.Kode === k; })[0];
    },
    poin: function () { return this.pelanggaranTerpilih ? Number(this.pelanggaranTerpilih.Poin) : 0; },
    skorAwal: function () { return this.profil ? Number(this.profil.penghuni.Skor) : 0; },
    skorAkhir: function () { return Math.max(0, this.skorAwal - this.poin); },
    ambang: function () {
      var s = this.skorAkhir;
      if (s < 50) return { sp: 'SP-3', tindakan: 'Sidang Pleno Skorsing / DO', warna: 'danger' };
      if (s < 65) return { sp: 'SP-2', tindakan: 'Panggil Wali &amp; Sidang', warna: 'danger' };
      if (s < 75) return { sp: 'SP-1', tindakan: 'Teguran &amp; Khidmat 7 Hari', warna: 'warn' };
      return { sp: '', tindakan: 'Belum menyentuh ambang SP', warna: 'ok' };
    }
  },
  methods: {
    cariSantri: async function () {
      if (this.cari.length < 2) { this.kandidat = []; return; }
      var res = await callApi('residents.list', { cari: this.cari, status: 'Aktif' }, { diam: true });
      if (res.ok) this.kandidat = res.data.rows.slice(0, 6);
    },
    pilih: async function (s) {
      this.santri = s; this.kandidat = []; this.cari = s.NamaLengkap;
      var res = await callApi('residents.profile', { penghuniId: s.PenghuniID });
      if (res.ok) this.profil = res.data;
    },
    pilihBerkas: async function (ev) {
      var f = ev.target.files[0];
      if (f) this.berkas = await bacaBerkas(f);
    },
    terbitkan: async function () {
      if (!this.santri) { toast('Pilih mahasantri terlebih dahulu.', 'warning'); return; }
      if (!this.f.kodePelanggaran) { toast('Pilih kategori pelanggaran.', 'warning'); return; }
      var ya = await konfirmasi('Terbitkan surat peringatan?',
        'Skor santri akan dipotong ' + this.poin + ' poin menjadi ' + this.skorAkhir + '. Tindakan ini tercatat permanen.', 'Ya, terbitkan');
      if (!ya) return;
      this.proses = true;
      var res = await callApi('discipline.issue', Object.assign({
        penghuniId: this.santri.PenghuniID, bukti: this.berkas
      }, this.f));
      this.proses = false;
      if (res.ok) { this.hasil = res.data; bersihkanCache(); toast(res.message, 'success'); }
    },
    reset: function () {
      this.hasil = null; this.santri = null; this.profil = null; this.cari = '';
      this.f.kodePelanggaran = ''; this.f.deskripsi = ''; this.f.sanksi = []; this.berkas = null;
    }
  },
  template: `
  <div>
    <sa-page judul="Penerbitan Surat Peringatan (SP) &amp; Berita Acara Konseling"
             sub="Prosedur penegakan disiplin santri, pencatatan BAP musyrif/konselor, pemotongan poin sistematis, dan otomatisasi notifikasi wali santri."
             :jalur="['Pengasuhan &amp; Kedisiplinan','Penerbitan SP &amp; BAP']">
      <template #aksi>
        <button class="btn secondary" @click="$emit('pindah','disiplin')">← Kembali ke Laporan Disiplin</button>
        <button class="btn" :disabled="proses || !santri" @click="terbitkan">
          <span v-if="proses" class="spin"></span>✔ Terbitkan SP &amp; Simpan Berita Acara
        </button>
      </template>
    </sa-page>

    <div class="card tight mb-md">
      <div class="flex items-center gap-md flex-wrap">
        <div class="kpi-icon danger">⚖️</div>
        <div class="flex-1" style="min-width:200px">
          <b>Pedoman Batas Ambang Disiplin Santri</b>
          <div class="fs-sm txt-2">Setiap mahasantri memiliki saldo awal 100 poin. Penalti memicu surat keputusan dewan pengasuhan secara otomatis.</div>
        </div>
        <span class="badge danger">Skor &lt; 75 → SP-1 · Teguran &amp; Khidmat</span>
        <span class="badge danger">Skor &lt; 65 → SP-2 · Panggil Wali</span>
        <span class="badge danger">Skor &lt; 50 → SP-3 · Sidang Pleno</span>
      </div>
    </div>

    <div class="grid grid-32">
      <!-- FORM -->
      <div>
        <div class="card">
          <div class="card-head">
            <div class="kpi-icon">1</div>
            <div class="t"><div class="card-title">Identitas Mahasantri Terperiksa</div>
              <div class="card-sub">Tentukan mahasantri yang diverifikasi dalam kasus pelanggaran kedisiplinan.</div></div>
            <span class="badge warn">Wajib Diisi</span>
          </div>
          <div class="field" style="position:relative">
            <label class="label">Cari Data Santri (Nama / NIM / Kamar)</label>
            <input class="input" v-model="cari" @input="cariSantri" placeholder="🔍 mis. Nabila Wardani atau 202403011">
            <div v-if="kandidat.length" class="dropdown" style="position:absolute;left:0;right:0;top:70px;width:auto">
              <div class="dropdown-list">
                <div v-for="k in kandidat" :key="k.PenghuniID" class="notif-item" @click="pilih(k)">
                  <sa-avatar :nama="k.NamaLengkap" :foto="k.FotoURL" ukuran="sm"></sa-avatar>
                  <div class="tx"><b>{{ k.NamaLengkap }}</b>
                    <span>{{ k.NIM }} · {{ k.NamaGedung }} {{ k.NomorKamar }} · Skor {{ k.Skor }}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="profil" class="grid grid-3 gap-md mt-md">
            <div class="text-center">
              <sa-avatar :nama="profil.penghuni.NamaLengkap" :foto="profil.penghuni.FotoURL" ukuran="lg"></sa-avatar>
              <div class="fw7 mt-sm">{{ profil.penghuni.NamaLengkap }}</div>
              <div class="mono fs-xs txt-3">{{ profil.penghuni.NIM }}</div>
            </div>
            <div>
              <div class="label">Kamar &amp; Gedung</div>
              <div class="fs-sm fw6">{{ profil.gedung.NamaGedung || '-' }}</div>
              <div class="fs-sm txt-2">Kamar {{ profil.kamar.NomorKamar || '-' }}</div>
              <div class="label mt-md">Status Disiplin Saat Ini</div>
              <span class="badge" :class="skorAwal >= 90 ? 'ok' : (skorAwal >= 75 ? 'warn' : 'danger')">
                {{ skorAwal }} / 100 Poin
              </span>
            </div>
            <div>
              <div class="label">Kontak Wali / Orang Tua</div>
              <div class="fs-sm fw6">{{ profil.penghuni.NamaWali || '-' }}</div>
              <div class="fs-sm txt-2">{{ profil.penghuni.NoHPWali || '-' }}</div>
              <a v-if="profil.penghuni.NoHPWali" class="btn xs secondary mt-sm"
                 :href="waLink(profil.penghuni.NoHPWali)" target="_blank">💬 Hubungi Wali</a>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="kpi-icon">2</div>
            <div class="t"><div class="card-title">Klasifikasi &amp; Detail Kasus Pelanggaran</div>
              <div class="card-sub">Parameter kejadian, kategori sanksi poin, dan ringkasan fakta di lapangan.</div></div>
            <span class="badge navy plain">BR-9 / BR-10</span>
          </div>
          <div class="grid grid-2 gap-md">
            <div class="field"><label class="label">Tanggal &amp; Waktu Kejadian</label>
              <input type="date" class="input" v-model="f.tanggalKejadian"></div>
            <div class="field"><label class="label">Lokasi / Titik Kejadian</label>
              <input class="input" v-model="f.lokasi" placeholder="mis. Gerbang Utama Asrama Putri"></div>
          </div>
          <div class="field">
            <label class="label">Kategori Master Pelanggaran <span class="req">*</span></label>
            <select class="select" v-model="f.kodePelanggaran">
              <option value="">— Pilih kategori pelanggaran —</option>
              <option v-for="p in (ref ? ref.pelanggaran : [])" :key="p.MasterID" :value="p.Kode">
                {{ p.Kode }} · {{ p.Nilai }} ({{ p.Induk }}) — −{{ p.Poin }} poin
              </option>
            </select>
          </div>

          <div class="info-box" :class="ambang.warna === 'danger' ? 'danger' : (ambang.warna === 'warn' ? 'warn' : 'ok')"
               v-if="profil && f.kodePelanggaran">
            <span>🧮</span>
            <div>
              <b>Simulasi Dampak Akumulasi Poin Santri</b><br>
              Skor awal <b>{{ skorAwal }} poin</b> &nbsp;−{{ poin }}&nbsp; → skor akhir <b>{{ skorAkhir }} poin</b>.<br>
              <template v-if="ambang.sp">
                Peringatan otomatis sistem: skor {{ skorAkhir }} berada di bawah ambang — sistem mewajibkan penerbitan
                <b>Surat Peringatan {{ ambang.sp }}</b> dengan tindakan <b>{{ ambang.tindakan }}</b>.
              </template>
              <template v-else>Belum menyentuh ambang SP — cukup teguran &amp; pembinaan.</template>
            </div>
          </div>

          <div class="field mt-md"><label class="label">Kronologi Kejadian &amp; Temuan Pengawas</label>
            <textarea class="input" v-model="f.deskripsi" style="min-height:120px"
              placeholder="Uraikan kronologi: waktu, tempat, temuan petugas, dan keterangan saksi…"></textarea></div>

          <div class="field"><label class="label">Lampiran Bukti Fisik / Dokumentasi (maks 2 MB)</label>
            <input type="file" class="input" accept="image/*,.pdf" @change="pilihBerkas" style="padding:8px">
            <div class="hint" v-if="berkas">✅ {{ berkas.nama }}</div></div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="kpi-icon">3</div>
            <div class="t"><div class="card-title">Berita Acara Pembinaan &amp; Konseling (BAP)</div>
              <div class="card-sub">Hasil mediasi, bentuk intervensi edukatif, dan komitmen perbaikan diri.</div></div>
            <span class="badge info plain">Musyrif / Konselor</span>
          </div>
          <div class="label">Bentuk Sanksi Pembinaan &amp; Tindakan Disiplin</div>
          <div class="grid grid-2 gap-sm mb-md">
            <label class="check"><input type="checkbox" value="Teguran Resmi Tertulis" v-model="f.sanksi">
              <span><b>Teguran Resmi Tertulis</b><br><span class="fs-xs txt-2">Penerbitan surat keputusan bermaterai digital institusi.</span></span></label>
            <label class="check"><input type="checkbox" value="Khidmat Disiplin Asrama" v-model="f.sanksi">
              <span><b>Khidmat Disiplin Asrama</b><br><span class="fs-xs txt-2">Piket kebersihan perpustakaan &amp; pantry selama 7 hari.</span></span></label>
            <label class="check"><input type="checkbox" value="Pemanggilan Wali Santri" v-model="f.sanksi">
              <span><b>Pemanggilan Wali Santri ke Kampus</b><br><span class="fs-xs txt-2">Pertemuan musyawarah dengan Dewan Pengasuhan.</span></span></label>
            <label class="check"><input type="checkbox" value="Penahanan Fasilitas Gadget" v-model="f.sanksi">
              <span><b>Penahanan Fasilitas Gadget Sementara</b><br><span class="fs-xs txt-2">Penyitaan gadget non-akademik di lemari musyrif.</span></span></label>
          </div>
          <div class="field"><label class="label">Pernyataan Komitmen &amp; Janji Santri Terperiksa</label>
            <textarea class="input" v-model="f.tindakLanjut"
              placeholder="Saya mengakui kelalaian saya… bersedia menjalankan sanksi dengan ikhlas…"></textarea></div>
          <label class="check"><input type="checkbox" v-model="f.notifWali">
            <span>Kirim notifikasi resmi &amp; salinan BAP ke wali santri via WhatsApp Gateway</span></label>
        </div>
      </div>

      <!-- PRATINJAU DOKUMEN -->
      <div>
        <div class="card" style="position:sticky;top:84px">
          <div class="card-head">
            <div class="t"><div class="card-title">Pratinjau Dokumen BAP Resmi</div></div>
            <button class="btn sm secondary" @click="cetak()">🖨 Cetak</button>
          </div>

          <div style="border:1px solid var(--border);border-radius:var(--r);padding:20px;background:var(--surface)">
            <div class="text-center" style="border-bottom:2px solid var(--navy);padding-bottom:10px;margin-bottom:12px">
              <div class="fw7" style="font-size:13px">PONDOK PESANTREN / {{ institusi }}</div>
              <div class="fs-xs txt-2">DEWAN PENGASUHAN DAN KEDISIPLINAN SANTRI</div>
              <div class="fs-xs txt-3">Jl. Raya Cihanjuang KM. 18, Kab. Bogor — Jawa Barat</div>
            </div>

            <div class="fs-xs" style="line-height:1.9">
              <div class="flex justify-between"><span>Nomor : {{ hasil ? hasil.nomorSurat : '…/BAP-DP/STIS-AW/X/2026' }}</span>
                <span>Bogor, {{ tanggal(f.tanggalKejadian) }}</span></div>
              <div>Lampiran : 1 (satu) berkas bukti</div>
              <div>Hal : <b>Surat Peringatan {{ ambang.sp || '—' }} &amp; BAP</b></div>
              <div class="mt-sm">Kepada Yth. Wali Santri<br><b>{{ profil ? (profil.penghuni.NamaWali || 'Bapak/Ibu Wali') : 'Bapak/Ibu Wali' }}</b></div>
            </div>

            <p class="fs-xs text-center mt-md" style="font-style:italic">Bismillāhirraḥmānirraḥīm</p>
            <p class="fs-xs mt-sm">Berdasarkan hasil sidang klarifikasi Berita Acara Pemeriksaan (BAP) Dewan Pengasuhan,
              menerangkan bahwa mahasantri berikut:</p>

            <div style="background:var(--surface-2);border-radius:var(--r-sm);padding:10px;margin:10px 0">
              <div class="kv fs-xs"><span>Nama / NIM</span><b>{{ profil ? profil.penghuni.NamaLengkap : '—' }} ({{ profil ? profil.penghuni.NIM : '—' }})</b></div>
              <div class="kv fs-xs"><span>Prodi</span><b>{{ profil ? profil.penghuni.Prodi : '—' }}</b></div>
              <div class="kv fs-xs"><span>Gedung / Kamar</span><b>{{ profil ? (profil.gedung.NamaGedung + ' — ' + profil.kamar.NomorKamar) : '—' }}</b></div>
            </div>

            <p class="fs-xs">Dinyatakan telah melanggar tata tertib asrama kategori
              <b>{{ pelanggaranTerpilih ? (pelanggaranTerpilih.Kode + ' (' + pelanggaranTerpilih.Induk + ')') : '—' }}</b>
              berupa <i>{{ pelanggaranTerpilih ? pelanggaranTerpilih.Nilai : '—' }}</i>. Dengan pemotongan
              <b>{{ poin }} poin</b>, total skor disiplin menjadi <b>{{ skorAkhir }} poin</b>.</p>

            <p class="fs-xs mt-sm" v-if="ambang.sp">Atas hal tersebut diterbitkan <b>SURAT PERINGATAN {{ ambang.sp }}</b>
              dan mewajibkan Bapak/Ibu Wali untuk hadir pada sesi pemanggilan tatap muka di Kantor Dewan Pengasuhan Asrama.</p>

            <div class="text-center mt-lg fs-xs">
              <div>Mengetahui &amp; Memeriksa,</div>
              <div class="fw7 mt-lg" style="text-decoration:underline">{{ user.NamaLengkap }}</div>
              <div class="txt-2">{{ user.RoleNama || user.Role }}</div>
            </div>
          </div>

          <div class="info-box mt-md"><span>🕌</span><div><b>Panduan Konseling Islami</b><br>
            Pendekatan disiplin bertujuan untuk <i>tarbiyah ruhiyah</i> dan pemulihan akhlak santri, bukan semata hukuman
            administratif. Pastikan proses BAP diiringi nasihat kasih sayang (<i>mau'izhah hasanah</i>).</div></div>
        </div>

        <div class="card" v-if="profil && profil.teguran && profil.teguran.length">
          <div class="card-head"><div class="t">
            <div class="card-title">Riwayat Pelanggaran Terdahulu</div>
            <div class="card-sub">{{ profil.teguran.length }} kasus pada arsip kumulatif</div>
          </div></div>
          <div class="timeline">
            <div class="tl-item danger" v-for="t in profil.teguran.slice(0,5)" :key="t.TeguranID">
              <div class="tl-time">{{ tanggal(t.TanggalKejadian,'pendek') }}</div>
              <div class="tl-title">{{ t.JenisPelanggaran }} <span class="txt-danger">−{{ t.Poin }} poin</span></div>
              <div class="tl-desc">{{ t.Sanksi || 'Teguran lisan' }} · {{ t.JenisSP || 'Tanpa SP' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- HASIL PENERBITAN -->
    <sa-modal v-if="hasil" judul="Surat Peringatan Diterbitkan"
              :sub="'Nomor surat ' + hasil.nomorSurat" ikon="✅" @tutup="reset">
      <div class="info-box ok"><span>✔</span><div>Skor santri diperbarui: <b>{{ hasil.skorLama }} → {{ hasil.skorBaru }}</b> poin.
        {{ hasil.jenisSP ? ('Status: ' + hasil.jenisSP + ' — ' + hasil.tindakan) : 'Belum menyentuh ambang SP.' }}</div></div>
      <div class="mt-md" v-if="f.notifWali && hasil.wali && hasil.wali.hp">
        <div class="label">Notifikasi Wali Santri</div>
        <p class="fs-sm txt-2">Kirim pemberitahuan resmi beserta tautan salinan BAP kepada
          <b>{{ hasil.wali.nama }}</b> ({{ hasil.wali.hp }}).</p>
        <a class="btn ok block mt-sm" :href="waLink(hasil.wali.hp, pesanWali(hasil))" target="_blank">
          💬 Kirim Sekarang via WhatsApp
        </a>
      </div>
      <template #aksi>
        <button class="btn secondary" @click="reset">Terbitkan SP Lain</button>
        <button class="btn" @click="$emit('pindah','disiplin')">Lihat Laporan Kedisiplinan</button>
      </template>
    </sa-modal>
  </div>`,
  created: function () {
    var self = this;
    this.institusi = CONFIG.NAMA_INSTITUSI;
    this.window = window;
    this.pesanWali = function (h) {
      return "Assalamu'alaikum Wr. Wb.\n\nYth. " + (h.wali.nama || 'Bapak/Ibu Wali') +
        ', melalui pesan resmi ini Dewan Pengasuhan dan Kedisiplinan Mahasantri ' + CONFIG.NAMA_INSTITUSI +
        ' menginformasikan bahwa ananda ' + (self.santri ? self.santri.NamaLengkap : '') +
        ' telah diterbitkan SURAT PERINGATAN ' + (h.jenisSP || '') + ' nomor ' + h.nomorSurat +
        ', dengan saldo skor disiplin saat ini: ' + h.skorBaru +
        ' poin.\n\nMohon kehadiran Bapak/Ibu pada sesi musyawarah pembinaan tatap muka di Kantor Dewan Pengasuhan. Jazakumullah khairan.';
    };
  }
};

/* =========================================================================
 * SKOR & TEGURAN SAYA (penghuni)
 * ======================================================================= */
window.VIEWS['disiplin-saya'] = {
  props: ['user'],
  data: function () { return { d: null, memuat: true }; },
  mounted: async function () {
    var res = await callApi('discipline.mine', {});
    this.memuat = false;
    if (res.ok) this.d = res.data;
  },
  template: `
  <div>
    <sa-page judul="Skor Kedisiplinan Saya" sub="Riwayat poin dan catatan pembinaan Anda selama menghuni asrama."
             :jalur="['Layanan Mandiri','Kedisiplinan']"></sa-page>
    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="d">
      <div class="grid grid-3 mb-md">
        <sa-kpi label="Skor Saat Ini" :nilai="d.skor" satuan="/100" ikon="🛡"
                :warna="d.skor >= 90 ? 'ok' : (d.skor >= 75 ? 'warn' : 'danger')"
                :persen="d.skor" :persenWarna="d.skor >= 90 ? 'ok' : (d.skor >= 75 ? 'warn' : 'danger')"></sa-kpi>
        <sa-kpi label="Jumlah Teguran" :nilai="d.teguran.length" ikon="⚠️"></sa-kpi>
        <sa-kpi label="Status Pembinaan" :nilai="d.skor >= 75 ? 'Aman' : 'Dalam SP'" ikon="📋"
                :warna="d.skor >= 75 ? 'ok' : 'danger'"></sa-kpi>
      </div>

      <div class="card">
        <div class="card-head"><div class="t"><div class="card-title">Riwayat Perubahan Skor</div></div></div>
        <div class="timeline" v-if="d.riwayatSkor.length">
          <div class="tl-item" v-for="s in d.riwayatSkor" :key="s.SkorLogID"
               :class="Number(s.Perubahan) < 0 ? 'danger' : 'ok'">
            <div class="tl-time">{{ tanggal(s.Tanggal,'jam') }}</div>
            <div class="tl-title">{{ s.Alasan }}</div>
            <div class="tl-desc">{{ s.SkorLama }} → {{ s.SkorBaru }} poin ({{ Number(s.Perubahan) > 0 ? '+' : '' }}{{ s.Perubahan }})</div>
          </div>
        </div>
        <sa-empty v-else judul="Rekor bersih — barakallahu fiik"
                  pesan="Belum ada catatan pelanggaran atas nama Anda." ikon="🌟"></sa-empty>
      </div>
    </template>
  </div>`
};
