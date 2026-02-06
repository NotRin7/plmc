# Palladium Secure Chat

Electron desktop client for encrypted, on‑chain messaging on the Palladium network.  
Uses **ElectrumX** (no local node required) and **P2WPKH (bech32)** addresses.

---

## Highlights
- **ElectrumX transport** over TLS (default: `palladiumblockchain.net:50002`)
- **End‑to‑end encryption** via ECDH + AES‑CBC
- **On‑chain messages** stored in `OP_RETURN` with `PLMC` prefix
- **Wallet import** via WIF + local persistence
- **P2WPKH** addresses and spends

---

## Quick Start (Users)

### 1) Install dependencies
```bash
npm install
```

### 2) Run the desktop app
```bash
npm run electron:dev
```

### 3) Configure ElectrumX
Open **Settings → ElectrumX Settings** and set:
- **Host:** `palladiumblockchain.net`
- **Port:** `50002` (TLS)

### 4) Login
Paste your **WIF** or click **Create New Key**, then **Start & Scan**.  
The app saves the account locally and auto‑login on next start.

### 5) Send a message
Add a contact using their **public key (hex)**, write a message, click **Send**.

---

## How It Works (Protocol Overview)

### Address Type
**P2WPKH (bech32)** is used for receive/change addresses and outputs.

### Encryption
1. **ECDH shared secret** from `(their_pubkey × my_privkey)` on secp256k1
2. **SHA256** of the shared secret becomes the AES key
3. **AES‑CBC + PKCS7**, with random 16‑byte IV  
   Message format: `ivHex:ciphertext`

### OP_RETURN payload
`OP_RETURN` data is: `"PLMC" + encryptedMessage`

### ElectrumX flow
- `blockchain.scripthash.listunspent` to fetch UTXOs
- `blockchain.transaction.get` to build PSBT inputs
- `blockchain.transaction.broadcast` to send raw tx
- `blockchain.scripthash.get_history` + `blockchain.headers.subscribe` to scan

---

## Development (for contributors)

### Project Layout
```
./electron
  main.cjs
  preload.js
./public
  logo_3.png
  logo_2.jpg
  manifest.json
./src
  App.jsx
  main.jsx
  index.css
  /wallet
    Wallet.js
    crypto.js
    rpc.js
  /ui
    ChatPanel.jsx
    ContactDialog.jsx
    LoginPanel.jsx
    ProfilePanel.jsx
    RpcDialog.jsx
    SettingsPanel.jsx
    strings.js
```

### Run Electron in dev mode
```bash
npm run electron:dev
```

### Build desktop binaries
```bash
npm run electron:build
```
Outputs are placed in `release/`.

---

## 🐳 Docker Build (Recommended)

You can build the application for **Linux** and **Windows** using Docker without installing native dependencies on your host machine.

### Build all platforms (Desktop)
```bash
docker-compose up --build
```

This will:
1. Install all dependencies in a container.
2. Build the Linux AppImage and Windows (.exe) installer.
3. Place the results in the `release/` folder on your host.

---

## 🤖 Android Build

The project uses **Capacitor** for Android support.

### 1. Sync web assets
```bash
npm run android:sync
```

### 2. Build APK (Manual)
Since building an APK requires the Android SDK, you can open the project in **Android Studio**:
```bash
npm run android:open
```
In Android Studio, go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

### 3. Build APK (Docker - Recommended)
If you don't want to install Android Studio, use the provided Docker environment:
```bash
npm run docker:build:android
```
The finished `.apk` will be in the `release/` folder.

---

## 🎨 Modern UI & Features
- **Cyberpunk Dark Theme:** Modern look with Orbitron and Space Grotesk fonts.
- **Glassmorphism:** High-tech panels with blur effects.
- **Cross-Platform:** Native support for Linux and Windows.
- **Multi-language:** Supports English, German, Italian, and Russian.

---

## Configuration
Defaults (editable in Settings):
- **Host:** `palladiumblockchain.net`
- **Port:** `50002` (TLS)

No username/password is required.

---

## Troubleshooting

**ElectrumX Connection Failed**
- Check host/port
- Ensure outbound TLS connections are allowed

**No balance / cannot send**
- Address must have confirmed UTXOs

**Messages not visible**
- Increase rescan window in Settings
- Ensure OP_RETURN prefix is `PLMC`

---

## Security Notes
- WIF is stored locally (`localStorage`).
- Message history is encrypted using a key derived from your private key.
- Use at your own risk; this is developer‑grade software.
