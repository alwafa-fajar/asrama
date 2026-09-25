/* ==========================================================================
 * SIM ASRAMA v6.0 — VIEW INTI
 * login · dashboard admin · dashboard penghuni · profil ·
 * formulir pendaftaran publik · cek status pendaftaran
 * ========================================================================== */

window.VIEWS = window.VIEWS || {};

/* =========================================================================
 * LOGIN
 * ======================================================================= */
window.VIEWS['login'] = {
  emits: ['masuk', 'pindah'],
  data: function () {
    var cfgLokal = {};
    try { cfgLokal = JSON.parse(localStorage.getItem('asr_authcfg') || '{}') || {}; } catch (e) {}
    return {
      mode: 'staf',                 // 'staf' (Google OAuth) | 'santri' (username + sandi)
      cfg: {
        googleClientId: CONFIG.GOOGLE_CLIENT_ID || cfgLokal.googleClientId || '',
        daruratSA: cfgLokal.daruratSA !== false
      },
      gsiSiap: false, gsiGagal: '', verif: false, darurat: false,
      identitas: '', password: '', proses: false, lihat: false
    };
  },
  mounted: function () {
    var self = this;
    pemanasanServer();                           // bangunkan GAS selagi pengguna membaca halaman
    this.siapkanGoogle();
    // Konfigurasi login dari server (client id bisa diisi SA lewat menu Pengaturan)
    callApi('auth.config', {}, { diam: true }).then(function (res) {
      if (!res.ok) return;
      var berubah = res.data.googleClientId && res.data.googleClientId !== self.cfg.googleClientId;
      self.cfg.daruratSA = res.data.daruratSA;
      if (!CONFIG.GOOGLE_CLIENT_ID) self.cfg.googleClientId = res.data.googleClientId;
      try { localStorage.setItem('asr_authcfg', JSON.stringify(res.data)); } catch (e) {}
      if (berubah && !CONFIG.GOOGLE_CLIENT_ID) self.siapkanGoogle();
    });
  },
  computed: {
    institusi: function () { return CONFIG.NAMA_INSTITUSI; },
    googleAktif: function () { return !!this.cfg.googleClientId; }
  },
  methods: {
    siapkanGoogle: async function () {
      if (!this.cfg.googleClientId) return;
      try {
        await pustaka('gsi');
        google.accounts.id.initialize({
          client_id: this.cfg.googleClientId,
          callback: this.onGoogle,
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: 'popup',
          use_fedcm_for_prompt: true
        });
        var el = this.$refs.gbtn;
        if (el) {
          el.innerHTML = '';
          google.accounts.id.renderButton(el, {
            type: 'standard', theme: 'filled_blue', size: 'large', text: 'signin_with',
            shape: 'pill', logo_alignment: 'left', width: Math.min(320, el.clientWidth || 320), locale: 'id'
          });
        }
        this.gsiSiap = true; this.gsiGagal = '';
      } catch (e) {
        this.gsiGagal = 'Layanan Google tidak dapat dimuat. Periksa koneksi / pemblokir iklan.';
      }
    },
    onGoogle: async function (resp) {
      if (!resp || !resp.credential) return;
      this.verif = true;
      var res = await callApi('auth.google', {
        credential: resp.credential, origin: location.origin + location.pathname
      });
      this.verif = false;
      if (res.ok) this.selesai(res.data);
    },
    masukSandi: async function () {
      if (!this.identitas || !this.password) { toast('Lengkapi username dan kata sandi.', 'warning'); return; }
      this.proses = true;
      var res = await callApi('auth.login', { identitas: this.identitas, password: this.password });
      this.proses = false;
      if (res.ok) this.selesai(res.data);
    },
    selesai: function (d) {
      simpanSesi(d.token, d.user);
      simpanPengaturanLokal(d.pengaturan || {});
      this.$emit('masuk', d.user, d);
    }
  },
  template: `
  <div class="auth">
    <div class="auth-left">
      <div>
        <span class="hero-tag">● SISTEM INFORMASI MANAJEMEN · v6.1</span>
        <h1>Asrama Kampus<br>dalam satu sistem terpadu.</h1>
        <p>Dari pendaftaran santri, penempatan kamar, penagihan, kedisiplinan, sampai kartu makan QR — semuanya terhubung dalam satu basis data.</p>
      </div>
      <div class="auth-feats">
        <div class="auth-feat"><span class="ic">🔐</span><div><b>Login Google untuk staf</b><br>Tanpa sandi tambahan — akun Google resmi Anda yang dipakai.</div></div>
        <div class="auth-feat"><span class="ic">📱</span><div><b>Kartu Makan QR Code</b><br>Verifikasi jatah katering di dapur kurang dari 3 detik.</div></div>
        <div class="auth-feat"><span class="ic">💬</span><div><b>Notifikasi WhatsApp &amp; Email</b><br>Tagihan, penempatan, dan pengumuman sampai langsung ke santri &amp; wali.</div></div>
      </div>
    </div>

    <div class="auth-right">
      <div class="auth-box">
        <div class="text-center mb-md">
          <div class="boot-logo" style="margin:0 auto 14px;animation:none"></div>
          <h2 class="page-title" style="font-size:22px">{{ institusi }}</h2>
          <p class="fs-sm txt-2">Sistem Informasi Manajemen Asrama</p>
        </div>

        <div class="card">
          <div class="auth-seg" role="tablist">
            <button type="button" :class="{on: mode === 'staf'}" @click="mode = 'staf'" role="tab">👔 Staf</button>
            <button type="button" :class="{on: mode === 'santri'}" @click="mode = 'santri'" role="tab">🎓 Santri</button>
          </div>

          <!-- ===== STAF: Google OAuth 2.0 ===== -->
          <div v-show="mode === 'staf'">
            <template v-if="googleAktif">
              <div class="gbtn-wrap">
                <div ref="gbtn" style="width:100%;display:flex;justify-content:center"></div>
                <div v-if="!gsiSiap && !gsiGagal" class="gbtn-skel" style="position:absolute"></div>
              </div>
              <div v-if="gsiGagal" class="info-box warn mt-sm"><span>⚠️</span><div>{{ gsiGagal }}
                <a href="#" @click.prevent="siapkanGoogle">Coba lagi</a></div></div>
              <p class="auth-note">Masuk memakai <b>akun Google</b> yang emailnya sudah didaftarkan Super Admin.
                Tidak perlu mengingat kata sandi.</p>

              <template v-if="cfg.daruratSA">
                <div class="auth-divider">atau</div>
                <div class="text-center" v-if="!darurat">
                  <a href="#" class="fs-sm" @click.prevent="darurat = true">🛟 Login darurat Super Admin</a>
                </div>
              </template>
            </template>
            <div v-else class="info-box mb-md"><span>ℹ️</span><div>Login Google belum dikonfigurasi.
              Sementara staf masuk dengan <b>username &amp; sandi</b>. Super Admin dapat mengisi
              <b>GOOGLE_CLIENT_ID</b> di menu Pengaturan Sistem.</div></div>

            <form v-if="!googleAktif || darurat" @submit.prevent="masukSandi">
              <div class="info-box warn mb-md" v-if="googleAktif"><span>🛟</span><div>Jalur darurat hanya untuk
                akun <b>Super Admin</b> ketika login Google bermasalah.</div></div>
              <div class="field">
                <label class="label">Username atau Email</label>
                <input class="input" v-model.trim="identitas" placeholder="mis. admin" autocomplete="username">
              </div>
              <div class="field">
                <label class="label">Kata Sandi</label>
                <div style="position:relative">
                  <input class="input" :type="lihat ? 'text' : 'password'" v-model="password"
                         placeholder="••••••••" autocomplete="current-password" style="padding-right:64px">
                  <button type="button" class="btn ghost xs" style="position:absolute;right:6px;top:7px"
                          @click="lihat = !lihat">{{ lihat ? 'Sembunyi' : 'Lihat' }}</button>
                </div>
              </div>
              <button class="btn block lg" :disabled="proses">
                <span v-if="proses" class="spin"></span>{{ proses ? 'Memverifikasi…' : (darurat ? 'Masuk (Darurat SA)' : 'Masuk ke Sistem') }}
              </button>
              <div class="text-center mt-sm" v-if="darurat"><a href="#" class="fs-xs" @click.prevent="darurat = false">← Kembali ke login Google</a></div>
            </form>
          </div>

          <!-- ===== SANTRI: NIM/username + sandi ===== -->
          <form v-show="mode === 'santri'" @submit.prevent="masukSandi">
            <div class="field">
              <label class="label">NIM / Username / Email</label>
              <input class="input" v-model.trim="identitas" placeholder="NIM Anda" autocomplete="username">
            </div>
            <div class="field">
              <label class="label">Kata Sandi</label>
              <div style="position:relative">
                <input class="input" :type="lihat ? 'text' : 'password'" v-model="password"
                       placeholder="••••••••" autocomplete="current-password" style="padding-right:64px">
                <button type="button" class="btn ghost xs" style="position:absolute;right:6px;top:7px"
                        @click="lihat = !lihat">{{ lihat ? 'Sembunyi' : 'Lihat' }}</button>
              </div>
            </div>
            <button class="btn block lg" :disabled="proses">
              <span v-if="proses" class="spin"></span>{{ proses ? 'Memverifikasi…' : 'Masuk sebagai Santri' }}
            </button>
            <p class="auth-note">Sandi awal dikirim lewat WhatsApp/email setelah pendaftaran Anda diterima.</p>
          </form>
        </div>

        <div class="text-center fs-sm txt-2">
          Calon santri baru?
          <a href="#" @click.prevent="$emit('pindah','daftar')"><b>Isi formulir pendaftaran</b></a> ·
          <a href="#" @click.prevent="$emit('pindah','status-daftar')">Cek status</a>
        </div>
      </div>
    </div>

    <div v-if="verif" class="verif-overlay"><div class="verif-card"><span class="spin dark"></span>Memverifikasi akun Google…</div></div>
  </div>`
};

/* =========================================================================
 * DASHBOARD ADMIN
 * ======================================================================= */
window.VIEWS['dashboard'] = {
  props: ['user'],
  emits: ['pindah'],
  data: function () { return { d: null, memuat: true }; },
  mounted: function () { this.muat(); },
  methods: {
    muat: function () {
      // Stale-while-revalidate: data terakhir tampil 0 ms, lalu disegarkan diam-diam
      var self = this;
      this.memuat = !this.d;
      return callSWR('dashboard.admin', {}, function (res) {
        self.memuat = false;
        if (res.ok) { self.d = res.data; self.$nextTick(self.gambar); }
      });
    },
    gambar: function () {
      if (!this.d) return;
      var t = this.d.tren || [];
      gambarChart('chartOkupansi', {
        type: 'bar',
        data: {
          labels: t.map(function (x) { return x.label; }),
          datasets: [
            { label: 'Okupansi Bed', data: t.map(function (x) { return x.okupansi; }),
              backgroundColor: '#0F2A4A', borderRadius: 6, maxBarThickness: 44, order: 2 },
            { label: 'Skor Disiplin', data: t.map(function (x) { return x.skorDisiplin; }),
              type: 'line', borderColor: '#2563EB', backgroundColor: '#2563EB',
              borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#fff', yAxisID: 'y2', order: 1 }
          ]
        },
        options: opsiDasar({
          plugins: { legend: { display: true, position: 'top', align: 'end',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded' } } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,.18)' }, border: { display: false } },
            y2: { position: 'right', min: 0, max: 100, grid: { display: false }, border: { display: false } },
            x: { grid: { display: false }, border: { display: false } }
          }
        })
      });
    },
    verifikasiCepat: function () { this.$emit('pindah', 'penghuni'); }
  },
  template: `
  <div>
    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="d">
      <!-- HERO -->
      <div class="hero">
        <div class="txt">
          <span class="hero-tag">● PORTAL {{ user.RoleNama || user.Role }} · v6.0 PRODUCTION BUILD</span>
          <h2>Selamat Datang, {{ user.NamaLengkap }}</h2>
          <p>Sistem Informasi Manajemen Asrama Kampus {{ institusi }} · Tahun Akademik {{ tahun }}</p>
        </div>
        <div class="hero-actions">
          <button class="btn secondary" @click="$emit('pindah','laporan')">⬇ Unduh Laporan Cepat</button>
          <button class="btn" @click="$emit('pindah','penghuni')">＋ Tambah Penghuni Baru</button>
        </div>
      </div>

      <!-- KPI -->
      <div class="grid grid-4 mb-md">
        <sa-kpi label="Total Penghuni Aktif" :nilai="angka(d.kpi.totalPenghuni)" ikon="👥"
                :persen="d.kpi.persenOkupansi"
                :catatan="'Kapasitas ' + angka(d.kpi.kapasitas) + ' bed · ' + d.kpi.persenOkupansi + '%'"
                :tren="'↑ +' + d.kpi.penghuniBaruSemesterIni + ' santri baru'"></sa-kpi>

        <sa-kpi label="Pendaftar Gelombang Ini" :nilai="angka(d.kpi.pendaftarTotal)" ikon="📝" warna="warn"
                :catatan="d.kpi.pendaftarMenunggu + ' menunggu verifikasi'"></sa-kpi>

        <sa-kpi label="Realisasi Tagihan (Bulan Ini)" :nilai="rupiah(d.kpi.realisasiTagihan, true)" ikon="💳" warna="ok"
                :persen="d.kpi.persenLunas" persenWarna="ok"
                :catatan="d.kpi.persenLunas + '% lunas · ' + d.kpi.jumlahTunggakan + ' tunggakan'"></sa-kpi>

        <sa-kpi label="Konsumsi Makan Hari Ini" :nilai="angka(d.kpi.konsumsiHariIni)" satuan="porsi" ikon="🍽"
                :catatan="'Pagi ' + d.kpi.makanPagi + ' · Siang ' + d.kpi.makanSiang + ' · Malam ' + d.kpi.makanMalam"></sa-kpi>
      </div>

      <!-- GRAFIK + RADAR -->
      <div class="grid grid-23">
        <div class="card">
          <div class="card-head">
            <div class="t">
              <div class="card-title">Grafik Okupansi &amp; Kedisiplinan Asrama</div>
              <div class="card-sub">Tren statistik 6 bulan terakhir</div>
            </div>
            <span class="badge plain info">Bulanan</span>
          </div>
          <div style="height:250px"><canvas id="chartOkupansi"></canvas></div>
          <div class="flex items-center justify-between mt-md fs-sm txt-2 flex-wrap gap-sm">
            <span>✅ Indeks kedisiplinan rata-rata tercatat {{ d.kpi.skorDisiplinRata }} poin</span>
            <a href="#" @click.prevent="$emit('pindah','laporan')">Detail Statistik ›</a>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="t">
              <div class="card-title">Radar Okupansi Gedung</div>
              <div class="card-sub">Status kamar &amp; kuota riil</div>
            </div>
            <div class="kpi-icon">🏢</div>
          </div>
          <div class="text-center" style="margin:6px 0 18px">
            <div style="font-size:42px;font-weight:700;letter-spacing:-.03em;color:var(--blue)" class="num">
              {{ d.kpi.persenOkupansi }}%
            </div>
            <div class="fs-xs txt-2 fw6" style="letter-spacing:.09em">TERISI</div>
          </div>
          <div v-for="g in d.radar" :key="g.GedungID" style="margin-bottom:12px">
            <div class="flex justify-between fs-sm" style="margin-bottom:4px">
              <span>{{ g.NamaGedung }} <span class="txt-3">({{ g.Tipe }})</span></span>
              <b class="num">{{ g.persen }}%</b>
            </div>
            <div class="progress"><div class="bar" :style="{width: g.persen + '%'}"></div></div>
          </div>
          <sa-empty v-if="!d.radar.length" judul="Belum ada gedung" pesan="Tambahkan gedung & kamar terlebih dahulu."></sa-empty>
        </div>
      </div>

      <!-- ANTREAN VERIFIKASI + PEMBAYARAN -->
      <div class="grid grid-2">
        <div class="card">
          <div class="card-head">
            <div class="t">
              <div class="card-title">📂 Pendaftar Menunggu Verifikasi</div>
              <div class="card-sub">{{ d.kpi.pendaftarMenunggu }} permohonan kamar baru belum diverifikasi</div>
            </div>
            <span class="badge plain">Gelombang aktif</span>
          </div>
          <div class="table-wrap" v-if="d.pendaftarMenunggu.length">
            <table class="tbl">
              <thead><tr><th>Santri / ID</th><th>Prodi</th><th>Status</th><th></th></tr></thead>
              <tbody>
                <tr v-for="p in d.pendaftarMenunggu" :key="p.PendaftarID">
                  <td>
                    <div class="person">
                      <sa-avatar :nama="p.NamaLengkap" ukuran="sm"></sa-avatar>
                      <div class="nm"><b>{{ p.NamaLengkap }}</b><span class="mono">{{ p.PendaftarID }}</span></div>
                    </div>
                  </td>
                  <td class="fs-sm">{{ p.Prodi || '-' }}</td>
                  <td><sa-badge :teks="p.Status"></sa-badge></td>
                  <td class="text-right"><button class="btn xs" @click="$emit('pindah','pendaftar')">Tinjau</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <sa-empty v-else judul="Tidak ada antrean" pesan="Semua pendaftar sudah diverifikasi." ikon="✅"></sa-empty>
          <div class="tbl-foot" v-if="d.pendaftarMenunggu.length">
            <span>Menampilkan {{ d.pendaftarMenunggu.length }} dari {{ d.kpi.pendaftarMenunggu }} antrean</span>
            <a href="#" @click.prevent="$emit('pindah','pendaftar')">Lihat Semua Pendaftar →</a>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="t">
              <div class="card-title">🏦 Konfirmasi Pembayaran</div>
              <div class="card-sub">Transaksi sewa kamar &amp; katering menunggu verifikasi</div>
            </div>
            <span class="badge ok">Live Sync</span>
          </div>
          <div class="table-wrap" v-if="d.pembayaranMenunggu.length">
            <table class="tbl">
              <thead><tr><th>Kwitansi / Santri</th><th class="num">Nominal</th><th>Bukti</th><th>Tindakan</th></tr></thead>
              <tbody>
                <tr v-for="b in d.pembayaranMenunggu" :key="b.PembayaranID">
                  <td>
                    <a href="#" class="mono" @click.prevent="$emit('pindah','tagihan')">{{ b.TagihanID }}</a>
                    <div class="fs-sm">{{ b.Nama }} <span class="txt-3">(Kmr {{ b.Kamar }})</span></div>
                  </td>
                  <td class="num fw6">{{ rupiah(b.Jumlah) }}</td>
                  <td><a v-if="b.BuktiID" :href="'https://drive.google.com/file/d/' + b.BuktiID + '/view'" target="_blank" class="btn xs secondary">Lihat</a><span v-else class="txt-3 fs-xs">—</span></td>
                  <td><button class="btn xs" @click="$emit('pindah','tagihan')">Verifikasi</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <sa-empty v-else judul="Tidak ada pembayaran menunggu" ikon="💰"></sa-empty>
          <div class="tbl-foot" v-if="d.pembayaranMenunggu.length">
            <span>Rekap mutasi rekening</span>
            <a href="#" @click.prevent="$emit('pindah','tagihan')">Buka Kas Masuk →</a>
          </div>
        </div>
      </div>

      <!-- SESI MAKAN -->
      <div class="panel-dark">
        <div class="kpi-icon" style="background:rgba(255,255,255,.14);color:#fff">🍽</div>
        <div class="it" style="flex:2">
          <small>{{ d.sesiMakan.dalamJam ? '● SESI MAKAN AKTIF' : '○ DI LUAR JAM MAKAN' }}</small>
          <b>Makan {{ d.sesiMakan.sesi }} ({{ d.sesiMakan.mulai }} – {{ d.sesiMakan.selesai }} WIB)</b>
          <div class="fs-sm" style="color:#93AECF">Dapur Utama · {{ angka(d.kpi.konsumsiHariIni) }} porsi tersaji hari ini</div>
        </div>
        <button class="btn" @click="$emit('pindah','scanner')">⬚ Buka Scanner QR Dapur →</button>
      </div>
    </template>
  </div>`,
  computed: {
    institusi: function () { return CONFIG.NAMA_INSTITUSI; },
    tahun: function () { return APP.pengaturan.TAHUN_AKADEMIK || '-'; }
  }
};

/* =========================================================================
 * DASHBOARD PENGHUNI
 * ======================================================================= */
window.VIEWS['dashboard-penghuni'] = {
  props: ['user'],
  emits: ['pindah'],
  data: function () { return { d: null, memuat: true }; },
  mounted: function () { this.muat(); },
  methods: {
    muat: function () {
      var self = this;
      this.memuat = !this.d;
      return callSWR('dashboard.resident', {}, function (res) {
        self.memuat = false;
        if (res.ok) self.d = res.data;
      });
    }
  },
  setup: function () { return { rupiah: rupiah, tanggal: tanggal, periodeLabel: periodeLabel, waLink: waLink }; },
  template: `
  <div>
    <sa-loading v-if="memuat"></sa-loading>
    <template v-else-if="d">
      <div class="hero">
        <div class="txt">
          <span class="hero-tag">● PORTAL SANTRI</span>
          <h2>Ahlan wa Sahlan, {{ d.penghuni.NamaLengkap }}</h2>
          <p>{{ d.gedung.NamaGedung }} · Kamar {{ d.kamar.NomorKamar }} · {{ d.paket.NamaPaket }}</p>
        </div>
        <div class="hero-actions">
          <button class="btn secondary" @click="$emit('pindah','tagihan-saya')">💳 Tagihan Saya</button>
          <button class="btn" v-if="d.kartuAktif" @click="$emit('pindah','kartu-saya')">⬚ Kartu Makan QR</button>
        </div>
      </div>

      <div class="grid grid-4 mb-md">
        <sa-kpi label="Skor Kedisiplinan" :nilai="d.skor" satuan="/100" ikon="🛡"
                :warna="d.skor >= 90 ? 'ok' : (d.skor >= 75 ? 'warn' : 'danger')"
                :persen="d.skor" :persenWarna="d.skor >= 90 ? 'ok' : (d.skor >= 75 ? 'warn' : 'danger')"
                :catatan="d.skor >= 90 ? 'Prima — pertahankan' : (d.skor >= 75 ? 'Perlu perhatian' : 'Dalam pembinaan')"></sa-kpi>
        <sa-kpi label="Tagihan Terdekat"
                :nilai="d.tagihanTerdekat ? rupiah(d.tagihanTerdekat.Jumlah, true) : 'Lunas'"
                ikon="💳" :warna="d.tagihanTerdekat ? 'warn' : 'ok'"
                :catatan="d.tagihanTerdekat ? ('Periode ' + periodeLabel(d.tagihanTerdekat.Periode)) : 'Tidak ada tunggakan'"></sa-kpi>
        <sa-kpi label="Aduan Aktif" :nilai="d.aduanAktif" ikon="🎧"
                catatan="Tiket yang sedang diproses"></sa-kpi>
        <sa-kpi label="Kartu Makan" :nilai="d.kartuAktif ? 'Aktif' : 'Nonaktif'" ikon="⬚"
                :warna="d.kartuAktif ? 'ok' : ''" :catatan="d.paket.NamaPaket"></sa-kpi>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><div class="t"><div class="card-title">Informasi Kamar &amp; Paket</div></div></div>
          <sa-kv k="Gedung" :v="d.gedung.NamaGedung"></sa-kv>
          <sa-kv k="Kamar / Lantai" :v="d.kamar.NomorKamar + ' · Lantai ' + d.kamar.Lantai"></sa-kv>
          <sa-kv k="Fasilitas" :v="d.kamar.Fasilitas || '-'"></sa-kv>
          <sa-kv k="Paket" :v="d.paket.NamaPaket"></sa-kv>
          <sa-kv k="Musyrif/ah" :v="d.gedung.Musyrif || '-'"></sa-kv>
          <div class="mt-md" v-if="d.pjAsrama && d.pjAsrama.length">
            <div class="label">Penanggung Jawab Asrama</div>
            <div class="flex gap-sm flex-wrap">
              <a v-for="(pj,i) in d.pjAsrama" :key="i" class="btn sm secondary" :href="pj.wa" target="_blank">
                💬 {{ pj.nama }}
              </a>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="t"><div class="card-title">Riwayat Tagihan</div></div>
            <button class="btn sm secondary" @click="$emit('pindah','tagihan-saya')">Lihat semua</button>
          </div>
          <div class="table-wrap" v-if="d.riwayatTagihan.length">
            <table class="tbl">
              <thead><tr><th>Periode</th><th class="num">Nominal</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-for="t in d.riwayatTagihan" :key="t.TagihanID">
                  <td>{{ periodeLabel(t.Periode) }}</td>
                  <td class="num">{{ rupiah(t.Jumlah) }}</td>
                  <td><sa-badge :teks="t.Status"></sa-badge></td>
                </tr>
              </tbody>
            </table>
          </div>
          <sa-empty v-else judul="Belum ada tagihan"></sa-empty>
        </div>
      </div>
    </template>
  </div>`
};

/* =========================================================================
 * PROFIL & GANTI SANDI
 * ======================================================================= */
window.VIEWS['profil'] = {
  props: ['user'],
  data: function () { return { lama: '', baru: '', ulangi: '', proses: false }; },
  methods: {
    simpan: async function () {
      if (this.baru.length < 6) { toast('Kata sandi baru minimal 6 karakter.', 'warning'); return; }
      if (this.baru !== this.ulangi) { toast('Konfirmasi kata sandi tidak sama.', 'warning'); return; }
      this.proses = true;
      var res = await callApi('auth.changePassword', { lama: this.lama, baru: this.baru });
      this.proses = false;
      if (res.ok) { this.lama = this.baru = this.ulangi = ''; toast(res.message, 'success'); }
    }
  },
  template: `
  <div>
    <sa-page judul="Profil Pengguna" sub="Identitas akun dan keamanan kata sandi."
             :jalur="['Akun','Profil']"></sa-page>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div class="t"><div class="card-title">Identitas Akun</div></div></div>
        <div class="flex items-center gap-md mb-md">
          <sa-avatar :nama="user.NamaLengkap" :foto="user.FotoGoogle" ukuran="lg"></sa-avatar>
          <div>
            <div class="fw7" style="font-size:17px">{{ user.NamaLengkap }}</div>
            <span class="badge info">{{ user.RoleNama || user.Role }}</span>
          </div>
        </div>
        <sa-kv k="User ID" :v="user.UserID"></sa-kv>
        <sa-kv k="Username" :v="user.Username"></sa-kv>
        <sa-kv k="Email" :v="user.Email || '-'"></sa-kv>
        <sa-kv k="Jenis Kelamin" :v="user.JenisKelamin === 'L' ? 'Laki-laki' : (user.JenisKelamin === 'P' ? 'Perempuan' : '-')"></sa-kv>
        <sa-kv k="Metode Masuk" :v="user.Metode === 'google' ? 'Google OAuth 2.0' : (user.Metode === 'darurat' ? 'Sandi (darurat SA)' : 'Username & sandi')"></sa-kv>
      </div>

      <div class="card" v-if="user.Metode === 'google'">
        <div class="card-head"><div class="t">
          <div class="card-title">Keamanan Akun</div>
          <div class="card-sub">Akun staf dilindungi login Google — kata sandi dikelola oleh Google.</div>
        </div></div>
        <div class="info-box"><span>🔐</span><div>Anda masuk memakai <b>{{ user.Email }}</b>. Untuk mengganti sandi atau
          mengaktifkan verifikasi 2 langkah, buka <a href="https://myaccount.google.com/security" target="_blank" rel="noopener">Akun Google → Keamanan</a>.</div></div>
      </div>

      <div class="card" v-else>
        <div class="card-head"><div class="t">
          <div class="card-title">Ganti Kata Sandi</div>
          <div class="card-sub">Wajib diganti bila Anda masih memakai sandi awal dari admin.</div>
        </div></div>
        <form @submit.prevent="simpan">
          <div class="field"><label class="label">Kata Sandi Lama</label>
            <input type="password" class="input" v-model="lama" autocomplete="current-password"></div>
          <div class="field"><label class="label">Kata Sandi Baru</label>
            <input type="password" class="input" v-model="baru" autocomplete="new-password"></div>
          <div class="field"><label class="label">Ulangi Kata Sandi Baru</label>
            <input type="password" class="input" v-model="ulangi" autocomplete="new-password"></div>
          <button class="btn" :disabled="proses"><span v-if="proses" class="spin"></span>Simpan Kata Sandi</button>
        </form>
      </div>
    </div>
  </div>`
};

/* =========================================================================
 * FORMULIR PENDAFTARAN (PUBLIK)
 * ======================================================================= */
window.VIEWS['daftar'] = {
  emits: ['pindah'],
  data: function () {
    return {
      ref: null, memuat: true, proses: false, hasil: null,
      f: { NamaLengkap: '', NIM: '', Email: '', NoHP: '', JenisKelamin: '', ProgramKelas: '',
           Prodi: '', Angkatan: '', BeratBadan: '', Alamat: '', NamaWali: '', NoHPWali: '',
           PaketID: '', BayarAwal: 0, BulanDibayar: 0 },
      berkas: { foto: null, surat: null, bukti: null }
    };
  },
  mounted: async function () {
    var res = await callApi('meta.ref', {});
    this.memuat = false;
    if (res.ok) this.ref = res.data;
  },
  computed: {
    prodiTersaring: function () {
      if (!this.ref) return [];
      var pk = this.f.ProgramKelas;
      return this.ref.prodi.filter(function (p) { return !pk || p.Induk === pk; });
    },
    paketTerpilih: function () {
      var self = this;
      return (this.ref ? this.ref.paket : []).filter(function (p) { return p.PaketID === self.f.PaketID; })[0];
    }
  },
  methods: {
    pilihBerkas: async function (jenis, ev) {
      var file = ev.target.files[0];
      if (!file) return;
      // Gambar boleh besar (foto kamera HP) — dikompres + dibuat thumbnail di browser
      var gambar = /^image\//.test(file.type);
      if (file.size > (gambar ? 15 : 2) * 1024 * 1024) {
        toast('Ukuran berkas maksimal ' + (gambar ? '15 MB (foto)' : '2 MB (PDF)') + '.', 'warning'); ev.target.value = ''; return;
      }
      var b = await bacaBerkas(file);
      if (b.ukuran > 2 * 1024 * 1024) { toast('Berkas masih lebih dari 2 MB setelah dikompres.', 'warning'); ev.target.value = ''; return; }
      this.berkas[jenis] = b;
    },
    hpValid: function (v) { return /^(\+?62|0)?8\d{8,12}$/.test(String(v || '').replace(/[\s.-]/g, '')); },
    kirim: async function () {
      if (!this.berkas.foto) { toast('Pas foto wajib diunggah.', 'warning'); return; }
      if (!this.hpValid(this.f.NoHP)) { toast('Nomor HP/WhatsApp tidak valid. Contoh: 081234567890', 'warning'); return; }
      this.proses = true;
      var res = await callApi('registration.submit', { data: this.f, berkas: this.berkas });
      this.proses = false;
      if (res.ok) this.hasil = res.data.PendaftarID;
    }
  },
  setup: function () { return { rupiah: rupiah, ukuranBaca: ukuranBaca }; },
  template: `
  <div class="content" style="max-width:920px;margin:0 auto">
    <sa-loading v-if="memuat"></sa-loading>

    <template v-else-if="hasil">
      <div class="card text-center" style="padding:48px 24px">
        <div style="font-size:46px">✅</div>
        <h2 class="page-title mt-sm">Pendaftaran Terkirim</h2>
        <p class="page-sub" style="margin:8px auto 18px">Simpan kode pendaftaran berikut untuk memeriksa status verifikasi berkas Anda.</p>
        <div class="mono" style="font-size:26px;font-weight:700;color:var(--blue)">{{ hasil }}</div>
        <div class="btn-row mt-lg" style="justify-content:center">
          <button class="btn secondary" @click="$emit('pindah','status-daftar')">Cek Status Pendaftaran</button>
          <button class="btn" @click="$emit('pindah','login')">Kembali ke Halaman Masuk</button>
        </div>
      </div>
    </template>

    <template v-else>
      <sa-page judul="Formulir Pendaftaran Santri Baru"
               :sub="'Asrama ' + (ref ? ref.institusi : '') + ' · Tahun Akademik ' + (ref ? ref.tahunAkademik : '')"
               :jalur="['Portal Publik','Formulir Pendaftaran']">
        <template #aksi><button class="btn secondary" @click="$emit('pindah','login')">← Halaman Masuk</button></template>
      </sa-page>

      <div class="info-box mb-md" v-if="ref && !ref.pendaftaranDibuka">
        <span>🔒</span><div><b>Pendaftaran sedang ditutup.</b> Silakan hubungi bagian PMB kampus untuk informasi gelombang berikutnya.</div>
      </div>

      <form @submit.prevent="kirim" v-if="ref && ref.pendaftaranDibuka">
        <div class="card">
          <div class="card-head"><div class="t"><div class="card-title">1. Data Diri Santri</div></div></div>
          <div class="grid grid-2 gap-md">
            <div class="field"><label class="label">Nama Lengkap <span class="req">*</span></label>
              <input class="input" v-model.trim="f.NamaLengkap" required></div>
            <div class="field"><label class="label">NIM <span class="txt-3">(opsional)</span></label>
              <input class="input" v-model.trim="f.NIM" placeholder="Boleh diisi belakangan"></div>
            <div class="field"><label class="label">Email <span class="req">*</span></label>
              <input type="email" class="input" v-model.trim="f.Email" required></div>
            <div class="field"><label class="label">No. HP / WhatsApp <span class="req">*</span></label>
              <input class="input" v-model.trim="f.NoHP" placeholder="08xxxxxxxxxx" inputmode="tel" required
                     :style="f.NoHP && !hpValid(f.NoHP) ? 'border-color:var(--danger)' : ''">
              <div class="hint">Nomor ini dipakai untuk notifikasi WhatsApp (status pendaftaran, sandi awal, tagihan).</div></div>
            <div class="field"><label class="label">Jenis Kelamin <span class="req">*</span></label>
              <select class="select" v-model="f.JenisKelamin" required>
                <option value="">— Pilih —</option><option value="L">Laki-laki</option><option value="P">Perempuan</option>
              </select></div>
            <div class="field"><label class="label">Berat Badan (kg)</label>
              <input type="number" class="input" v-model="f.BeratBadan"></div>
            <div class="field"><label class="label">Program Kelas</label>
              <select class="select" v-model="f.ProgramKelas" @change="f.Prodi=''">
                <option value="">— Pilih —</option>
                <option v-for="p in ref.programKelas" :key="p.Kode" :value="p.Kode">{{ p.Nilai }}</option>
              </select></div>
            <div class="field"><label class="label">Program Studi</label>
              <select class="select" v-model="f.Prodi">
                <option value="">— Pilih —</option>
                <option v-for="p in prodiTersaring" :key="p.MasterID" :value="p.Nilai">{{ p.Nilai }}</option>
              </select></div>
            <div class="field"><label class="label">Angkatan</label>
              <select class="select" v-model="f.Angkatan">
                <option value="">— Pilih —</option>
                <option v-for="a in ref.angkatan" :key="a.MasterID" :value="a.Nilai">{{ a.Nilai }}</option>
              </select></div>
            <div class="field"><label class="label">Alamat Domisili</label>
              <input class="input" v-model.trim="f.Alamat"></div>
            <div class="field"><label class="label">Nama Wali / Orang Tua</label>
              <input class="input" v-model.trim="f.NamaWali"></div>
            <div class="field"><label class="label">No. HP Wali</label>
              <input class="input" v-model.trim="f.NoHPWali"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div class="t"><div class="card-title">2. Paket Asrama &amp; Pembayaran Awal</div>
            <div class="card-sub">Pembayaran awal bersifat opsional — boleh dikosongkan.</div></div></div>
          <div class="field"><label class="label">Paket Asrama <span class="req">*</span></label>
            <select class="select" v-model="f.PaketID" required>
              <option value="">— Pilih paket —</option>
              <option v-for="p in ref.paket" :key="p.PaketID" :value="p.PaketID">
                {{ p.NamaPaket }} — {{ rupiah(p.Harga) }}/bulan
              </option>
            </select>
            <div class="hint" v-if="paketTerpilih">{{ paketTerpilih.Deskripsi }}</div>
          </div>
          <div class="grid grid-2 gap-md">
            <div class="field"><label class="label">Nominal Dibayar di Muka</label>
              <input type="number" class="input" v-model="f.BayarAwal" min="0"></div>
            <div class="field"><label class="label">Untuk Berapa Bulan</label>
              <input type="number" class="input" v-model="f.BulanDibayar" min="0" max="12"></div>
          </div>
          <div class="info-box" v-if="ref.rekening">
            <span>🏦</span><div>Transfer ke: <b>{{ ref.rekening }}</b></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div class="t"><div class="card-title">3. Unggah Berkas</div>
            <div class="card-sub">Foto langsung dari kamera HP boleh — otomatis dikompres &amp; dibuatkan thumbnail. PDF maks 2 MB.</div></div></div>
          <div class="grid grid-3 gap-md">
            <div class="field"><label class="label">Pas Foto <span class="req">*</span></label>
              <input type="file" class="input" accept="image/*" @change="pilihBerkas('foto',$event)" style="padding:8px">
              <div class="hint flex items-center gap-sm" v-if="berkas.foto">
                <img v-if="berkas.foto.pratinjau" :src="berkas.foto.pratinjau" class="foto-preview" alt="Pratinjau">
                <span>✅ {{ berkas.foto.nama }} · {{ ukuranBaca(berkas.foto.ukuran) }}<template v-if="berkas.foto.ukuranAsli"> (dari {{ ukuranBaca(berkas.foto.ukuranAsli) }})</template></span>
              </div></div>
            <div class="field"><label class="label">Surat Pernyataan</label>
              <input type="file" class="input" accept="image/*,.pdf" @change="pilihBerkas('surat',$event)" style="padding:8px">
              <div class="hint flex items-center gap-sm" v-if="berkas.surat">
                <img v-if="berkas.surat.pratinjau" :src="berkas.surat.pratinjau" class="foto-preview" alt="Pratinjau">
                <span>✅ {{ berkas.surat.nama }} · {{ ukuranBaca(berkas.surat.ukuran) }}<template v-if="berkas.surat.ukuranAsli"> (dari {{ ukuranBaca(berkas.surat.ukuranAsli) }})</template></span>
              </div></div>
            <div class="field"><label class="label">Bukti Pembayaran</label>
              <input type="file" class="input" accept="image/*,.pdf" @change="pilihBerkas('bukti',$event)" style="padding:8px">
              <div class="hint flex items-center gap-sm" v-if="berkas.bukti">
                <img v-if="berkas.bukti.pratinjau" :src="berkas.bukti.pratinjau" class="foto-preview" alt="Pratinjau">
                <span>✅ {{ berkas.bukti.nama }} · {{ ukuranBaca(berkas.bukti.ukuran) }}<template v-if="berkas.bukti.ukuranAsli"> (dari {{ ukuranBaca(berkas.bukti.ukuranAsli) }})</template></span>
              </div></div>
          </div>
        </div>

        <div class="btn-row" style="justify-content:flex-end;margin-bottom:40px">
          <button type="button" class="btn secondary" @click="$emit('pindah','login')">Batal</button>
          <button class="btn lg" :disabled="proses"><span v-if="proses" class="spin"></span>Kirim Pendaftaran</button>
        </div>
      </form>
    </template>
  </div>`
};

/* =========================================================================
 * CEK STATUS PENDAFTARAN (PUBLIK)
 * ======================================================================= */
window.VIEWS['status-daftar'] = {
  emits: ['pindah'],
  data: function () { return { kunci: '', hasil: null, proses: false, kosong: false }; },
  methods: {
    cek: async function () {
      if (!this.kunci) return;
      this.proses = true; this.kosong = false; this.hasil = null;
      var res = await callApi('registration.status', { kunci: this.kunci }, { diam: true });
      this.proses = false;
      if (res.ok) this.hasil = res.data; else this.kosong = true;
    }
  },
  setup: function () { return { tanggal: tanggal }; },
  template: `
  <div class="content" style="max-width:640px;margin:0 auto">
    <sa-page judul="Cek Status Pendaftaran" sub="Masukkan kode pendaftaran, email, atau NIM Anda."
             :jalur="['Portal Publik','Status Pendaftaran']">
      <template #aksi><button class="btn secondary" @click="$emit('pindah','login')">← Halaman Masuk</button></template>
    </sa-page>
    <div class="card">
      <form @submit.prevent="cek" class="flex gap-sm flex-wrap">
        <input class="input flex-1" v-model.trim="kunci" placeholder="mis. PDF0012 / nama@email.com / 202401042" style="min-width:220px">
        <button class="btn" :disabled="proses"><span v-if="proses" class="spin"></span>Periksa</button>
      </form>

      <div v-if="hasil" class="mt-lg">
        <div class="flex items-center gap-md mb-md">
          <sa-avatar :nama="hasil.NamaLengkap" ukuran="lg"></sa-avatar>
          <div>
            <div class="fw7" style="font-size:17px">{{ hasil.NamaLengkap }}</div>
            <span class="mono txt-2">{{ hasil.PendaftarID }}</span>
          </div>
          <div style="margin-left:auto"><sa-badge :teks="hasil.Status"></sa-badge></div>
        </div>
        <sa-kv k="Program Studi" :v="hasil.Prodi || '-'"></sa-kv>
        <sa-kv k="Tanggal Daftar" :v="tanggal(hasil.TanggalDaftar,'jam')"></sa-kv>
        <sa-kv k="Catatan Verifikator" :v="hasil.Catatan || '—'"></sa-kv>

        <div class="info-box mt-md" v-if="hasil.Status === 'Diterima'">
          <span>🎉</span><div><b>Selamat, Anda diterima!</b> Akun santri sudah dibuat. Hubungi bagian PMB untuk mendapatkan sandi awal, lalu masuk melalui halaman login.</div>
        </div>
        <div class="info-box warn mt-md" v-else-if="hasil.Status === 'Perlu Revisi'">
          <span>⚠️</span><div>Berkas Anda perlu diperbaiki sesuai catatan di atas. Silakan hubungi PMB.</div>
        </div>
      </div>

      <sa-empty v-if="kosong" judul="Data tidak ditemukan"
                pesan="Periksa kembali kode/email/NIM yang Anda masukkan." ikon="🔍"></sa-empty>
    </div>
  </div>`
};
