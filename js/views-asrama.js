/* ==========================================================================
 * SIM ASRAMA v6.0 — VIEW OPERASIONAL ASRAMA
 * pendaftar · penghuni · penempatan kamar · gedung & kamar ·
 * tagihan & pembayaran · tagihan saya · helpdesk · helpdesk saya
 * ========================================================================== */

window.VIEWS = window.VIEWS || {};

/* =========================================================================
 * VERIFIKASI PENDAFTAR
 * ======================================================================= */
window.VIEWS['pendaftar'] = {
  props: ['user'],
  data: function () {
    return { rows: [], memuat: true, cari: '', status: 'Baru', pilih: null, aksi: '', catatan: '', proses: false,
             cekWA: { jalan: false, selesai: 0, total: 0 } };
  },
  mounted: function () { this.muat(); },
  computed: {
    tersaring: function () {
      var q = this.cari.toLowerCase(), s = this.status;
      return this.rows.filter(function (r) {
        var cocokS = !s || r.Status === s;
        var cocokQ = !q || String(r.NamaLengkap).toLowerCase().indexOf(q) > -1 || String(r.NIM).indexOf(q) > -1;
        return cocokS && cocokQ;
      });
    },
    hitung: function () {
      var r = this.rows;
      return {
        baru: r.filter(function (x) { return x.Status === 'Baru'; }).length,
        revisi: r.filter(function (x) { return x.Status === 'Perlu Revisi'; }).length,
        diterima: r.filter(function (x) { return x.Status === 'Diterima'; }).length,
        ditolak: r.filter(function (x) { return x.Status === 'Ditolak'; }).length
      };
    }
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('registration.list', {});
      this.memuat = false;
      if (res.ok) this.rows = res.data;
    },
    buka: function (r, aksi) { this.pilih = r; this.aksi = aksi || 'lihat'; this.catatan = ''; },
    deteksiWA: async function () {
      var sasaran = this.tersaring.filter(function (r) { return !r.StatusWA; });
      if (!sasaran.length) sasaran = this.tersaring;
      if (!sasaran.length) { toast('Tidak ada nomor untuk dicek.', 'info'); return; }
      var self = this;
      this.cekWA = { jalan: true, selesai: 0, total: sasaran.length };
      var peta = await deteksiNomorWA(sasaran.map(function (r) { return r.NoHP; }), function (n) { self.cekWA.selesai = n; });
      this.rows.forEach(function (r) { var k = normalHp(r.NoHP); if (peta[k] !== undefined) r.StatusWA = peta[k]; });
      this.cekWA.jalan = false;
    },
    kirim: async function () {
      if ((this.aksi === 'revisi' || this.aksi === 'tolak') && !this.catatan) {
        toast('Catatan wajib diisi untuk revisi/penolakan.', 'warning'); return;
      }
      this.proses = true;
      var res = await callApi('registration.verify',
        { pendaftarId: this.pilih.PendaftarID, aksi: this.aksi, catatan: this.catatan });
      this.proses = false;
      if (res.ok) {
        if (this.aksi === 'terima') {
          Swal.fire({
            icon: 'success', title: 'Pendaftar Diterima',
            html: '<div style="text-align:left;font-size:13px">Akun santri dibuat otomatis.<br><br>' +
                  '<b>Username:</b> <code>' + res.data.username + '</code><br>' +
                  '<b>Sandi awal:</b> <code>' + res.data.sandiAwal + '</code><br>' +
                  '<b>Tagihan dibuat:</b> ' + res.data.jumlahTagihan + ' periode<br><br>' +
                  '<span style="color:#92400E">Bila notifikasi WhatsApp/Email aktif, username &amp; sandi ini sudah otomatis dikirim ke santri. ' +
                  'Bila belum, sampaikan manual lalu minta segera menggantinya.</span></div>',
            confirmButtonColor: '#2563EB'
          });
        } else { toast(res.message, 'success'); }
        this.pilih = null; bersihkanCache(); this.muat();
      }
    },
    berkasUrl: function (id) { return 'https://drive.google.com/file/d/' + id + '/view'; },
    waKelas: function (s) { return s === 'Terdaftar' ? 'ya' : (s === 'Tidak Terdaftar' ? 'tidak' : 'belum'); },
    waLabel: function (s) { return s === 'Terdaftar' ? '✓ WA aktif' : (s === 'Tidak Terdaftar' ? '✕ bukan WA' : '? WA belum dicek'); }
  },
  template: `
  <div>
    <sa-page judul="Verifikasi Berkas Pendaftar"
             sub="Tinjau data dan berkas calon santri, lalu putuskan: terima, minta revisi, atau tolak."
             :jalur="['Operasional Asrama','Pendaftaran','Verifikasi']">
      <template #aksi>
        <button class="btn secondary" :disabled="cekWA.jalan" @click="deteksiWA" title="Cek nomor HP pendaftar terdaftar di WhatsApp (via Fonnte)">
          <span v-if="cekWA.jalan" class="spin dark"></span>📱 {{ cekWA.jalan ? ('Mengecek ' + cekWA.selesai + '/' + cekWA.total) : 'Deteksi Nomor WA' }}</button>
        <button class="btn secondary" @click="muat">↻ Segarkan</button>
      </template>
    </sa-page>

    <div class="grid grid-4 mb-md">
      <sa-kpi label="Menunggu Verifikasi" :nilai="hitung.baru" ikon="📥" warna="warn"></sa-kpi>
      <sa-kpi label="Perlu Revisi" :nilai="hitung.revisi" ikon="✏️"></sa-kpi>
      <sa-kpi label="Diterima" :nilai="hitung.diterima" ikon="✅" warna="ok"></sa-kpi>
      <sa-kpi label="Ditolak" :nilai="hitung.ditolak" ikon="⛔" warna="danger"></sa-kpi>
    </div>

    <div class="card">
      <div class="filters">
        <input class="input flex-1" v-model="cari" placeholder="🔍 Cari nama atau NIM…" style="min-width:220px">
        <select class="select" v-model="status">
          <option value="">Semua status</option>
          <option>Baru</option><option>Perlu Revisi</option><option>Diterima</option><option>Ditolak</option>
        </select>
        <button class="btn sm secondary" @click="unduhExcel(tersaring,'Pendaftar','Pendaftar')">⬇ Ekspor Excel</button>
      </div>

      <sa-loading v-if="memuat"></sa-loading>
      <div class="table-wrap" v-else-if="tersaring.length">
        <table class="tbl">
          <thead><tr>
            <th>Santri / ID</th><th>Prodi &amp; Angkatan</th><th>Paket</th><th>Berkas</th>
            <th>Tanggal</th><th>Status</th><th>Tindakan</th>
          </tr></thead>
          <tbody>
            <tr v-for="r in tersaring" :key="r.PendaftarID">
              <td>
                <div class="person">
                  <sa-avatar :nama="r.NamaLengkap" :foto="r.FotoURL" ukuran="sm"></sa-avatar>
                  <div class="nm"><b>{{ r.NamaLengkap }}</b>
                    <span class="mono">{{ r.PendaftarID }} · {{ r.JenisKelamin === 'L' ? 'Putra' : 'Putri' }}</span>
                    <span><span class="wa-badge" :class="waKelas(r.StatusWA)" :title="'WhatsApp ' + r.NoHP">{{ waLabel(r.StatusWA) }}</span></span></div>
                </div>
              </td>
              <td class="fs-sm">{{ r.Prodi || '-' }}<div class="txt-3 fs-xs">Angkatan {{ r.Angkatan || '-' }}</div></td>
              <td class="fs-sm">{{ r.PaketID }}</td>
              <td>
                <div class="flex gap-sm">
                  <a v-if="r.FotoID" :href="berkasUrl(r.FotoID)" target="_blank" title="Pas foto">📷</a>
                  <a v-if="r.SuratID" :href="berkasUrl(r.SuratID)" target="_blank" title="Surat pernyataan">📄</a>
                  <a v-if="r.BuktiID" :href="berkasUrl(r.BuktiID)" target="_blank" title="Bukti bayar">🧾</a>
                </div>
              </td>
              <td class="fs-sm">{{ tanggal(r.TanggalDaftar,'pendek') }}</td>
              <td><sa-badge :teks="r.Status"></sa-badge></td>
              <td>
                <div class="flex gap-sm">
                  <button class="btn xs secondary" @click="buka(r,'lihat')">Detail</button>
                  <button class="btn xs" v-if="r.Status !== 'Diterima'" @click="buka(r,'terima')">Terima</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <sa-empty v-else judul="Tidak ada pendaftar" pesan="Belum ada data pada filter ini."></sa-empty>
    </div>

    <!-- MODAL DETAIL / VERIFIKASI -->
    <sa-modal v-if="pilih" :judul="pilih.NamaLengkap" :sub="'Kode pendaftaran ' + pilih.PendaftarID"
              ikon="📝" lebar="wide" @tutup="pilih=null">
      <div class="grid grid-2 gap-md">
        <div>
          <sa-kv k="NIM" :v="pilih.NIM || '—'"></sa-kv>
          <sa-kv k="Email" :v="pilih.Email"></sa-kv>
          <sa-kv k="No. HP" :v="pilih.NoHP"></sa-kv>
          <sa-kv k="Jenis Kelamin" :v="pilih.JenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'"></sa-kv>
          <sa-kv k="Program / Prodi" :v="(pilih.ProgramKelas || '-') + ' · ' + (pilih.Prodi || '-')"></sa-kv>
          <sa-kv k="Angkatan" :v="pilih.Angkatan || '-'"></sa-kv>
        </div>
        <div>
          <sa-kv k="Berat Badan" :v="(pilih.BeratBadan || '-') + ' kg'"></sa-kv>
          <sa-kv k="Alamat" :v="pilih.Alamat || '-'"></sa-kv>
          <sa-kv k="Wali" :v="(pilih.NamaWali || '-') + ' · ' + (pilih.NoHPWali || '-')"></sa-kv>
          <sa-kv k="Paket" :v="pilih.PaketID"></sa-kv>
          <sa-kv k="Bayar di Muka" :v="rupiah(pilih.BayarAwal) + ' (' + (pilih.BulanDibayar || 0) + ' bulan)'"></sa-kv>
          <sa-kv k="Status" :v="pilih.Status"></sa-kv>
        </div>
      </div>

      <div class="label mt-md">Berkas (thumbnail — klik untuk ukuran penuh)</div>
      <div class="thumb-grid">
        <sa-thumb v-if="pilih.FotoID" :src="pilih.FotoURL" :href="berkasUrl(pilih.FotoID)" judul="📷 Pas Foto"></sa-thumb>
        <sa-thumb v-if="pilih.SuratID" :src="pilih.SuratThumb" :href="berkasUrl(pilih.SuratID)" judul="📄 Surat"></sa-thumb>
        <sa-thumb v-if="pilih.BuktiID" :src="pilih.BuktiThumb" :href="berkasUrl(pilih.BuktiID)" judul="🧾 Bukti Bayar"></sa-thumb>
      </div>
      <div class="flex items-center gap-sm mt-sm fs-sm">
        <span>WhatsApp {{ pilih.NoHP }}:</span>
        <span class="wa-badge" :class="waKelas(pilih.StatusWA)">{{ waLabel(pilih.StatusWA) }}</span>
        <a :href="waLink(pilih.NoHP)" target="_blank" rel="noopener" class="fs-xs">Buka chat ↗</a>
      </div>

      <div class="mt-lg" v-if="pilih.Status !== 'Diterima'">
        <div class="label">Keputusan Verifikasi</div>
        <div class="pills mb-md">
          <button :class="{active: aksi==='terima'}" @click="aksi='terima'">✅ Terima</button>
          <button :class="{active: aksi==='revisi'}" @click="aksi='revisi'">✏️ Perlu Revisi</button>
          <button :class="{active: aksi==='tolak'}" @click="aksi='tolak'">⛔ Tolak</button>
        </div>
        <div class="field" v-if="aksi==='revisi' || aksi==='tolak'">
          <label class="label">Catatan untuk pendaftar <span class="req">*</span></label>
          <textarea class="input" v-model="catatan" placeholder="Jelaskan berkas mana yang perlu diperbaiki…"></textarea>
        </div>
        <div class="info-box" v-if="aksi==='terima'">
          <span>ℹ️</span>
          <div>Saat diterima, sistem otomatis membuat: <b>akun santri + sandi awal</b>, <b>record penghuni</b> (skor 100),
          dan <b>tagihan</b> sesuai status pembayaran di muka. Keputusan ini bersifat final (BR-2).</div>
        </div>
      </div>

      <template #aksi>
        <button class="btn secondary" @click="pilih=null">Tutup</button>
        <button v-if="pilih.Status !== 'Diterima' && aksi && aksi!=='lihat'"
                class="btn" :class="{danger: aksi==='tolak'}" :disabled="proses" @click="kirim">
          <span v-if="proses" class="spin"></span>
          {{ aksi==='terima' ? 'Terima & Buat Akun' : (aksi==='revisi' ? 'Minta Revisi' : 'Tolak Pendaftar') }}
        </button>
      </template>
    </sa-modal>
  </div>`
};

/* =========================================================================
 * MANAJEMEN PENGHUNI
 * ======================================================================= */
window.VIEWS['penghuni'] = {
  props: ['user'],
  emits: ['pindah'],
  data: function () {
    return {
      rows: [], ringkasan: {}, memuat: true, ref: null,
      f: { cari: '', status: 'Aktif', gedungId: '', prodi: '', angkatan: '', paketId: '', hanyaKartu: false },
      detail: null, detailData: null, halaman: 1, perHal: 12,
      tambah: false, baru: {}, proses: false
    };
  },
  mounted: async function () {
    var r = await callCached('meta.ref', {});
    if (r.ok) this.ref = r.data;
    this.muat();
  },
  computed: {
    halTotal: function () { return Math.max(1, Math.ceil(this.rows.length / this.perHal)); },
    tampil: function () {
      var m = (this.halaman - 1) * this.perHal;
      return this.rows.slice(m, m + this.perHal);
    },
    bolehKelola: function () { return ['SA','PMB','PA','PI'].indexOf(this.user.Role) > -1; }
  },
  watch: {
    'f.cari': function () { this.cariDebounce(); }
  },
  created: function () { this.cariDebounce = debounce(this.muat, CONFIG.DEBOUNCE_MS); },
  methods: {
    muat: async function () {
      this.memuat = true; this.halaman = 1;
      var res = await callApi('residents.list', this.f);
      this.memuat = false;
      if (res.ok) { this.rows = res.data.rows; this.ringkasan = res.data.ringkasan; }
    },
    resetFilter: function () {
      this.f = { cari: '', status: 'Aktif', gedungId: '', prodi: '', angkatan: '', paketId: '', hanyaKartu: false };
      this.muat();
    },
    bukaDetail: async function (r) {
      this.detail = r; this.detailData = null;
      var res = await callApi('residents.profile', { penghuniId: r.PenghuniID });
      if (res.ok) this.detailData = res.data;
    },
    checkout: async function (r) {
      var ya = await konfirmasi('Checkout ' + r.NamaLengkap + '?',
        'Kamar akan dibebaskan, akun dinonaktifkan, dan kartu makan tidak berlaku lagi.', 'Ya, checkout', true);
      if (!ya) return;
      var self = this;
      await optimistic(function () {
        var lama = r.Status, lamaKamar = r.NomorKamar;
        r.Status = 'Keluar'; r.NomorKamar = '';
        return function () { r.Status = lama; r.NomorKamar = lamaKamar; };
      }, 'residents.checkout', { penghuniId: r.PenghuniID });
      self.detail = null;
    },
    ubahKartu: async function (r) {
      await optimistic(function () {
        var lama = r.EligibleKartu; r.EligibleKartu = !lama;
        return function () { r.EligibleKartu = lama; };
      }, 'card.approveEligible', { penghuniId: r.PenghuniID, eligible: !r.EligibleKartu });
    },
    simpanBaru: async function () {
      this.proses = true;
      var res = await callApi('residents.create', { data: this.baru });
      this.proses = false;
      if (res.ok) {
        Swal.fire({ icon: 'success', title: 'Penghuni ditambahkan',
          html: 'Username: <code>' + res.data.username + '</code><br>Sandi awal: <code>' + res.data.sandiAwal + '</code>',
          confirmButtonColor: '#2563EB' });
        this.tambah = false; this.baru = {}; bersihkanCache(); this.muat();
      }
    },
    ekspor: function () {
      unduhExcel(this.rows.map(function (r) {
        return { NIM: r.NIM, Nama: r.NamaLengkap, JK: r.JenisKelamin, Prodi: r.Prodi, Angkatan: r.Angkatan,
                 Gedung: r.NamaGedung, Kamar: r.NomorKamar, Paket: r.NamaPaket, Skor: r.Skor, Status: r.Status };
      }), 'Penghuni_' + new Date().toISOString().substring(0, 10), 'Penghuni');
    },
    kelasSkor: function (s) { return s >= 90 ? 'ok' : (s >= 75 ? 'warn' : 'danger'); }
  },
  template: `
  <div>
    <sa-page judul="Manajemen Data Penghuni &amp; Verifikasi Santri"
             sub="Kelola data pokok mahasantri aktif, pantau skor kedisiplinan, dan percepat penyesuaian alokasi kamar."
             :jalur="['Operasional Asrama','Manajemen Penghuni']">
      <template #aksi>
        <button class="btn secondary" @click="ekspor">⬇ Ekspor Excel</button>
        <button class="btn dark" v-if="bolehKelola" @click="tambah = true; baru = {}">＋ Tambah Penghuni</button>
      </template>
    </sa-page>

    <div class="grid grid-4 mb-md">
      <sa-kpi label="Total Penghuni Aktif" :nilai="angka(ringkasan.aktif || 0)" ikon="👥"
              :catatan="'dari ' + angka(ringkasan.total || 0) + ' data terdaftar'"></sa-kpi>
      <sa-kpi label="Belum Berkamar" :nilai="ringkasan.belumBerkamar || 0" ikon="🛏" warna="warn"
              catatan="Menunggu penempatan"></sa-kpi>
      <sa-kpi label="Indeks Kedisiplinan" :nilai="ringkasan.rataSkor || 0" satuan="/100" ikon="🛡"
              :warna="(ringkasan.rataSkor||0) >= 90 ? 'ok' : 'warn'"
              :catatan="(ringkasan.perluPembinaan || 0) + ' santri butuh pembinaan'"></sa-kpi>
      <sa-kpi label="Berhak Kartu Makan" :nilai="angka(ringkasan.eligibleKartu || 0)" ikon="🍽" warna="ok"
              catatan="Paket katering aktif"></sa-kpi>
    </div>

    <div class="card">
      <div class="filters">
        <input class="input flex-1" v-model="f.cari" placeholder="🔍 Cari nama, NIM, atau email…" style="min-width:240px">
        <select class="select" v-model="f.status" @change="muat">
          <option value="">Semua status</option>
          <option>Aktif</option><option>Nonaktif</option><option>Keluar</option><option>Alumni</option>
        </select>
        <select class="select" v-model="f.gedungId" @change="muat" v-if="ref">
          <option value="">Semua gedung</option>
          <option v-for="g in ref.gedung" :key="g.GedungID" :value="g.GedungID">{{ g.NamaGedung }}</option>
        </select>
        <select class="select" v-model="f.angkatan" @change="muat" v-if="ref">
          <option value="">Semua angkatan</option>
          <option v-for="a in ref.angkatan" :key="a.MasterID" :value="a.Nilai">{{ a.Nilai }}</option>
        </select>
        <select class="select" v-model="f.paketId" @change="muat" v-if="ref">
          <option value="">Semua paket</option>
          <option v-for="p in ref.paket" :key="p.PaketID" :value="p.PaketID">{{ p.NamaPaket }}</option>
        </select>
        <label class="check"><input type="checkbox" v-model="f.hanyaKartu" @change="muat"> Hanya paket katering</label>
        <button class="btn sm ghost" @click="resetFilter">Reset filter</button>
      </div>

      <sa-loading v-if="memuat"></sa-loading>
      <template v-else-if="rows.length">
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Mahasantri &amp; Identitas</th><th>Kamar &amp; Bed</th><th>Kartu Makan</th>
              <th>Skor Disiplin</th><th>Status</th><th>Tindakan</th>
            </tr></thead>
            <tbody>
              <tr v-for="r in tampil" :key="r.PenghuniID" :class="{sel: detail && detail.PenghuniID === r.PenghuniID}">
                <td>
                  <div class="person">
                    <sa-avatar :nama="r.NamaLengkap" :foto="r.FotoURL"></sa-avatar>
                    <div class="nm"><b>{{ r.NamaLengkap }}</b>
                      <span class="mono">{{ r.NIM || r.PenghuniID }} · {{ r.Prodi || '-' }}</span></div>
                  </div>
                </td>
                <td class="fs-sm">
                  <template v-if="r.NomorKamar">{{ r.NamaGedung }}<div class="txt-3 fs-xs">Kamar {{ r.NomorKamar }} · Lt {{ r.Lantai }}</div></template>
                  <span v-else class="badge warn">Belum ditempatkan</span>
                </td>
                <td>
                  <span class="badge" :class="r.EligibleKartu ? 'ok' : ''">
                    {{ r.EligibleKartu ? 'Aktif (3x)' : (r.IncludeMakan ? 'Belum disetujui' : 'Non-katering') }}
                  </span>
                </td>
                <td style="min-width:130px">
                  <div class="flex items-center gap-sm">
                    <b class="num">{{ r.Skor }}</b>
                    <div class="progress flex-1"><div class="bar" :class="kelasSkor(r.Skor)" :style="{width: r.Skor + '%'}"></div></div>
                  </div>
                </td>
                <td><sa-badge :teks="r.Status"></sa-badge></td>
                <td>
                  <div class="flex gap-sm">
                    <button class="btn xs secondary" @click="bukaDetail(r)">Detail</button>
                    <button class="btn xs ghost" v-if="bolehKelola && r.IncludeMakan" @click="ubahKartu(r)"
                            :title="r.EligibleKartu ? 'Nonaktifkan kartu' : 'Aktifkan kartu'">⬚</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="tbl-foot">
          <span>Menampilkan {{ (halaman-1)*perHal + 1 }}–{{ Math.min(halaman*perHal, rows.length) }} dari {{ angka(rows.length) }} santri</span>
          <div class="pager">
            <button :disabled="halaman === 1" @click="halaman--">‹</button>
            <button v-for="h in Math.min(halTotal, 5)" :key="h" :class="{active: halaman === h}" @click="halaman = h">{{ h }}</button>
            <span v-if="halTotal > 5" class="txt-3" style="padding:0 6px">… {{ halTotal }}</span>
            <button :disabled="halaman === halTotal" @click="halaman++">›</button>
          </div>
        </div>
      </template>
      <sa-empty v-else judul="Belum ada penghuni" pesan="Terima pendaftar atau tambahkan penghuni manual."></sa-empty>
    </div>

    <!-- PANEL DETAIL -->
    <sa-modal v-if="detail" :judul="detail.NamaLengkap" :sub="(detail.NIM || detail.PenghuniID) + ' · ' + (detail.Prodi || '')"
              ikon="👤" lebar="wide" @tutup="detail = null">
      <sa-loading v-if="!detailData" teks="Memuat profil…"></sa-loading>
      <template v-else>
        <div class="flex items-center gap-md mb-md flex-wrap">
          <sa-avatar :nama="detail.NamaLengkap" :foto="detailData.penghuni.FotoURL" ukuran="lg"></sa-avatar>
          <div class="flex-1">
            <div class="flex gap-sm flex-wrap">
              <sa-badge :teks="detailData.penghuni.Status"></sa-badge>
              <span class="badge info plain">{{ detailData.paket.NamaPaket || '-' }}</span>
              <span class="badge plain" :class="kelasSkor(detailData.penghuni.Skor)">Skor {{ detailData.penghuni.Skor }}/100</span>
            </div>
          </div>
          <div class="btn-row">
            <a class="btn sm secondary" :href="waLink(detailData.penghuni.NoHP)" target="_blank">💬 WhatsApp</a>
            <button class="btn sm danger" v-if="bolehKelola && detailData.penghuni.Status === 'Aktif'"
                    @click="checkout(detail)">Checkout</button>
          </div>
        </div>

        <div class="grid grid-2 gap-md">
          <div>
            <div class="label">Biodata</div>
            <sa-kv k="Email" :v="detailData.penghuni.Email || '-'"></sa-kv>
            <sa-kv k="No. HP" :v="detailData.penghuni.NoHP || '-'"></sa-kv>
            <sa-kv k="Angkatan" :v="detailData.penghuni.Angkatan || '-'"></sa-kv>
            <sa-kv k="Berat Badan" :v="(detailData.penghuni.BeratBadan || '-') + ' kg'"></sa-kv>
            <sa-kv k="Tanggal Masuk" :v="tanggal(detailData.penghuni.TanggalMasuk,'pendek')"></sa-kv>
            <sa-kv k="Wali" :v="(detailData.penghuni.NamaWali || '-') + ' · ' + (detailData.penghuni.NoHPWali || '-')"></sa-kv>
          </div>
          <div>
            <div class="label">Kamar &amp; Kartu</div>
            <sa-kv k="Gedung" :v="detailData.gedung.NamaGedung || 'Belum ditempatkan'"></sa-kv>
            <sa-kv k="Kamar" :v="detailData.kamar.NomorKamar || '-'"></sa-kv>
            <sa-kv k="Fasilitas" :v="detailData.kamar.Fasilitas || '-'"></sa-kv>
            <sa-kv k="Kartu Makan QR" :v="detailData.qrValue || 'Tidak aktif'"></sa-kv>
            <div class="text-center mt-md" v-if="detailData.qrValue">
              <div v-html="qrImgTag(detailData.qrValue, 96)"></div>
              <div class="fs-xs txt-3 mt-sm">QR kartu asrama makan</div>
            </div>
          </div>
        </div>

        <div class="label mt-lg">Riwayat Skor Kedisiplinan</div>
        <div class="timeline" v-if="detailData.skorLog.length">
          <div class="tl-item" v-for="s in detailData.skorLog.slice(0,6)" :key="s.SkorLogID"
               :class="Number(s.Perubahan) < 0 ? 'danger' : 'ok'">
            <div class="tl-time">{{ tanggal(s.Tanggal,'jam') }}</div>
            <div class="tl-title">{{ s.Alasan }} <span :class="Number(s.Perubahan)<0 ? 'txt-danger':'txt-ok'">({{ Number(s.Perubahan) > 0 ? '+' : '' }}{{ s.Perubahan }} poin)</span></div>
            <div class="tl-desc">Skor {{ s.SkorLama }} → {{ s.SkorBaru }}</div>
          </div>
        </div>
        <p v-else class="fs-sm txt-3">Belum ada perubahan skor — santri berstatus bersih.</p>
      </template>
      <template #aksi><button class="btn secondary" @click="detail = null">Tutup</button></template>
    </sa-modal>

    <!-- MODAL TAMBAH -->
    <sa-modal v-if="tambah" judul="Tambah Penghuni Manual" sub="Gunakan untuk santri yang tidak melalui formulir pendaftaran."
              ikon="➕" @tutup="tambah = false">
      <div class="grid grid-2 gap-md">
        <div class="field"><label class="label">Nama Lengkap <span class="req">*</span></label>
          <input class="input" v-model.trim="baru.NamaLengkap"></div>
        <div class="field"><label class="label">NIM</label><input class="input" v-model.trim="baru.NIM"></div>
        <div class="field"><label class="label">Email</label><input class="input" v-model.trim="baru.Email"></div>
        <div class="field"><label class="label">No. HP</label><input class="input" v-model.trim="baru.NoHP"></div>
        <div class="field"><label class="label">Jenis Kelamin <span class="req">*</span></label>
          <select class="select" v-model="baru.JenisKelamin">
            <option value="">— Pilih —</option><option value="L">Laki-laki</option><option value="P">Perempuan</option>
          </select></div>
        <div class="field"><label class="label">Paket <span class="req">*</span></label>
          <select class="select" v-model="baru.PaketID">
            <option value="">— Pilih —</option>
            <option v-for="p in (ref ? ref.paket : [])" :key="p.PaketID" :value="p.PaketID">{{ p.NamaPaket }}</option>
          </select></div>
        <div class="field"><label class="label">Prodi</label>
          <select class="select" v-model="baru.Prodi">
            <option value="">— Pilih —</option>
            <option v-for="p in (ref ? ref.prodi : [])" :key="p.MasterID" :value="p.Nilai">{{ p.Nilai }}</option>
          </select></div>
        <div class="field"><label class="label">Angkatan</label>
          <select class="select" v-model="baru.Angkatan">
            <option value="">— Pilih —</option>
            <option v-for="a in (ref ? ref.angkatan : [])" :key="a.MasterID" :value="a.Nilai">{{ a.Nilai }}</option>
          </select></div>
      </div>
      <template #aksi>
        <button class="btn secondary" @click="tambah = false">Batal</button>
        <button class="btn" :disabled="proses" @click="simpanBaru"><span v-if="proses" class="spin"></span>Simpan Penghuni</button>
      </template>
    </sa-modal>
  </div>`
};

/* =========================================================================
 * PENEMPATAN KAMAR — papan alokasi (optimistic UI)
 * ======================================================================= */
window.VIEWS['penempatan'] = {
  props: ['user'],
  data: function () {
    return {
      d: null, memuat: true, gedungAktif: '', lantaiAktif: 0,
      cariAntrean: '', cariKamar: '', santriPilih: null, kamarPilih: null,
      konfirmasi: null, proses: false, isiKamar: null
    };
  },
  mounted: function () { this.muat(); },
  computed: {
    antrean: function () {
      var q = this.cariAntrean.toLowerCase();
      return (this.d ? this.d.antrean : []).filter(function (a) {
        return !q || String(a.NamaLengkap).toLowerCase().indexOf(q) > -1 || String(a.NIM).indexOf(q) > -1;
      });
    },
    kamarTampil: function () {
      if (!this.d) return [];
      var g = this.gedungAktif, l = this.lantaiAktif, q = this.cariKamar.toLowerCase();
      return this.d.kamar.filter(function (k) {
        return (!g || k.GedungID === g) && (!l || Number(k.Lantai) === Number(l)) &&
               (!q || String(k.NomorKamar).toLowerCase().indexOf(q) > -1);
      });
    },
    gedungTerpilih: function () {
      var g = this.gedungAktif;
      return (this.d ? this.d.gedung : []).filter(function (x) { return x.GedungID === g; })[0];
    },
    statGedung: function () {
      var k = this.kamarTampil;
      var kap = k.reduce(function (s, x) { return s + Number(x.Kapasitas || 0); }, 0);
      var isi = k.reduce(function (s, x) { return s + x.terisi; }, 0);
      return { kapasitas: kap, terisi: isi, kosong: kap - isi,
               persen: kap ? Math.round(isi / kap * 1000) / 10 : 0, kamar: k.length };
    },
    lantaiTersedia: function () {
      var g = this.gedungAktif, set = {};
      (this.d ? this.d.kamar : []).forEach(function (k) { if (!g || k.GedungID === g) set[k.Lantai] = true; });
      return Object.keys(set).sort();
    }
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('rooms.board', {});
      this.memuat = false;
      if (res.ok) {
        this.d = res.data;
        if (!this.gedungAktif && this.d.gedung.length) this.gedungAktif = this.d.gedung[0].GedungID;
      }
    },
    pilihSantri: function (s) { this.santriPilih = (this.santriPilih && this.santriPilih.PenghuniID === s.PenghuniID) ? null : s; },
    klikKamar: function (k) {
      if (this.santriPilih) {
        if (k.statusIsi === 'Penuh') { toast('Kamar ' + k.NomorKamar + ' sudah penuh.', 'warning'); return; }
        if (k.Status === 'Perbaikan') { toast('Kamar sedang dalam perbaikan.', 'warning'); return; }
        var g = this.d.gedung.filter(function (x) { return x.GedungID === k.GedungID; })[0] || {};
        var genderCocok = (g.Tipe === 'Putra' && this.santriPilih.JenisKelamin === 'L') ||
                          (g.Tipe === 'Putri' && this.santriPilih.JenisKelamin === 'P');
        this.konfirmasi = { santri: this.santriPilih, kamar: k, gedung: g, genderCocok: genderCocok };
      } else {
        this.isiKamar = k;
      }
    },
    /** FR-5.4 — optimistic UI + rollback */
    tempatkan: async function () {
      var self = this, k = this.konfirmasi.kamar, s = this.konfirmasi.santri;
      this.proses = true;
      var res = await optimistic(function () {
        var idx = self.d.antrean.findIndex(function (a) { return a.PenghuniID === s.PenghuniID; });
        var hapus = idx > -1 ? self.d.antrean.splice(idx, 1)[0] : null;
        k.terisi++; k.sisa = Math.max(0, k.sisa - 1);
        k.penghuni.push({ PenghuniID: s.PenghuniID, NamaLengkap: s.NamaLengkap, NIM: s.NIM,
                          Skor: 100, NamaPaket: s.NamaPaket, FotoURL: s.FotoURL });
        if (k.terisi >= Number(k.Kapasitas)) k.statusIsi = 'Penuh';
        return function () {                       // rollback bila server menolak
          k.terisi--; k.sisa++; k.penghuni.pop();
          k.statusIsi = k.terisi >= Number(k.Kapasitas) ? 'Penuh' : 'Tersedia';
          if (hapus && idx > -1) self.d.antrean.splice(idx, 0, hapus);
        };
      }, 'rooms.assign', { penghuniId: s.PenghuniID, kamarId: k.KamarID });
      this.proses = false;
      this.konfirmasi = null;
      if (res.ok) this.santriPilih = null;
    },
    keluarkan: async function (p, k) {
      var ya = await konfirmasi('Keluarkan ' + p.NamaLengkap + ' dari kamar ' + k.NomorKamar + '?',
        'Santri akan kembali ke antrean penempatan.', 'Ya, keluarkan', true);
      if (!ya) return;
      var self = this;
      await optimistic(function () {
        var idx = k.penghuni.findIndex(function (x) { return x.PenghuniID === p.PenghuniID; });
        var hapus = k.penghuni.splice(idx, 1)[0];
        k.terisi--; k.sisa++; k.statusIsi = 'Tersedia';
        return function () { k.penghuni.splice(idx, 0, hapus); k.terisi++; k.sisa--; };
      }, 'rooms.unassign', { penghuniId: p.PenghuniID });
      this.muat();
    },
    kelasBed: function (k, i) {
      if (i < k.terisi) { return 'isi'; }
      return '';
    },
    ekspor: function () {
      var rows = [];
      var self = this;
      this.d.kamar.forEach(function (k) {
        var g = self.d.gedung.filter(function (x) { return x.GedungID === k.GedungID; })[0] || {};
        if (!k.penghuni.length) rows.push({ Gedung: g.NamaGedung, Kamar: k.NomorKamar, Lantai: k.Lantai, Kapasitas: k.Kapasitas, Terisi: 0, Santri: '-', NIM: '-' });
        else k.penghuni.forEach(function (p) {
          rows.push({ Gedung: g.NamaGedung, Kamar: k.NomorKamar, Lantai: k.Lantai, Kapasitas: k.Kapasitas, Terisi: k.terisi, Santri: p.NamaLengkap, NIM: p.NIM });
        });
      });
      unduhExcel(rows, 'Okupansi_Kamar', 'Okupansi');
    }
  },
  template: `
  <div>
    <sa-page judul="Papan Alokasi &amp; Penempatan Kamar"
             sub="Pilih santri di antrean, lalu klik kamar tujuan. Validasi gender dan kapasitas berjalan otomatis."
             :jalur="['Operasional Asrama','Penempatan Kamar']">
      <template #aksi>
        <button class="btn secondary" @click="ekspor">⬇ Ekspor Okupansi</button>
        <button class="btn secondary" @click="muat">↻ Segarkan</button>
      </template>
    </sa-page>

    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="d">
      <div class="grid grid-4 mb-md">
        <sa-kpi label="Total Kapasitas" :nilai="angka(statGedung.kapasitas)" satuan="bed" ikon="🛏"
                :catatan="statGedung.kamar + ' kamar unit'"></sa-kpi>
        <sa-kpi label="Terisi / Okupansi" :nilai="angka(statGedung.terisi)" ikon="✅" warna="ok"
                :persen="statGedung.persen" persenWarna="ok" :catatan="statGedung.persen + '% terisi'"></sa-kpi>
        <sa-kpi label="Bed Kosong Tersedia" :nilai="statGedung.kosong" ikon="🟦"
                catatan="Siap huni gelombang baru"></sa-kpi>
        <sa-kpi label="Antrean Penempatan" :nilai="d.antrean.length" ikon="⏳" warna="warn"
                catatan="Santri belum berkamar"></sa-kpi>
      </div>

      <div class="grid grid-32">
        <!-- ANTREAN -->
        <div class="card">
          <div class="card-head">
            <div class="t">
              <div class="card-title">Antrean Santri</div>
              <div class="card-sub">Siap ditempatkan ke kamar</div>
            </div>
            <span class="badge info">{{ antrean.length }} Menunggu</span>
          </div>
          <input class="input mb-md" v-model="cariAntrean" placeholder="🔍 Cari nama, NIM, prodi…">
          <div style="max-height:620px;overflow:auto">
            <div v-for="a in antrean" :key="a.PenghuniID" class="room" style="margin-bottom:10px"
                 :class="{aktif: santriPilih && santriPilih.PenghuniID === a.PenghuniID}" @click="pilihSantri(a)">
              <div class="person">
                <sa-avatar :nama="a.NamaLengkap" :foto="a.FotoURL"></sa-avatar>
                <div class="nm flex-1">
                  <b>{{ a.NamaLengkap }}</b>
                  <span class="mono">{{ a.NIM || a.PenghuniID }}</span>
                </div>
                <span class="badge plain" :class="a.JenisKelamin === 'L' ? 'info' : 'danger'">
                  {{ a.JenisKelamin === 'L' ? 'Putra' : 'Putri' }}
                </span>
              </div>
              <div class="room-facil">
                <span class="facil">{{ a.Prodi || 'Prodi -' }}</span>
                <span class="facil">Angkatan {{ a.Angkatan || '-' }}</span>
                <span class="facil" v-if="a.BeratBadan">{{ a.BeratBadan }} kg</span>
              </div>
              <div class="fs-xs txt-2">{{ a.NamaPaket }}</div>
              <div class="mt-sm fs-xs txt-blue fw6" v-if="santriPilih && santriPilih.PenghuniID === a.PenghuniID">
                ✓ Terpilih — klik kamar tujuan di kanan
              </div>
            </div>
            <sa-empty v-if="!antrean.length" judul="Antrean kosong"
                      pesan="Semua santri aktif sudah memiliki kamar." ikon="🎉"></sa-empty>
          </div>
        </div>

        <!-- PAPAN KAMAR -->
        <div class="card">
          <div class="tabs">
            <button v-for="g in d.gedung" :key="g.GedungID" class="tab"
                    :class="{active: gedungAktif === g.GedungID}"
                    @click="gedungAktif = g.GedungID; lantaiAktif = 0">
              {{ g.Tipe === 'Putra' ? '🏠' : '🏡' }} {{ g.NamaGedung }}
            </button>
          </div>

          <div class="filters">
            <div class="pills">
              <button :class="{active: lantaiAktif === 0}" @click="lantaiAktif = 0">Semua Lantai</button>
              <button v-for="l in lantaiTersedia" :key="l" :class="{active: Number(lantaiAktif) === Number(l)}"
                      @click="lantaiAktif = l">Lantai {{ l }}</button>
            </div>
            <input class="input" v-model="cariKamar" placeholder="🔍 Nomor kamar…" style="min-width:160px">
          </div>

          <div class="legend">
            <span><i style="background:var(--ok)"></i>Penuh / Terisi</span>
            <span><i style="background:var(--border)"></i>Bed kosong</span>
            <span><i style="background:var(--warn)"></i>Perbaikan / Maintenance</span>
            <span v-if="santriPilih" class="txt-blue fw6">● Mode penempatan aktif — klik kamar tujuan</span>
          </div>

          <div class="room-grid">
            <div v-for="k in kamarTampil" :key="k.KamarID" class="room" @click="klikKamar(k)">
              <div class="room-top">
                <div class="room-no">{{ String(k.NomorKamar).slice(-3) }}</div>
                <div class="flex-1">
                  <div class="room-name">Kamar {{ k.NomorKamar }}</div>
                  <div class="room-meta">Lantai {{ k.Lantai }} · Kapasitas {{ k.Kapasitas }} bed</div>
                </div>
                <span class="badge" :class="k.Status === 'Perbaikan' ? 'warn' : (k.statusIsi === 'Penuh' ? 'ok' : 'info')">
                  {{ k.Status === 'Perbaikan' ? 'Perbaikan' : k.statusIsi + ' (' + k.terisi + '/' + k.Kapasitas + ')' }}
                </span>
              </div>
              <div class="room-facil">
                <span class="facil" v-for="(f,i) in String(k.Fasilitas||'').split(',').filter(x=>x)" :key="i">{{ f.trim() }}</span>
              </div>
              <div class="beds">
                <div class="bed" v-for="n in Number(k.Kapasitas)" :key="n" :class="kelasBed(k, n-1)"></div>
              </div>
              <div class="fs-xs txt-2 flex justify-between">
                <span>{{ k.terisi }} terisi · {{ k.sisa }} kosong</span>
                <span class="stack">
                  <sa-avatar v-for="p in k.penghuni.slice(0,4)" :key="p.PenghuniID" :nama="p.NamaLengkap" ukuran="sm"></sa-avatar>
                </span>
              </div>
            </div>
          </div>
          <sa-empty v-if="!kamarTampil.length" judul="Tidak ada kamar" pesan="Tambahkan kamar pada menu Gedung &amp; Kamar."></sa-empty>
        </div>
      </div>

      <!-- KONFIRMASI ALOKASI -->
      <sa-modal v-if="konfirmasi" judul="Konfirmasi Alokasi Kamar"
                sub="Validasi kebijakan asrama otomatis" ikon="🛏" @tutup="konfirmasi = null">
        <div class="flex items-center gap-md" style="background:var(--surface-2);border:1px solid var(--border);
             border-radius:var(--r);padding:14px">
          <sa-avatar :nama="konfirmasi.santri.NamaLengkap" :foto="konfirmasi.santri.FotoURL"></sa-avatar>
          <div class="flex-1">
            <b>{{ konfirmasi.santri.NamaLengkap }}</b>
            <div class="mono fs-xs txt-2">{{ konfirmasi.santri.NIM || konfirmasi.santri.PenghuniID }}</div>
          </div>
          <div style="font-size:18px">→</div>
          <div class="text-right">
            <b>Kamar {{ konfirmasi.kamar.NomorKamar }}</b>
            <div class="fs-xs txt-ok">Bed {{ konfirmasi.kamar.terisi + 1 }} · {{ konfirmasi.gedung.NamaGedung }}</div>
          </div>
        </div>

        <div class="label mt-lg">Validasi Kebijakan Asrama Otomatis</div>
        <div class="validasi-grid">
          <div class="validasi-item" :class="{bad: !konfirmasi.genderCocok}">
            <span class="ic">{{ konfirmasi.genderCocok ? '✔' : '✘' }}</span>
            Gender {{ konfirmasi.genderCocok ? 'Valid' : 'TIDAK COCOK' }} ({{ konfirmasi.gedung.Tipe }})
          </div>
          <div class="validasi-item" :class="{bad: konfirmasi.kamar.sisa <= 0}">
            <span class="ic">{{ konfirmasi.kamar.sisa > 0 ? '✔' : '✘' }}</span>
            Kapasitas tersedia (sisa {{ konfirmasi.kamar.sisa }} bed)
          </div>
          <div class="validasi-item" :class="{bad: konfirmasi.kamar.Status === 'Perbaikan'}">
            <span class="ic">{{ konfirmasi.kamar.Status !== 'Perbaikan' ? '✔' : '✘' }}</span>
            Status kamar {{ konfirmasi.kamar.Status }}
          </div>
          <div class="validasi-item">
            <span class="ic">✔</span> Paket fasilitas sesuai
          </div>
        </div>
        <div class="info-box warn" v-if="!konfirmasi.genderCocok">
          <span>⚠️</span><div>Gender santri tidak sesuai tipe gedung. Server akan menolak penempatan ini (BR-7).</div>
        </div>

        <template #aksi>
          <button class="btn ghost" @click="konfirmasi = null">Batal</button>
          <button class="btn" :disabled="proses || !konfirmasi.genderCocok || konfirmasi.kamar.sisa <= 0" @click="tempatkan">
            <span v-if="proses" class="spin"></span>✔ Ya, Tempatkan Sekarang
          </button>
        </template>
      </sa-modal>

      <!-- ISI KAMAR -->
      <sa-modal v-if="isiKamar" :judul="'Kamar ' + isiKamar.NomorKamar"
                :sub="isiKamar.terisi + ' dari ' + isiKamar.Kapasitas + ' bed terisi · Lantai ' + isiKamar.Lantai"
                ikon="🏠" lebar="wide" @tutup="isiKamar = null">
        <div class="beds mb-md">
          <div class="bed" v-for="n in Number(isiKamar.Kapasitas)" :key="n" :class="kelasBed(isiKamar, n-1)" style="height:10px"></div>
        </div>
        <div class="table-wrap" v-if="isiKamar.penghuni.length">
          <table class="tbl">
            <thead><tr><th>Bed</th><th>Santri</th><th>Paket</th><th>Skor</th><th>Kontak</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(p,i) in isiKamar.penghuni" :key="p.PenghuniID">
                <td class="mono">B.0{{ i+1 }}</td>
                <td>
                  <div class="person">
                    <sa-avatar :nama="p.NamaLengkap" :foto="p.FotoURL" ukuran="sm"></sa-avatar>
                    <div class="nm"><b>{{ p.NamaLengkap }}</b><span class="mono">{{ p.NIM }}</span></div>
                  </div>
                </td>
                <td class="fs-sm">{{ p.NamaPaket }}</td>
                <td><span class="badge plain" :class="p.Skor >= 90 ? 'ok' : (p.Skor >= 75 ? 'warn' : 'danger')">{{ p.Skor }}</span></td>
                <td><a class="btn xs secondary" :href="waLink(p.NoHP)" target="_blank">💬 WA</a></td>
                <td><button class="btn xs danger" @click="keluarkan(p, isiKamar)">Keluarkan</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <sa-empty v-else judul="Kamar masih kosong" pesan="Pilih santri di antrean lalu klik kamar ini."></sa-empty>
        <template #aksi><button class="btn secondary" @click="isiKamar = null">Tutup</button></template>
      </sa-modal>
    </template>
  </div>`
};

/* =========================================================================
 * GEDUNG & KAMAR (CRUD)
 * ======================================================================= */
window.VIEWS['gedung-kamar'] = {
  props: ['user'],
  data: function () {
    return { tab: 'Gedung', gedung: [], kamar: [], paket: [], memuat: true,
             form: null, jenis: '', proses: false, gedungFilter: '' };
  },
  mounted: function () { this.muat(); },
  computed: {
    kamarTampil: function () {
      var g = this.gedungFilter;
      return this.kamar.filter(function (k) { return !g || k.GedungID === g; });
    }
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var a = await callApi('crud.list', { tabel: 'Gedung' });
      var b = await callApi('crud.list', { tabel: 'Kamar' });
      var c = await callApi('crud.list', { tabel: 'Paket' });
      this.memuat = false;
      if (a.ok) this.gedung = a.data;
      if (b.ok) this.kamar = b.data;
      if (c.ok) this.paket = c.data;
    },
    baru: function (jenis) {
      this.jenis = jenis;
      this.form = jenis === 'Gedung' ? { NamaGedung: '', Tipe: 'Putra', JumlahLantai: 3, Musyrif: '', NoHPMusyrif: '', Status: 'Aktif' }
        : jenis === 'Kamar' ? { GedungID: this.gedungFilter || (this.gedung[0] || {}).GedungID, NomorKamar: '', Lantai: 1, Kapasitas: 8, Fasilitas: '', Status: 'Tersedia' }
        : { NamaPaket: '', Harga: 0, Deskripsi: '', IncludeMakan: true, Status: 'Aktif' };
    },
    sunting: function (jenis, row) { this.jenis = jenis; this.form = Object.assign({}, row); },
    simpan: async function () {
      this.proses = true;
      var idField = { Gedung: 'GedungID', Kamar: 'KamarID', Paket: 'PaketID' }[this.jenis];
      var id = this.form[idField];
      var res = id
        ? await callApi('crud.update', { tabel: this.jenis, id: id, data: this.form })
        : await callApi('crud.create', { tabel: this.jenis, data: this.form });
      this.proses = false;
      if (res.ok) { toast(res.message, 'success'); this.form = null; bersihkanCache(); this.muat(); }
    },
    hapus: async function (jenis, row) {
      var idField = { Gedung: 'GedungID', Kamar: 'KamarID', Paket: 'PaketID' }[jenis];
      var nama = row.NamaGedung || row.NomorKamar || row.NamaPaket;
      var ya = await konfirmasi('Hapus ' + nama + '?', 'Tindakan ini tidak dapat dibatalkan.', 'Ya, hapus', true);
      if (!ya) return;
      var res = await callApi('crud.delete', { tabel: jenis, id: row[idField] });
      if (res.ok) { toast(res.message, 'success'); bersihkanCache(); this.muat(); }
    }
  },
  template: `
  <div>
    <sa-page judul="Master Gedung, Kamar &amp; Paket"
             sub="Struktur fisik asrama dan skema biaya yang menjadi dasar penempatan serta penagihan."
             :jalur="['Operasional Asrama','Master Data Asrama']">
      <template #aksi><button class="btn" @click="baru(tab)">＋ Tambah {{ tab }}</button></template>
    </sa-page>

    <div class="tabs">
      <button class="tab" :class="{active: tab==='Gedung'}" @click="tab='Gedung'">🏢 Gedung <span class="cnt">{{ gedung.length }}</span></button>
      <button class="tab" :class="{active: tab==='Kamar'}" @click="tab='Kamar'">🛏 Kamar <span class="cnt">{{ kamar.length }}</span></button>
      <button class="tab" :class="{active: tab==='Paket'}" @click="tab='Paket'">💳 Paket <span class="cnt">{{ paket.length }}</span></button>
    </div>

    <sa-loading v-if="memuat"></sa-loading>

    <!-- GEDUNG -->
    <div class="card" v-else-if="tab==='Gedung'">
      <div class="table-wrap" v-if="gedung.length">
        <table class="tbl">
          <thead><tr><th>Gedung</th><th>Tipe</th><th class="num">Kamar</th><th class="num">Kapasitas</th>
            <th>Okupansi</th><th>Musyrif/ah</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr v-for="g in gedung" :key="g.GedungID">
              <td><b>{{ g.NamaGedung }}</b><div class="mono fs-xs txt-3">{{ g.GedungID }} · {{ g.JumlahLantai }} lantai</div></td>
              <td><span class="badge plain" :class="g.Tipe==='Putra' ? 'info':'danger'">{{ g.Tipe }}</span></td>
              <td class="num">{{ g.jumlahKamar }}</td>
              <td class="num">{{ g.kapasitas }}</td>
              <td style="min-width:150px">
                <sa-progress :nilai="g.persen" :label="g.terisi + '/' + g.kapasitas"></sa-progress>
              </td>
              <td class="fs-sm">{{ g.Musyrif || '-' }}<div class="txt-3 fs-xs">{{ g.NoHPMusyrif }}</div></td>
              <td><sa-badge :teks="g.Status"></sa-badge></td>
              <td><div class="flex gap-sm">
                <button class="btn xs secondary" @click="sunting('Gedung', g)">Ubah</button>
                <button class="btn xs ghost" @click="hapus('Gedung', g)">🗑</button>
              </div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <sa-empty v-else judul="Belum ada gedung" pesan="Tambahkan gedung asrama terlebih dahulu.">
        <button class="btn" @click="baru('Gedung')">＋ Tambah Gedung</button>
      </sa-empty>
    </div>

    <!-- KAMAR -->
    <div class="card" v-else-if="tab==='Kamar'">
      <div class="filters">
        <select class="select" v-model="gedungFilter">
          <option value="">Semua gedung</option>
          <option v-for="g in gedung" :key="g.GedungID" :value="g.GedungID">{{ g.NamaGedung }}</option>
        </select>
        <span class="chip">{{ kamarTampil.length }} kamar</span>
      </div>
      <div class="table-wrap" v-if="kamarTampil.length">
        <table class="tbl">
          <thead><tr><th>Kamar</th><th>Gedung</th><th class="num">Lantai</th><th class="num">Kapasitas</th>
            <th>Fasilitas</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr v-for="k in kamarTampil" :key="k.KamarID">
              <td><b>{{ k.NomorKamar }}</b><div class="mono fs-xs txt-3">{{ k.KamarID }}</div></td>
              <td class="fs-sm">{{ (gedung.filter(g => g.GedungID === k.GedungID)[0]||{}).NamaGedung || k.GedungID }}</td>
              <td class="num">{{ k.Lantai }}</td>
              <td class="num">{{ k.Kapasitas }}</td>
              <td class="fs-sm">{{ potong(k.Fasilitas, 40) }}</td>
              <td><sa-badge :teks="k.Status"></sa-badge></td>
              <td><div class="flex gap-sm">
                <button class="btn xs secondary" @click="sunting('Kamar', k)">Ubah</button>
                <button class="btn xs ghost" @click="hapus('Kamar', k)">🗑</button>
              </div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <sa-empty v-else judul="Belum ada kamar"></sa-empty>
    </div>

    <!-- PAKET -->
    <div class="card" v-else>
      <div class="grid grid-3">
        <div class="card flat" v-for="p in paket" :key="p.PaketID" style="margin:0;border:1px solid var(--border)">
          <div class="flex justify-between items-center mb-md">
            <span class="badge" :class="p.IncludeMakan === true || p.IncludeMakan === 'TRUE' ? 'ok' : ''">
              {{ p.IncludeMakan === true || p.IncludeMakan === 'TRUE' ? 'Termasuk Katering' : 'Tanpa Katering' }}
            </span>
            <sa-badge :teks="p.Status"></sa-badge>
          </div>
          <div class="card-title">{{ p.NamaPaket }}</div>
          <div class="kpi-value mt-sm">{{ rupiah(p.Harga) }}<small>/bulan</small></div>
          <p class="fs-sm txt-2 mt-sm">{{ p.Deskripsi }}</p>
          <div class="btn-row mt-md">
            <button class="btn xs secondary" @click="sunting('Paket', p)">Ubah</button>
            <button class="btn xs ghost" @click="hapus('Paket', p)">🗑 Hapus</button>
          </div>
        </div>
      </div>
      <sa-empty v-if="!paket.length" judul="Belum ada paket"></sa-empty>
    </div>

    <!-- FORM -->
    <sa-modal v-if="form" :judul="(form.GedungID || form.KamarID || form.PaketID ? 'Ubah ' : 'Tambah ') + jenis"
              ikon="✏️" @tutup="form = null">
      <template v-if="jenis === 'Gedung'">
        <div class="field"><label class="label">Nama Gedung</label><input class="input" v-model="form.NamaGedung"></div>
        <div class="grid grid-2 gap-md">
          <div class="field"><label class="label">Tipe</label>
            <select class="select" v-model="form.Tipe"><option>Putra</option><option>Putri</option></select></div>
          <div class="field"><label class="label">Jumlah Lantai</label>
            <input type="number" class="input" v-model="form.JumlahLantai"></div>
          <div class="field"><label class="label">Musyrif/ah</label><input class="input" v-model="form.Musyrif"></div>
          <div class="field"><label class="label">No. HP Musyrif</label><input class="input" v-model="form.NoHPMusyrif"></div>
        </div>
        <div class="field"><label class="label">Status</label>
          <select class="select" v-model="form.Status"><option>Aktif</option><option>Nonaktif</option></select></div>
      </template>

      <template v-else-if="jenis === 'Kamar'">
        <div class="field"><label class="label">Gedung</label>
          <select class="select" v-model="form.GedungID">
            <option v-for="g in gedung" :key="g.GedungID" :value="g.GedungID">{{ g.NamaGedung }}</option>
          </select></div>
        <div class="grid grid-3 gap-md">
          <div class="field"><label class="label">Nomor Kamar</label><input class="input" v-model="form.NomorKamar" placeholder="A.101"></div>
          <div class="field"><label class="label">Lantai</label><input type="number" class="input" v-model="form.Lantai"></div>
          <div class="field"><label class="label">Kapasitas (bed)</label><input type="number" class="input" v-model="form.Kapasitas"></div>
        </div>
        <div class="field"><label class="label">Fasilitas</label>
          <input class="input" v-model="form.Fasilitas" placeholder="AC 1.5 PK, KM Dalam, Lemari 8 Pintu"></div>
        <div class="field"><label class="label">Status</label>
          <select class="select" v-model="form.Status">
            <option>Tersedia</option><option>Penuh</option><option>Perbaikan</option><option>Nonaktif</option>
          </select></div>
      </template>

      <template v-else>
        <div class="field"><label class="label">Nama Paket</label><input class="input" v-model="form.NamaPaket"></div>
        <div class="grid grid-2 gap-md">
          <div class="field"><label class="label">Harga per Bulan</label><input type="number" class="input" v-model="form.Harga"></div>
          <div class="field"><label class="label">Status</label>
            <select class="select" v-model="form.Status"><option>Aktif</option><option>Nonaktif</option></select></div>
        </div>
        <div class="field"><label class="label">Deskripsi</label><textarea class="input" v-model="form.Deskripsi"></textarea></div>
        <label class="check"><input type="checkbox" v-model="form.IncludeMakan">
          <span>Termasuk katering 3x sehari (santri otomatis berhak kartu makan QR)</span></label>
      </template>

      <template #aksi>
        <button class="btn secondary" @click="form = null">Batal</button>
        <button class="btn" :disabled="proses" @click="simpan"><span v-if="proses" class="spin"></span>Simpan</button>
      </template>
    </sa-modal>
  </div>`
};

/* =========================================================================
 * TAGIHAN & PEMBAYARAN (admin)
 * ======================================================================= */
window.VIEWS['tagihan'] = {
  props: ['user'],
  data: function () {
    return {
      tab: 'daftar', rows: [], ringkasan: {}, memuat: true,
      f: { periode: '', status: '', cari: '' },
      pending: [], eligible: null, terpilih: [], periodeBaru: '', proses: false, verif: null, catatan: ''
    };
  },
  mounted: function () {
    var d = new Date();
    this.periodeBaru = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    this.muat();
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('billing.list', this.f);
      this.memuat = false;
      if (res.ok) { this.rows = res.data.rows; this.ringkasan = res.data.ringkasan; }
    },
    muatPending: async function () {
      var res = await callApi('billing.pending', {});
      if (res.ok) this.pending = res.data;
    },
    muatEligible: async function () {
      var res = await callApi('billing.eligible', { periode: this.periodeBaru });
      if (res.ok) { this.eligible = res.data; this.terpilih = []; }
    },
    gantiTab: function (t) {
      this.tab = t;
      if (t === 'verifikasi') this.muatPending();
      if (t === 'terbitkan') this.muatEligible();
    },
    pilihSemua: function (ev) {
      this.terpilih = ev.target.checked ? this.eligible.rows.map(function (r) { return r.PenghuniID; }) : [];
    },
    terbitkan: async function (semua) {
      var jml = semua ? this.eligible.rows.length : this.terpilih.length;
      if (!jml) { toast('Pilih minimal satu santri.', 'warning'); return; }
      var ya = await konfirmasi('Terbitkan ' + jml + ' tagihan?',
        'Periode ' + periodeLabel(this.periodeBaru) + '. Penerbitan bersifat idempotent — tidak akan dobel.', 'Ya, terbitkan');
      if (!ya) return;
      this.proses = true;
      var res = await callApi(semua ? 'billing.genBatch' : 'billing.genForSelected',
        { periode: this.periodeBaru, penghuniIds: this.terpilih });
      this.proses = false;
      if (res.ok) { toast(res.message, 'success'); bersihkanCache(); this.muatEligible(); this.muat(); }
    },
    verifikasi: async function (aksi) {
      if (aksi === 'tolak' && !this.catatan) { toast('Alasan penolakan wajib diisi.', 'warning'); return; }
      this.proses = true;
      var res = await callApi('billing.verifyPayment',
        { pembayaranId: this.verif.PembayaranID, aksi: aksi, catatan: this.catatan });
      this.proses = false;
      if (res.ok) { toast(res.message, 'success'); this.verif = null; this.catatan = ''; bersihkanCache(); this.muatPending(); this.muat(); }
    },
    ekspor: function () {
      unduhExcel(this.rows.map(function (t) {
        return { Invoice: t.TagihanID, NIM: t.NIM, Nama: t.NamaLengkap, Kamar: t.NomorKamar,
                 Paket: t.NamaPaket, Periode: t.Periode, Nominal: t.Jumlah, Status: t.Status,
                 JatuhTempo: t.JatuhTempo, Lunas: t.TanggalLunas };
      }), 'Tagihan_' + (this.f.periode || 'semua'), 'Tagihan');
    }
  },
  template: `
  <div>
    <sa-page judul="Manajemen Tagihan &amp; Pembayaran Asrama"
             sub="Kelola penagihan berkala, verifikasi bukti transfer, dan penerbitan faktur massal mahasantri."
             :jalur="['Operasional Asrama','Tagihan &amp; Pembayaran']">
      <template #aksi>
        <button class="btn secondary" @click="ekspor">⬇ Ekspor Rekap Keuangan</button>
        <button class="btn" @click="gantiTab('terbitkan')">＋ Terbitkan Tagihan Baru</button>
      </template>
    </sa-page>

    <div class="grid grid-4 mb-md">
      <sa-kpi label="Total Penagihan" :nilai="rupiah(ringkasan.totalTagihan || 0, true)" ikon="🧾"></sa-kpi>
      <sa-kpi label="Sudah Lunas &amp; Terverifikasi" :nilai="rupiah(ringkasan.terkumpul || 0, true)" ikon="✅" warna="ok"
              :catatan="(ringkasan.jumlahLunas || 0) + ' tagihan lunas · ' + (ringkasan.jumlahGratis || 0) + ' gratis'"></sa-kpi>
      <sa-kpi label="Menunggu Verifikasi" :nilai="ringkasan.menungguVerifikasi || 0" satuan="transaksi" ikon="⏳" warna="warn"
              catatan="Perlu tindakan kasir"></sa-kpi>
      <sa-kpi label="Tunggakan / Belum Bayar" :nilai="rupiah(ringkasan.tunggakan || 0, true)" ikon="⚠️" warna="danger"
              :catatan="(ringkasan.jumlahBelum || 0) + ' tagihan terpapar'"></sa-kpi>
    </div>

    <div class="tabs">
      <button class="tab" :class="{active: tab==='daftar'}" @click="gantiTab('daftar')">Daftar Tagihan <span class="cnt">{{ rows.length }}</span></button>
      <button class="tab" :class="{active: tab==='verifikasi'}" @click="gantiTab('verifikasi')">Verifikasi Bukti Pembayaran
        <span class="cnt">{{ ringkasan.menungguVerifikasi || 0 }}</span></button>
      <button class="tab" :class="{active: tab==='terbitkan'}" @click="gantiTab('terbitkan')">Penerbitan Tagihan Massal</button>
    </div>

    <!-- TAB DAFTAR -->
    <div class="card" v-if="tab==='daftar'">
      <div class="filters">
        <input class="input flex-1" v-model="f.cari" @input="muat" placeholder="🔍 Cari invoice, NIM, atau nama santri…" style="min-width:240px">
        <select class="select" v-model="f.status" @change="muat">
          <option value="">Semua status</option>
          <option>Belum Bayar</option><option>Menunggu Verifikasi</option><option>Lunas</option>
          <option>Gratis</option><option>Terlambat</option>
        </select>
        <input class="input" type="month" v-model="f.periode" @change="muat" style="min-width:160px">
      </div>
      <sa-loading v-if="memuat"></sa-loading>
      <div class="table-wrap" v-else-if="rows.length">
        <table class="tbl">
          <thead><tr><th>No. Invoice &amp; Tgl</th><th>Mahasantri &amp; Kamar</th><th>Paket Hunian</th>
            <th>Periode</th><th class="num">Nominal</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="t in rows.slice(0,100)" :key="t.TagihanID">
              <td><a href="#" class="mono">{{ t.TagihanID }}</a>
                <div class="fs-xs txt-3">{{ tanggal(t.TanggalTerbit,'pendek') }}</div></td>
              <td>
                <div class="person">
                  <sa-avatar :nama="t.NamaLengkap" ukuran="sm"></sa-avatar>
                  <div class="nm"><b>{{ t.NamaLengkap }}</b><span class="mono">{{ t.NIM }} · Kmr {{ t.NomorKamar }}</span></div>
                </div>
              </td>
              <td class="fs-sm">{{ t.NamaPaket }}</td>
              <td class="fs-sm">{{ periodeLabel(t.Periode) }}
                <div class="fs-xs txt-3">Jatuh tempo {{ tanggal(t.JatuhTempo,'pendek') }}</div></td>
              <td class="num fw6">{{ rupiah(t.Jumlah) }}</td>
              <td><sa-badge :teks="t.Status"></sa-badge></td>
            </tr>
          </tbody>
        </table>
      </div>
      <sa-empty v-else judul="Belum ada tagihan" pesan="Terbitkan tagihan pada tab Penerbitan Massal."></sa-empty>
      <div class="tbl-foot" v-if="rows.length">
        <span>Menampilkan {{ Math.min(100, rows.length) }} dari {{ angka(rows.length) }} data tagihan</span>
      </div>
    </div>

    <!-- TAB VERIFIKASI -->
    <div class="card" v-else-if="tab==='verifikasi'">
      <div class="card-head"><div class="t">
        <div class="card-title">Pemeriksaan &amp; Validasi Bukti Pembayaran</div>
        <div class="card-sub">Verifikasi visual struk mutasi bank syariah dengan data tagihan sistem.</div>
      </div></div>
      <div class="table-wrap" v-if="pending.length">
        <table class="tbl">
          <thead><tr><th>Santri</th><th>Invoice &amp; Periode</th><th class="num">Nominal Ditransfer</th>
            <th class="num">Nilai Tagihan</th><th>Metode</th><th>Bukti</th><th>Tindakan</th></tr></thead>
          <tbody>
            <tr v-for="b in pending" :key="b.PembayaranID">
              <td><b>{{ b.NamaLengkap }}</b><div class="mono fs-xs txt-3">{{ b.NIM }}</div></td>
              <td><span class="mono">{{ b.TagihanID }}</span><div class="fs-xs txt-3">{{ periodeLabel(b.Periode) }}</div></td>
              <td class="num fw6 txt-ok">{{ rupiah(b.Jumlah) }}</td>
              <td class="num">{{ rupiah(b.NominalTagihan) }}</td>
              <td class="fs-sm">{{ b.Metode }}<div class="fs-xs txt-3">{{ b.NoReferensi }}</div></td>
              <td><div v-if="b.BuktiURL" style="width:64px"><sa-thumb :src="b.BuktiThumb" :href="b.BuktiURL" tinggi="48"></sa-thumb></div>
                  <span v-else class="txt-3 fs-xs">Tanpa bukti</span></td>
              <td><button class="btn xs" @click="verif = b; catatan = ''">Periksa</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <sa-empty v-else judul="Tidak ada bukti menunggu" pesan="Semua pembayaran sudah diverifikasi." ikon="✅"></sa-empty>
    </div>

    <!-- TAB TERBITKAN -->
    <div class="card" v-else>
      <div class="card-head"><div class="t">
        <div class="card-title">Generator Penagihan Massal</div>
        <div class="card-sub">Penerbitan bersifat idempotent — santri yang sudah ditagih pada periode ini otomatis dilewati (BR-3).</div>
      </div></div>
      <div class="filters">
        <input class="input" type="month" v-model="periodeBaru" @change="muatEligible" style="min-width:180px">
        <button class="btn sm secondary" @click="muatEligible">↻ Muat ulang daftar</button>
      </div>

      <template v-if="eligible">
        <div class="panel-dark mb-md">
          <div class="it"><small>Periode target</small><b>{{ periodeLabel(eligible.periode) }}</b></div>
          <div class="it"><small>Santri belum ditagih</small><b>{{ eligible.rows.length }} mahasantri</b></div>
          <div class="it"><small>Estimasi nilai faktur</small><b>{{ rupiah(eligible.estimasi) }}</b></div>
          <div class="it"><small>Dipilih</small><b>{{ terpilih.length }} santri</b></div>
        </div>

        <div class="table-wrap" v-if="eligible.rows.length">
          <table class="tbl">
            <thead><tr>
              <th style="width:40px"><input type="checkbox" @change="pilihSemua"></th>
              <th>Santri</th><th>Kamar</th><th>Paket</th><th class="num">Nominal</th>
            </tr></thead>
            <tbody>
              <tr v-for="r in eligible.rows" :key="r.PenghuniID" :class="{sel: terpilih.indexOf(r.PenghuniID) > -1}">
                <td><input type="checkbox" :value="r.PenghuniID" v-model="terpilih"></td>
                <td><b>{{ r.NamaLengkap }}</b><div class="mono fs-xs txt-3">{{ r.NIM }}</div></td>
                <td class="fs-sm">{{ r.NomorKamar }}</td>
                <td class="fs-sm">{{ r.NamaPaket }}</td>
                <td class="num">{{ rupiah(r.Harga) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <sa-empty v-else judul="Semua santri sudah ditagih"
                  :pesan="'Tidak ada tagihan baru untuk periode ' + periodeLabel(eligible.periode) + '.'" ikon="✅"></sa-empty>

        <div class="btn-row mt-md" v-if="eligible.rows.length">
          <button class="btn secondary" :disabled="proses || !terpilih.length" @click="terbitkan(false)">
            Terbitkan {{ terpilih.length }} Terpilih
          </button>
          <button class="btn dark" :disabled="proses" @click="terbitkan(true)">
            <span v-if="proses" class="spin"></span>⚡ Terbitkan Semua ({{ eligible.rows.length }})
          </button>
        </div>
      </template>
      <sa-loading v-else></sa-loading>
    </div>

    <!-- MODAL VERIFIKASI -->
    <sa-modal v-if="verif" judul="Verifikasi Bukti Pembayaran"
              :sub="verif.NamaLengkap + ' · ' + verif.TagihanID" ikon="🧾" @tutup="verif = null">
      <sa-kv k="Periode" :v="periodeLabel(verif.Periode)"></sa-kv>
      <sa-kv k="Nilai tagihan" :v="rupiah(verif.NominalTagihan)"></sa-kv>
      <sa-kv k="Nominal ditransfer" :v="rupiah(verif.Jumlah)"></sa-kv>
      <sa-kv k="Metode / referensi" :v="verif.Metode + ' · ' + (verif.NoReferensi || '-')"></sa-kv>
      <sa-kv k="Tanggal bayar" :v="tanggal(verif.TanggalBayar,'pendek')"></sa-kv>
      <div class="info-box mt-md" v-if="Number(verif.Jumlah) > Number(verif.NominalTagihan)">
        <span>ℹ️</span><div>Terdapat kelebihan bayar {{ rupiah(Number(verif.Jumlah) - Number(verif.NominalTagihan)) }} —
        akan dicatat sebagai saldo deposit santri (BR-6).</div>
      </div>
      <div class="mt-md" v-if="verif.BuktiURL">
        <sa-thumb :src="verif.BuktiThumb" :href="verif.BuktiURL" judul="🔍 Bukti transfer — klik untuk ukuran penuh" tinggi="220"></sa-thumb>
      </div>
      <div class="field mt-md">
        <label class="label">Catatan (wajib bila menolak)</label>
        <textarea class="input" v-model="catatan" placeholder="mis. nominal tidak sesuai / struk buram"></textarea>
      </div>
      <template #aksi>
        <button class="btn ghost" @click="verif = null">Batal</button>
        <button class="btn danger" :disabled="proses" @click="verifikasi('tolak')">⛔ Tolak Bukti</button>
        <button class="btn ok" :disabled="proses" @click="verifikasi('terima')">
          <span v-if="proses" class="spin"></span>✔ Verifikasi &amp; Tandai Lunas
        </button>
      </template>
    </sa-modal>
  </div>`
};

/* =========================================================================
 * TAGIHAN SAYA (penghuni)
 * ======================================================================= */
window.VIEWS['tagihan-saya'] = {
  props: ['user'],
  data: function () { return { d: null, memuat: true, bayar: null, form: {}, berkas: null, proses: false }; },
  mounted: function () { this.muat(); },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('billing.mine', {});
      this.memuat = false;
      if (res.ok) this.d = res.data;
    },
    bukaBayar: function (t) {
      this.bayar = t;
      this.form = { jumlah: t.Jumlah, metode: 'Transfer', noReferensi: '', tanggalBayar: new Date().toISOString().substring(0, 10) };
      this.berkas = null;
    },
    pilihBerkas: async function (ev) {
      var f = ev.target.files[0];
      if (!f) return;
      if (f.size > (/^image\//.test(f.type) ? 15 : 2) * 1024 * 1024) { toast('Maksimal 2 MB (PDF) / 15 MB (foto).', 'warning'); return; }
      this.berkas = await bacaBerkas(f);   // foto otomatis dikompres + dibuat thumbnail
    },
    kirim: async function () {
      if (!this.berkas) { toast('Unggah bukti transfer terlebih dahulu.', 'warning'); return; }
      this.proses = true;
      var res = await callApi('billing.submitProof', Object.assign({
        tagihanId: this.bayar.TagihanID, bukti: this.berkas
      }, this.form));
      this.proses = false;
      if (res.ok) { toast(res.message, 'success'); this.bayar = null; this.muat(); }
    }
  },
  template: `
  <div>
    <sa-page judul="Tagihan &amp; Pembayaran Saya"
             sub="Riwayat tagihan asrama Anda beserta status verifikasi bukti pembayaran."
             :jalur="['Layanan Mandiri','Tagihan Saya']"></sa-page>

    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="d">
      <div class="grid grid-2 mb-md">
        <sa-kpi label="Total Tunggakan" :nilai="rupiah(d.totalTunggakan)" ikon="💳"
                :warna="d.totalTunggakan > 0 ? 'danger' : 'ok'"
                :catatan="d.totalTunggakan > 0 ? 'Segera lakukan pembayaran' : 'Tidak ada tunggakan — jazakumullah khairan'"></sa-kpi>
        <div class="card" style="margin:0">
          <div class="card-title">Rekening Tujuan</div>
          <p class="fs-sm txt-2 mt-sm">{{ d.rekening || 'Belum diatur oleh admin.' }}</p>
          <div class="info-box mt-md"><span>ℹ️</span><div>Unggah bukti transfer setelah membayar. Bendahara akan memverifikasi maksimal 1×24 jam.</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="t"><div class="card-title">Riwayat Tagihan</div></div></div>
        <div class="table-wrap" v-if="d.tagihan.length">
          <table class="tbl">
            <thead><tr><th>Invoice</th><th>Periode</th><th class="num">Nominal</th><th>Jatuh Tempo</th>
              <th>Status</th><th>Tindakan</th></tr></thead>
            <tbody>
              <tr v-for="t in d.tagihan" :key="t.TagihanID">
                <td class="mono">{{ t.TagihanID }}</td>
                <td>{{ periodeLabel(t.Periode) }}</td>
                <td class="num fw6">{{ rupiah(t.Jumlah) }}</td>
                <td class="fs-sm">{{ tanggal(t.JatuhTempo,'pendek') }}</td>
                <td><sa-badge :teks="t.Status"></sa-badge></td>
                <td>
                  <button v-if="t.Status === 'Belum Bayar' || t.Status === 'Terlambat'" class="btn xs" @click="bukaBayar(t)">
                    Unggah Bukti
                  </button>
                  <span v-else class="fs-xs txt-3">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <sa-empty v-else judul="Belum ada tagihan"></sa-empty>
      </div>
    </template>

    <sa-modal v-if="bayar" judul="Unggah Bukti Pembayaran" :sub="bayar.TagihanID + ' · ' + periodeLabel(bayar.Periode)"
              ikon="🧾" @tutup="bayar = null">
      <div class="info-box mb-md"><span>🏦</span><div>Transfer ke <b>{{ d.rekening }}</b> sejumlah <b>{{ rupiah(bayar.Jumlah) }}</b></div></div>
      <div class="grid grid-2 gap-md">
        <div class="field"><label class="label">Nominal Ditransfer</label>
          <input type="number" class="input" v-model="form.jumlah">
          <div class="hint">Tidak boleh kurang dari nilai tagihan.</div></div>
        <div class="field"><label class="label">Tanggal Transfer</label>
          <input type="date" class="input" v-model="form.tanggalBayar"></div>
        <div class="field"><label class="label">Metode</label>
          <select class="select" v-model="form.metode">
            <option>Transfer</option><option>Virtual Account</option><option>Tunai</option>
          </select></div>
        <div class="field"><label class="label">No. Referensi</label>
          <input class="input" v-model="form.noReferensi" placeholder="Nomor referensi mutasi"></div>
      </div>
      <div class="field"><label class="label">Berkas Bukti (maks 2 MB)</label>
        <input type="file" class="input" accept="image/*,.pdf" @change="pilihBerkas" style="padding:8px">
        <div class="hint" v-if="berkas">✅ {{ berkas.nama }}</div></div>
      <template #aksi>
        <button class="btn secondary" @click="bayar = null">Batal</button>
        <button class="btn" :disabled="proses" @click="kirim"><span v-if="proses" class="spin"></span>Kirim Bukti</button>
      </template>
    </sa-modal>
  </div>`
};

/* =========================================================================
 * HELPDESK (admin)
 * ======================================================================= */
window.VIEWS['helpdesk'] = {
  props: ['user'],
  data: function () { return { rows: [], memuat: true, status: '', pilih: null, pesan: '', statusBaru: '', proses: false }; },
  mounted: function () { this.muat(); },
  computed: {
    tampil: function () { var s = this.status; return this.rows.filter(function (r) { return !s || r.Status === s; }); }
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('helpdesk.list', {});
      this.memuat = false;
      if (res.ok) this.rows = res.data;
    },
    buka: function (r) { this.pilih = r; this.pesan = ''; this.statusBaru = r.Status; },
    balas: async function () {
      this.proses = true;
      var res = await callApi('helpdesk.reply', { aduanId: this.pilih.AduanID, pesan: this.pesan, status: this.statusBaru });
      this.proses = false;
      if (res.ok) { toast('Balasan terkirim.', 'success'); this.pilih = null; this.muat(); }
    }
  },
  template: `
  <div>
    <sa-page judul="Helpdesk &amp; Pengaduan Santri"
             sub="Tanggapi keluhan fasilitas, kebersihan, keamanan, dan katering dari mahasantri."
             :jalur="['Operasional Asrama','Helpdesk']">
      <template #aksi><button class="btn secondary" @click="muat">↻ Segarkan</button></template>
    </sa-page>

    <div class="card">
      <div class="filters">
        <div class="pills">
          <button :class="{active: status===''}" @click="status=''">Semua</button>
          <button :class="{active: status==='Baru'}" @click="status='Baru'">Baru</button>
          <button :class="{active: status==='Diproses'}" @click="status='Diproses'">Diproses</button>
          <button :class="{active: status==='Selesai'}" @click="status='Selesai'">Selesai</button>
        </div>
        <button class="btn sm secondary" @click="unduhExcel(tampil,'Helpdesk','Aduan')">⬇ Ekspor</button>
      </div>

      <sa-loading v-if="memuat"></sa-loading>
      <div class="table-wrap" v-else-if="tampil.length">
        <table class="tbl">
          <thead><tr><th>Tiket</th><th>Pelapor &amp; Kamar</th><th>Kategori</th><th>Prioritas</th>
            <th>Tanggal</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr v-for="a in tampil" :key="a.AduanID">
              <td><span class="mono">{{ a.AduanID }}</span><div class="fs-sm fw6">{{ potong(a.Judul, 38) }}</div></td>
              <td class="fs-sm">{{ a.NamaPelapor }}<div class="txt-3 fs-xs">Kamar {{ a.NomorKamar }}</div></td>
              <td class="fs-sm">{{ a.Kategori }}</td>
              <td><span class="badge plain" :class="a.Prioritas === 'Tinggi' ? 'danger' : ''">{{ a.Prioritas }}</span></td>
              <td class="fs-sm">{{ tanggal(a.TanggalBuat,'pendek') }}</td>
              <td><sa-badge :teks="a.Status"></sa-badge></td>
              <td><button class="btn xs" @click="buka(a)">Tangani</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <sa-empty v-else judul="Tidak ada aduan" pesan="Belum ada pengaduan pada filter ini." ikon="🎧"></sa-empty>
    </div>

    <sa-modal v-if="pilih" :judul="pilih.Judul" :sub="pilih.AduanID + ' · ' + pilih.NamaPelapor + ' · Kamar ' + pilih.NomorKamar"
              ikon="🎧" lebar="wide" @tutup="pilih = null">
      <div class="info-box mb-md"><span>📝</span><div>{{ pilih.Deskripsi }}</div></div>
      <div v-if="pilih.LampiranURL" class="mb-md" style="max-width:260px">
        <sa-thumb :src="pilih.LampiranThumb" :href="pilih.LampiranURL" judul="📎 Lampiran" tinggi="150"></sa-thumb>
      </div>

      <div class="label mt-md">Percakapan</div>
      <div class="timeline" v-if="pilih.balasan && pilih.balasan.length">
        <div class="tl-item" v-for="b in pilih.balasan" :key="b.BalasanID">
          <div class="tl-time">{{ tanggal(b.Tanggal,'jam') }}</div>
          <div class="tl-title">{{ b.NamaPengirim }}</div>
          <div class="tl-desc">{{ b.Pesan }}</div>
        </div>
      </div>
      <p v-else class="fs-sm txt-3">Belum ada balasan.</p>

      <div class="grid grid-2 gap-md mt-md">
        <div class="field"><label class="label">Balasan</label>
          <textarea class="input" v-model="pesan" placeholder="Tulis tanggapan untuk santri…"></textarea></div>
        <div class="field"><label class="label">Ubah Status</label>
          <select class="select" v-model="statusBaru">
            <option>Baru</option><option>Diproses</option><option>Selesai</option><option>Ditolak</option>
          </select>
          <a class="btn sm secondary mt-sm" :href="waLink(pilih.NoHP, 'Assalamu\\'alaikum, terkait aduan ' + pilih.AduanID)" target="_blank">
            💬 Hubungi via WhatsApp</a>
        </div>
      </div>

      <template #aksi>
        <button class="btn secondary" @click="pilih = null">Tutup</button>
        <button class="btn" :disabled="proses" @click="balas"><span v-if="proses" class="spin"></span>Kirim Balasan</button>
      </template>
    </sa-modal>
  </div>`
};

/* =========================================================================
 * HELPDESK SAYA (penghuni)
 * ======================================================================= */
window.VIEWS['helpdesk-saya'] = {
  props: ['user'],
  data: function () {
    return { d: null, memuat: true, ref: null, buat: false,
             f: { kategori: '', judul: '', deskripsi: '', prioritas: 'Normal' }, berkas: null, proses: false, detail: null };
  },
  mounted: async function () {
    var r = await callCached('meta.ref', {});
    if (r.ok) this.ref = r.data;
    this.muat();
  },
  methods: {
    muat: async function () {
      this.memuat = true;
      var res = await callApi('helpdesk.mine', {});
      this.memuat = false;
      if (res.ok) this.d = res.data;
    },
    pilihBerkas: async function (ev) {
      var f = ev.target.files[0];
      if (f) this.berkas = await bacaBerkas(f);
    },
    kirim: async function () {
      if (!this.f.judul || !this.f.deskripsi) { toast('Judul dan deskripsi wajib diisi.', 'warning'); return; }
      this.proses = true;
      var res = await callApi('helpdesk.create', Object.assign({ lampiran: this.berkas }, this.f));
      this.proses = false;
      if (res.ok) { toast(res.message, 'success'); this.buat = false; this.f = { kategori: '', judul: '', deskripsi: '', prioritas: 'Normal' }; this.berkas = null; this.muat(); }
    }
  },
  template: `
  <div>
    <sa-page judul="Aduan &amp; Bantuan" sub="Sampaikan keluhan fasilitas atau layanan asrama kepada musyrif."
             :jalur="['Layanan Mandiri','Helpdesk']">
      <template #aksi><button class="btn" @click="buat = true">＋ Buat Aduan Baru</button></template>
    </sa-page>

    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="d">
      <div class="card" v-if="d.pjAsrama && d.pjAsrama.length">
        <div class="card-head"><div class="t">
          <div class="card-title">Penanggung Jawab Asrama Anda</div>
          <div class="card-sub">Untuk keperluan mendesak, hubungi langsung via WhatsApp.</div>
        </div></div>
        <div class="flex gap-md flex-wrap">
          <div v-for="(pj,i) in d.pjAsrama" :key="i" class="flex items-center gap-md"
               style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r);padding:12px 16px">
            <sa-avatar :nama="pj.nama"></sa-avatar>
            <div><b>{{ pj.nama }}</b><div class="fs-xs txt-2">{{ pj.hp }}</div></div>
            <a class="btn sm ok" :href="pj.wa" target="_blank">💬 WhatsApp</a>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="t"><div class="card-title">Riwayat Aduan Saya</div></div></div>
        <div class="table-wrap" v-if="d.rows.length">
          <table class="tbl">
            <thead><tr><th>Tiket</th><th>Judul</th><th>Kategori</th><th>Tanggal</th><th>Status</th><th></th></tr></thead>
            <tbody>
              <tr v-for="a in d.rows" :key="a.AduanID">
                <td class="mono">{{ a.AduanID }}</td>
                <td class="fs-sm fw6">{{ a.Judul }}</td>
                <td class="fs-sm">{{ a.Kategori }}</td>
                <td class="fs-sm">{{ tanggal(a.TanggalBuat,'pendek') }}</td>
                <td><sa-badge :teks="a.Status"></sa-badge></td>
                <td><button class="btn xs secondary" @click="detail = a">Lihat</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <sa-empty v-else judul="Belum ada aduan" pesan="Semoga fasilitas asrama Anda selalu nyaman." ikon="🌿"></sa-empty>
      </div>
    </template>

    <sa-modal v-if="buat" judul="Buat Aduan Baru" sub="Sampaikan keluhan Anda dengan jelas agar cepat ditindaklanjuti."
              ikon="🎧" @tutup="buat = false">
      <div class="grid grid-2 gap-md">
        <div class="field"><label class="label">Kategori</label>
          <select class="select" v-model="f.kategori">
            <option value="">— Pilih —</option>
            <option v-for="k in (ref ? ref.kategoriAduan : [])" :key="k.MasterID" :value="k.Nilai">{{ k.Nilai }}</option>
          </select></div>
        <div class="field"><label class="label">Prioritas</label>
          <select class="select" v-model="f.prioritas">
            <option>Rendah</option><option>Normal</option><option>Tinggi</option>
          </select></div>
      </div>
      <div class="field"><label class="label">Judul Aduan <span class="req">*</span></label>
        <input class="input" v-model="f.judul" placeholder="mis. AC kamar tidak dingin"></div>
      <div class="field"><label class="label">Deskripsi <span class="req">*</span></label>
        <textarea class="input" v-model="f.deskripsi" placeholder="Jelaskan kronologi dan dampaknya…"></textarea></div>
      <div class="field"><label class="label">Lampiran (opsional, maks 2 MB)</label>
        <input type="file" class="input" accept="image/*,.pdf" @change="pilihBerkas" style="padding:8px">
        <div class="hint" v-if="berkas">✅ {{ berkas.nama }}</div></div>
      <template #aksi>
        <button class="btn secondary" @click="buat = false">Batal</button>
        <button class="btn" :disabled="proses" @click="kirim"><span v-if="proses" class="spin"></span>Kirim Aduan</button>
      </template>
    </sa-modal>

    <sa-modal v-if="detail" :judul="detail.Judul" :sub="detail.AduanID" ikon="📄" @tutup="detail = null">
      <sa-kv k="Kategori" :v="detail.Kategori"></sa-kv>
      <sa-kv k="Prioritas" :v="detail.Prioritas"></sa-kv>
      <sa-kv k="Status" :v="detail.Status"></sa-kv>
      <div class="info-box mt-md"><span>📝</span><div>{{ detail.Deskripsi }}</div></div>
      <div class="label mt-md">Balasan Petugas</div>
      <div class="timeline" v-if="detail.balasan && detail.balasan.length">
        <div class="tl-item" v-for="b in detail.balasan" :key="b.BalasanID">
          <div class="tl-time">{{ tanggal(b.Tanggal,'jam') }}</div>
          <div class="tl-title">{{ b.NamaPengirim }}</div>
          <div class="tl-desc">{{ b.Pesan }}</div>
        </div>
      </div>
      <p v-else class="fs-sm txt-3">Belum ada balasan dari petugas.</p>
      <template #aksi><button class="btn secondary" @click="detail = null">Tutup</button></template>
    </sa-modal>
  </div>`
};
