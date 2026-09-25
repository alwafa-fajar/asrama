/* ==========================================================================
 * SIM ASRAMA v6.1 — SHELL APLIKASI (Vue 3 SPA)
 * Navigasi client-side 0 ms (gas-instant-ux prinsip 1): seluruh view dimuat
 * sekali, perpindahan menu hanya mengganti komponen — tanpa reload halaman.
 * ========================================================================== */

/* -------------------------------------------------------------------------
 * DEFINISI MENU — disaring otomatis sesuai peran (RBAC tetap ditegakkan server)
 * ---------------------------------------------------------------------- */
var MENU = [
  { grup: 'Utama', items: [
    { id: 'dashboard',        label: 'Dashboard',              ikon: '▦', role: ['SA','PMB','KEU','PA','PI','PIM'] },
    { id: 'dashboard-penghuni', label: 'Beranda Santri',       ikon: '▦', role: ['PNG'] }
  ]},
  { grup: 'Operasional Asrama', items: [
    { id: 'pendaftar',        label: 'Verifikasi Pendaftar',   ikon: '📝', role: ['SA','PMB','PA','PI','PIM'] },
    { id: 'penghuni',         label: 'Manajemen Penghuni',     ikon: '👥', role: ['SA','PMB','KEU','PA','PI','PIM'] },
    { id: 'penempatan',       label: 'Penempatan Kamar',       ikon: '🛏', role: ['SA','PA','PI','PIM','PMB'] },
    { id: 'gedung-kamar',     label: 'Gedung, Kamar &amp; Paket', ikon: '🏢', role: ['SA','PA','PI','KEU','PIM'] },
    { id: 'tagihan',          label: 'Tagihan &amp; Pembayaran',  ikon: '💳', role: ['SA','KEU','PA','PI','PIM'] },
    { id: 'helpdesk',         label: 'Helpdesk &amp; Pengaduan',  ikon: '🎧', role: ['SA','PA','PI','PMB'] }
  ]},
  { grup: 'Pengasuhan &amp; Kedisiplinan', items: [
    { id: 'disiplin',         label: 'Laporan Kedisiplinan',   ikon: '🛡', role: ['SA','PA','PI','PIM'] },
    { id: 'sp-bap',           label: 'Penerbitan SP &amp; BAP',   ikon: '⚖️', role: ['SA','PA','PI'] }
  ]},
  { grup: 'Modul Kartu &amp; Makan', items: [
    { id: 'scanner',          label: 'Scanner QR Kartu Makan', ikon: '⬚', role: ['SA','PA','PI','PTG'] },
    { id: 'kelola-kartu',     label: 'Kelola Kartu Makan',     ikon: '🪪', role: ['SA','PA','PI'] },
    { id: 'log-makan',        label: 'Log &amp; Konsumsi Makan',  ikon: '🍽', role: ['SA','PA','PI','PIM'] },
    { id: 'kartu-saya',       label: 'Kartu Makan Saya',       ikon: '🪪', role: ['PNG'] }
  ]},
  { grup: 'Layanan Mandiri', items: [
    { id: 'tagihan-saya',     label: 'Tagihan Saya',           ikon: '💳', role: ['PNG'] },
    { id: 'helpdesk-saya',    label: 'Aduan &amp; Bantuan',       ikon: '🎧', role: ['PNG'] },
    { id: 'disiplin-saya',    label: 'Skor Kedisiplinan Saya', ikon: '🛡', role: ['PNG'] }
  ]},
  { grup: 'Laporan &amp; Analitika', items: [
    { id: 'laporan',          label: 'Laporan Eksekutif',      ikon: '📊', role: ['SA','KEU','PA','PI','PIM'] },
    { id: 'audit',            label: 'Audit Log',              ikon: '🧾', role: ['SA','PIM'] }
  ]},
  { grup: 'Super Admin (Khusus SA)', items: [
    { id: 'migrasi',          label: 'Migrasi Database',       ikon: '🚚', role: ['SA'] },
    { id: 'import',           label: 'Import Data Agregat',    ikon: '📥', role: ['SA'] },
    { id: 'backup',           label: 'Backup &amp; Cadangan Data', ikon: '🗄', role: ['SA'] },
    { id: 'users',            label: 'Manajemen Pengguna',     ikon: '👤', role: ['SA','PMB'] },
    { id: 'master',           label: 'Master Data',            ikon: '🗂', role: ['SA','PMB'] },
    { id: 'pengaturan',       label: 'Pengaturan Sistem',      ikon: '⚙️', role: ['SA'] }
  ]},
  { grup: 'Pendukung', items: [
    { id: 'arsip',            label: 'Arsip &amp; Pengumuman',    ikon: '📁', role: ['SA','PMB','KEU','PA','PI','PIM','PNG'] },
    { id: 'notifikasi-wa',    label: 'WhatsApp &amp; Notifikasi', ikon: '💬', role: ['SA','PMB','KEU','PA','PI'] },
    { id: 'profil',           label: 'Profil &amp; Kata Sandi',   ikon: '🔑', role: ['SA','PMB','KEU','PA','PI','PIM','PNG','PTG'] }
  ]}
];

var ROUTE_PUBLIK = ['login', 'daftar', 'status-daftar'];

var ROOT = {
  data: function () {
    return {
      user: null, route: 'login', sidebar: false, notif: { rows: [], belumDibaca: 0 },
      notifBuka: false, tema: 'light', cariGlobal: '', siap: false, pengVer: 0
    };
  },
  computed: {
    menuTersaring: function () {
      var role = this.user ? this.user.Role : '';
      return MENU.map(function (g) {
        return { grup: g.grup, items: g.items.filter(function (i) { return i.role.indexOf(role) > -1; }) };
      }).filter(function (g) { return g.items.length; });
    },
    judulHalaman: function () {
      var r = this.route, hasil = r;
      this.menuTersaring.forEach(function (g) {
        g.items.forEach(function (i) { if (i.id === r) hasil = i.label; });
      });
      return hasil;
    },
    publik: function () { return ROUTE_PUBLIK.indexOf(this.route) > -1; },
    tahunAkademik: function () { return this.pengVer >= 0 ? (APP.pengaturan.TAHUN_AKADEMIK || '') : ''; },
    semester: function () { return this.pengVer >= 0 ? (APP.pengaturan.SEMESTER_AKTIF || '') : ''; },
    institusi: function () { return CONFIG.NAMA_INSTITUSI; },
    aplikasi: function () { return CONFIG.NAMA_APLIKASI; }
  },
  mounted: function () {
    window.__app = this;
    // Buka ulang aplikasi → langsung tampil dari sesi & pengaturan lokal (0 ms),
    // lalu 1 panggilan app.boot di latar belakang memvalidasi sesi + menyegarkan data
    if (muatSesi()) {
      this.user = APP.user;
      muatPengaturanLokal();
      this.route = this.rutaAwal();
      this.segarkanSesi();
    } else {
      pemanasanServer();
    }
    // Tema tersimpan per perangkat (pengaturan tampilan, bukan data)
    try {
      var t = localStorage.getItem('asr_tema');
      if (t) { this.tema = t; document.documentElement.setAttribute('data-theme', t); }
    } catch (e) {}
    this.siap = true;
    // Deep link sederhana: index.html#daftar
    var hash = String(location.hash || '').replace('#', '');
    if (!this.user && ROUTE_PUBLIK.indexOf(hash) > -1) this.route = hash;
  },
  methods: {
    rutaAwal: function () {
      var r = APP.user ? APP.user.Role : '';
      if (r === 'PNG') return 'dashboard-penghuni';
      if (r === 'PTG') return 'scanner';
      if (r === 'PDF') return 'status-daftar';
      return 'dashboard';
    },
    masuk: function (user, boot) {
      this.user = user;
      this.route = this.rutaAwal();
      // Paket boot ikut di respons login → tidak ada round-trip tambahan
      if (boot && boot.notif) this.notif = boot.notif; else this.muatNotif();
      if (!boot || !boot.pengaturan) this.muatPengaturan();
      this.mulaiPolling();
      if (['SA','PMB','KEU','PA','PI','PIM'].indexOf(user.Role) > -1) pramuatPustaka(['chart', 'xlsx']);
      if (user.harusGantiSandi) {
        setTimeout(function () {
          Swal.fire({ icon: 'warning', title: 'Anda masih memakai sandi awal',
            text: 'Demi keamanan, segera ganti kata sandi melalui menu Profil & Kata Sandi.',
            confirmButtonColor: '#2563EB' });
        }, 800);
      }
    },
    keluar: async function () {
      var ya = await konfirmasi('Keluar dari sistem?', 'Sesi Anda akan diakhiri.', 'Ya, keluar');
      if (!ya) return;
      callApi('auth.logout', {}, { diam: true });
      this.keluarPaksa();
    },
    keluarPaksa: function () {
      hapusSesi();
      try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
      if (this._poll) clearInterval(this._poll);
      this.user = null; this.route = 'login'; this.sidebar = false;
    },
    segarkanSesi: async function () {
      var res = await callApi('app.boot', {}, { diam: true });
      if (!res.ok) { if (res.code === 401) this.keluarPaksa(); return; }
      var u = Object.assign({}, this.user, res.data.user);
      simpanSesi(APP.token, u);
      this.user = u;
      simpanPengaturanLokal(res.data.pengaturan);
      this.notif = res.data.notif;
      this.mulaiPolling();
      if (['SA','PMB','KEU','PA','PI','PIM'].indexOf(u.Role) > -1) pramuatPustaka(['chart', 'xlsx']);
    },
    mulaiPolling: function () {
      var self = this;
      if (this._poll) clearInterval(this._poll);
      // Notifikasi disegarkan tiap 2 menit, hanya saat tab terlihat (hemat kuota GAS)
      this._poll = setInterval(function () { if (!document.hidden && self.user) self.muatNotif(); }, 120000);
    },
    pindah: function (id) {
      this.route = id;
      this.sidebar = false;
      this.notifBuka = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    muatPengaturan: async function () {
      var res = await callCached('settings.list', {}, 300000);
      if (res.ok) {
        var p = {};
        res.data.forEach(function (r) { p[r.Kunci] = r.Nilai; });
        simpanPengaturanLokal(p);
      }
    },
    muatNotif: async function () {
      var res = await callApi('notify.list', {}, { diam: true });
      if (res.ok) this.notif = res.data;
    },
    bacaNotif: async function (n) {
      if (!n.Dibaca) {
        n.Dibaca = true;
        this.notif.belumDibaca = Math.max(0, this.notif.belumDibaca - 1);
        callApi('notify.markRead', { notifId: n.NotifID }, { diam: true });
      }
      if (n.Link) this.pindah(n.Link);
    },
    bacaSemua: async function () {
      this.notif.rows.forEach(function (n) { n.Dibaca = true; });
      this.notif.belumDibaca = 0;
      await callApi('notify.markAllRead', {}, { diam: true });
    },
    gantiTema: function () {
      this.tema = this.tema === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', this.tema);
      try { localStorage.setItem('asr_tema', this.tema); } catch (e) {}
    },
    cariEnter: function () {
      if (!this.cariGlobal) return;
      if (['SA','PMB','KEU','PA','PI','PIM'].indexOf(this.user.Role) > -1) this.pindah('penghuni');
    }
  },
  template: `
  <div v-if="!siap"></div>

  <!-- ===================== HALAMAN PUBLIK ===================== -->
  <component v-else-if="!user" :is="'view-' + route" @masuk="masuk" @pindah="pindah"></component>

  <!-- ===================== APLIKASI ===================== -->
  <div v-else class="app-shell">
    <!-- SIDEBAR -->
    <aside class="sidebar" :class="{open: sidebar}">
      <div class="sidebar-brand">
        <small>{{ institusi }}</small>
        <strong>{{ aplikasi }}</strong>
      </div>
      <nav class="nav">
        <template v-for="g in menuTersaring" :key="g.grup">
          <div class="nav-label" v-html="g.grup"></div>
          <a v-for="i in g.items" :key="i.id" class="nav-item" :class="{active: route === i.id}"
             href="#" @click.prevent="pindah(i.id)">
            <span class="ico">{{ i.ikon }}</span><span v-html="i.label"></span>
            <span class="pill" v-if="i.id === 'scanner' && user.Role === 'PTG'">LIVE</span>
          </a>
        </template>
      </nav>
      <div class="sidebar-foot">
        <div class="sys-status">
          <span class="dot"></span>
          <div><b style="display:block;color:#fff">Koneksi Sistem</b>
            <span style="color:#8FB0D6">Online Sync · Schema v52</span></div>
        </div>
      </div>
    </aside>
    <div v-if="sidebar" class="backdrop-click" @click="sidebar = false"></div>

    <!-- KONTEN -->
    <div class="main">
      <header class="topbar">
        <button class="burger" @click="sidebar = !sidebar" aria-label="Menu">☰</button>
        <div class="searchbox">
          <span class="mag">🔍</span>
          <input v-model="cariGlobal" @keyup.enter="cariEnter"
                 placeholder="Cari NIM, kamar, nama penghuni, tagihan…">
        </div>
        <div class="topbar-right">
          <span class="topbar-chip">📅 Semester {{ semester }} {{ tahunAkademik }}</span>
          <button class="bell" @click="gantiTema" :title="tema === 'dark' ? 'Mode terang' : 'Mode gelap'">
            {{ tema === 'dark' ? '☀️' : '🌙' }}
          </button>
          <button class="bell" @click="notifBuka = !notifBuka" aria-label="Notifikasi">
            🔔<span class="dot" v-if="notif.belumDibaca"></span>
          </button>
          <div class="userchip" @click="pindah('profil')">
            <sa-avatar :nama="user.NamaLengkap" :foto="user.FotoGoogle" ukuran="sm"></sa-avatar>
            <div class="who"><b>{{ user.NamaLengkap }}</b><span>{{ user.RoleNama || user.Role }}</span></div>
            <button class="btn xs ghost" @click.stop="keluar" title="Keluar">⏻</button>
          </div>
        </div>

        <!-- DROPDOWN NOTIFIKASI -->
        <div v-if="notifBuka" class="dropdown">
          <div class="dropdown-head">
            <span>Notifikasi ({{ notif.belumDibaca }} baru)</span>
            <a href="#" @click.prevent="bacaSemua" class="fs-xs">Tandai semua terbaca</a>
          </div>
          <div class="dropdown-list">
            <div v-for="n in notif.rows" :key="n.NotifID" class="notif-item" :class="{unread: !n.Dibaca}"
                 @click="bacaNotif(n)">
              <span class="dot" v-if="!n.Dibaca"></span>
              <div class="tx">
                <b>{{ n.Judul }}</b><span>{{ n.Pesan }}</span>
                <i>{{ tanggal(n.Tanggal,'jam') }}</i>
              </div>
            </div>
            <sa-empty v-if="!notif.rows.length" judul="Tidak ada notifikasi" ikon="🔔"></sa-empty>
          </div>
        </div>
      </header>
      <div v-if="notifBuka" class="backdrop-click" style="z-index:50" @click="notifBuka = false"></div>

      <main class="content">
        <component :is="'view-' + route" :user="user" @pindah="pindah" @masuk="masuk"></component>
      </main>
    </div>
  </div>`
};

/* -------------------------------------------------------------------------
 * BOOTSTRAP
 * ---------------------------------------------------------------------- */
(function () {
  if (!window.Vue) {
    document.getElementById('app').innerHTML =
      '<div class="boot-screen"><p style="color:#DC2626">Gagal memuat pustaka Vue. Periksa koneksi internet Anda.</p></div>';
    return;
  }
  if (String(CONFIG.GAS_URL).indexOf('GANTI_DENGAN') > -1) {
    console.warn('⚠️ GAS_URL belum diisi di js/config.js');
  }

  var app = Vue.createApp(ROOT);

  // Komponen bersama
  Object.keys(window.KOMPONEN).forEach(function (nama) {
    app.component(nama, window.KOMPONEN[nama]);
  });
  // View halaman
  Object.keys(window.VIEWS).forEach(function (nama) {
    app.component('view-' + nama, window.VIEWS[nama]);
  });

  // Helper global agar bisa dipakai langsung di seluruh template
  var g = app.config.globalProperties;
  g.rupiah = rupiah; g.angka = angka; g.tanggal = tanggal; g.periodeLabel = periodeLabel;
  g.kelasStatus = kelasStatus; g.inisial = inisial; g.potong = potong; g.waLink = waLink;
  g.qrImgTag = qrImgTag; g.unduhExcel = unduhExcel; g.toast = toast; g.konfirmasi = konfirmasi;
  g.ukuranBaca = ukuranBaca; g.normalHp = normalHp;
  g.cetak = function () { window.print(); };
  g.callApi = callApi; g.optimistic = optimistic; g.bersihkanCache = bersihkanCache;
  g.CONFIG = CONFIG; g.APP = APP; g.PALET = PALET;

  app.config.errorHandler = function (err, vm, info) {
    console.error('[SIM Asrama]', err, info);
  };

  app.mount('#app');
})();
