# ✈️ Jocul de Avioane 8x8 (Multiplayer Online Hibrid P2P + Cloud WSS)

Un remake modern al clasicului joc din copilărie „Avioanele”, reproiectat pentru a fi jucat pe telefon (iPhone & Android), tabletă sau calculator alături de familie și prieteni, oriunde în țară sau în lume, prin arhitectură **Dual-Transport: WebRTC P2P (PeerJS) + Releu Cloud WSS Multi-Broker**.

🌐 **Joc Live pe GitHub Pages:** [https://scaevola1981.github.io/avioanele/](https://scaevola1981.github.io/avioanele/)  
📜 **Istoric Complet Modificări & Jurnal Tehnic:** vezi [CHANGELOG.md](CHANGELOG.md)

---

## 🌟 Caracteristici Principale

- **Multiplayer Online Hibrid (WebRTC P2P + Releu Cloud WSS Multi-Broker):**
  - Conexiune ultra-rapidă directă prin **WebRTC P2P (PeerJS)** în rețele compatibile.
  - **Releu Cloud WSS Multi-Broker (MQTT over TLS pe 3 noduri globale: EMQX, HiveMQ, Mosquitto)** activ simultan în paralel. Asigură conectivitate garantată 100% între iPhone și Android, între orașe diferite, pe rețele mobile **4G/5G (Orange, Digi, Vodafone)**, prin routere cu **CGNAT / Symmetric NAT** și la comutarea aplicației în fundal (WhatsApp / SMS).
  - Indicator de stare în timp real pe ecran: `🟢 Releu Cloud Activ` / `🟡 Conectare Releu...`.
  - Deduplicare automată a pachetelor și resincronizare instantanee la revenirea în aplicație (`visibilitychange`).
- **Alăturare Rapidă & Curățare Automată Sesiune:**
  - Alăturare directă prin introducerea codului de 4 caractere, fără ferestre sau pași intermediari derutanți.
  - Curățare automată a URL-ului (`history.replaceState`) pentru a nu rămâne blocat niciodată pe meciuri sau coduri vechi.
  - Buton dedicat **„🚪 Părăsește Meciul”** cu notificare instantanee către adversar (`opponent-left-modal`).
- **Aplicație PWA Instalabilă pe Telefon:**
  - Suport nativ complet pentru adăugare ca aplicație pe ecranul principal (iOS Safari & Android Chrome), cu ghid vizual pas cu pas integrat în aplicație și actualizare automată (*Network-First Service Worker v27 cu auto-reload*).
- **Amplasare Inteligentă & Intuitivă a Avioanelor:**
  - Două variante de flotă selectabile pe 2 coloane: **Varianta 1 (Compact – 8 căsuțe)** și **Varianta 2 (Clasic – 10 căsuțe)**.
  - Atinge o căsuță pentru Capul avionului, alege orientarea din butoanele rapide sau căsuțele hașurate ori folosește amplasarea aleatorie (**🎲 Aleatoriu**).
  - Culori neon distincte pentru fiecare avion din flotă.
- **Ecran de Luptă Dual & Modal Tactic de Tură:**
  - Ambele table sunt vizibile simultan pe aceeași pagină:
    - **🛡️ Flota Mea (Sus):** vezi avioanele tale și loviturile adversarului în timp real.
    - **🎯 Radar Atac (Dedesubt):** terenul inamic unde lansezi rachetele și marchezi deducțiile.
  - **Modal Tactic Central de Anunțare a Turei (`showTurnModal`):** afișează clar și vizibil cine este la rând și rezultatul ultimei lovituri (cu închidere automată la 2s sau la atingere).
  - **Banner Sticky de Tură:** rămâne fixat în partea de sus a ecranului chiar și la scroll pe mobil.
- **Deducere Tactică pe Radarul de Atac (Desenare Contur Căsuță cu Căsuță):**
  - Regula clasică autentică: doborârea capului (**💥 CAP DOBORÂT**) nu dezvăluie automat poziția corpului avionului.
  - Instrument interactiv **„✏️ DESENEAZĂ CONTUR AVION”** prin care poți marca manual pe radar căsuțele unde deduci că se află avionul doborât.
- **Motor Audio Militar Realist (Web Audio API Multi-Layer Synthesis):**
  - Sunete procedurale multi-strat cu compresor dinamic și sub-bas (fără fișiere externe): comutator tactic de cockpit, sonar AWACS cu ecou dublu, lansare rachetă aer-aer, impact în apă, tun antiaerian pe blindaj, bip dublu *Lock-On* + dublă explozie și turbină în picaj la cap doborât, plus fanfară *brass* de victorie.
  - Deblocare automată a canalului audio după revenirea din WhatsApp (`interrupted` state recovery) și suport `navigator.audioSession.type = 'playback'` pentru redare chiar și cu comutatorul *Silent* activ pe iPhone.
- **Design Neo-Skeuomorphic cu Teme Dark & Light:** Interfață tactilă de cockpit militar, 100% responsivă pe orice diagonală de ecran.

---

## 🚀 Cum se Joacă Online

1. Deschide [https://scaevola1981.github.io/avioanele/](https://scaevola1981.github.io/avioanele/) pe telefon sau calculator (sau direct din aplicația instalată pe ecran).
2. Alege-ți numele de pilot, varianta de avion și mărimea escadrilei.
3. Apasă pe **„CREEAZĂ MISIUNE”** (Gazdă).
4. Apasă pe **„📤 INVITĂ”** sau **„🔗 Copiază”** și trimite link-ul sau codul din 4 caractere adversarului pe WhatsApp / SMS.
5. Adversarul introduce codul la **„Alătură-te unei Misiuni”** și apasă **„INTRĂ ÎN JOC”**.
6. Ambii piloți își așază avioanele pe grila tactică și apasă **„GATA DE LUPTĂ”**.
7. Lupta începe imediat!

---

## 💻 Rulare Locală (Dezvoltare)

Proiectul conține un server HTTP nativ Node.js fără dependențe externe:

```bash
# Pornire server local
npm start
# sau
npm run dev
```

Serverul va porni automat pe portul `3000` (sau `5173` / `8080` dacă portul este ocupat):
➔ Deschide în browser: `http://localhost:3000`

---

## 📁 Structura Proiectului

```text
/Avioanele-joc
│
├── index.html       # Interfața completă (Meniu, Setup, Luptă, Modal Tură, Modale Invitație & PWA)
├── styles.css       # Sistem de design Neo-Skeuomorphism (Dark & Light), 100% responsiv
├── game.js          # Logica jocului, deducție contur, Dual-Transport (WebRTC P2P + Cloud WSS Relay)
├── sound.js         # Motor audio militar realist multi-strat (Web Audio API, zero dependențe)
├── server.js        # Server local Node.js cu fallback automat de porturi
├── package.json     # Configurația npm pentru pornire locală (npm start / npm run dev)
├── sw.js            # Service Worker Network-First (cache-busting v27)
├── manifest.json    # Manifestul PWA pentru instalare nativă pe telefon (iOS & Android)
├── README.md        # Documentația generală a proiectului
├── CHANGELOG.md     # Jurnalul detaliat al modificărilor și ghidul pentru sesiuni viitoare
└── public/          # Directorul pentru pictogramele aplicației (PNG)
    ├── icon-192.png
    ├── icon-512.png
    ├── icon.png
    ├── apple-touch-icon.png
    └── favicon.png
```

---
*Creat cu pasiune pentru seri de joc în familie.*
