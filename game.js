/**
 * game.js - Logica completă pentru Jocul de Avioane 8x8
 * Multiplayer Online prin Supabase Realtime (Broadcast & Presence)
 */

const GRID_SIZE = 8;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 64

// Sistemul de coordonate oficial: A-H vertical, 1-8 orizontal
const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const COL_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function getCoordinateLabel(cellIndex) {
    const r = Math.floor(cellIndex / GRID_SIZE);
    const c = cellIndex % GRID_SIZE;
    return `${ROW_LETTERS[r]}${COL_NUMBERS[c]}`;
}

// Starea globală a jocului
const state = {
    supabaseClient: null,
    channel: null,
    roomCode: '',
    role: null, // 'host' | 'guest'
    opponentConnected: false,
    opponentReady: false,
    myReady: false,
    
    // Reguli joc
    planeVariant: 1, // 1: Compact (8 căsuțe), 2: Clasic (10 căsuțe)
    planeCount: 3,   // V1: 2-4, V2: 1-3
    
    // Faza curentă
    phase: 'MENU', // 'MENU' | 'SETUP' | 'BATTLE' | 'GAMEOVER'
    
    // Plasare flotă
    myPlanes: [], // Array de obiecte plane: { id, orientation, head: {r,c}, cells: [{r,c,type}], isDown: false }
    selectedOrientation: 'N', // 'N', 'E', 'S', 'W'
    activePlaneIndex: null,   // Pentru re-editare/ștergere
    
    // Luptă
    currentTurn: 'host', // 'host' | 'guest'
    myShotsOnEnemy: {},  // cellIndex -> { status: 'MISS' | 'HIT' | 'HEAD', planeId }
    enemyShotsOnMe: {},  // cellIndex -> { status: 'MISS' | 'HIT' | 'HEAD', planeId }
    lastCombatMessage: '', // Mesaj de feedback cu coordonate (ex: "Ai tras la C4: LOVIT!")
    
    // Statistici meci
    stats: {
        myHits: 0,
        myMisses: 0,
        enemyDownedPlanes: 0,
        myDownedPlanes: 0
    }
};

// ==========================================
// 1. GEOMETRIA ȘI FORMA AVIOANELOR
// ==========================================

/**
 * Generează căsuțele avionului în funcție de cap (r, c), orientare și variantă.
 * Varianta 1 (Compact, 8 celule): Cap (1), Aripă față (3), Corp (1), Aripă spate (3)
 * Varianta 2 (Clasic, 10 celule): Cap (1), Aripă față (5), Corp (1), Aripă spate (3)
 */
function calculatePlaneCells(headR, headC, orientation, variant) {
    const cells = [{ r: headR, c: headC, type: 'head' }];
    const wingSpan = variant === 1 ? 3 : 5;
    const halfWing = Math.floor(wingSpan / 2);

    if (orientation === 'N') {
        // Aripa față (linia 1 sub cap)
        for (let dc = -halfWing; dc <= halfWing; dc++) {
            cells.push({ r: headR + 1, c: headC + dc, type: 'wing' });
        }
        // Corp (linia 2 sub cap)
        cells.push({ r: headR + 2, c: headC, type: 'body' });
        // Aripa spate / Coada (linia 3 sub cap, lățime 3)
        for (let dc = -1; dc <= 1; dc++) {
            cells.push({ r: headR + 3, c: headC + dc, type: 'tail' });
        }
    } else if (orientation === 'S') {
        // Aripa față (linia 1 deasupra capului)
        for (let dc = -halfWing; dc <= halfWing; dc++) {
            cells.push({ r: headR - 1, c: headC + dc, type: 'wing' });
        }
        // Corp (linia 2 deasupra capului)
        cells.push({ r: headR - 2, c: headC, type: 'body' });
        // Aripa spate (linia 3 deasupra capului, lățime 3)
        for (let dc = -1; dc <= 1; dc++) {
            cells.push({ r: headR - 3, c: headC + dc, type: 'tail' });
        }
    } else if (orientation === 'E') {
        // Orientat spre Est (capul la dreapta, aripile la stânga)
        for (let dr = -halfWing; dr <= halfWing; dr++) {
            cells.push({ r: headR + dr, c: headC - 1, type: 'wing' });
        }
        cells.push({ r: headR, c: headC - 2, type: 'body' });
        for (let dr = -1; dr <= 1; dr++) {
            cells.push({ r: headR + dr, c: headC - 3, type: 'tail' });
        }
    } else if (orientation === 'W') {
        // Orientat spre Vest (capul la stânga, aripile la dreapta)
        for (let dr = -halfWing; dr <= halfWing; dr++) {
            cells.push({ r: headR + dr, c: headC + 1, type: 'wing' });
        }
        cells.push({ r: headR, c: headC + 2, type: 'body' });
        for (let dr = -1; dr <= 1; dr++) {
            cells.push({ r: headR + dr, c: headC + 3, type: 'tail' });
        }
    }

    return cells;
}

/**
 * Validează dacă avionul se încadrează complet pe tabla 8x8
 */
function isWithinBounds(cells) {
    return cells.every(c => c.r >= 0 && c.r < GRID_SIZE && c.c >= 0 && c.c < GRID_SIZE);
}

/**
 * Verifică dacă avionul se suprapune cu oricare din avioanele deja plasate
 */
function collidesWithExisting(cells, existingPlanes, excludeIndex = null) {
    const currentCells = new Set(cells.map(c => `${c.r},${c.c}`));
    for (let i = 0; i < existingPlanes.length; i++) {
        if (excludeIndex !== null && i === excludeIndex) continue;
        for (const c of existingPlanes[i].cells) {
            if (currentCells.has(`${c.r},${c.c}`)) {
                return true;
            }
        }
    }
    return false;
}

// ==========================================
// 2. SUPABASE INITIALIZARE & REALTIME
// ==========================================

function getSupabaseCredentials() {
    let url = localStorage.getItem('supabase_url') || (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL) || '';
    let key = localStorage.getItem('supabase_anon_key') || (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY) || '';
    return { url: url.trim(), key: key.trim() };
}

function initSupabase(showModalIfMissing = true) {
    const { url, key } = getSupabaseCredentials();
    if (!url || !key) {
        if (showModalIfMissing) {
            showScreen('supabase-config-modal');
        }
        return false;
    }
    try {
        if (!state.supabaseClient) {
            state.supabaseClient = supabase.createClient(url, key, {
                realtime: {
                    params: {
                        eventsPerSecond: 20
                    }
                }
            });
        }
        return true;
    } catch (e) {
        console.warn("Atenție la inițializarea Supabase:", e);
        if (showModalIfMissing) {
            alert("Datele Supabase nu sunt valide. Verifică URL-ul și cheia Anon!");
            showScreen('supabase-config-modal');
        }
        return false;
    }
}

function connectToRoom(code, role) {
    state.roomCode = code.toUpperCase();
    state.role = role;

    // Afișează imediat ecranul de plasare și randează grila 8x8
    onConnectedToRoom();

    const hasSupabase = initSupabase(false);
    if (hasSupabase && state.supabaseClient) {
        // Închide canalul vechi dacă există
        if (state.channel) {
            try {
                state.supabaseClient.removeChannel(state.channel);
            } catch (err) {
                console.warn(err);
            }
        }

        const channelName = `room_${state.roomCode}`;
        state.channel = state.supabaseClient.channel(channelName, {
            config: {
                presence: { key: state.role }
            }
        });

        // 1. Monitorizare Prezență (Cine e în cameră)
        state.channel.on('presence', { event: 'sync' }, () => {
            const presenceState = state.channel.presenceState();
            const otherRole = state.role === 'host' ? 'guest' : 'host';
            const hasOpponent = Boolean(presenceState[otherRole]);

            state.opponentConnected = hasOpponent;
            updateLobbyOpponentStatus();

            if (hasOpponent && state.role === 'host' && state.phase === 'SETUP') {
                // Trimite din nou setările către guest dacă abia a intrat
                broadcastEvent('GAME_CONFIG', {
                    variant: state.planeVariant,
                    count: state.planeCount
                });
            }
        });

        // 2. Ascultare mesaje Broadcast
        state.channel.on('broadcast', { event: 'GAME_EVENT' }, ({ payload }) => {
            handleBroadcastEvent(payload);
        });

        // Abonare canal
        state.channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                try {
                    await state.channel.track({ onlineAt: new Date().toISOString() });
                } catch (e) {
                    console.warn(e);
                }
            } else if (status === 'CHANNEL_ERROR') {
                console.warn("Canalul Supabase nu a putut stabili conexiunea Realtime.");
            }
        });
    } else {
        console.log("Rulare în mod local / preview (fără conexiune activă Supabase)");
    }
}

function broadcastEvent(type, data = {}) {
    if (!state.channel) return;
    state.channel.send({
        type: 'broadcast',
        event: 'GAME_EVENT',
        payload: {
            type,
            sender: state.role,
            ...data
        }
    });
}

function handleBroadcastEvent(payload) {
    if (payload.sender === state.role) return; // Ignoră propriile mesaje

    switch (payload.type) {
        case 'GAME_CONFIG':
            if (state.role === 'guest') {
                state.planeVariant = payload.variant;
                state.planeCount = payload.count;
                updateSetupUI();
            }
            break;

        case 'PLAYER_READY':
            state.opponentReady = true;
            updateOpponentReadyIndicator();
            checkBothReadyToStart();
            break;

        case 'START_BATTLE':
            state.currentTurn = payload.startingTurn || 'host';
            startCombatPhase();
            break;

        case 'FIRE_SHOT':
            handleIncomingShot(payload.cellIndex);
            break;

        case 'SHOT_RESULT':
            handleShotResultReceived(payload);
            break;

        case 'REMATCH_OFFER':
            showRematchModal();
            break;

        case 'REMATCH_ACCEPTED':
            resetGameForRematch();
            break;
    }
}

// ==========================================
// 3. LOGICA DE REȚEA ȘI COMBAT
// ==========================================

function onConnectedToRoom() {
    showScreen('setup-screen');
    renderSetupGrid();
    updateSetupUI();

    if (state.role === 'host') {
        broadcastEvent('GAME_CONFIG', {
            variant: state.planeVariant,
            count: state.planeCount
        });
    }
}

function checkBothReadyToStart() {
    if (state.myReady && state.opponentReady) {
        if (state.role === 'host') {
            // Gazda dă startul
            broadcastEvent('START_BATTLE', { startingTurn: 'host' });
            state.currentTurn = 'host';
            startCombatPhase();
        }
    }
}

/**
 * Primește foc de la inamic și evaluează impactul pe tabla mea (Anti-Cheat)
 */
function handleIncomingShot(cellIndex) {
    const r = Math.floor(cellIndex / GRID_SIZE);
    const c = cellIndex % GRID_SIZE;

    let resultStatus = 'MISS';
    let hitPlane = null;
    let hitType = null;

    // Caută dacă celula atinge vreunul din avioanele mele
    for (const plane of state.myPlanes) {
        for (const cell of plane.cells) {
            if (cell.r === r && cell.c === c) {
                hitPlane = plane;
                hitType = cell.type;
                break;
            }
        }
        if (hitPlane) break;
    }

    let planeDownCells = null;
    let allDestroyed = false;

    if (hitPlane) {
        if (hitType === 'head') {
            // CAP NIMERIT -> Avionul este complet doborât!
            resultStatus = 'HEAD';
            hitPlane.isDown = true;
            planeDownCells = hitPlane.cells.map(cell => cell.r * GRID_SIZE + cell.c);
            
            // Verifică dacă toate avioanele sunt doborâte
            allDestroyed = state.myPlanes.every(p => p.isDown);
        } else {
            resultStatus = 'HIT';
        }
    }

    // Înregistrează lovitura pe tabla mea
    state.enemyShotsOnMe[cellIndex] = {
        status: resultStatus,
        planeId: hitPlane ? hitPlane.id : null
    };

    const coord = getCoordinateLabel(cellIndex);
    const statusLabel = resultStatus === 'HEAD' ? 'CAP DOBORÂT!' : (resultStatus === 'HIT' ? 'LOVIT!' : 'RATAT!');
    state.lastCombatMessage = `🛡️ Inamicul a tras la <b>${coord}</b>: <span style="color: ${resultStatus === 'HEAD' ? 'var(--neon-gold)' : (resultStatus === 'HIT' ? 'var(--neon-crimson)' : 'var(--text-muted)')}">${statusLabel}</span>`;

    // Trimite rezultatul înapoi trăgătorului
    broadcastEvent('SHOT_RESULT', {
        cellIndex,
        status: resultStatus,
        planeDownCells,
        allDestroyed
    });

    // Sunete și animații locale pentru apărare
    if (resultStatus === 'HEAD') {
        soundFX.playPlaneDestroyed();
        state.stats.myDownedPlanes++;
    } else if (resultStatus === 'HIT') {
        soundFX.playHit();
    } else {
        soundFX.playMiss();
    }

    renderDefenseGrid();
    updateCombatStatusUI();

    // Dacă pe telefon utilizatorul e pe tab-ul de atac, aprinde bulina de alertă pe tab-ul flotei
    const defTab = document.getElementById('tab-defense');
    const dot = document.getElementById('defense-alert-dot');
    if (dot && defTab && !defTab.classList.contains('active')) {
        dot.classList.remove('hidden');
    }

    if (allDestroyed) {
        // Am pierdut toate avioanele -> Înfrângere
        setTimeout(() => {
            endGame(false);
        }, 1200);
    } else {
        // Tura se mută la mine!
        state.currentTurn = state.role;
        updateCombatStatusUI();
    }
}

/**
 * Primește confirmarea focului tras de mine pe tabla inamicului
 */
function handleShotResultReceived(payload) {
    const { cellIndex, status, planeDownCells, allDestroyed } = payload;
    const coord = getCoordinateLabel(cellIndex);

    state.myShotsOnEnemy[cellIndex] = { status };

    if (status === 'HEAD') {
        soundFX.playPlaneDestroyed();
        state.stats.enemyDownedPlanes++;
        state.stats.myHits++;
        state.lastCombatMessage = `🎯 Ai tras la <b>${coord}</b>: <span style="color: var(--neon-gold); font-weight: bold;">CAP DOBORÂT!</span>`;

        // Marchează tot avionul doborât pe ecran
        if (planeDownCells && planeDownCells.length > 0) {
            planeDownCells.forEach(idx => {
                state.myShotsOnEnemy[idx] = { status: 'PLANE_BODY_DOWN' };
            });
            state.myShotsOnEnemy[cellIndex] = { status: 'HEAD' };
        }
    } else if (status === 'HIT') {
        soundFX.playHit();
        state.stats.myHits++;
        state.lastCombatMessage = `🔥 Ai tras la <b>${coord}</b>: <span style="color: var(--neon-crimson); font-weight: bold;">LOVIT!</span>`;
    } else {
        soundFX.playMiss();
        state.stats.myMisses++;
        state.lastCombatMessage = `🌊 Ai tras la <b>${coord}</b>: <span style="color: var(--text-muted);">RATAT ÎN APĂ</span>`;
    }

    renderAttackGrid();
    updateCombatStatusUI();

    if (allDestroyed) {
        // Am doborât toate avioanele inamice -> Victorie!
        setTimeout(() => {
            endGame(true);
        }, 1200);
    } else {
        // Tura trece la inamic
        const otherRole = state.role === 'host' ? 'guest' : 'host';
        state.currentTurn = otherRole;
        updateCombatStatusUI();
    }
}

// ==========================================
// 4. GENERARE ALEATORIE ȘI ASISTENȚĂ LA SETUP
// ==========================================

function randomizeFleet() {
    state.myPlanes = [];
    const orientations = ['N', 'S', 'E', 'W'];
    let attempts = 0;

    while (state.myPlanes.length < state.planeCount && attempts < 1000) {
        attempts++;
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * GRID_SIZE);
        const orient = orientations[Math.floor(Math.random() * orientations.length)];
        const cells = calculatePlaneCells(r, c, orient, state.planeVariant);

        if (isWithinBounds(cells) && !collidesWithExisting(cells, state.myPlanes)) {
            state.myPlanes.push({
                id: state.myPlanes.length,
                orientation: orient,
                head: { r, c },
                cells,
                isDown: false
            });
        }
    }

    soundFX.playRadarPing();
    renderSetupGrid();
    updateSetupUI();
}

// ==========================================
// 5. RANDARE INTERFAȚĂ & CONTROL ECRANE
// ==========================================

function showScreen(screenId) {
    document.querySelectorAll('.app-screen, .app-modal').forEach(el => {
        el.classList.add('hidden');
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
    }
}

function updateSetupUI() {
    const variantName = state.planeVariant === 1 ? 'Compact (8 căsuțe)' : 'Clasic (10 căsuțe)';
    document.getElementById('setup-rule-variant').textContent = variantName;
    document.getElementById('setup-rule-count').textContent = `${state.myPlanes.length} / ${state.planeCount}`;

    const readyBtn = document.getElementById('btn-ready-fleet');
    if (state.myPlanes.length === state.planeCount) {
        readyBtn.disabled = false;
        readyBtn.classList.add('pulse-ready');
    } else {
        readyBtn.disabled = true;
        readyBtn.classList.remove('pulse-ready');
    }

    updateLobbyOpponentStatus();
}

function updateLobbyOpponentStatus() {
    const oppStatus = document.getElementById('lobby-opponent-status');
    if (!oppStatus) return;

    if (state.opponentConnected) {
        oppStatus.innerHTML = `🟢 <span style="color: var(--neon-cyan)">Adversar Conectat</span> ${state.opponentReady ? '(Gata de Luptă!)' : '(Își plasează avioanele)'}`;
    } else {
        oppStatus.innerHTML = `🟡 <span style="color: var(--neon-amber)">În așteptarea adversarului...</span>`;
    }
}

function updateOpponentReadyIndicator() {
    updateLobbyOpponentStatus();
}

function renderSetupGrid() {
    const gridEl = document.getElementById('setup-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    // Cartografiază celulele ocupate
    const cellMap = {};
    state.myPlanes.forEach((plane, pIdx) => {
        plane.cells.forEach(c => {
            const idx = c.r * GRID_SIZE + c.c;
            cellMap[idx] = { type: c.type, planeIndex: pIdx };
        });
    });

    for (let i = 0; i < TOTAL_CELLS; i++) {
        const r = Math.floor(i / GRID_SIZE);
        const c = i % GRID_SIZE;
        const cellEl = document.createElement('div');
        cellEl.className = 'grid-cell';
        cellEl.dataset.index = i;
        cellEl.title = `Coordonata ${getCoordinateLabel(i)}`;

        if (cellMap[i]) {
            cellEl.classList.add('occupied', `plane-${cellMap[i].type}`);
            if (cellMap[i].type === 'head') {
                cellEl.innerHTML = `<span class="cell-head-icon">▲</span>`;
            }
        }

        // Hover preview la plasare
        cellEl.addEventListener('mouseenter', () => previewPlanePlacement(r, c));
        cellEl.addEventListener('mouseleave', clearPlanePreview);

        // Click pentru plasare sau selectare
        cellEl.addEventListener('click', () => handleSetupCellClick(r, c));

        gridEl.appendChild(cellEl);
    }
}

function previewPlanePlacement(r, c) {
    if (state.myPlanes.length >= state.planeCount) return;
    clearPlanePreview();

    const cells = calculatePlaneCells(r, c, state.selectedOrientation, state.planeVariant);
    const validBounds = isWithinBounds(cells);
    const hasCollision = collidesWithExisting(cells, state.myPlanes);

    const isValid = validBounds && !hasCollision;

    cells.forEach(cell => {
        if (cell.r >= 0 && cell.r < GRID_SIZE && cell.c >= 0 && cell.c < GRID_SIZE) {
            const idx = cell.r * GRID_SIZE + cell.c;
            const el = document.querySelector(`#setup-grid .grid-cell[data-index="${idx}"]`);
            if (el) {
                el.classList.add(isValid ? 'preview-valid' : 'preview-invalid');
            }
        }
    });
}

function clearPlanePreview() {
    document.querySelectorAll('#setup-grid .grid-cell').forEach(el => {
        el.classList.remove('preview-valid', 'preview-invalid');
    });
}

function handleSetupCellClick(r, c) {
    soundFX.playClick();

    // Verifică dacă am dat click pe un avion deja plasat pentru a-l șterge/repoziționa
    for (let i = 0; i < state.myPlanes.length; i++) {
        const plane = state.myPlanes[i];
        const isClickOnPlane = plane.cells.some(cell => cell.r === r && cell.c === c);
        if (isClickOnPlane) {
            // Elimină avionul selectat pentru a permite re-plasarea lui
            state.myPlanes.splice(i, 1);
            renderSetupGrid();
            updateSetupUI();
            return;
        }
    }

    // Încercare plasare avion nou cu capul la (r, c)
    if (state.myPlanes.length >= state.planeCount) {
        return;
    }

    const cells = calculatePlaneCells(r, c, state.selectedOrientation, state.planeVariant);
    if (!isWithinBounds(cells)) {
        return;
    }

    if (collidesWithExisting(cells, state.myPlanes)) {
        return;
    }

    state.myPlanes.push({
        id: state.myPlanes.length,
        orientation: state.selectedOrientation,
        head: { r, c },
        cells,
        isDown: false
    });

    renderSetupGrid();
    updateSetupUI();
}

function startCombatPhase() {
    state.phase = 'BATTLE';
    showScreen('combat-screen');
    renderAttackGrid();
    renderDefenseGrid();
    updateCombatStatusUI();
}

function renderAttackGrid() {
    const gridEl = document.getElementById('attack-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    const isMyTurn = state.currentTurn === state.role;

    for (let i = 0; i < TOTAL_CELLS; i++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'grid-cell attack-cell';
        cellEl.dataset.index = i;
        const coord = getCoordinateLabel(i);

        const shot = state.myShotsOnEnemy[i];
        if (shot) {
            cellEl.classList.add('cell-shot', `shot-${shot.status.toLowerCase()}`);
            if (shot.status === 'HEAD') {
                cellEl.innerHTML = '☠️';
                cellEl.title = `${coord}: CAP DOBORÂT!`;
            } else if (shot.status === 'HIT' || shot.status === 'PLANE_BODY_DOWN') {
                cellEl.innerHTML = '🔥';
                cellEl.title = `${coord}: LOVIT`;
            } else if (shot.status === 'MISS') {
                cellEl.innerHTML = '•';
                cellEl.title = `${coord}: RATAT`;
            }
        } else if (isMyTurn) {
            cellEl.title = `Trage la coordonata ${coord}`;
            cellEl.addEventListener('click', () => fireAtEnemy(i));
        } else {
            cellEl.title = `Coordonata ${coord}`;
        }

        gridEl.appendChild(cellEl);
    }
}

function renderDefenseGrid() {
    const gridEl = document.getElementById('defense-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    // Cartografiază celulele avioanelor mele
    const myCellMap = {};
    state.myPlanes.forEach(plane => {
        plane.cells.forEach(c => {
            const idx = c.r * GRID_SIZE + c.c;
            myCellMap[idx] = { type: c.type, isDown: plane.isDown };
        });
    });

    for (let i = 0; i < TOTAL_CELLS; i++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'grid-cell defense-cell';
        cellEl.dataset.index = i;
        const coord = getCoordinateLabel(i);
        cellEl.title = `Sectorul tău ${coord}`;

        if (myCellMap[i]) {
            cellEl.classList.add('my-plane-cell', `plane-${myCellMap[i].type}`);
            if (myCellMap[i].isDown) {
                cellEl.classList.add('plane-destroyed');
            }
        }

        const shot = state.enemyShotsOnMe[i];
        if (shot) {
            cellEl.classList.add('incoming-shot', `shot-${shot.status.toLowerCase()}`);
            if (shot.status === 'HEAD') {
                cellEl.innerHTML = '💥';
                cellEl.title = `${coord}: CAP DOBORÂT!`;
            } else if (shot.status === 'HIT') {
                cellEl.innerHTML = '🔥';
                cellEl.title = `${coord}: LOVIT`;
            } else if (shot.status === 'MISS') {
                cellEl.innerHTML = '•';
                cellEl.title = `${coord}: RATAT`;
            }
        }

        gridEl.appendChild(cellEl);
    }
}

function fireAtEnemy(cellIndex) {
    if (state.currentTurn !== state.role) return;
    if (state.myShotsOnEnemy[cellIndex]) return; // Deja s-a tras aici

    soundFX.playShotLaunch();

    const coord = getCoordinateLabel(cellIndex);
    state.lastCombatMessage = `🚀 Tragi către <b>${coord}</b>...`;

    // Blocăm celula local pentru a preveni double-click
    state.myShotsOnEnemy[cellIndex] = { status: 'PENDING' };
    renderAttackGrid();
    updateCombatStatusUI();

    // Transmite focul către inamic
    broadcastEvent('FIRE_SHOT', { cellIndex });
}

function updateCombatStatusUI() {
    const turnIndicator = document.getElementById('combat-turn-indicator');
    const isMyTurn = state.currentTurn === state.role;

    let turnText = isMyTurn 
        ? `🎯 <span style="color: var(--neon-cyan); font-weight: bold;">RÂNDUL TĂU! Alege o coordonată pe radar</span>`
        : `🛡️ <span style="color: var(--neon-amber)">Rândul adversarului... Se pregătește să tragă</span>`;

    if (state.lastCombatMessage) {
        turnIndicator.innerHTML = `<div>${turnText}</div><div style="font-size: 13px; margin-top: 5px; color: var(--text-muted);">${state.lastCombatMessage}</div>`;
    } else {
        turnIndicator.innerHTML = `<div>${turnText}</div>`;
    }

    // Actualizează contoarele de avioane
    document.getElementById('enemy-planes-down-count').textContent = `${state.stats.enemyDownedPlanes} / ${state.planeCount}`;
    document.getElementById('my-planes-alive-count').textContent = `${state.planeCount - state.stats.myDownedPlanes} / ${state.planeCount}`;
}

function endGame(won) {
    state.phase = 'GAMEOVER';
    showScreen('gameover-modal');

    const titleEl = document.getElementById('gameover-title');
    const msgEl = document.getElementById('gameover-message');

    if (won) {
        soundFX.playVictory();
        titleEl.textContent = '🏆 VICTORIE!';
        titleEl.style.color = 'var(--neon-gold)';
        msgEl.textContent = 'Ai doborât întreaga flotă inamică!';
    } else {
        soundFX.playDefeat();
        titleEl.textContent = '💥 ÎNFRÂNGERE';
        titleEl.style.color = 'var(--neon-crimson)';
        msgEl.textContent = 'Toate avioanele tale au fost doborâte!';
    }

    document.getElementById('stat-my-hits').textContent = state.stats.myHits;
    document.getElementById('stat-my-misses').textContent = state.stats.myMisses;
}

function showRematchModal() {
    const rematchPrompt = confirm("Adversarul cere revanșa! Dorești să jucați din nou?");
    if (rematchPrompt) {
        broadcastEvent('REMATCH_ACCEPTED');
        resetGameForRematch();
    }
}

function resetGameForRematch() {
    state.phase = 'SETUP';
    state.myReady = false;
    state.opponentReady = false;
    state.myPlanes = [];
    state.myShotsOnEnemy = {};
    state.enemyShotsOnMe = {};
    state.stats = {
        myHits: 0,
        myMisses: 0,
        enemyDownedPlanes: 0,
        myDownedPlanes: 0
    };

    showScreen('setup-screen');
    renderSetupGrid();
    updateSetupUI();
}

// ==========================================
// 6. INITIALIZARE EVENIMENTE DOM
// Gestionare PWA Install Prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

function openInstallModal() {
    showScreen('install-app-modal');
}

document.addEventListener('DOMContentLoaded', () => {
    // 0. Inițializare Temă Dark / Light (Neo-Skeuomorphism)
    const savedTheme = localStorage.getItem('app_theme') || 'dark';
    const themeBtn = document.getElementById('btn-toggle-theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeBtn) themeBtn.textContent = '☀️';
    } else {
        if (themeBtn) themeBtn.textContent = '🌙';
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            soundFX.playClick();
            const isLight = document.body.classList.toggle('light-theme');
            themeBtn.textContent = isLight ? '☀️' : '🌙';
            localStorage.setItem('app_theme', isLight ? 'light' : 'dark');
        });
    }

    // Gestionare Modal Instalare Aplicație
    const installBtn = document.getElementById('btn-open-install-modal');
    if (installBtn) {
        installBtn.addEventListener('click', () => {
            soundFX.playClick();
            openInstallModal();
        });
    }

    const closeInstallBtn = document.getElementById('btn-close-install-modal');
    if (closeInstallBtn) {
        closeInstallBtn.addEventListener('click', () => {
            soundFX.playClick();
            showScreen('menu-screen');
        });
    }

    const pwaInstallBtn = document.getElementById('btn-pwa-install');
    if (pwaInstallBtn) {
        pwaInstallBtn.addEventListener('click', async () => {
            soundFX.playClick();
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
                if (outcome === 'accepted') {
                    showScreen('menu-screen');
                }
            } else {
                alert("Pe Desktop (Chrome, Edge sau Brave): apasă pe pictograma de instalare (⊕) din dreapta barei de adrese URL pentru a descărca aplicația direct pe Desktop!");
            }
        });
    }

    // 1. Inițializare parametri URL (ex: ?room=AV88)
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
        document.getElementById('input-join-room-code').value = roomFromUrl.toUpperCase();
        // Odată trimis link-ul cu jocul, apare modalul unde jucătorul poate descărca aplicația pe desktop/telefon
        setTimeout(() => {
            openInstallModal();
        }, 500);
    }

    // 2. Pre-completare chei Supabase din localStorage sau config.js
    const creds = getSupabaseCredentials();
    if (creds.url) document.getElementById('input-supabase-url').value = creds.url;
    if (creds.key) document.getElementById('input-supabase-key').value = creds.key;

    // 3. Salvare setări Supabase
    document.getElementById('btn-save-supabase').addEventListener('click', () => {
        const url = document.getElementById('input-supabase-url').value.trim();
        const key = document.getElementById('input-supabase-key').value.trim();
        if (!url || !key) {
            alert('Te rog introdu atât URL-ul cât și Anon Key!');
            return;
        }
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_anon_key', key);
        alert('Setările Supabase au fost salvate cu succes!');
        showScreen('menu-screen');
    });

    document.getElementById('btn-open-supabase-settings').addEventListener('click', () => {
        showScreen('supabase-config-modal');
    });

    document.getElementById('btn-close-supabase-modal').addEventListener('click', () => {
        showScreen('menu-screen');
    });

    // 4. Creare Cameră (Host)
    document.getElementById('btn-create-room').addEventListener('click', () => {
        soundFX.playClick();
        const variant = parseInt(document.querySelector('input[name="plane-variant"]:checked').value);
        const count = parseInt(document.getElementById('select-plane-count').value);

        state.planeVariant = variant;
        state.planeCount = count;

        // Generare cod de cameră din 4 caractere (ex: AV88)
        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        document.getElementById('display-room-code').textContent = code;
        connectToRoom(code, 'host');
    });

    // 5. Alăturare Cameră (Guest)
    document.getElementById('btn-join-room').addEventListener('click', () => {
        soundFX.playClick();
        const codeInput = document.getElementById('input-join-room-code').value.trim().toUpperCase();
        if (codeInput.length < 3) {
            alert('Te rog introdu un cod valid de cameră!');
            return;
        }
        document.getElementById('display-room-code').textContent = codeInput;
        connectToRoom(codeInput, 'guest');
    });

    // 6. Copiere link cameră
    document.getElementById('btn-copy-room-link').addEventListener('click', () => {
        soundFX.playRadarPing();
        const link = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
        navigator.clipboard.writeText(link).then(() => {
            const btn = document.getElementById('btn-copy-room-link');
            const originalText = btn.textContent;
            btn.textContent = '✅ Link Copiat!';
            setTimeout(() => { btn.textContent = originalText; }, 2000);
        });
    });

    // 7. Schimbare variantă în ecranul gazdei -> ajustează numărul de avioane permis
    document.querySelectorAll('input[name="plane-variant"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const variant = parseInt(e.target.value);
            const selectCount = document.getElementById('select-plane-count');
            selectCount.innerHTML = '';

            if (variant === 1) {
                // Compact: 2, 3 sau 4 avioane
                [2, 3, 4].forEach(n => {
                    const opt = document.createElement('option');
                    opt.value = n;
                    opt.textContent = `${n} Avioane`;
                    if (n === 3) opt.selected = true;
                    selectCount.appendChild(opt);
                });
            } else {
                // Clasic: 1, 2 sau 3 avioane
                [1, 2, 3].forEach(n => {
                    const opt = document.createElement('option');
                    opt.value = n;
                    opt.textContent = `${n} Avioane`;
                    if (n === 3) opt.selected = true;
                    selectCount.appendChild(opt);
                });
            }
        });
    });

    // 8. Butoane de orientare în Setup (N, E, S, W)
    document.querySelectorAll('.btn-orient').forEach(btn => {
        btn.addEventListener('click', (e) => {
            soundFX.playClick();
            document.querySelectorAll('.btn-orient').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            state.selectedOrientation = e.currentTarget.dataset.orient;
        });
    });

    // 9. Buton Dispunere Aleatorie
    document.getElementById('btn-randomize-fleet').addEventListener('click', () => {
        randomizeFleet();
    });

    // 10. Buton Curățare Tablă
    document.getElementById('btn-clear-fleet').addEventListener('click', () => {
        soundFX.playClick();
        state.myPlanes = [];
        renderSetupGrid();
        updateSetupUI();
    });

    // 11. Buton Gata de Luptă (Ready)
    document.getElementById('btn-ready-fleet').addEventListener('click', () => {
        soundFX.playRadarPing();
        state.myReady = true;
        document.getElementById('btn-ready-fleet').disabled = true;
        document.getElementById('btn-ready-fleet').textContent = '✅ În Așteptarea Adversarului...';
        broadcastEvent('PLAYER_READY');
        checkBothReadyToStart();
    });

    // 12. Comutator Tab-uri pe mobil în timpul luptei (Radar Atac vs Flota Mea)
    document.getElementById('tab-attack').addEventListener('click', () => {
        soundFX.playClick();
        document.getElementById('tab-attack').classList.add('active');
        document.getElementById('tab-defense').classList.remove('active');
        document.getElementById('board-attack-container').classList.remove('hidden-mobile');
        document.getElementById('board-defense-container').classList.add('hidden-mobile');
    });

    document.getElementById('tab-defense').addEventListener('click', () => {
        soundFX.playClick();
        document.getElementById('tab-defense').classList.add('active');
        document.getElementById('tab-attack').classList.remove('active');
        document.getElementById('board-defense-container').classList.remove('hidden-mobile');
        document.getElementById('board-attack-container').classList.add('hidden-mobile');
        const dot = document.getElementById('defense-alert-dot');
        if (dot) dot.classList.add('hidden');
    });

    // 13. Butoane Meci Încheiat (Revanșă & Ieșire)
    document.getElementById('btn-request-rematch').addEventListener('click', () => {
        soundFX.playClick();
        document.getElementById('btn-request-rematch').textContent = '⏳ Cerere Trimisă...';
        document.getElementById('btn-request-rematch').disabled = true;
        broadcastEvent('REMATCH_OFFER');
    });

    document.getElementById('btn-exit-to-menu').addEventListener('click', () => {
        window.location.href = window.location.pathname;
    });

    // 14. Buton Sunet Mute/Unmute
    const soundBtn = document.getElementById('btn-toggle-sound');
    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            const isMuted = soundFX.toggleMute();
            soundBtn.textContent = isMuted ? '🔇' : '🔊';
        });
        if (soundFX.muted) {
            soundBtn.textContent = '🔇';
        }
    }
});
