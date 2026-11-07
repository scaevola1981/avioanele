# ✈️ Jocul de Avioane 8x8 (Multiplayer Online Hibrid P2P + Cloud WSS)

Un remake modern al clasicului joc din copilărie „Avioanele”, reproiectat pentru a fi jucat pe telefon (iPhone & Android), tabletă sau calculator alături de familie și prieteni, oriunde în țară sau în lume, prin arhitectură **Dual-Transport: WebRTC P2P (PeerJS) + Releu Cloud WSS Multi-Broker**.

🌐 **Joc Live pe GitHub Pages:** [https://scaevola1981.github.io/avioanele/](https://scaevola1981.github.io/avioanele/)

---

## 🌟 Caracteristici Principale

- **Multiplayer Online Hibrid (WebRTC P2P + Releu Cloud WSS):**
  - Conexiune ultra-rapidă directă prin **WebRTC P2P (PeerJS)** în rețele locale / compatibile.
  - **Releu Cloud WSS Multi-Broker (MQTT over TLS)** activ în paralel pentru conectivitate garantată 100% între orașe diferite, pe rețele mobile **4G/5G (Orange, Digi, Vodafone)**, routere cu **CGNAT / Symmetric NAT** și la comutarea aplicației în fundal (WhatsApp / SMS).
  - Deduplicare automată a pachetelor și resincronizare instantanee la revenirea în aplicație (`visibilitychange`).
- **Aplicație PWA Instalabilă pe Telefon:**
  - Suport nativ complet pentru adăugare ca aplicație pe ecranul principal (iOS Safari & Android Chrome), cu ghid vizual pas cu pas integrat în aplicație și actualizare automată (*Network-First Service Worker*).
- **Amplasare Inteligentă & Intuitivă a Avioanelor:**
  - Două variante de flotă selectabile pe 2 coloane: **Varianta 1 (Compact – 8 căsuțe)** și **Varianta 2 (Clasic – 10 căsuțe)**.
  - Atinge o căsuță pentru Capul avionului, alege orientarea din butoanele rapide sau căsuțele hașurate ori folosește amplasarea aleatorie (**🎲 Aleatoriu**).
  - Culori neon distincte pentru fiecare avion din flotă.
- **Ecran de Luptă Dual & Modal Tactic de Tură:**
  - Ambele table sunt vizibile simultan pe aceeași pagină:
    - **🛡️ Flota Mea (Sus):** vezi avioanele tale și loviturile adversarului în timp real.
    - **🎯 Radar Atac (Dedesubt):** terenul inamic unde lansezi rachetele și marchezi deducțiile.
  - **Modal Tactic Central de Anunțare a Turei:** afișează clar și vizibil cine este la rând și rezultatul ultimei lovituri (cu închidere automată sau la atingere).
  - **Banner Sticky de Tură:** rămâne fixat în partea de sus a ecranului chiar și la scroll pe mobil.
- **Deducere Tactică pe Radarul de Atac (Desenare Contur Căsuță cu Căsuță):**
  - Regula clasică autentică: doborârea capului (**💥 CAP DOBORÂT**) nu dezvăluie automat poziția corpului avionului.
  - Instrument interactiv **„✏️ DESENEAZĂ CONTUR AVION”** prin care poți marca manual pe radar căsuțele unde deduci că se află avionul doborât.
- **Motor Audio Militar Realist (Web Audio API Multi-Layer Synthesis):**
  - Sunete procedurale multi-strat cu compresor dinamic și sub-bas (fără fișiere externe): comutator tactic de cockpit, sonar AWACS cu ecou dublu, lansare rachetă aer-aer, impact în apă, tun antiaerian pe blindaj, bip dublu *Lock-On* + dublă explozie și turbină în picaj la cap doborât, plus fanfară *brass* de victorie.
  - Deblocare automată a canalului audio după revenirea din WhatsApp (`interrupted` state recovery) și suport `navigator.audioSession.type = 'playback'` pentru redare chiar și cu comutatorul *Silent* activ pe iPhone.
- **Sistem de Invitație & Persistență Sesiune:**
  - Coduri de cameră din 4 caractere afișate cu font monospațiat clar (*JetBrains Mono* cu zero tăiat).
  - Partajare nativă rapidă prin WhatsApp / SMS și listă cu piloții recenți.
  - Salvarea și restaurarea automată a meciului în caz de reîncărcare a paginii sau întrerupere temporară a semnalului.
- **Design Neo-Skeuomorphic cu Teme Dark & Light:** Interfață tactilă de cockpit militar, 100% responsivă.

---

## 🚀 Cum se Joacă

1. Deschide [https://scaevola1981.github.io/avioanele/](https://scaevola1981.github.io/avioanele/) pe telefon sau calculator (sau direct din aplicația instalată pe ecran).
2. Alege-ți numele de pilot, varianta de avion și mărimea escadrilei.
3. Apasă pe **„CREEAZĂ MISIUNE”** (Gazdă).
4. Apasă pe **„📤 INVITĂ”** sau **„🔗 Copiază”** și trimite link-ul sau codul din 4 caractere adversarului pe WhatsApp / SMS.
5. Plasează-ți avioanele pe grila tactică și apasă **„GATA DE LUPTĂ”**.
6. Lupta începe imediat ce ambii piloți sunt pregătiți!

---

## 📁 Structura Proiectului

```text
/Avioanele-joc
│
├── index.html       # Interfața completă (Meniu, Setup, Luptă, Modal Tură, Modale Invitație & PWA)
├── styles.css       # Sistem de design Neo-Skeuomorphism (Dark & Light), 100% responsiv
├── game.js          # Logica jocului, deducție contur, Dual-Transport (WebRTC P2P + Cloud WSS Relay)
├── sound.js         # Motor audio militar realist multi-strat (Web Audio API, zero dependențe)
├── sw.js            # Service Worker Network-First pentru suport PWA și actualizare automată
├── manifest.json    # Manifestul PWA pentru instalare nativă pe telefon (iOS & Android)
├── README.md        # Documentația proiectului
└── public/          # Directorul pentru toate imaginile și pictogramele aplicației (PNG)
    ├── icon-192.png
    ├── icon-512.png
    ├── icon.png
    ├── apple-touch-icon.png
    └── favicon.png
```
