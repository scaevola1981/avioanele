# ✈️ Jocul de Avioane 8x8 (Multiplayer Online P2P)

Un remake modern al clasicului joc din copilărie „Avioanele”, reproiectat pentru a fi jucat pe telefon (iPhone & Android), tabletă sau calculator alături de familie și prieteni, oriunde în lume, prin **WebRTC P2P (PeerJS)**.

🌐 **Joc Live pe GitHub Pages:** [https://scaevola1981.github.io/avioanele/](https://scaevola1981.github.io/avioanele/)

---

## 🌟 Caracteristici Principale

- **Multiplayer Online Direct P2P (WebRTC / PeerJS):** Conexiune ultra-rapidă, sigură și gratuită între dispozitive, fără nevoie de baze de date sau servere complexe.
- **Aplicație PWA Instalabilă pe Telefon:** Suport nativ complet pentru adăugare ca aplicație pe ecranul principal (iOS Safari & Android Chrome).
- **Amplasare Inteligentă & Intuitivă a Avioanelor:**
  - Atinge o căsuță pentru Capul avionului.
  - Jocul afișează instant contururile hașurate și butoanele rapide de orientare pentru pozițiile valide.
  - Atingi oricare căsuță hașurată pentru a fixa avionul.
  - Culori unice și vibrante de neon pentru fiecare avion din flotă.
- **Ecran de Luptă Dual (Simultan):**
  - Ambele table sunt vizibile simultan pe aceeași pagină:
    - **🛡️ Flota Mea (Sus):** vezi avioanele tale și loviturile adversarului.
    - **🎯 Radar Atac (Dedesubt):** terenul gol unde tragi pentru a găsi avioanele inamice.
  - Fără butoane complicate de comutare a tab-urilor.
- **Sistem de Invitație & Piloți Recenți:**
  - Buton „⚔️ INVITĂ” compatibil cu WhatsApp, SMS și partajare mobilă nativă.
  - Listă automată a piloților cu care ai mai luptat, cu posibilitate de provocare directă In-App.
- **Persistență Sesiune:** Dacă conexiunea se întrerupe temporar sau pagina este reîncărcată, starea meciului este restaurată automat.
- **Efecte Audio Sintetizate (Web Audio API):** Sonar radar, lansare rachete, stropire în apă la ratare, explozii metalice la lovire și fanfară de victorie.
- **Design Neo-Skeuomorphic cu Teme Dark & Light:** Interfață cu aspect tactil de cockpit militar.

---

## 🚀 Cum se Joacă

1. Deschide [https://scaevola1981.github.io/avioanele/](https://scaevola1981.github.io/avioanele/) pe orice telefon sau calculator.
2. Alege-ți numele de pilot.
3. Apasă pe **„CREEAZĂ MISIUNE”** (Gazdă).
4. Apasă pe **„📤 INVITĂ”** sau **„🔗 Copiază”** și trimite link-ul adversarului pe WhatsApp sau SMS.
5. Plasează-ți avioanele pe grila tactică și apasă **„GATA DE LUPTĂ”**.
6. Lupta începe imediat ce ambii piloți sunt pregătiți!

---

## 📁 Structura Proiectului

```text
/Avioanele-joc
│
├── index.html       # Interfața completă (Meniu, Setup, Luptă, Modale)
├── styles.css       # Sistem de design Neo-Skeuomorphism (Dark & Light), 100% responsiv
├── game.js          # Logica jocului, validare 8x8, plasare hașurată, WebRTC P2P
├── sound.js         # Generator audio procedural Web Audio API (zero dependențe)
├── sw.js            # Service Worker pentru suport PWA și funcționare offline
├── manifest.json    # Manifestul PWA pentru instalare pe ecranul telefonului
├── icon-192.png     # Iconiță PWA 192x192
├── icon-512.png     # Iconiță PWA 512x512
└── README.md        # Documentația proiectului
```
