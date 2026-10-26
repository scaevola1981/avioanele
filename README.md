# ✈️ Jocul de Avioane 8x8 (Multiplayer Online)

Un remake modern al clasicului joc din copilărie „Avioanele”, reproiectat pentru a fi jucat pe telefon, tabletă sau calculator alături de familie și prieteni, oriunde în lume, prin **Supabase Realtime**.

---

## 🌟 Caracteristici Principale

- **Multiplayer Online în Timp Real:** Joacă de la distanță prin WebSockets (Supabase Realtime Broadcast & Presence).
- **2 Modele Distincte de Avioane:**
  - **Avion Compact (8 căsuțe):** Cap (1), Aripă față (3), Corp (1), Aripă spate (3) — Suportă între **2 și 4 avioane**.
  - **Avion Clasic (10 căsuțe):** Cap (1), Aripă față (5), Corp (1), Aripă spate (3) — Suportă până la **3 avioane**.
- **Ture Alternative Stricte:** Fiecare jucător trage o singură dată, apoi rândul trece la adversar.
- **Efecte Audio Sintetizate (Web Audio API):** Sonar radar, lansare rachetă, stropire în apă la ratare, explozii metalice la lovire și fanfară de victorie — fără fișiere audio externe grele.
- **Interfață Tactică Neon Glassmorphism:**
  - Tematică modernă Tactical Radar HUD.
  - Comutator rapid între **Radar Țintă** și **Flota Mea** pe ecrane de telefon.
  - Mod Dual Radar pe ecrane mari/desktop.
  - Buton „🎲 Aleatoriu” pentru plasarea automată rapidă a flotei.

---

## 🚀 Cum se Joacă

### 1. Rulare Locală
Deschide direct fișierul `index.html` în orice browser modern sau pornește un server local:
```bash
python3 -m http.server 8080
```
Accesează `http://localhost:8080`.

### 2. Conectare Online prin Supabase (Gratuit)
1. Creează un cont și un proiect gratuit pe [supabase.com](https://supabase.com).
2. Mergi în **Project Settings -> API** și copiază:
   - **Project URL**
   - **anon public key**
3. Ai două variante simple:
   - **Varianta A:** Deschide jocul, apasă pe rotița de setări `⚙️` din colțul dreapta-sus, lipește cele două chei și apasă „Salvează Conexiunea” (se salvează automat în browserul telefonului).
   - **Varianta B:** Completează datele o singură dată în fișierul `config.js`:
     ```javascript
     window.APP_CONFIG = {
         SUPABASE_URL: "https://xyzcompany.supabase.co",
         SUPABASE_ANON_KEY: "cheia_ta_anonima_publica"
     };
     ```
4. **Creează Camera (Gazda):** Alege modelul de avion și numărul de avioane, apoi apasă **„CREEAZĂ CAMERA”**.
5. **Trimite Invitația:** Apasă pe **„🔗 Copiază Link”** și trimite linkul pe WhatsApp/SMS prietenului sau copilului.
6. **Lupta:** După ce ambii jucători își plasează avioanele și apasă **„GATA DE LUPTĂ”**, bătălia începe automat!

---

## 📁 Structura Proiectului

```text
/Avioanele-joc
│
├── index.html       # Structura interfeței (Meniu, Setup, Combat, GameOver, Setări)
├── styles.css       # Design Glassmorphism, tematică Tactical Radar, 100% responsiv
├── config.js        # Configurație implicită Supabase (opțională)
├── sound.js         # Generator audio procedural Web Audio API (zero dependențe)
├── game.js          # Geometria avioanelor, validarea tablei 8x8 și sincronizarea Supabase
└── README.md        # Documentația proiectului
```

---

## 🚢 Deploy Gratuit (Vercel / Netlify / Cloudflare Pages)

Proiectul conține fișiere statice pure (HTML/CSS/JS), deci poate fi publicat instant pe orice platformă de hosting static:
- **Vercel:** Trage folderul sau fă commit pe GitHub și apasă *Deploy*.
- **Netlify:** Trage folderul în secțiunea *Sites -> Drop to deploy*.
- **Cloudflare Pages:** Conectează repository-ul GitHub sau încarcă direct fișierele.
