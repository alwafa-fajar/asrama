/* ==========================================================================
 * SIM ASRAMA v6.1 — MIGRASI DATABASE (skill gas-migrasi-database)
 * --------------------------------------------------------------------------
 * Memindahkan data app lama → app baru:
 *   Pindai (dry-run) → Jalankan Import → (delta sync sebelum cutover)
 * Data besar (ratusan ribu baris) diproses BERTAHAP per potongan: browser
 * mengulang panggilan migrasi.run sampai selesai, posisi disimpan di
 * localStorage sehingga bisa DILANJUTKAN bila tab tertutup.
 * ========================================================================== */

window.VIEWS = window.VIEWS || {};

window.VIEWS['migrasi'] = {
  props: ['user'],
  data: function () {
    return {
      source: '', scan: null, memindai: false,
      pilih: {}, overwrite: false, chunk: 4000,
      jalan: false, berhenti: false, mode: '', progres: { sheet: '', selesai: 0, total: 0, mulai: 0 },
      laporan: {}, peringatan: [], selesai: false,
      lanjutan: null,
      rahasia: { hashSalt: '', qrSecret: '' },
      thumb: { jalan: false, selesai: 0, sisa: null },
      riwayat: []
    };
  },
  mounted: function () {
    try { this.lanjutan = JSON.parse(localStorage.getItem('asr_migrasi') || 'null'); } catch (e) {}
    this.muatRiwayat();
  },
  computed: {
    sheetDipilih: function () {
      var self = this;
      return (this.scan ? this.scan.sheets : []).filter(function (s) { return s.dikenal && self.pilih[s.sheet]; });
    },
    totalDipilih: function () { return this.sheetDipilih.reduce(function (a, s) { return a + s.baris; }, 0); },
    adaPeringatan: function () {
      var l = this.laporan;
      return this.peringatan.length > 0 || Object.keys(l).some(function (k) { return l[k].warnings.length; });
    },
    persen: function () { return this.progres.total ? Math.round(this.progres.selesai / this.progres.total * 100) : 0; },
    eta: function () {
      if (!this.jalan || !this.progres.selesai) return '';
      var dtk = (Date.now() - this.progres.mulai) / 1000;
      var sisa = (this.progres.total - this.progres.selesai) * dtk / this.progres.selesai;
      return sisa > 90 ? '±' + Math.round(sisa / 60) + ' menit lagi' : '±' + Math.round(sisa) + ' detik lagi';
    }
  },
  methods: {
    pindai: async function () {
      if (!this.source) { toast('Tempel URL/ID spreadsheet app lama.', 'warning'); return; }
      this.memindai = true; this.scan = null; this.laporan = {}; this.selesai = false; this.peringatan = [];
      var res = await callApi('migrasi.scan', { source: this.source }, { timeout: 120000 });
      this.memindai = false;
      if (!res.ok) return;
      this.scan = res.data;
      var p = {};
      res.data.sheets.forEach(function (s) { p[s.sheet] = s.dikenal && !s.log; });   // log default OFF (volume besar)
      this.pilih = p;
    },
    pilihSemua: function (v) {
      var self = this;
      this.scan.sheets.forEach(function (s) { if (s.dikenal) self.pilih[s.sheet] = v; });
    },
    jalankan: async function (dryRun, lanjut) {
      if (!lanjut) {
        if (!this.sheetDipilih.length) { toast('Pilih minimal satu sheet.', 'warning'); return; }
        if (!dryRun) {
          var ya = await konfirmasi('Jalankan import ke database baru?',
            this.totalDipilih.toLocaleString('id-ID') + ' baris dari ' + this.sheetDipilih.length + ' sheet. ' +
            'Aman diulang — data yang sama tidak akan dobel.' + (this.overwrite ? ' Opsi TIMPA aktif!' : ''), 'Ya, import');
          if (!ya) return;
        }
      }
      var self = this;
      var state = lanjut ? lanjut : {
        source: this.scan.source.id, sourceName: this.scan.source.nama, dryRun: dryRun, overwrite: this.overwrite,
        sheets: this.sheetDipilih.map(function (s) { return { sheet: s.sheet, baris: s.baris }; }),
        idx: 0, offset: 0, report: {}
      };
      this.mode = state.dryRun ? 'Pindai (dry-run)' : 'Import';
      this.jalan = true; this.berhenti = false; this.selesai = false; this.peringatan = [];
      this.laporan = state.report;
      var total = state.sheets.reduce(function (a, s) { return a + s.baris; }, 0);
      var sudah = state.sheets.slice(0, state.idx).reduce(function (a, s) { return a + s.baris; }, 0) + state.offset;
      this.progres = { sheet: '', selesai: sudah, total: total, mulai: Date.now() - 1 };

      while (state.idx < state.sheets.length) {
        if (this.berhenti) break;
        var s = state.sheets[state.idx];
        this.progres.sheet = s.sheet;
        if (!state.report[s.sheet]) state.report[s.sheet] = { source: s.baris, inserted: 0, updated: 0, skipped: 0, warnings: [] };
        var res = await callApi('migrasi.run', {
          source: state.source, sheet: s.sheet, offset: state.offset, limit: Number(this.chunk),
          dryRun: state.dryRun, overwrite: state.overwrite
        }, { timeout: 330000 });
        if (!res.ok) { this.berhenti = true; toast('Berhenti di ' + s.sheet + ': ' + res.error, 'error'); break; }
        var r = state.report[s.sheet], d = res.data;
        r.inserted += d.inserted; r.updated += d.updated; r.skipped += d.skipped;
        d.warnings.forEach(function (w) { if (r.warnings.length < 20) r.warnings.push(w); });
        this.progres.selesai += d.nextOffset - d.offset;
        this.laporan = Object.assign({}, state.report);
        if (d.done) { state.idx++; state.offset = 0; } else { state.offset = d.nextOffset; }
        if (!state.dryRun) { try { localStorage.setItem('asr_migrasi', JSON.stringify(state)); } catch (e) {} }
      }

      if (state.idx >= state.sheets.length) {
        var fin = await callApi('migrasi.finalize', {
          source: state.source, sourceName: state.sourceName, dryRun: state.dryRun, overwrite: state.overwrite,
          sheets: state.sheets.map(function (s) { return s.sheet; }), report: state.report
        }, { timeout: 330000 });
        if (fin.ok) { this.peringatan = fin.data.peringatan || []; toast(fin.message, 'success'); }
        try { localStorage.removeItem('asr_migrasi'); } catch (e) {}
        this.lanjutan = null; this.selesai = true;
        if (!state.dryRun) { bersihkanCache(); this.muatRiwayat(); }
      } else if (!state.dryRun) {
        this.lanjutan = state;
      }
      this.jalan = false;
    },
    lanjutkan: function () {
      var st = this.lanjutan;
      this.source = st.source;
      this.jalankan(st.dryRun, st);
    },
    buangLanjutan: function () { try { localStorage.removeItem('asr_migrasi'); } catch (e) {} this.lanjutan = null; },
    simpanRahasia: async function () {
      var res = await callApi('migrasi.secrets', this.rahasia);
      if (res.ok) {
        toast(res.message, 'success');
        if (this.scan) this.scan.rahasiaLama = res.data;
        this.rahasia = { hashSalt: '', qrSecret: '' };
      }
    },
    buatThumbnail: async function () {
      this.thumb = { jalan: true, selesai: 0, sisa: null };
      var tabel = ['Penghuni', 'Pendaftar'];
      for (var i = 0; i < tabel.length; i++) {
        var sisa = 1;
        while (sisa > 0 && this.thumb.jalan) {
          var res = await callApi('thumb.backfill', { tabel: tabel[i], limit: 25 }, { timeout: 330000 });
          if (!res.ok) { this.thumb.jalan = false; return; }
          this.thumb.selesai += res.data.diproses;
          sisa = res.data.sisa; this.thumb.sisa = sisa;
          if (!res.data.diproses) break;
        }
      }
      this.thumb.jalan = false;
      toast(this.thumb.selesai + ' thumbnail foto lama dibuat.', 'success');
    },
    muatRiwayat: async function () {
      var res = await callApi('migrasi.history', {}, { diam: true });
      if (res.ok) this.riwayat = res.data;
    },
    fmt: function (n) { return (Number(n) || 0).toLocaleString('id-ID'); }
  },
  template: `
  <div>
    <sa-page judul="Migrasi Database dari App Lama"
             sub="Pindahkan ratusan ribu data dari spreadsheet app lama ke app baru — aman diulang, ada dry-run, dan delta sync sebelum pindah."
             :jalur="['Super Admin','Migrasi Database']">
    </sa-page>

    <div class="info-box warn mb-md" v-if="lanjutan && !jalan"><span>⏸</span><div>
      Ada proses import yang belum selesai ({{ lanjutan.sourceName }} — sheet {{ lanjutan.idx + 1 }}/{{ lanjutan.sheets.length }},
      baris {{ fmt(lanjutan.offset) }}). <a href="#" @click.prevent="lanjutkan"><b>Lanjutkan dari posisi terakhir</b></a> ·
      <a href="#" @click.prevent="buangLanjutan">Abaikan</a></div></div>

    <div class="grid grid-32 gap-md">
      <div class="card">
        <div class="card-head"><div class="t"><div class="card-title">1. Spreadsheet Sumber (App Lama)</div>
          <div class="card-sub">Hanya <b>dibaca</b> — app lama tidak diubah sama sekali.</div></div></div>
        <div class="flex gap-sm">
          <input class="input flex-1" v-model.trim="source" placeholder="https://docs.google.com/spreadsheets/d/…/edit  atau ID-nya">
          <button class="btn" :disabled="memindai || jalan" @click="pindai"><span v-if="memindai" class="spin"></span>🔎 Baca Struktur</button>
        </div>
        <div class="info-box mt-md"><span>🔑</span><div>Jalankan app baru dengan <b>akun Google yang sama</b> dengan pemilik app lama.
          Dengan begitu seluruh ID file Drive lama (pas foto, bukti transfer, surat) tetap terbaca —
          yang dipindah hanya ID-nya, bukan filenya.</div></div>
      </div>

      <div class="card">
        <div class="card-head"><div class="t"><div class="card-title">Rahasia App Lama (opsional)</div>
          <div class="card-sub">Agar sandi santri &amp; kartu QR yang sudah dicetak tetap berlaku.</div></div></div>
        <div class="field"><label class="label">HASH_SALT app lama
          <span class="wa-badge ya" v-if="scan && scan.rahasiaLama.hashSalt">tersimpan</span></label>
          <input class="input" type="password" v-model.trim="rahasia.hashSalt" autocomplete="off" placeholder="Script Properties → HASH_SALT"></div>
        <div class="field"><label class="label">QR_SECRET app lama
          <span class="wa-badge ya" v-if="scan && scan.rahasiaLama.qrSecret">tersimpan</span></label>
          <input class="input" type="password" v-model.trim="rahasia.qrSecret" autocomplete="off" placeholder="Script Properties → QR_SECRET"></div>
        <button class="btn sm secondary" :disabled="!rahasia.hashSalt && !rahasia.qrSecret" @click="simpanRahasia">Simpan Rahasia</button>
        <div class="hint mt-sm">Ambil dari proyek Apps Script LAMA → ⚙️ Project Settings → Script Properties.</div>
      </div>
    </div>

    <!-- DAFTAR SHEET -->
    <div class="card" v-if="scan">
      <div class="card-head"><div class="t">
        <div class="card-title">2. Pilih Data — {{ scan.source.nama }}</div>
        <div class="card-sub">{{ fmt(scan.totalBaris) }} baris di {{ scan.sheets.length }} sheet ·
          dibaca per {{ fmt(chunk) }} baris per panggilan (aman dari batas 6 menit Apps Script).</div></div>
        <div class="flex gap-sm"><button class="btn xs secondary" @click="pilihSemua(true)">Pilih semua</button>
          <button class="btn xs ghost" @click="pilihSemua(false)">Kosongkan</button></div>
      </div>

      <div class="mig-row head"><span></span><span>Sheet</span><span class="num">Baris</span>
        <span class="opt">Kolom cocok</span><span class="num">Ditambah</span><span class="num opt">Diperbarui</span><span class="num opt">Dilewati</span></div>
      <div class="mig-row" v-for="s in scan.sheets" :key="s.sheet" :style="!s.dikenal ? 'opacity:.45' : ''">
        <input type="checkbox" v-model="pilih[s.sheet]" :disabled="!s.dikenal || jalan">
        <span><b>{{ s.sheet }}</b>
          <span class="badge plain" v-if="s.log" style="margin-left:6px">log</span>
          <span class="badge plain danger" v-if="!s.dikenal" style="margin-left:6px">tidak dikenal</span>
          <div class="fs-xs txt-3" v-if="s.dikenal && !s.adaKunci">⚠️ kolom kunci {{ s.kunci }} tidak ada</div>
          <div class="fs-xs txt-3" v-if="s.kolomHilang.length" :title="s.kolomHilang.join(', ')">{{ s.kolomHilang.length }} kolom baru akan dikosongkan</div>
          <div class="fs-xs txt-3" v-if="s.kolomTambahan.length" :title="s.kolomTambahan.join(', ')">{{ s.kolomTambahan.length }} kolom lama tidak dipakai</div>
          <div class="progress mt-sm" v-if="jalan && progres.sheet === s.sheet"><div class="bar" style="width:100%;opacity:.6"></div></div>
        </span>
        <span class="num">{{ fmt(s.baris) }}</span>
        <span class="opt fs-sm">{{ s.kolomCocok }}/{{ s.kolomTarget }}</span>
        <span class="num fw6 txt-ok">{{ laporan[s.sheet] ? fmt(laporan[s.sheet].inserted) : '—' }}</span>
        <span class="num opt">{{ laporan[s.sheet] ? fmt(laporan[s.sheet].updated) : '—' }}</span>
        <span class="num opt txt-2">{{ laporan[s.sheet] ? fmt(laporan[s.sheet].skipped) : '—' }}</span>
      </div>

      <div class="flex gap-md flex-wrap items-center mt-md">
        <label class="check"><input type="checkbox" v-model="overwrite" :disabled="jalan">
          Timpa data yang sudah ada di app baru <span class="txt-3">(bawaan: TIDAK — keputusan di app baru dipertahankan)</span></label>
        <label class="fs-sm">Potongan:
          <select class="select" v-model="chunk" :disabled="jalan" style="width:auto;display:inline-block">
            <option :value="2000">2.000</option><option :value="4000">4.000</option><option :value="8000">8.000</option></select></label>
      </div>

      <div class="card mt-md" v-if="jalan || selesai" style="background:var(--surface-2)">
        <div class="flex justify-between fs-sm mb-sm"><b>{{ mode }} · {{ jalan ? progres.sheet : 'selesai' }}</b>
          <span>{{ fmt(progres.selesai) }} / {{ fmt(progres.total) }} baris · {{ persen }}% <span class="txt-3">{{ eta }}</span></span></div>
        <div class="progress lg"><div class="bar ok" :style="{width: persen + '%'}"></div></div>
      </div>

      <div class="btn-row mt-md" style="justify-content:flex-end">
        <button class="btn ghost" v-if="jalan" @click="berhenti = true">⏸ Jeda setelah potongan ini</button>
        <button class="btn secondary" :disabled="jalan || !sheetDipilih.length" @click="jalankan(true)">🔍 Pindai (Dry-run)</button>
        <button class="btn" :disabled="jalan || !sheetDipilih.length" @click="jalankan(false)">
          <span v-if="jalan" class="spin"></span>🚚 Jalankan Import ({{ fmt(totalDipilih) }} baris)</button>
      </div>

      <div v-if="selesai && mode !== 'Import'" class="info-box mt-md"><span>🔍</span><div>Dry-run selesai — <b>belum ada data yang ditulis</b>.
        Periksa angka Ditambah/Diperbarui di atas, lalu klik <b>Jalankan Import</b>.</div></div>

      <div v-if="adaPeringatan" class="mt-md">
        <div class="label">Peringatan</div>
        <div class="info-box warn" v-for="(p, i) in peringatan" :key="'p' + i"><span>⚠️</span><div>{{ p }}</div></div>
        <template v-for="(r, k) in laporan" :key="k">
          <div class="fs-xs txt-2" v-for="(w, i) in r.warnings" :key="k + i">• <b>{{ k }}</b>: {{ w }}</div>
        </template>
      </div>
    </div>

    <div class="grid grid-2 gap-md">
      <div class="card">
        <div class="card-head"><div class="t"><div class="card-title">3. Thumbnail Foto Lama</div>
          <div class="card-sub">Foto dari app lama belum punya thumbnail. Dibuat bertahap dari file Drive asli.</div></div></div>
        <button class="btn secondary" :disabled="thumb.jalan" @click="buatThumbnail">
          <span v-if="thumb.jalan" class="spin dark"></span>🖼 Buat Thumbnail Foto Lama</button>
        <div class="fs-sm txt-2 mt-sm" v-if="thumb.selesai || thumb.jalan">{{ thumb.selesai }} dibuat<span v-if="thumb.sisa !== null"> · sisa {{ thumb.sisa }}</span></div>
      </div>
      <div class="card">
        <div class="card-head"><div class="t"><div class="card-title">4. Checklist Cutover</div></div></div>
        <ol class="fs-sm" style="padding-left:18px;line-height:1.9;margin:0">
          <li>Baca Struktur → <b>Pindai (dry-run)</b> → <b>Jalankan Import</b></li>
          <li>Cek data penghuni, foto, tagihan, pengaturan. Uji login 1 akun santri.</li>
          <li>Tepat sebelum pindah: <b>Jalankan Import sekali lagi</b> (delta sync).</li>
          <li>Umumkan alamat baru (blast WA). Arsipkan deployment lama — datanya tetap aman.</li>
          <li>Catatan: sesi login lama tidak ikut; semua pengguna cukup login ulang.</li>
        </ol>
      </div>
    </div>

    <div class="card" v-if="riwayat.length">
      <div class="card-head"><div class="t"><div class="card-title">Riwayat Migrasi</div></div></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Waktu</th><th>Sumber</th><th>Sheet</th><th>Mode</th><th class="num">Sumber</th><th class="num">Ditambah</th><th class="num">Diperbarui</th><th class="num">Dilewati</th></tr></thead>
        <tbody><tr v-for="r in riwayat" :key="r.MigrasiID">
          <td class="fs-xs">{{ tanggal(r.Tanggal,'jam') }}</td><td class="fs-sm">{{ r.NamaSumber }}</td><td class="fs-sm"><b>{{ r.Sheet }}</b></td>
          <td class="fs-xs">{{ r.Mode }}</td><td class="num">{{ fmt(r.BarisSumber) }}</td><td class="num txt-ok fw6">{{ fmt(r.Ditambah) }}</td>
          <td class="num">{{ fmt(r.Diperbarui) }}</td><td class="num txt-2">{{ fmt(r.Dilewati) }}</td>
        </tr></tbody>
      </table></div>
    </div>
  </div>`
};
