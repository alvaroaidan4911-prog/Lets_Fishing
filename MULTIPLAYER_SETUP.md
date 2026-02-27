# 🌐 Panduan Setup Multiplayer — Let's Fishing v4

Multiplayer menggunakan **Firebase Realtime Database** (gratis, tidak perlu server).

---

## ⏱️ Estimasi waktu: ~10 menit

---

## Langkah 1 — Buat Project Firebase

1. Buka **https://console.firebase.google.com**
2. Klik **"Add project"** (atau "Create a project")
3. Isi nama project bebas, misal: `letsfishing-game`
4. Klik Continue → (boleh disable Analytics) → **Create project**

---

## Langkah 2 — Aktifkan Realtime Database

1. Di sidebar kiri, klik **"Build"** → **"Realtime Database"**
2. Klik **"Create database"**
3. Pilih lokasi server (pilih yang paling dekat, misal Singapore)
4. Pilih **"Start in test mode"** → **Enable**

> ⚠️ Test mode berlaku 30 hari. Setelah itu perlu atur Rules di console.

---

## Langkah 3 — Daftarkan Web App

1. Klik ikon roda gigi ⚙️ di sidebar → **"Project settings"**
2. Scroll ke bawah, bagian **"Your apps"**
3. Klik icon **`</>`** (Web)
4. Isi nama app: `fishing-web` → klik **"Register app"**
5. Kamu akan melihat kode seperti ini:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "letsfishing-game.firebaseapp.com",
  databaseURL: "https://letsfishing-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "letsfishing-game",
  storageBucket: "letsfishing-game.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456:web:abc123"
};
```

---

## Langkah 4 — Isi Config di Game

Buka file **`multiplayer.js`**, di bagian paling atas ada:

```js
window.FIREBASE_CONFIG = {
  apiKey:            "ISI_DISINI",
  authDomain:        "ISI_DISINI.firebaseapp.com",
  ...
};
```

**Ganti setiap nilai** dengan nilai dari Firebase kamu. Contoh:

```js
window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "letsfishing-game.firebaseapp.com",
  databaseURL:       "https://letsfishing-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "letsfishing-game",
  storageBucket:     "letsfishing-game.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456:web:abc123"
};
```

---

## Langkah 5 — Upload ke Hosting

Firebase tidak bisa dipakai dari file lokal (`file://`). Game harus di-host. Cara termudah:

### Opsi A — GitHub Pages (gratis, paling mudah)
1. Buat repo di GitHub, upload semua file game
2. Settings → Pages → Source: main branch
3. URL: `https://username.github.io/nama-repo`

### Opsi B — Netlify (drag & drop)
1. Buka **https://netlify.com**
2. Drag folder game ke halaman Netlify
3. Langsung online dalam 30 detik!

### Opsi C — Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## Cara Bermain Bareng Teman

1. Buka game dari URL yang sama (misal GitHub Pages)
2. Masukkan **nama yang berbeda** tapi **room name yang SAMA**
3. Kalian akan muncul di dunia yang sama!

> Contoh: kamu dan teman sama-sama isi room name: `bareng123`

---

## Fitur Multiplayer yang Ada

| Fitur | Keterangan |
|-------|-----------|
| 🧍 Real-time sync | Posisi & rotasi player lain muncul |
| 🏊 Swim animation | Animasi renang player lain terlihat |
| 🎣 Fishing animation | Pose mancing + fishing line terlihat |
| 💬 Chat | Tekan [T] untuk buka chat |
| 🏷️ Name tag | Nama player muncul di atas kepala |
| 🌊 Wake particles | Efek jetski terlihat player lain |
| 🏠 Rooms | Room berbeda = world terpisah |
| 🔴 Join/leave notif | Notifikasi saat player masuk/keluar |

---

## Troubleshooting

**"Koneksi gagal"**
→ Pastikan `databaseURL` sudah diisi dan benar

**Player lain tidak muncul**
→ Pastikan kalian di room yang sama dan URL game sama

**"Gagal load SDK"**
→ Cek koneksi internet, Firebase CDN butuh internet

**Test mode expired**
→ Di Firebase Console → Realtime Database → Rules, ganti:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
