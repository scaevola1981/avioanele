# Arhitectura și Ghidul de Implementare: Jocul de Avioane 8x8 (Multiplayer Online)

Acest document descrie specificațiile tehnice, arhitectura frontend/backend (bazată pe **Supabase Realtime**) și structura de fișiere pentru aplicația web nostalgică **Jocul de Avioane 8x8**, optimizată pentru a fi jucată pe dispozitive mobile și desktop în familie.

---

## 1. Arhitectura Tehnologică

Pentru a menține aplicația extrem de rapidă, ușor de găzduit (pe Vercel sau Netlify) și fără costuri de server dedicat, am optat pentru:
*   **Frontend:** HTML5, CSS Modular (cu accent pe design *glassmorphism* și variabile CSS izolate) și JavaScript Vanilla (ES6+).
*   **Realtime & Sync:** **Supabase Realtime (Broadcast / PostgreSQL)** — permite sincronizarea instantanee a mutărilor și a stărilor de joc între tabletele sau telefoanele jucătorilor prin WebSocket-uri.
*   **Responsivitate:** Design adaptat pentru ecrane mici (mobile-first), cu posibilitatea comutării rapide între **Tabla de Atac** și **Tabla Proprie** pe telefoane.

---

## 2. Structura Fișierelor în Proiect

Proiectul este structurat modular pentru o întreținere ușoară:

```text
/avioane-8x8
│
├── index.html           # Structura principală HTML5 (Meniu, Setup, Game, GameOver)
├── styles.css           # Sistemul de design CSS modular (Glassmorphism, Culori, Animații)
└── game.js              # Logica jocului (Poziționare avion 8x8, Orientare N/E/S/W, Supabase Sync)
```

---

## 3. Specificații Funcționale și Reguli de Joc

1.  **Grila de 8x8:** Fiecare jucător dispune de o matrice de 64 de celule (coordonate de la `0` la `63`).
2.  **Forma Avionului:** Avionul ocupă 10 căsuțe pe grilă și conține:
    *   **Capul** (1 pătrățel — ținta principală care decide victoria instant dacă este nimerit).
    *   **Corpul și Cabina** (câteva pătrățele pe axa centrală).
    *   **Aripile și Coada** (dispunere simetrică în funcție de orientare: Nord, Est, Sud, Vest).
3.  **Faza de Setup:** Jucătorul își plasează capul avionului pe grilă și îl poate roti cu butoanele de orientare. Sistemul validează automat ca întreaga structură să nu iasă din limitele tablei de 8x8.
4.  **Faza de Luptă (Turn-based):**
    *   Jucătorii trag pe rând în tabla inamicului.
    *   Marcaje posibile: *Ratat* (albastru deschis), *Lovit* (roșu/foc), *Cap Nimerit* (galben animat — declanșează victoria).

---

## 4. Ghid de Rulare și Deploy

1.  **Local:** Deschide fișierul `index.html` direct în orice browser modern. (Dacă nu introduci cheile Supabase, jocul rulează într-un mod local/simulat pe același ecran pentru teste rapide).
2.  **Online cu Supabase:**
    *   Creează un proiect gratuit pe [Supabase](https://supabase.com).
    *   Copiază **Project URL** și **Anon Key**.
    *   Introdu-le în ecranul de meniu al aplicației împreună cu un cod de cameră comun (ex: `FAMILIA123`) pentru a juca de pe dispozitive separate (tu pe laptop, copilul pe tabletă).
3.  **Deploy Instant:** Urcă fișierele pe **Vercel** sau **Cloudflare Pages** pentru a obține un link permanent pe care să-l trimiți celor mici.

---
*Creat cu pasiune pentru seri de joc în familie.*