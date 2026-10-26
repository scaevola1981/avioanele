/**
 * game.js - Logica completă pentru Jocul de Avioane 8x8
 * Multiplayer Online P2P WebRTC prin PeerJS (fără conturi sau baze de date)
 * Cu persistență de sesiune automată (ține minte meciul neterminat)
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

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// Starea globală a jocului
const state = {
    peer: null,
    activeConn: null,
    isReconnecting: false,
    roomCode: '',
    role: null, // 'host' | 'guest'
    playerName: localStorage.getItem('pilot_name') || 'Comandant',
    opponentName: 'Adversar',
    opponentConnected: false,
    opponentReady: false,
    myReady: false,
    
    // Reguli joc
    planeVariant: 1, // 1: Compact (8 căsuțe), 2: Clasic (10 căsuțe)
    planeCount: 3,   // V1: 2-4, V2: 1-3
    
    // Faza curentă
    phase: 'MENU', // 'MENU' | 'SETUP' | 'BATTLE' | 'GAMEOVER'
    
    // Plasare interactivă cu contur hașurat (fără butoane statice N/E/S/V)
    myPlanes: [], // Array de obiecte plane: { id, orientation, head: {r,c}, cells: [{r,c,type}], isDown: false }
    previewHead: null, // { r, c } capul selectat
    previewValidOrientations: [], // ['N', 'S', etc.] orientări care încap pe tablă
    activePlaneIndex: null,   // Pentru re-editare/ștergere

    // Piloți recenți & Provocări
    recentOpponents: JSON.parse(localStorage.getItem('avioane_recent_opponents') || '[]'),
    pilotPeer: null,
    pendingChallengeRoom: '',
    
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
// 2. WEBRTC P2P (PEERJS) & PERSISTENȚĂ SESIUNE
// Fără servere, fără conturi, direct între telefoane!
// ==========================================

const SESSION_STORAGE_KEY = 'avioane_active_session';

function saveMatchSession() {
    if (state.phase === 'MENU' || state.phase === 'GAMEOVER') {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
    }
    const session = {
        roomCode: state.roomCode,
        role: state.role,
        playerName: state.playerName,
        opponentName: state.opponentName,
        phase: state.phase,
        planeVariant: state.planeVariant,
        planeCount: state.planeCount,
        myPlanes: state.myPlanes,
        myReady: state.myReady,
        opponentReady: state.opponentReady,
        currentTurn: state.currentTurn,
        myShotsOnEnemy: state.myShotsOnEnemy,
        enemyShotsOnMe: state.enemyShotsOnMe,
        lastCombatMessage: state.lastCombatMessage,
        stats: state.stats,
        timestamp: Date.now()
    };
    try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
        console.warn("Eroare salvare sesiune:", e);
    }
}

function clearMatchSession() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
}

function getActiveSession() {
    try {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw);
        // Validă timp de 12 ore
        if (Date.now() - session.timestamp < 12 * 60 * 60 * 1000) {
            return session;
        }
    } catch (e) {
        console.warn(e);
    }
    return null;
}

function resumeMatch(session) {
    if (!session) return;
    state.roomCode = session.roomCode;
    state.role = session.role;
    state.playerName = session.playerName || state.playerName;
    state.opponentName = session.opponentName || 'Adversar';
    state.planeVariant = session.planeVariant;
    state.planeCount = session.planeCount;
    state.myPlanes = session.myPlanes || [];
    state.myReady = session.myReady || false;
    state.opponentReady = session.opponentReady || false;
    state.currentTurn = session.currentTurn || 'host';
    state.myShotsOnEnemy = session.myShotsOnEnemy || {};
    state.enemyShotsOnMe = session.enemyShotsOnMe || {};
    state.lastCombatMessage = session.lastCombatMessage || '';
    state.stats = session.stats || state.stats;
    state.phase = session.phase;

    const displayCode = document.getElementById('display-room-code');
    if (displayCode) displayCode.textContent = session.roomCode;
    updatePlayerNamesUI();

    if (session.phase === 'BATTLE') {
        showScreen('combat-screen');
        renderAttackGrid();
        renderDefenseGrid();
        updateCombatStatusUI();
    } else {
        showScreen('setup-screen');
        renderSetupGrid();
        updateSetupUI();
        if (state.myReady) {
            const readyBtn = document.getElementById('btn-ready-fleet');
            if (readyBtn) {
                readyBtn.disabled = true;
                readyBtn.textContent = '✅ În Așteptarea Adversarului...';
            }
        }
    }

    // Reia conexiunea WebRTC P2P direct cu adversarul
    connectToRoom(session.roomCode, session.role, true);
}

const PEER_CONFIG = {
    debug: 1,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ]
    }
};

function getHostPeerId(roomCode) {
    return `av88-${roomCode.trim().toLowerCase()}-host`;
}

function connectToRoom(code, role, isResuming = false) {
    state.roomCode = code.toUpperCase();
    state.role = role;
    state.isReconnecting = isResuming;

    if (!isResuming) {
        onConnectedToRoom();
    }
    saveMatchSession();

    if (state.activeConn) {
        try { state.activeConn.close(); } catch (e) {}
        state.activeConn = null;
    }
    if (state.peer) {
        try { state.peer.destroy(); } catch (e) {}
        state.peer = null;
    }

    const hostId = getHostPeerId(state.roomCode);

    if (role === 'host') {
        state.peer = new Peer(hostId, PEER_CONFIG);

        state.peer.on('open', (id) => {
            console.log('Peer Host activat cu ID:', id);
            hideReconnectBanner();
            updateLobbyOpponentStatus();
        });

        state.peer.on('connection', (conn) => {
            console.log('Client nou conectat la Host:', conn.peer);
            setupConnection(conn);
        });

        state.peer.on('error', (err) => {
            console.warn('Eroare Peer Host:', err);
            if (err.type === 'unavailable-id') {
                setTimeout(() => {
                    if (state.role === 'host') {
                        connectToRoom(code, role, true);
                    }
                }, 1200);
            } else if (err.type === 'disconnected' || err.type === 'network') {
                showReconnectBanner();
            }
        });

        state.peer.on('disconnected', () => {
            showReconnectBanner();
            if (state.peer && !state.peer.destroyed) {
                state.peer.reconnect();
            }
        });

    } else {
        const guestId = `av88-${state.roomCode.toLowerCase()}-g-${Date.now().toString(36)}`;
        state.peer = new Peer(guestId, PEER_CONFIG);

        state.peer.on('open', (id) => {
            console.log('Peer Guest activat:', id, 'conectare la Host:', hostId);
            const conn = state.peer.connect(hostId, {
                reliable: true
            });
            setupConnection(conn);
        });

        state.peer.on('error', (err) => {
            console.warn('Eroare Peer Guest:', err);
            if (err.type === 'peer-unavailable') {
                const oppStatus = document.getElementById('lobby-opponent-status');
                if (oppStatus) {
                    oppStatus.innerHTML = `⚠️ <span style="color: var(--neon-crimson)">Camera <b>${state.roomCode}</b> nu a fost găsită sau gazda nu este online!</span>`;
                }
            } else if (err.type === 'disconnected' || err.type === 'network') {
                showReconnectBanner();
            }
        });

        state.peer.on('disconnected', () => {
            showReconnectBanner();
            if (state.peer && !state.peer.destroyed) {
                state.peer.reconnect();
            }
        });
    }
}

function setupConnection(conn) {
    state.activeConn = conn;

    const handleOpen = () => {
        console.log('Conexiune WebRTC P2P Deschisă cu succes!');
        state.opponentConnected = true;
        hideReconnectBanner();
        updateLobbyOpponentStatus();
        updatePlayerNamesUI();

        if (state.role === 'host') {
            broadcastEvent('PLAYER_HELLO', {
                playerName: state.playerName,
                role: 'host',
                variant: state.planeVariant,
                count: state.planeCount
            });

            if (state.myReady) {
                broadcastEvent('PLAYER_READY', { playerName: state.playerName });
            }

            // Dacă meciul era în desfășurare, trimite starea completă celuilalt telefon
            if (state.phase === 'BATTLE') {
                broadcastEvent('SYNC_BATTLE_STATE', {
                    currentTurn: state.currentTurn,
                    hostShotsOnGuest: state.myShotsOnEnemy,
                    guestShotsOnHost: state.enemyShotsOnMe,
                    hostStats: state.stats,
                    planeCount: state.planeCount,
                    variant: state.planeVariant,
                    hostName: state.playerName,
                    guestName: state.opponentName
                });
            }
        } else {
            broadcastEvent('PLAYER_HELLO', {
                playerName: state.playerName,
                role: 'guest'
            });
            if (state.myReady) {
                broadcastEvent('PLAYER_READY', { playerName: state.playerName });
            }
            if (state.phase === 'BATTLE') {
                broadcastEvent('REQUEST_BATTLE_SYNC');
            }
        }
    };

    if (conn.open) {
        handleOpen();
    } else {
        conn.on('open', handleOpen);
    }

    conn.on('data', (data) => {
        handleBroadcastEvent(data);
    });

    conn.on('close', () => {
        console.log('Conexiunea WebRTC cu adversarul s-a întrerupt');
        state.opponentConnected = false;
        updateLobbyOpponentStatus();
        if (state.phase === 'BATTLE') {
            showReconnectBanner();
        }
    });

    conn.on('error', (err) => {
        console.warn('Eroare conexiune P2P:', err);
    });
}

function broadcastEvent(type, data = {}) {
    if (!state.activeConn || !state.activeConn.open) {
        console.warn('WebRTC nu este conectat pentru a trimite:', type);
        return;
    }
    try {
        state.activeConn.send({
            type,
            sender: state.role,
            ...data
        });
    } catch (e) {
        console.warn("Eroare la trimiterea mesajului P2P:", e);
    }
}

function handleBroadcastEvent(payload) {
    if (!payload || !payload.type) return;

    switch (payload.type) {
        case 'PLAYER_HELLO':
            if (payload.playerName) {
                state.opponentName = payload.playerName;
                recordRecentOpponent(payload.playerName);
            }
            if (payload.variant && payload.count && state.role === 'guest') {
                state.planeVariant = payload.variant;
                state.planeCount = payload.count;
                updateSetupUI();
            }
            state.opponentConnected = true;
            updatePlayerNamesUI();
            updateLobbyOpponentStatus();
            saveMatchSession();

            if (payload.role !== state.role && state.role === 'guest') {
                broadcastEvent('PLAYER_HELLO_ACK', {
                    playerName: state.playerName,
                    role: state.role
                });
            }
            if (state.myReady) {
                broadcastEvent('PLAYER_READY', { playerName: state.playerName });
            }
            if (state.role === 'host' && state.phase === 'BATTLE') {
                broadcastEvent('SYNC_BATTLE_STATE', {
                    currentTurn: state.currentTurn,
                    hostShotsOnGuest: state.myShotsOnEnemy,
                    guestShotsOnHost: state.enemyShotsOnMe,
                    hostStats: state.stats,
                    planeCount: state.planeCount,
                    variant: state.planeVariant,
                    hostName: state.playerName,
                    guestName: state.opponentName
                });
            }
            break;

        case 'PLAYER_HELLO_ACK':
            if (payload.playerName) {
                state.opponentName = payload.playerName;
                recordRecentOpponent(payload.playerName);
            }
            state.opponentConnected = true;
            updatePlayerNamesUI();
            updateLobbyOpponentStatus();
            saveMatchSession();
            if (state.myReady) {
                broadcastEvent('PLAYER_READY', { playerName: state.playerName });
            }
            break;

        case 'GAME_CONFIG':
            if (state.role === 'guest') {
                state.planeVariant = payload.variant;
                state.planeCount = payload.count;
                if (payload.hostName) {
                    state.opponentName = payload.hostName;
                }
                updatePlayerNamesUI();
                updateLobbyOpponentStatus();
                updateSetupUI();
                saveMatchSession();
            }
            break;

        case 'PLAYER_READY':
            state.opponentReady = true;
            if (payload.playerName) {
                state.opponentName = payload.playerName;
            }
            updatePlayerNamesUI();
            updateOpponentReadyIndicator();
            saveMatchSession();
            checkBothReadyToStart();
            break;

        case 'START_BATTLE':
            state.currentTurn = payload.startingTurn || 'host';
            saveMatchSession();
            startCombatPhase();
            break;

        case 'FIRE_SHOT':
            handleIncomingShot(payload.cellIndex);
            break;

        case 'SHOT_RESULT':
            handleShotResultReceived(payload);
            break;

        case 'SYNC_BATTLE_STATE':
            handleSyncBattleState(payload);
            break;

        case 'REQUEST_BATTLE_SYNC':
            if (state.role === 'host' && state.phase === 'BATTLE') {
                broadcastEvent('SYNC_BATTLE_STATE', {
                    currentTurn: state.currentTurn,
                    hostShotsOnGuest: state.myShotsOnEnemy,
                    guestShotsOnHost: state.enemyShotsOnMe,
                    hostStats: state.stats,
                    planeCount: state.planeCount,
                    variant: state.planeVariant,
                    hostName: state.playerName,
                    guestName: state.opponentName
                });
            }
            break;

        case 'REMATCH_OFFER':
            showRematchModal();
            break;

        case 'REMATCH_ACCEPTED':
            resetGameForRematch();
            break;
    }
}

function handleSyncBattleState(payload) {
    if (!payload) return;
    if (state.role === 'guest') {
        state.currentTurn = payload.currentTurn;
        if (payload.hostShotsOnGuest) state.enemyShotsOnMe = payload.hostShotsOnGuest;
        if (payload.guestShotsOnHost) state.myShotsOnEnemy = payload.guestShotsOnHost;
        if (payload.hostName) state.opponentName = payload.hostName;
    } else {
        state.currentTurn = payload.currentTurn;
    }
    hideReconnectBanner();
    renderAttackGrid();
    renderDefenseGrid();
    updateCombatStatusUI();
    saveMatchSession();
}

function showReconnectBanner() {
    const banner = document.getElementById('reconnect-banner');
    if (banner && state.phase === 'BATTLE') {
        banner.classList.remove('hidden');
    }
}

function hideReconnectBanner() {
    const banner = document.getElementById('reconnect-banner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

// ==========================================
// 3. LOGICA DE REȚEA ȘI COMBAT
// ==========================================

function onConnectedToRoom() {
    state.phase = 'SETUP';
    showScreen('setup-screen');
    renderSetupGrid();
    updatePlayerNamesUI();
    updateSetupUI();
    saveMatchSession();

    if (state.role === 'host') {
        broadcastEvent('GAME_CONFIG', {
            variant: state.planeVariant,
            count: state.planeCount,
            hostName: state.playerName
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
    saveMatchSession();
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
    saveMatchSession();
}

// ==========================================
// 4. GENERARE ALEATORIE ȘI ASISTENȚĂ LA SETUP
// ==========================================

function randomizeFleet() {
    state.previewHead = null;
    state.previewValidOrientations = [];
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
    saveMatchSession();
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

function updatePlayerNamesUI() {
    const myName = state.playerName || (state.role === 'host' ? 'Comandant' : 'Pilot');
    const oppName = state.opponentName && state.opponentName !== 'Adversar' ? state.opponentName : 'Se așteaptă...';

    const mySetupDisplay = document.getElementById('setup-my-name-display');
    const oppSetupDisplay = document.getElementById('setup-opp-name-display');
    const combatOpp = document.getElementById('combat-opp-name');
    const combatMy = document.getElementById('combat-my-name');

    if (mySetupDisplay) mySetupDisplay.textContent = myName;
    if (oppSetupDisplay) oppSetupDisplay.textContent = oppName;
    if (combatOpp) combatOpp.textContent = (state.opponentName || 'INAMIC').toUpperCase();
    if (combatMy) combatMy.textContent = myName.toUpperCase();
}

function updateSetupUI() {
    const variantName = state.planeVariant === 1 ? 'Compact (8 căsuțe)' : 'Clasic (10 căsuțe)';
    const variantEl = document.getElementById('setup-rule-variant');
    if (variantEl) variantEl.textContent = variantName;

    const countEl = document.getElementById('setup-rule-count');
    if (countEl) countEl.textContent = `${state.myPlanes.length} / ${state.planeCount}`;

    const readyBtn = document.getElementById('btn-ready-fleet');
    if (readyBtn) {
        if (state.myPlanes.length === state.planeCount) {
            readyBtn.disabled = false;
            readyBtn.classList.add('pulse-ready');
        } else {
            readyBtn.disabled = true;
            readyBtn.classList.remove('pulse-ready');
        }
    }

    // Actualizare ghid și bare de direcții interactive (Point 1)
    const pillsBar = document.getElementById('placement-orientation-bar');
    const pillsContainer = document.getElementById('direction-pills-container');
    const hintEl = document.getElementById('setup-instruction-hint');

    if (pillsBar && pillsContainer) {
        if (state.previewHead && state.previewValidOrientations.length > 0) {
            pillsContainer.innerHTML = '';
            const labels = {
                'N': '▲ NORD',
                'S': '▼ SUD',
                'E': '▶ EST',
                'W': '◀ VEST'
            };
            state.previewValidOrientations.forEach(orient => {
                const btn = document.createElement('button');
                btn.className = `btn-direction-pill pill-${orient}`;
                btn.innerHTML = labels[orient] || orient;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    soundFX.playClick();
                    placePlane(state.previewHead.r, state.previewHead.c, orient);
                });
                pillsContainer.appendChild(btn);
            });
            pillsBar.classList.remove('hidden');
            if (hintEl) hintEl.textContent = '👆 Apasă pe un contur hașurat de pe radar sau alege direcția de mai jos';
        } else {
            pillsBar.classList.add('hidden');
            if (hintEl) {
                hintEl.textContent = state.myPlanes.length === state.planeCount
                    ? '✅ Toate avioanele sunt așezate! Apasă GATA DE LUPTĂ.'
                    : `👆 Atinge o căsuță pentru Capul avionului (${state.myPlanes.length + 1} din ${state.planeCount})`;
            }
        }
    }

    updatePlayerNamesUI();
    updateLobbyOpponentStatus();
    renderRecentOpponentsUI();
}

function updateLobbyOpponentStatus() {
    const oppStatus = document.getElementById('lobby-opponent-status');
    if (!oppStatus) return;

    const oppName = state.opponentName && state.opponentName !== 'Adversar' ? state.opponentName : 'Adversarul';

    if (state.opponentConnected) {
        oppStatus.innerHTML = `🟢 <span style="color: var(--neon-cyan)"><b>${oppName}</b> s-a conectat!</span> ${state.opponentReady ? '<b>(Gata de Luptă! ✈️)</b>' : '(Își plasează avioanele...)'}`;
    } else {
        oppStatus.innerHTML = `🟡 <span style="color: var(--neon-amber)">În așteptarea adversarului... Trimite invitația!</span>`;
    }
}

function updateOpponentReadyIndicator() {
    updatePlayerNamesUI();
    updateLobbyOpponentStatus();
}

function renderSetupGrid() {
    const gridEl = document.getElementById('setup-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    // 1. Cartografiază celulele avioanelor deja așezate (cu culori distincte 0..3)
    const cellMap = {};
    state.myPlanes.forEach((plane, pIdx) => {
        plane.cells.forEach(c => {
            const idx = c.r * GRID_SIZE + c.c;
            cellMap[idx] = { type: c.type, planeIndex: pIdx };
        });
    });

    // 2. Cartografiază contururile hașurate pentru capul activ selectat (Point 1)
    const previewCellMap = {};
    if (state.previewHead && state.previewValidOrientations.length > 0) {
        state.previewValidOrientations.forEach(orient => {
            const cells = calculatePlaneCells(state.previewHead.r, state.previewHead.c, orient, state.planeVariant);
            cells.forEach(c => {
                if (c.r >= 0 && c.r < GRID_SIZE && c.c >= 0 && c.c < GRID_SIZE) {
                    const idx = c.r * GRID_SIZE + c.c;
                    if (!previewCellMap[idx]) previewCellMap[idx] = [];
                    previewCellMap[idx].push({ orient, type: c.type });
                }
            });
        });
    }

    for (let i = 0; i < TOTAL_CELLS; i++) {
        const r = Math.floor(i / GRID_SIZE);
        const c = i % GRID_SIZE;
        const cellEl = document.createElement('div');
        cellEl.className = 'grid-cell';
        cellEl.dataset.index = i;
        cellEl.dataset.r = r;
        cellEl.dataset.c = c;
        const coord = getCoordinateLabel(i);

        if (cellMap[i]) {
            // Avion plasat - culoare distinctă conform Point 2
            const pIdx = cellMap[i].planeIndex;
            cellEl.classList.add('occupied', `plane-${cellMap[i].type}`, `plane-color-${pIdx}`);
            if (cellMap[i].type === 'head') {
                cellEl.innerHTML = `<span class="cell-head-icon">✈️</span>`;
            }
            cellEl.title = `Avionul ${pIdx + 1} (${coord}) - Apasă pentru a-l șterge/repoziționa`;
        } else if (state.previewHead && state.previewHead.r === r && state.previewHead.c === c) {
            // Capul activ selectat
            cellEl.classList.add('active-head-selected');
            cellEl.innerHTML = '🎯';
            cellEl.title = `Cap selectat la ${coord}. Apasă pe un contur hașurat sau altă căsuță.`;
        } else if (previewCellMap[i]) {
            // Căsuță aparținând conturului hașurat
            const previewInfo = previewCellMap[i][0];
            cellEl.classList.add('preview-contour', `preview-orient-${previewInfo.orient}`);
            cellEl.dataset.orient = previewInfo.orient;

            const arrowMap = { 'N': '▲', 'S': '▼', 'E': '▶', 'W': '◀' };
            if (previewInfo.type === 'tail') {
                cellEl.innerHTML = `<span class="preview-badge-orient">${arrowMap[previewInfo.orient] || ''}</span>`;
            }
            cellEl.title = `Apasă pentru a confirma avionul orientat spre ${previewInfo.orient}`;
        } else {
            cellEl.title = `Coordonata ${coord} - Apasă pentru a alege Capul avionului`;
        }

        // Click pentru plasare sau selectare contur
        cellEl.addEventListener('click', () => handleSetupCellClick(r, c));

        gridEl.appendChild(cellEl);
    }
}

function handleSetupCellClick(r, c) {
    soundFX.playClick();

    // 1. Verifică dacă am dat click pe un avion deja plasat pentru a-l șterge/repoziționa
    for (let i = 0; i < state.myPlanes.length; i++) {
        const plane = state.myPlanes[i];
        const isClickOnPlane = plane.cells.some(cell => cell.r === r && cell.c === c);
        if (isClickOnPlane) {
            state.myPlanes.splice(i, 1);
            state.previewHead = null;
            state.previewValidOrientations = [];
            renderSetupGrid();
            updateSetupUI();
            saveMatchSession();
            return;
        }
    }

    // 2. Dacă avem deja un cap selectat și utilizatorul dă click pe unul din contururile hașurate
    if (state.previewHead) {
        // Dacă dă click din nou pe același cap -> anulează previzualizarea
        if (state.previewHead.r === r && state.previewHead.c === c) {
            state.previewHead = null;
            state.previewValidOrientations = [];
            renderSetupGrid();
            updateSetupUI();
            return;
        }

        // Verifică dacă căsuța (r, c) aparține vreunei orientări valide din preview
        for (const orient of state.previewValidOrientations) {
            const cells = calculatePlaneCells(state.previewHead.r, state.previewHead.c, orient, state.planeVariant);
            const matchesOrient = cells.some(cell => cell.r === r && cell.c === c);
            if (matchesOrient) {
                // Confirmă imediat așezarea avionului pe acel contur! (Point 1)
                placePlane(state.previewHead.r, state.previewHead.c, orient);
                return;
            }
        }
    }

    // 3. Verifică dacă flota este deja completă
    if (state.myPlanes.length >= state.planeCount) {
        return;
    }

    // 4. Utilizatorul a ales un nou cap de avion la (r, c) -> calculează automat orientările valide
    const validOrientations = [];
    for (const orient of ['N', 'E', 'S', 'W']) {
        const cells = calculatePlaneCells(r, c, orient, state.planeVariant);
        if (isWithinBounds(cells) && !collidesWithExisting(cells, state.myPlanes)) {
            validOrientations.push(orient);
        }
    }

    if (validOrientations.length === 0) {
        soundFX.playMiss();
        state.previewHead = null;
        state.previewValidOrientations = [];
        renderSetupGrid();
        updateSetupUI();
        return;
    }

    // Activează previzualizarea contururilor hașurate pe tablă
    state.previewHead = { r, c };
    state.previewValidOrientations = validOrientations;
    renderSetupGrid();
    updateSetupUI();
}

function placePlane(headR, headC, orient) {
    const cells = calculatePlaneCells(headR, headC, orient, state.planeVariant);
    if (!isWithinBounds(cells) || collidesWithExisting(cells, state.myPlanes)) {
        return;
    }

    state.myPlanes.push({
        id: state.myPlanes.length,
        orientation: orient,
        head: { r: headR, c: headC },
        cells,
        isDown: false
    });

    state.previewHead = null;
    state.previewValidOrientations = [];
    soundFX.playRadarPing();
    renderSetupGrid();
    updateSetupUI();
    saveMatchSession();
}

function startCombatPhase() {
    state.phase = 'BATTLE';
    showScreen('combat-screen');
    renderAttackGrid();
    renderDefenseGrid();
    updateCombatStatusUI();
    saveMatchSession();
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

    // Cartografiază celulele avioanelor mele cu culorile lor distincte
    const myCellMap = {};
    state.myPlanes.forEach((plane, pIdx) => {
        plane.cells.forEach(c => {
            const idx = c.r * GRID_SIZE + c.c;
            myCellMap[idx] = { type: c.type, isDown: plane.isDown, planeIndex: pIdx };
        });
    });

    for (let i = 0; i < TOTAL_CELLS; i++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'grid-cell defense-cell';
        cellEl.dataset.index = i;
        const coord = getCoordinateLabel(i);
        cellEl.title = `Sectorul tău ${coord}`;

        if (myCellMap[i]) {
            cellEl.classList.add('my-plane-cell', `plane-${myCellMap[i].type}`, `plane-color-${myCellMap[i].planeIndex}`);
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
    saveMatchSession();

    // Transmite focul către inamic
    broadcastEvent('FIRE_SHOT', { cellIndex });
}

function updateCombatStatusUI() {
    const turnIndicator = document.getElementById('combat-turn-indicator');
    const isMyTurn = state.currentTurn === state.role;
    const myName = state.playerName || 'Tu';
    const oppName = state.opponentName && state.opponentName !== 'Adversar' ? state.opponentName : 'Adversarul';

    updatePlayerNamesUI();

    let turnText = isMyTurn 
        ? `🎯 <span style="color: var(--neon-cyan); font-weight: bold;">RÂNDUL TĂU (${myName})! Alege o coordonată pe radar</span>`
        : `🛡️ <span style="color: var(--neon-amber)">Rândul lui ${oppName}... Se pregătește să tragă</span>`;

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
    clearMatchSession();
    showScreen('gameover-modal');

    const titleEl = document.getElementById('gameover-title');
    const msgEl = document.getElementById('gameover-message');
    const myName = state.playerName || 'Pilot';
    const oppName = state.opponentName && state.opponentName !== 'Adversar' ? state.opponentName : 'inamică';

    if (won) {
        soundFX.playVictory();
        titleEl.textContent = `🏆 VICTORIE, ${myName}!`;
        titleEl.style.color = 'var(--neon-gold)';
        msgEl.textContent = `Ai doborât întreaga flotă a lui ${oppName}!`;
    } else {
        soundFX.playDefeat();
        titleEl.textContent = '💥 ÎNFRÂNGERE';
        titleEl.style.color = 'var(--neon-crimson)';
        msgEl.textContent = `${oppName} a doborât toate avioanele tale!`;
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
    state.previewHead = null;
    state.previewValidOrientations = [];
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
// 5.1 OPONENTI RECENTI & INVITATII IN-APP (P2P CHALLENGE)
// ==========================================

function getRecentOpponents() {
    try {
        const raw = localStorage.getItem('recent_opponents');
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function recordRecentOpponent(name) {
    if (!name || name === 'Adversar' || name === state.playerName) return;
    try {
        let list = getRecentOpponents();
        list = list.filter(item => item.name && item.name.toLowerCase() !== name.toLowerCase());
        list.unshift({ name: name, date: Date.now() });
        if (list.length > 8) list = list.slice(0, 8);
        localStorage.setItem('recent_opponents', JSON.stringify(list));
        state.recentOpponents = list;
        renderRecentOpponentsUI();
    } catch (e) {
        console.warn('Eroare salvare adversar recent:', e);
    }
}

function renderRecentOpponentsUI() {
    const list = getRecentOpponents();
    state.recentOpponents = list;

    // 1. Meniu principal
    const menuListEl = document.getElementById('recent-opponents-list');
    if (menuListEl) {
        menuListEl.innerHTML = '';
        if (list.length === 0) {
            menuListEl.innerHTML = '<p class="empty-recent-text">Nu ai încă adversari înregistrați. Creează o cameră și luptă cu un prieten!</p>';
        } else {
            list.forEach(item => {
                const row = document.createElement('div');
                row.className = 'recent-pilot-row';
                row.innerHTML = `
                    <div class="pilot-info">
                        <span class="pilot-avatar">👨‍✈️</span>
                        <span class="pilot-name">${item.name}</span>
                    </div>
                    <button class="btn-neo btn-small btn-invite-recent" data-pilot="${item.name}">⚔️ INVITĂ</button>
                `;
                menuListEl.appendChild(row);
            });

            menuListEl.querySelectorAll('.btn-invite-recent').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const pilotName = e.currentTarget.dataset.pilot;
                    createRoomAndInvite(pilotName);
                });
            });
        }
    }

    // 2. Setup Screen
    const setupBox = document.getElementById('setup-recent-invite-box');
    const setupChipsEl = document.getElementById('setup-recent-opponents-pills');
    if (setupChipsEl && setupBox) {
        setupChipsEl.innerHTML = '';
        if (list.length === 0) {
            setupBox.classList.add('hidden');
        } else {
            setupBox.classList.remove('hidden');
            list.slice(0, 4).forEach(item => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'quick-pilot-chip';
                chip.dataset.pilot = item.name;
                chip.textContent = `⚔️ ${item.name}`;
                chip.addEventListener('click', () => {
                    inviteSpecificPilot(item.name);
                });
                setupChipsEl.appendChild(chip);
            });
        }
    }
}

function createRoomAndInvite(pilotName) {
    soundFX.playClick();
    const pilotInput = document.getElementById('input-pilot-name');
    const nameVal = pilotInput ? pilotInput.value.trim() : '';
    const finalName = nameVal || ('Comandant ' + Math.floor(100 + Math.random() * 900));
    state.playerName = finalName;
    localStorage.setItem('pilot_name', finalName);

    const variantRadio = document.querySelector('input[name="plane-variant"]:checked');
    const variant = variantRadio ? parseInt(variantRadio.value) : 1;
    const countSelect = document.getElementById('select-plane-count');
    const count = countSelect ? parseInt(countSelect.value) : 3;

    state.planeVariant = variant;
    state.planeCount = count;

    // Generare cod de cameră
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    document.getElementById('display-room-code').textContent = code;
    connectToRoom(code, 'host');

    // După conectare trimite invitația
    setTimeout(() => {
        inviteSpecificPilot(pilotName);
    }, 600);
}

function inviteSpecificPilot(pilotName) {
    soundFX.playRadarPing();
    sendInAppInvite(pilotName, state.roomCode);
    shareRoomInvite(pilotName);
}

function shareRoomInvite(pilotName) {
    const roomCode = state.roomCode || document.getElementById('display-room-code').textContent || '';
    const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://scaevola1981.github.io';
    const pathname = window.location.pathname || '/avioanele/';
    const shareUrl = `${origin}${pathname}?room=${roomCode}`;
    const targetGreeting = pilotName ? `Salut ${pilotName}!` : 'Salut!';
    const shareTitle = '⚔️ Jocul de Avioane 8x8 - Luptă cu mine!';
    const shareText = `${targetGreeting} Te provoc la o luptă în Jocul de Avioane 8x8! Intră aici sau folosește codul ${roomCode}:\n${shareUrl}`;

    if (navigator.share) {
        navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
        }).catch(err => {
            console.log('Share dismissed or failed:', err);
        });
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => {
            alert(`✅ Invitația a fost copiată în clipboard!\n\nTrimite-o prin WhatsApp sau SMS către ${pilotName || 'adversar'}:\n\nCod cameră: ${roomCode}\n${shareUrl}`);
        }).catch(() => {
            prompt('Copiază textul invitației pentru a-l trimite prin WhatsApp:', shareText);
        });
    } else {
        prompt('Copiază textul invitației:', shareText);
    }
}

// Semnalizare de fond P2P pentru notificări In-App între piloți
function initPilotSignaling(pilotName) {
    if (!pilotName) return;
    const clean = pilotName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length < 2) return;
    const pilotPeerId = 'av88-pilot-' + clean;

    if (state.pilotPeer && state.pilotPeer.id === pilotPeerId && !state.pilotPeer.destroyed) {
        return; // Deja activ
    }

    if (state.pilotPeer && !state.pilotPeer.destroyed) {
        try { state.pilotPeer.destroy(); } catch (e) {}
    }

    try {
        state.pilotPeer = new Peer(pilotPeerId, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        state.pilotPeer.on('open', (id) => {
            console.log('📡 Pilot P2P Beacon activat pentru:', id);
        });

        state.pilotPeer.on('connection', (conn) => {
            conn.on('data', (data) => {
                if (data && data.type === 'GAME_CHALLENGE') {
                    handleIncomingChallenge(data);
                }
            });
        });

        state.pilotPeer.on('error', (err) => {
            // Nu blocăm jocul dacă ID-ul este temporar ocupat în alt tab
            console.warn('Pilot beacon notice:', err.type);
        });
    } catch (e) {
        console.warn('Eroare inițializare pilot peer:', e);
    }
}

function sendInAppInvite(targetPilotName, roomCode) {
    if (!targetPilotName || !roomCode) return;
    const cleanTarget = targetPilotName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanTarget.length < 2) return;
    const targetPeerId = 'av88-pilot-' + cleanTarget;

    try {
        const callerPeer = state.pilotPeer || state.peer;
        if (!callerPeer || callerPeer.destroyed) return;

        const challengeConn = callerPeer.connect(targetPeerId);
        challengeConn.on('open', () => {
            challengeConn.send({
                type: 'GAME_CHALLENGE',
                challengerName: state.playerName || 'Un Comandant',
                roomCode: roomCode,
                timestamp: Date.now()
            });
            setTimeout(() => {
                try { challengeConn.close(); } catch (e) {}
            }, 2500);
        });
    } catch (e) {
        console.warn('Nu s-a putut trimite semnalul in-app direct:', e);
    }
}

function handleIncomingChallenge(data) {
    soundFX.playRadarPing();
    const modal = document.getElementById('in-app-challenge-modal');
    if (!modal) return;

    state.pendingChallengeRoom = data.roomCode;
    const nameEl = document.getElementById('challenge-challenger-name');
    const roomEl = document.getElementById('challenge-room-code');

    if (nameEl) nameEl.textContent = data.challengerName || 'Un Pilot';
    if (roomEl) roomEl.textContent = data.roomCode;

    modal.classList.remove('hidden');
}

function triggerAppInstall() {
    soundFX.playClick();
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                deferredPrompt = null;
                const menuInstallBtn = document.getElementById('btn-menu-download-app');
                if (menuInstallBtn) menuInstallBtn.style.display = 'none';
            }
        }).catch(err => console.warn(err));
    } else {
        // Instrucțiuni pe mobil în funcție de dispozitiv
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            alert('📲 INSTALARE PE IPHONE / IPAD:\n\n1. Apasă butonul „Partajare” (pătratul cu săgeată în sus ⬆️ din Safari).\n2. Derulează în jos și alege „Adaugă pe ecranul principal” (Add to Home Screen).\n3. Apasă „Adaugă” dreapta-sus.');
        } else {
            alert('📲 INSTALARE PE ANDROID / DESKTOP:\n\n1. Deschide meniul browserului (cele 3 puncte verticale ⋮ din colțul dreapta-sus).\n2. Alege „Instalează aplicația” sau „Adaugă la ecranul de pornire”.\n3. Aplicația va apărea ca iconiță separată pe ecranul telefonului!');
        }
    }
}

// ==========================================
// 6. INITIALIZARE EVENIMENTE DOM
// ==========================================

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

    // 1. Inițializare Nume Pilot (Memorat în localStorage)
    const savedPilotName = localStorage.getItem('pilot_name') || '';
    const menuPilotInput = document.getElementById('input-pilot-name');
    const modalGuestInput = document.getElementById('input-modal-guest-name');
    if (savedPilotName) {
        state.playerName = savedPilotName;
        if (menuPilotInput) menuPilotInput.value = savedPilotName;
        if (modalGuestInput) modalGuestInput.value = savedPilotName;
        initPilotSignaling(savedPilotName);
    }
    renderRecentOpponentsUI();

    if (menuPilotInput) {
        menuPilotInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val) {
                state.playerName = val;
                localStorage.setItem('pilot_name', val);
                if (modalGuestInput) modalGuestInput.value = val;
                initPilotSignaling(val);
            }
        });
    }

    if (modalGuestInput) {
        modalGuestInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val) {
                state.playerName = val;
                localStorage.setItem('pilot_name', val);
                if (menuPilotInput) menuPilotInput.value = val;
                initPilotSignaling(val);
            }
        });
    }

    // 2. Inițializare parametri URL (ex: ?room=AV88) - Afișează Modalul de Invitație conform cerinței
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
        const roomCode = roomFromUrl.toUpperCase();
        document.getElementById('input-join-room-code').value = roomCode;
        
        const inviteRoomDisplay = document.getElementById('invite-room-display');
        if (inviteRoomDisplay) inviteRoomDisplay.textContent = roomCode;

        // Afișează modalul de invitație (conține: 1. Buton JOACĂ, 2. Buton DESCARCĂ APLICAȚIA, 3. NUMELE)
        const inviteModal = document.getElementById('invite-welcome-modal');
        if (inviteModal) {
            inviteModal.classList.remove('hidden');
        }
    }

    // 2.1 Butonul JOACĂ din modalul de invitație
    const btnModalPlay = document.getElementById('btn-modal-join-play');
    if (btnModalPlay) {
        btnModalPlay.addEventListener('click', () => {
            soundFX.playClick();
            const guestInput = document.getElementById('input-modal-guest-name');
            const enteredName = guestInput ? guestInput.value.trim() : '';
            const finalName = enteredName || ('Pilot ' + Math.floor(100 + Math.random() * 900));
            state.playerName = finalName;
            localStorage.setItem('pilot_name', finalName);
            initPilotSignaling(finalName);

            const roomCode = document.getElementById('input-join-room-code').value.trim().toUpperCase();
            document.getElementById('display-room-code').textContent = roomCode;

            // Închide modalul
            const inviteModal = document.getElementById('invite-welcome-modal');
            if (inviteModal) inviteModal.classList.add('hidden');

            // Conectare în cameră
            connectToRoom(roomCode, 'guest');
        });
    }

    // 2.2 Butoane DESCARCĂ APLICAȚIA (Banner Meniu & Modal)
    const btnMenuDownload = document.getElementById('btn-menu-download-app');
    if (btnMenuDownload) {
        btnMenuDownload.addEventListener('click', () => {
            triggerAppInstall();
        });
    }

    const btnModalDownload = document.getElementById('btn-modal-download-app');
    if (btnModalDownload) {
        btnModalDownload.addEventListener('click', () => {
            triggerAppInstall();
        });
    }

    // 3. Verificare meci în desfășurare (Persistență sesiune dacă nu s-a terminat jocul)
    const activeSession = getActiveSession();
    const resumeBanner = document.getElementById('resume-session-banner');
    if (activeSession && (activeSession.phase === 'BATTLE' || activeSession.phase === 'SETUP')) {
        if (resumeBanner) {
            const resumeRoomEl = document.getElementById('resume-room-code');
            const resumeRoleEl = document.getElementById('resume-role-text');
            if (resumeRoomEl) resumeRoomEl.textContent = activeSession.roomCode;
            if (resumeRoleEl) resumeRoleEl.textContent = activeSession.role === 'host' ? 'Gazdă' : 'Oaspete';
            resumeBanner.classList.remove('hidden');
        }
    }

    const btnResume = document.getElementById('btn-resume-game');
    if (btnResume) {
        btnResume.addEventListener('click', () => {
            soundFX.playClick();
            if (resumeBanner) resumeBanner.classList.add('hidden');
            const session = getActiveSession();
            if (session) {
                resumeMatch(session);
            }
        });
    }

    const btnDiscard = document.getElementById('btn-discard-session');
    if (btnDiscard) {
        btnDiscard.addEventListener('click', () => {
            soundFX.playClick();
            clearMatchSession();
            if (resumeBanner) resumeBanner.classList.add('hidden');
        });
    }

    // 5. Creare Cameră (Host)
    document.getElementById('btn-create-room').addEventListener('click', () => {
        soundFX.playClick();
        const pilotInput = document.getElementById('input-pilot-name');
        const nameVal = pilotInput ? pilotInput.value.trim() : '';
        const finalName = nameVal || ('Comandant ' + Math.floor(100 + Math.random() * 900));
        state.playerName = finalName;
        localStorage.setItem('pilot_name', finalName);

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

    // 6. Alăturare Cameră directă (Guest)
    document.getElementById('btn-join-room').addEventListener('click', () => {
        soundFX.playClick();
        const pilotInput = document.getElementById('input-pilot-name');
        const nameVal = pilotInput ? pilotInput.value.trim() : '';
        const finalName = nameVal || ('Pilot ' + Math.floor(100 + Math.random() * 900));
        state.playerName = finalName;
        localStorage.setItem('pilot_name', finalName);

        const codeInput = document.getElementById('input-join-room-code').value.trim().toUpperCase();
        if (codeInput.length < 3) {
            alert('Te rog introdu un cod valid de cameră!');
            return;
        }
        document.getElementById('display-room-code').textContent = codeInput;
        connectToRoom(codeInput, 'guest');
    });

    // 7. Copiere link cameră
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

    // 8. Buton Invită Adversar (Setup Screen)
    const btnInviteOpponent = document.getElementById('btn-invite-opponent');
    if (btnInviteOpponent) {
        btnInviteOpponent.addEventListener('click', () => {
            soundFX.playClick();
            shareRoomInvite();
        });
    }

    // 8.1 Butoane Notificare Provocare In-App (Acceptă / Refuză)
    const btnAcceptChallenge = document.getElementById('btn-accept-challenge');
    if (btnAcceptChallenge) {
        btnAcceptChallenge.addEventListener('click', () => {
            soundFX.playClick();
            const modal = document.getElementById('in-app-challenge-modal');
            if (modal) modal.classList.add('hidden');
            if (state.pendingChallengeRoom) {
                document.getElementById('input-join-room-code').value = state.pendingChallengeRoom;
                document.getElementById('display-room-code').textContent = state.pendingChallengeRoom;
                connectToRoom(state.pendingChallengeRoom, 'guest');
            }
        });
    }

    const btnDeclineChallenge = document.getElementById('btn-decline-challenge');
    if (btnDeclineChallenge) {
        btnDeclineChallenge.addEventListener('click', () => {
            soundFX.playClick();
            const modal = document.getElementById('in-app-challenge-modal');
            if (modal) modal.classList.add('hidden');
            state.pendingChallengeRoom = null;
        });
    }

    // 9. Buton Dispunere Aleatorie
    document.getElementById('btn-randomize-fleet').addEventListener('click', () => {
        randomizeFleet();
    });

    // 10. Buton Curățare Tablă (Șterge Tot)
    document.getElementById('btn-clear-fleet').addEventListener('click', () => {
        soundFX.playClick();
        state.previewHead = null;
        state.previewValidOrientations = [];
        state.myPlanes = [];
        renderSetupGrid();
        updateSetupUI();
        saveMatchSession();
    });

    // 11. Buton Gata de Luptă (Ready)
    document.getElementById('btn-ready-fleet').addEventListener('click', () => {
        soundFX.playRadarPing();
        state.myReady = true;
        document.getElementById('btn-ready-fleet').disabled = true;
        document.getElementById('btn-ready-fleet').textContent = '✅ În Așteptarea Adversarului...';
        broadcastEvent('PLAYER_READY', { playerName: state.playerName });
        saveMatchSession();
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
        clearMatchSession();
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

// Salvare stare la închiderea paginii și eliberare conexiune PeerJS
window.addEventListener('beforeunload', () => {
    saveMatchSession();
    if (state.activeConn) {
        try { state.activeConn.close(); } catch (e) {}
    }
    if (state.peer) {
        try { state.peer.destroy(); } catch (e) {}
    }
});
