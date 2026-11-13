# 📜 Jurnal de Dezvoltare & Istoric Proiect (CHANGELOG)

Acest fișier documentează toate etapele de dezvoltare, modificările recente, arhitectura tehnică și punctele de pornire pentru sesiunile viitoare de lucru la jocul **Avioanele 8x8**.

---

## 📌 Unde ne aflăm acum (Stare Curentă – Versiunea v27)

* **Versiune activă:** `v27` (PWA Cache-Busting, Service Worker Network-First cu Auto-Reload).
* **Live GitHub Pages:** [https://scaevola1981.github.io/avioanele/](https://scaevola1981.github.io/avioanele/)
* **Depozit GitHub:** `https://github.com/scaevola1981/avioanele.git` (ramura `main`).
* **Server Local:** Suport complet prin `package.json` și `server.js` (rulează cu `npm start` sau `npm run dev` pe portul 3000 / 5173 / 8080).

---

## 🚀 Ultima Sesiune (v26 & v27 – 13 Noiembrie 2026)

### 1. Rezolvarea Conectivității Cross-Platform (iPhone ⟷ Android)
* **Problemă identificată:**
  * La introducerea manuală a codului camerei, butonul „INTRĂ ÎN JOC” deschidea încă o fereastră pop-up de confirmare (*„Invitație la Luptă”*). Dacă pe Android nu se mai apăsa și al doilea buton din acea fereastră, jucătorul nu era conectat niciodată la cameră, iar iPhone-ul rămânea blocat pe *„În așteptarea oaspetelui...”*.
  * În plus, vechiul cod rămânea salvat în bara URL a browserului pe Android (`?room=COD_VECHI`), recitind mereu vechea cameră la reîncărcare.
* **Soluție implementată în v27:**
  * **Alăturare directă prin cod:** La apăsarea pe „INTRĂ ÎN JOC”, jucătorul este conectat instantaneu (`connectToRoom(codeInput, 'guest')`), eliminând complet pop-up-ul redundant. Pop-up-ul rămâne activ exclusiv dacă se dă click pe un link extern nou din WhatsApp.
  * **Curățarea automată a URL-ului:** S-a integrat `cleanUrlRoomParam()` prin `history.replaceState` – parametrul `?room=` este șters imediat din bara de adrese la inițializare, prevenind buclele de conectare pe camere vechi.
  * **Butoane de ieșire din invitație:** S-a adăugat butonul **✕** în colț și textul „Renunță și mergi la meniu” în modalul de invitație.
  * **Trei brokeri redundanți de Releu Cloud (MQTT over TLS):**
    1. `wss://broker.emqx.io:8084/mqtt`
    2. `wss://broker.hivemq.com:8884/mqtt`
    3. `wss://test.mosquitto.org:8081/mqtt` (nou adăugat în v27)
  * **Indicator vizual de semnal Releu:** Afișat în ecranul de pregătire chiar sub codul camerei (`🟢 Releu Cloud Activ` / `🟡 Conectare Releu...`).
  * **Expirare automată sesiuni:** Sesiunile abandonate în faza de `SETUP` expiră automat după 10 minute în loc de 12 ore, curățând automat `localStorage`.

### 2. Părăsire Meci & Notificare Adversar (v26)
* **Buton „🚪 Părăsește Meciul”** în bara de antet (vizibil doar în ecranele de `SETUP` și `LUPTĂ`).
* **Eveniment `PLAYER_LEFT`** transmis prin P2P și Releul Cloud către adversar.
* **Modal dedicat `opponent-left-modal`** care anunță clar celălalt jucător dacă adversarul a ieșit în meniu sau a închis meciul, resetând complet datele tablei pentru a permite începerea unui meci nou fără blocaje.

### 3. Server Local Zero-Dependințe & `package.json` (v26)
* S-a adăugat `package.json` cu scripturile:
  * `npm start` ➔ pornește `node server.js`
  * `npm run dev` ➔ pornește `node server.js`
* S-a creat `server.js` folosind modulele native Node.js (`http`, `fs`, `path`), cu detectare MIME types și fallback automat de porturi (3000 ➔ 5173 ➔ 8080) dacă portul 3000 este deja ocupat de alt serviciu.

### 4. Modal Tactic de Tură & Vizibilitate Rând (v25)
* S-a implementat `turn-announce-modal` (`showTurnModal(isMyTurn, customSubtitle, durationMs)`) care afișează clar pe centrul ecranului cine este la rând și rezultatul ultimei lovituri, cu fundal semitransparent și închidere automată la 2 secunde sau la click.

### 5. Motor Audio Militar Realist Multi-Strat (v24 & v25)
* Sinteză procedurală 100% nativă Web Audio API (fără fișiere MP3/WAV externe):
  * **Click tactil:** comutator metalic de cockpit cu rezonanță ceramică.
  * **Sonar radar:** bip 1800Hz cu ecou spațial dublu.
  * **Lansare rachetă:** suflu de combustibil solid + șuierat aerodinamic în frecvență înaltă.
  * **Apă / Ratat:** cădere în adâncime cu stropi de apă și zgomot alb filtrat.
  * **Blindaj / Corp lovit:** detonare de ogivă combinată cu impact mecanic pe fuselaj.
  * **Cap doborât:** bip alertă *Lock-On* + explozie dublă de combustibil + turbină în picaj.
  * **Victorie:** fanfară militară polifonică cu acorduri alămuri.
* Suport complet pentru redare în fundal și compatibilitate iOS Silent Switch prin `navigator.audioSession.type = 'playback'`.

---

## 🏗️ Arhitectura Tehnică & Fișiere Cheie

```text
/Avioanele-joc
├── index.html       # Structura DOM (Meniu, Setup, Luptă, GameOver, Modale: Tură, Invitație, Meci Părăsit)
├── styles.css       # Design Neo-Skeuomorphic Dark & Light, variabile CSS, layout 100% mobil
├── game.js          # Inima logicii: Transport Hibrid (PeerJS + Cloud WSS MQTT), Deducție contur, Stări
├── sound.js         # Generator audio procedural multi-strat (Web Audio API)
├── server.js        # Server local HTTP ultra-ușor cu fallback automat de porturi (zero npm dependencies)
├── package.json     # Configurare npm (npm start / npm run dev)
├── sw.js            # Service Worker Network-First (cache-busting v27)
├── manifest.json    # Configurare PWA instalabilă pe telefon
├── README.md        # Documentația generală și ghidul de joc
├── CHANGELOG.md     # Acest fișier: istoricul detaliat și ghidul pentru pașii viitori
└── public/          # Iconițe PWA (192px, 512px, apple-touch-icon, favicon)
```

---

## 🎯 De unde să începi pe viitor (Recomandări & Idei Viitoare)

Dacă dorești să extinzi jocul în sesiunile următoare, iată direcțiile prioritare deja pregătite:

1. **Mod Antrenament Solo (vs AI):**
   * Crearea unui bot autonom (*AI Tactic*) care să plaseze avioanele conform regulilor și să tragă inteligent (căutare în tablă de șah + focalizare pe celulele adiacente când lovește un corp).
2. **Chat Tactic Rapid cu Mesaje Predefinite:**
   * Un meniu pop-up cu replici rapide radio (*„Radar blocat!”*, *„Mi-ai nimerit aripa!”*, *„Pregătește-te!”*, *„Bună lovitură!”*) transmise instant prin Releul Cloud WSS.
3. **Statistici Avansate & Istoric Meciuri:**
   * Număr total de victorii / înfrângeri salvate local, rată de acuratețe a rachetelor lansate și trofee/insigne deblocate (ex: *„Trăgător de Elită”* pentru doborârea din prima încercare).
4. **Variante Suplimentare de Tablă:**
   * Opțiune pentru tablă de 10x10 cu 3 sau 4 avioane clasice de 10 celule.
