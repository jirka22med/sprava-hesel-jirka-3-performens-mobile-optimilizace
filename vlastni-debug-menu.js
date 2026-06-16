// ============================================================
// HVĚZDNÁ FLOTILA - VLASTNÍ DEBUG MENU (PŘÍPOJNÝ MODUL)
// vlastni-debug-menu.js
// Verze: 1.0 | Autor: Admirál Claude.AI & Více admirál Jiřík
//
// Funkce:
//   - FPS live monitor (requestAnimationFrame)
//   - Zachycení a výpis konzolových logů
//   - Stav Firebase (přihlášení, cache, poslední sync)
//   - Výkonnostní statistiky (RAM, uptime)
//   - LCARS Star Trek design inspirovaný diagnostikou
// ============================================================

// ============================================================
// 📊 FPS MONITOR
// Měří snímky za sekundu pomocí requestAnimationFrame
// ============================================================

const DebugFPS = (function () {
    let fps          = 0;
    let frameCount   = 0;
    let lastTime     = performance.now();
    let fpsHistory   = []; // posledních 30 hodnot pro mini-graf
    let running      = false;

    function tick() {
        if (!running) return;
        frameCount++;
        const now = performance.now();
        const delta = now - lastTime;

        if (delta >= 1000) {
            fps = Math.round(frameCount * 1000 / delta);
            frameCount = 0;
            lastTime   = now;

            fpsHistory.push(fps);
            if (fpsHistory.length > 30) fpsHistory.shift();
        }

        requestAnimationFrame(tick);
    }

    return {
        start() {
            if (running) return;
            running = true;
            requestAnimationFrame(tick);
        },
        getFPS()     { return fps; },
        getHistory() { return fpsHistory; },
        getColor()   {
            if (fps >= 55) return '#00e676'; // zelená
            if (fps >= 30) return '#f0c040'; // žlutá
            return '#ef5350';                 // červená
        }
    };
})();

// ============================================================
// 📝 LOG INTERCEPTOR
// Zachytí console.log / warn / error a uloží do zásobníku
// ============================================================

const DebugLogger = (function () {
    const MAX_LOGS = 150;
    const logs     = [];

    const originalLog   = console.log.bind(console);
    const originalWarn  = console.warn.bind(console);
    const originalError = console.error.bind(console);

    function capture(type, args) {
        const msg = args.map(a => {
            try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
            catch(e) { return '[object]'; }
        }).join(' ');

        logs.push({
            type,
            msg,
            time: new Date().toLocaleTimeString('cs-CZ', { hour12: false })
        });

        if (logs.length > MAX_LOGS) logs.shift();

        // Aktualizuj počítadlo v tlačítku pokud je modal zavřený
        const badge = document.getElementById('debugLogBadge');
        if (badge) {
            badge.textContent = logs.length;
            badge.style.display = 'inline-block';
        }
    }

    // Přepis konzolových metod
    console.log = function(...args) {
        capture('log', args);
        originalLog(...args);
    };
    console.warn = function(...args) {
        capture('warn', args);
        originalWarn(...args);
    };
    console.error = function(...args) {
        capture('error', args);
        originalError(...args);
    };

    return {
        getLogs()       { return logs; },
        clearLogs()     { logs.length = 0; },
        getCount()      { return logs.length; },
        getErrorCount() { return logs.filter(l => l.type === 'error').length; },
        getWarnCount()  { return logs.filter(l => l.type === 'warn').length; }
    };
})();

// ============================================================
// 📡 APP STATUS READER
// Čte stav aplikace z globálních proměnných script.js
// ============================================================

const DebugAppStatus = {

    getFirebaseStatus() {
        // Pokusí se zjistit stav Firebase z globálního scope
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                const user = firebase.auth().currentUser;
                return user ? `✅ Přihlášen: ${user.uid.substring(0, 8)}...` : '⚠️ Nepřihlášen';
            }
        } catch(e) {}
        return '❓ Neznámý';
    },

    getMasterKeyStatus() {
        try {
            if (typeof masterKeyStore !== 'undefined' && masterKeyStore.get()) {
                return '✅ Načten v paměti';
            }
        } catch(e) {}
        return '❌ Nenačten';
    },

    getCacheStatus() {
        try {
            if (typeof passwordsCache !== 'undefined') {
                const hasData = passwordsCache.data && passwordsCache.data.length > 0;
                const age     = passwordsCache.timestamp
                    ? Math.round((Date.now() - passwordsCache.timestamp) / 1000)
                    : null;
                if (hasData) return `✅ ${passwordsCache.data.length} hesel | stáří: ${age}s`;
                return '⚠️ Prázdná cache';
            }
        } catch(e) {}
        return '❓ Cache nedostupná';
    },

    getPasswordCount() {
        try {
            if (typeof passwordsCache !== 'undefined' && passwordsCache.data) {
                return passwordsCache.data.length;
            }
        } catch(e) {}
        return '?';
    },

    getMemoryInfo() {
        if (performance.memory) {
            const used  = Math.round(performance.memory.usedJSHeapSize  / 1048576);
            const total = Math.round(performance.memory.totalJSHeapSize / 1048576);
            const pct   = Math.round((used / total) * 100);
            return { used, total, pct };
        }
        return null;
    },

    getUptime() {
        const sec = Math.round(performance.now() / 1000);
        const m   = Math.floor(sec / 60);
        const s   = sec % 60;
        return `${m}m ${s}s`;
    },

    getNetworkStatus() {
        if (!navigator.onLine) return { ok: false, label: '❌ Offline' };
        const conn = navigator.connection || navigator.mozConnection;
        if (conn) return { ok: true, label: `✅ Online | ${conn.effectiveType || '?'} | ${conn.downlink || '?'} Mbps` };
        return { ok: true, label: '✅ Online' };
    }
};

// ============================================================
// 🎨 DYNAMICKÉ CSS (LCARS STAR TREK DESIGN)
// ============================================================

(function injectDebugStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* ===== IMPORT FONTŮ ===== */
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

        /* ===== PLOVOUCÍ TLAČÍTKO ===== */
        #debugMenuToggle {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 52px;
            height: 52px;
            background: linear-gradient(135deg, #031524, #010d1a);
            border: 2px solid #f0c040;
            border-radius: 50%;
            cursor: pointer;
            z-index: 9000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.4em;
            box-shadow: 0 0 20px rgba(240,192,64,0.35), inset 0 0 15px rgba(240,192,64,0.05);
            transition: all 0.25s;
            animation: debugBtnPulse 3s ease-in-out infinite;
        }
        #debugMenuToggle:hover {
            box-shadow: 0 0 30px rgba(240,192,64,0.6);
            transform: scale(1.08);
        }
        @keyframes debugBtnPulse {
            0%,100% { box-shadow: 0 0 20px rgba(240,192,64,0.35); }
            50%      { box-shadow: 0 0 30px rgba(240,192,64,0.6); }
        }

        /* Odznak s počtem logů */
        #debugLogBadge {
            display: none;
            position: absolute;
            top: -4px;
            right: -4px;
            background: #ef5350;
            color: white;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            font-size: 0.55em;
            font-family: 'Share Tech Mono', monospace;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 8px #ef5350;
        }

        /* ===== OVERLAY ===== */
        #debugMenuOverlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(1,13,26,0.85);
            z-index: 9001;
            backdrop-filter: blur(4px);
            animation: debugFadeIn 0.2s ease;
        }
        @keyframes debugFadeIn { from{opacity:0} to{opacity:1} }

        /* ===== HLAVNÍ PANEL ===== */
        #debugMenuPanel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: min(920px, 96vw);
            max-height: 85vh;
            background: #010d1a;
            border: 2px solid #0d3a6e;
            border-top: 3px solid #f0c040;
            border-radius: 4px;
            z-index: 9002;
            display: flex;
            flex-direction: column;
            font-family: 'Exo 2', sans-serif;
            box-shadow: 0 0 60px rgba(240,192,64,0.15), 0 0 120px rgba(13,58,110,0.3);
            animation: debugSlideIn 0.3s ease;
            overflow: hidden;
        }
        @keyframes debugSlideIn { from{opacity:0;transform:translate(-50%,-48%)} to{opacity:1;transform:translate(-50%,-50%)} }

        /* ===== HEADER PANELU ===== */
        #debugMenuHeader {
            background: linear-gradient(135deg, #020f1e 0%, #04192d 100%);
            border-bottom: 2px solid #0d3a6e;
            padding: 14px 22px;
            display: flex;
            align-items: center;
            gap: 16px;
            position: relative;
            overflow: hidden;
        }
        #debugMenuHeader::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(90deg, rgba(240,192,64,0.04) 0%, transparent 50%);
            pointer-events: none;
        }
        .dbg-hbars { display: flex; flex-direction: column; gap: 3px; }
        .dbg-hbar  { height: 5px; border-radius: 3px; animation: dbgBarPulse 2s ease-in-out infinite; }
        .dbg-hbar:nth-child(1) { width: 44px; background: #f0c040; box-shadow: 0 0 8px #f0c040; }
        .dbg-hbar:nth-child(2) { width: 30px; background: #4fc3f7; box-shadow: 0 0 8px #4fc3f7; animation-delay:.3s; }
        .dbg-hbar:nth-child(3) { width: 20px; background: #ef5350; box-shadow: 0 0 8px #ef5350; animation-delay:.6s; }
        @keyframes dbgBarPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        .dbg-title {
            font-family: 'Orbitron', monospace;
            font-size: 1.05em;
            font-weight: 900;
            color: #f0c040;
            text-shadow: 0 0 20px rgba(240,192,64,0.6);
            letter-spacing: 3px;
            flex: 1;
        }
        .dbg-sub {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.65em;
            color: #4fc3f7;
            letter-spacing: 2px;
            margin-top: 3px;
        }
        #debugMenuClose {
            background: rgba(239,83,80,0.15);
            border: 1px solid #ef5350;
            color: #ef5350;
            border-radius: 3px;
            cursor: pointer;
            padding: 6px 12px;
            font-family: 'Orbitron', monospace;
            font-size: 0.7em;
            letter-spacing: 1px;
            transition: all 0.2s;
        }
        #debugMenuClose:hover { background: rgba(239,83,80,0.3); box-shadow: 0 0 10px rgba(239,83,80,0.4); }

        /* ===== STATUS BAR ===== */
        #debugStatusBar {
            background: #010e1c;
            border-bottom: 1px solid rgba(13,58,110,0.5);
            padding: 6px 22px;
            display: flex;
            gap: 22px;
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.68em;
            color: rgba(179,229,252,0.6);
            overflow-x: auto;
        }
        .dbg-si { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
        .dbg-dot { width: 6px; height: 6px; border-radius: 50%; animation: dbgBlink 1.5s ease-in-out infinite; }
        .dbg-dot.g { background: #00e676; box-shadow: 0 0 6px #00e676; }
        .dbg-dot.y { background: #f0c040; box-shadow: 0 0 6px #f0c040; animation-delay:.5s; }
        .dbg-dot.r { background: #ef5350; box-shadow: 0 0 6px #ef5350; animation-delay:1s; }
        @keyframes dbgBlink { 0%,100%{opacity:1} 50%{opacity:0.2} }

        /* ===== NAVIGAČNÍ TABY ===== */
        #debugNavTabs {
            background: #010c18;
            border-bottom: 2px solid #0d3a6e;
            padding: 0 22px;
            display: flex;
            gap: 2px;
        }
        .dbg-tab {
            font-family: 'Orbitron', monospace;
            font-size: 0.6em;
            font-weight: 700;
            padding: 10px 14px;
            cursor: pointer;
            border: none;
            background: transparent;
            color: rgba(179,229,252,0.45);
            letter-spacing: 1px;
            text-transform: uppercase;
            border-bottom: 3px solid transparent;
            transition: all 0.2s;
            white-space: nowrap;
        }
        .dbg-tab:hover  { color: #4fc3f7; background: rgba(79,195,247,0.05); }
        .dbg-tab.active { color: #f0c040; border-bottom-color: #f0c040; background: rgba(240,192,64,0.05); }

        /* ===== OBSAH ===== */
        #debugContent {
            overflow-y: auto;
            flex: 1;
            padding: 16px 20px;
            scrollbar-width: thin;
            scrollbar-color: #0d3a6e #010d1a;
        }
        .dbg-section { display: none; }
        .dbg-section.active { display: block; animation: dbgFadeUp 0.25s ease; }
        @keyframes dbgFadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

        /* ===== KARTY ===== */
        .dbg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 14px; }
        .dbg-card {
            background: rgba(2,15,28,0.9);
            border: 1px solid rgba(13,58,110,0.4);
            border-radius: 3px;
            padding: 12px;
            position: relative;
            overflow: hidden;
        }
        .dbg-card::after {
            content: '';
            position: absolute;
            top: 0; left: 0;
            width: 3px; height: 100%;
            background: #f0c040;
            box-shadow: 0 0 8px rgba(240,192,64,0.4);
        }
        .dbg-card-label {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.62em;
            color: rgba(179,229,252,0.45);
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 5px;
        }
        .dbg-card-value {
            font-family: 'Orbitron', monospace;
            font-size: 1.3em;
            font-weight: 900;
            color: #f0c040;
        }
        .dbg-card-sub {
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.68em;
            color: rgba(179,229,252,0.55);
            margin-top: 3px;
        }
        .dbg-bar { background: rgba(13,58,110,0.3); border-radius: 2px; height: 4px; margin-top: 8px; overflow: hidden; }
        .dbg-bar-fill { height: 100%; border-radius: 2px; transition: width 0.8s ease; box-shadow: 0 0 6px currentColor; }

        /* ===== PANEL ===== */
        .dbg-panel {
            background: rgba(3,21,36,0.8);
            border: 1px solid #0d3a6e;
            border-radius: 3px;
            margin-bottom: 12px;
            overflow: hidden;
            position: relative;
        }
        .dbg-panel::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(79,195,247,0.5), transparent);
        }
        .dbg-panel-header {
            background: linear-gradient(90deg, rgba(13,58,110,0.4), rgba(3,21,36,0.9));
            padding: 8px 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid rgba(13,58,110,0.35);
        }
        .dbg-panel-title {
            font-family: 'Orbitron', monospace;
            font-size: 0.65em;
            font-weight: 700;
            color: #f0c040;
            letter-spacing: 2px;
            text-transform: uppercase;
        }
        .dbg-panel-badge {
            margin-left: auto;
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.65em;
            color: #4fc3f7;
            background: rgba(79,195,247,0.1);
            padding: 2px 7px;
            border-radius: 2px;
            border: 1px solid rgba(79,195,247,0.25);
        }

        /* ===== STAV ŘÁDKY ===== */
        .dbg-status-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 8px 14px;
            border-bottom: 1px solid rgba(13,58,110,0.18);
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.75em;
        }
        .dbg-status-row:last-child { border-bottom: none; }
        .dbg-status-key { color: rgba(179,229,252,0.45); min-width: 130px; }
        .dbg-status-val { color: #b3e5fc; flex: 1; word-break: break-all; }

        /* ===== LOG VIEWER ===== */
        #debugLogContainer {
            background: #010810;
            border: 1px solid #0d3a6e;
            border-radius: 3px;
            max-height: 340px;
            overflow-y: auto;
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.72em;
        }
        .dbg-log-line {
            display: flex;
            gap: 10px;
            padding: 4px 10px;
            border-bottom: 1px solid rgba(13,58,110,0.12);
            line-height: 1.4;
            word-break: break-all;
        }
        .dbg-log-line:hover { background: rgba(79,195,247,0.04); }
        .dbg-log-time { color: rgba(179,229,252,0.35); min-width: 70px; flex-shrink: 0; }
        .dbg-log-type { min-width: 40px; flex-shrink: 0; font-weight: bold; }
        .dbg-log-msg  { color: rgba(179,229,252,0.8); flex: 1; }
        .dbg-log-line.log  .dbg-log-type { color: #4fc3f7; }
        .dbg-log-line.warn .dbg-log-type { color: #f0c040; }
        .dbg-log-line.warn .dbg-log-msg  { color: #f0c040; }
        .dbg-log-line.error .dbg-log-type { color: #ef5350; }
        .dbg-log-line.error .dbg-log-msg  { color: #ef5350; }

        /* Tlačítka v log sekci */
        .dbg-log-controls {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }
        .dbg-btn {
            font-family: 'Orbitron', monospace;
            font-size: 0.62em;
            font-weight: 700;
            letter-spacing: 1px;
            padding: 7px 14px;
            border-radius: 3px;
            cursor: pointer;
            border: 1px solid;
            transition: all 0.2s;
        }
        .dbg-btn-blue  { background: rgba(79,195,247,0.1);  color: #4fc3f7;  border-color: rgba(79,195,247,0.4);  }
        .dbg-btn-red   { background: rgba(239,83,80,0.1);   color: #ef5350;  border-color: rgba(239,83,80,0.4);   }
        .dbg-btn-green { background: rgba(0,230,118,0.1);   color: #00e676;  border-color: rgba(0,230,118,0.4);   }
        .dbg-btn-gold  { background: rgba(240,192,64,0.1);  color: #f0c040;  border-color: rgba(240,192,64,0.4);  }
        .dbg-btn:hover { transform: translateY(-1px); filter: brightness(1.2); }

        /* ===== FPS MINI GRAF ===== */
        #debugFpsCanvas {
            width: 100%;
            height: 60px;
            background: rgba(2,15,28,0.8);
            border-radius: 3px;
            border: 1px solid rgba(13,58,110,0.4);
            display: block;
            margin-top: 8px;
        }

        /* ===== BADGE ===== */
        .dbg-badge {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 2px;
            font-size: 0.8em;
            font-family: 'Share Tech Mono', monospace;
        }
        .dbg-badge-green  { background: rgba(0,230,118,0.12);  color: #00e676; border: 1px solid rgba(0,230,118,0.3); }
        .dbg-badge-red    { background: rgba(239,83,80,0.12);   color: #ef5350; border: 1px solid rgba(239,83,80,0.3); }
        .dbg-badge-yellow { background: rgba(240,192,64,0.12);  color: #f0c040; border: 1px solid rgba(240,192,64,0.3); }
        .dbg-badge-blue   { background: rgba(79,195,247,0.12);  color: #4fc3f7; border: 1px solid rgba(79,195,247,0.3); }

        /* ===== FOOTER ===== */
        #debugMenuFooter {
            background: #010c18;
            border-top: 1px solid #0d3a6e;
            padding: 8px 22px;
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.65em;
            color: rgba(179,229,252,0.35);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        /* ===== SCROLLBAR ===== */
        #debugContent::-webkit-scrollbar,
        #debugLogContainer::-webkit-scrollbar { width: 4px; }
        #debugContent::-webkit-scrollbar-track,
        #debugLogContainer::-webkit-scrollbar-track { background: #010d1a; }
        #debugContent::-webkit-scrollbar-thumb,
        #debugLogContainer::-webkit-scrollbar-thumb { background: #0d3a6e; border-radius: 3px; }
    `;
    document.head.appendChild(style);
})();

// ============================================================
// 🖼️ INJEKCE HTML DO DOM
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    document.body.insertAdjacentHTML('beforeend', `
    <!-- PLOVOUCÍ TLAČÍTKO -->
    <button id="debugMenuToggle" title="Debug Menu - Hvězdná flotila" onclick="openDebugMenu()">
        🔧
        <span id="debugLogBadge" style="display:none;position:absolute;top:-4px;right:-4px;
            background:#ef5350;color:white;border-radius:50%;width:18px;height:18px;
            font-size:0.55em;font-family:'Share Tech Mono',monospace;
            display:inline-flex;align-items:center;justify-content:center;
            box-shadow:0 0 8px #ef5350;">0</span>
    </button>

    <!-- OVERLAY -->
    <div id="debugMenuOverlay" onclick="closeDebugMenu()"></div>

    <!-- HLAVNÍ PANEL -->
    <div id="debugMenuPanel">

        <!-- HEADER -->
        <div id="debugMenuHeader">
            <div class="dbg-hbars">
                <div class="dbg-hbar"></div>
                <div class="dbg-hbar"></div>
                <div class="dbg-hbar"></div>
            </div>
            <div>
                <div class="dbg-title">HVĚZDNÁ FLOTILA // DEBUG</div>
                <div class="dbg-sub">SYSTÉMOVÁ DIAGNOSTIKA • VÍCE ADMIRÁL JIŘÍK</div>
            </div>
            <button id="debugMenuClose" onclick="closeDebugMenu()">✕ ZAVŘÍT</button>
        </div>

        <!-- STATUS BAR -->
        <div id="debugStatusBar">
            <div class="dbg-si"><div class="dbg-dot g"></div><span id="dbgFpsStatus">FPS: --</span></div>
            <div class="dbg-si"><div class="dbg-dot b" id="dbgFirebaseDot"></div><span id="dbgFirebaseStatus">Firebase: --</span></div>
            <div class="dbg-si"><div class="dbg-dot y"></div><span id="dbgUptimeStatus">Uptime: --</span></div>
            <div class="dbg-si"><div class="dbg-dot g" id="dbgNetDot"></div><span id="dbgNetStatus">Síť: --</span></div>
            <div class="dbg-si"><div class="dbg-dot r"></div><span id="dbgErrStatus">Chyby: 0</span></div>
        </div>

        <!-- NAVIGACE -->
        <div id="debugNavTabs">
            <button class="dbg-tab active" onclick="debugSwitchTab('prehled',  this)">📊 PŘEHLED</button>
            <button class="dbg-tab"        onclick="debugSwitchTab('firebase', this)">☁️ FIREBASE</button>
            <button class="dbg-tab"        onclick="debugSwitchTab('vykon',    this)">⚡ VÝKON</button>
            <button class="dbg-tab"        onclick="debugSwitchTab('logy',     this)">📝 LOGY</button>
        </div>

        <!-- OBSAH -->
        <div id="debugContent">

            <!-- TAB: PŘEHLED -->
            <div id="dbgTab-prehled" class="dbg-section active">
                <div class="dbg-grid">
                    <div class="dbg-card">
                        <div class="dbg-card-label">FPS</div>
                        <div class="dbg-card-value" id="dbgCardFps">--</div>
                        <div class="dbg-card-sub">Snímků za sekundu</div>
                        <div class="dbg-bar"><div class="dbg-bar-fill" id="dbgFpsBar" style="width:0%;background:#00e676;color:#00e676;"></div></div>
                    </div>
                    <div class="dbg-card">
                        <div class="dbg-card-label">HESLA V CACHE</div>
                        <div class="dbg-card-value" id="dbgCardPwdCount">--</div>
                        <div class="dbg-card-sub" id="dbgCardCacheSub">Načítám...</div>
                    </div>
                    <div class="dbg-card">
                        <div class="dbg-card-label">MASTER KEY</div>
                        <div class="dbg-card-value" style="font-size:0.75em;" id="dbgCardMasterKey">--</div>
                    </div>
                    <div class="dbg-card">
                        <div class="dbg-card-label">UPTIME</div>
                        <div class="dbg-card-value" style="font-size:0.85em;" id="dbgCardUptime">--</div>
                        <div class="dbg-card-sub">Od načtení stránky</div>
                    </div>
                </div>

                <div class="dbg-panel">
                    <div class="dbg-panel-header">
                        <span>🌐</span>
                        <span class="dbg-panel-title">SÍŤOVÝ STATUS</span>
                    </div>
                    <div class="dbg-status-row">
                        <span class="dbg-status-key">Připojení:</span>
                        <span class="dbg-status-val" id="dbgNetDetail">--</span>
                    </div>
                    <div class="dbg-status-row">
                        <span class="dbg-status-key">User Agent:</span>
                        <span class="dbg-status-val" style="font-size:0.85em;opacity:0.6;">${navigator.userAgent.substring(0,80)}...</span>
                    </div>
                    <div class="dbg-status-row">
                        <span class="dbg-status-key">Jazyk:</span>
                        <span class="dbg-status-val">${navigator.language}</span>
                    </div>
                    <div class="dbg-status-row">
                        <span class="dbg-status-key">Cookies:</span>
                        <span class="dbg-status-val">${navigator.cookieEnabled ? '<span class="dbg-badge dbg-badge-green">Povoleny</span>' : '<span class="dbg-badge dbg-badge-red">Zakázány</span>'}</span>
                    </div>
                </div>
            </div>

            <!-- TAB: FIREBASE -->
            <div id="dbgTab-firebase" class="dbg-section">
                <div class="dbg-panel">
                    <div class="dbg-panel-header">
                        <span>🔥</span>
                        <span class="dbg-panel-title">FIREBASE STATUS</span>
                    </div>
                    <div class="dbg-status-row">
                        <span class="dbg-status-key">Auth stav:</span>
                        <span class="dbg-status-val" id="dbgFbAuth">--</span>
                    </div>
                    <div class="dbg-status-row">
                        <span class="dbg-status-key">Master Key:</span>
                        <span class="dbg-status-val" id="dbgFbMasterKey">--</span>
                    </div>
                    <div class="dbg-status-row">
                        <span class="dbg-status-key">Cache hesel:</span>
                        <span class="dbg-status-val" id="dbgFbCache">--</span>
                    </div>
                    <div class="dbg-status-row">
                        <span class="dbg-status-key">Počet hesel:</span>
                        <span class="dbg-status-val" id="dbgFbPwdCount">--</span>
                    </div>
                </div>

                <div class="dbg-panel">
                    <div class="dbg-panel-header">
                        <span>🛠️</span>
                        <span class="dbg-panel-title">FIREBASE DEBUG NÁSTROJE</span>
                    </div>
                    <div style="padding:12px;display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="dbg-btn dbg-btn-blue"  onclick="debugTestFirebase()">🔗 Test spojení</button>
                        <button class="dbg-btn dbg-btn-gold"  onclick="debugGetUserId()">👤 Zobrazit UID</button>
                        <button class="dbg-btn dbg-btn-green" onclick="debugRefreshCache()">🔄 Refresh cache</button>
                    </div>
                    <div id="dbgFbToolResult" style="padding:0 12px 12px;font-family:'Share Tech Mono',monospace;font-size:0.75em;color:#4fc3f7;display:none;"></div>
                </div>
            </div>

            <!-- TAB: VÝKON -->
            <div id="dbgTab-vykon" class="dbg-section">
                <div class="dbg-panel">
                    <div class="dbg-panel-header">
                        <span>⚡</span>
                        <span class="dbg-panel-title">FPS MONITOR</span>
                        <span class="dbg-panel-badge" id="dbgFpsBadge">-- FPS</span>
                    </div>
                    <div style="padding:12px;">
                        <canvas id="debugFpsCanvas" height="60"></canvas>
                        <div style="display:flex;gap:16px;margin-top:8px;font-family:'Share Tech Mono',monospace;font-size:0.68em;color:rgba(179,229,252,0.45);">
                            <span>MIN: <span id="dbgFpsMin" style="color:#ef5350;">--</span></span>
                            <span>MAX: <span id="dbgFpsMax" style="color:#00e676;">--</span></span>
                            <span>AVG: <span id="dbgFpsAvg" style="color:#f0c040;">--</span></span>
                        </div>
                    </div>
                </div>

                <div class="dbg-panel">
                    <div class="dbg-panel-header">
                        <span>💾</span>
                        <span class="dbg-panel-title">PAMĚŤ</span>
                    </div>
                    <div style="padding:12px;" id="dbgMemPanel">
                        <div style="font-family:'Share Tech Mono',monospace;font-size:0.75em;color:rgba(179,229,252,0.45);">
                            Načítám...
                        </div>
                    </div>
                </div>

                <div class="dbg-panel">
                    <div class="dbg-panel-header">
                        <span>📐</span>
                        <span class="dbg-panel-title">ROZLIŠENÍ & VIEWPORT</span>
                    </div>
                    <div class="dbg-status-row">
                        <span class="dbg-status-key">Obrazovka:</span>
                        <span class="dbg-status-val">${screen.width} × ${screen.height} px | ${screen.colorDepth}-bit</span>
                    </div>
                    <div class="dbg-status-row">
                        <span class="dbg-status-key">Viewport:</span>
                        <span class="dbg-status-val" id="dbgViewport">--</span>
                    </div>
                    <div class="dbg-status-row">
                        <span class="dbg-status-key">Pixel ratio:</span>
                        <span class="dbg-status-val">${window.devicePixelRatio}×</span>
                    </div>
                </div>
            </div>

            <!-- TAB: LOGY -->
            <div id="dbgTab-logy" class="dbg-section">
                <div class="dbg-log-controls">
                    <button class="dbg-btn dbg-btn-blue"  onclick="debugScrollLogsBottom()">⬇️ Skočit na konec</button>
                    <button class="dbg-btn dbg-btn-gold"  onclick="debugFilterLogs('warn')">⚠️ Jen varování</button>
                    <button class="dbg-btn dbg-btn-red"   onclick="debugFilterLogs('error')">❌ Jen chyby</button>
                    <button class="dbg-btn dbg-btn-green" onclick="debugFilterLogs('all')">📋 Vše</button>
                    <button class="dbg-btn dbg-btn-red"   onclick="debugClearLogs()">🗑️ Smazat logy</button>
                </div>
                <div id="debugLogContainer">
                    <div style="padding:20px;text-align:center;font-family:'Share Tech Mono',monospace;font-size:0.75em;color:rgba(179,229,252,0.3);">
                        Logy se načtou při otevření panelu...
                    </div>
                </div>
                <div style="margin-top:8px;font-family:'Share Tech Mono',monospace;font-size:0.65em;color:rgba(179,229,252,0.35);">
                    Zachyceno: <span id="dbgLogTotal" style="color:#4fc3f7;">0</span> logů |
                    Varování: <span id="dbgLogWarns" style="color:#f0c040;">0</span> |
                    Chyby: <span id="dbgLogErrors" style="color:#ef5350;">0</span>
                </div>
            </div>

        </div><!-- /debugContent -->

        <!-- FOOTER -->
        <div id="debugMenuFooter">
            <span>🖖 HVĚZDNÁ FLOTILA // vlastni-debug-menu.js v1.0</span>
            <span id="dbgFooterTime">--:--:--</span>
        </div>

    </div><!-- /debugMenuPanel -->
    `);

    // Spustit FPS monitor ihned
    DebugFPS.start();

    // Aktualizace každou sekundu (i když je panel zavřený)
    setInterval(updateDebugStatusBar, 1000);

    console.log('🔧 Vlastni-debug-menu.js načten - Diagnostika online! 🚀');
});

// ============================================================
// 🔄 AKTUALIZACE DAT
// ============================================================

function updateDebugStatusBar() {
    const fps = DebugFPS.getFPS();

    // Status bar
    const fpsEl = document.getElementById('dbgFpsStatus');
    if (fpsEl) fpsEl.textContent = `FPS: ${fps}`;

    const upEl = document.getElementById('dbgUptimeStatus');
    if (upEl) upEl.textContent = `Uptime: ${DebugAppStatus.getUptime()}`;

    const net     = DebugAppStatus.getNetworkStatus();
    const netEl   = document.getElementById('dbgNetStatus');
    const netDot  = document.getElementById('dbgNetDot');
    if (netEl)  netEl.textContent  = net.ok ? 'Online' : 'Offline';
    if (netDot) netDot.className   = `dbg-dot ${net.ok ? 'g' : 'r'}`;

    const errEl = document.getElementById('dbgErrStatus');
    if (errEl) errEl.textContent = `Chyby: ${DebugLogger.getErrorCount()}`;

    // Footer čas
    const timeEl = document.getElementById('dbgFooterTime');
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('cs-CZ');

    // Aktualizace aktivního tabu
    updateDebugActiveTab();
}

function updateDebugActiveTab() {
    const activeTab = document.querySelector('.dbg-tab.active');
    if (!activeTab) return;
    const tabId = activeTab.getAttribute('onclick').match(/'([^']+)'/)[1];

    if (tabId === 'prehled') updateDebugPrehled();
    if (tabId === 'firebase') updateDebugFirebase();
    if (tabId === 'vykon')   updateDebugVykon();
    if (tabId === 'logy')    updateDebugLogy();
}

function updateDebugPrehled() {
    const fps = DebugFPS.getFPS();

    const cardFps = document.getElementById('dbgCardFps');
    if (cardFps) { cardFps.textContent = fps; cardFps.style.color = DebugFPS.getColor(); }

    const fpsBar = document.getElementById('dbgFpsBar');
    if (fpsBar) {
        const pct = Math.min(100, Math.round((fps / 60) * 100));
        fpsBar.style.width = pct + '%';
        fpsBar.style.background = DebugFPS.getColor();
        fpsBar.style.color      = DebugFPS.getColor();
    }

    const pwdEl = document.getElementById('dbgCardPwdCount');
    if (pwdEl) pwdEl.textContent = DebugAppStatus.getPasswordCount();

    const cacheEl = document.getElementById('dbgCardCacheSub');
    if (cacheEl) cacheEl.textContent = DebugAppStatus.getCacheStatus();

    const mkEl = document.getElementById('dbgCardMasterKey');
    if (mkEl) mkEl.textContent = DebugAppStatus.getMasterKeyStatus();

    const upEl = document.getElementById('dbgCardUptime');
    if (upEl) upEl.textContent = DebugAppStatus.getUptime();

    const net    = DebugAppStatus.getNetworkStatus();
    const netEl  = document.getElementById('dbgNetDetail');
    if (netEl) netEl.textContent = net.label;

    const vp = document.getElementById('dbgViewport');
    if (vp) vp.textContent = `${window.innerWidth} × ${window.innerHeight} px`;
}

function updateDebugFirebase() {
    const authEl = document.getElementById('dbgFbAuth');
    if (authEl) authEl.textContent = DebugAppStatus.getFirebaseStatus();

    const mkEl = document.getElementById('dbgFbMasterKey');
    if (mkEl) mkEl.textContent = DebugAppStatus.getMasterKeyStatus();

    const cacheEl = document.getElementById('dbgFbCache');
    if (cacheEl) cacheEl.textContent = DebugAppStatus.getCacheStatus();

    const pwdEl = document.getElementById('dbgFbPwdCount');
    if (pwdEl) pwdEl.textContent = DebugAppStatus.getPasswordCount() + ' hesel v cache';
}

function updateDebugVykon() {
    const history = DebugFPS.getHistory();
    const fps     = DebugFPS.getFPS();

    // Badge
    const badge = document.getElementById('dbgFpsBadge');
    if (badge) { badge.textContent = fps + ' FPS'; badge.style.color = DebugFPS.getColor(); }

    // Min/Max/Avg
    if (history.length > 0) {
        const min = Math.min(...history);
        const max = Math.max(...history);
        const avg = Math.round(history.reduce((a,b) => a+b, 0) / history.length);
        const minEl = document.getElementById('dbgFpsMin'); if (minEl) minEl.textContent = min;
        const maxEl = document.getElementById('dbgFpsMax'); if (maxEl) maxEl.textContent = max;
        const avgEl = document.getElementById('dbgFpsAvg'); if (avgEl) avgEl.textContent = avg;
    }

    // Canvas graf
    drawFpsGraph();

    // Paměť
    const memPanel = document.getElementById('dbgMemPanel');
    if (memPanel) {
        const mem = DebugAppStatus.getMemoryInfo();
        if (mem) {
            const color = mem.pct > 80 ? '#ef5350' : mem.pct > 60 ? '#f0c040' : '#00e676';
            memPanel.innerHTML = `
                <div style="font-family:'Share Tech Mono',monospace;font-size:0.78em;margin-bottom:8px;">
                    <span style="color:rgba(179,229,252,0.45);">Použito:</span>
                    <span style="color:${color};font-weight:bold;margin-left:8px;">${mem.used} MB / ${mem.total} MB (${mem.pct}%)</span>
                </div>
                <div class="dbg-bar">
                    <div class="dbg-bar-fill" style="width:${mem.pct}%;background:${color};color:${color};"></div>
                </div>`;
        } else {
            memPanel.innerHTML = `<div style="font-family:'Share Tech Mono',monospace;font-size:0.75em;color:rgba(179,229,252,0.35);">
                Paměťové API není v tomto prohlížeči dostupné.</div>`;
        }
    }

    // Viewport
    const vp = document.getElementById('dbgViewport');
    if (vp) vp.textContent = `${window.innerWidth} × ${window.innerHeight} px`;
}

function drawFpsGraph() {
    const canvas = document.getElementById('debugFpsCanvas');
    if (!canvas) return;

    const ctx     = canvas.getContext('2d');
    const history = DebugFPS.getHistory();
    const W       = canvas.offsetWidth;
    const H       = canvas.height;

    canvas.width = W;

    ctx.clearRect(0, 0, W, H);

    // Pozadí
    ctx.fillStyle = 'rgba(2,15,28,0.9)';
    ctx.fillRect(0, 0, W, H);

    // Mřížka
    ctx.strokeStyle = 'rgba(13,58,110,0.3)';
    ctx.lineWidth   = 1;
    [30, 60].forEach(line => {
        const y = H - (line / 65) * H;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.fillStyle = 'rgba(179,229,252,0.2)';
        ctx.font = '9px Share Tech Mono';
        ctx.fillText(line + ' FPS', 3, y - 2);
    });

    if (history.length < 2) return;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   'rgba(0,230,118,0.3)');
    grad.addColorStop(1,   'rgba(0,230,118,0.0)');

    const step = W / (history.length - 1);

    ctx.beginPath();
    ctx.moveTo(0, H - (history[0] / 65) * H);
    history.forEach((v, i) => {
        ctx.lineTo(i * step, H - (Math.min(v, 65) / 65) * H);
    });
    ctx.lineTo((history.length - 1) * step, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Linie
    ctx.beginPath();
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#00e676';
    ctx.shadowBlur  = 4;
    ctx.moveTo(0, H - (history[0] / 65) * H);
    history.forEach((v, i) => {
        ctx.lineTo(i * step, H - (Math.min(v, 65) / 65) * H);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function updateDebugLogy(filter) {
    const container = document.getElementById('debugLogContainer');
    if (!container) return;

    const logs = DebugLogger.getLogs();
    const show = filter ? logs.filter(l => l.type === filter) : logs;

    if (show.length === 0) {
        container.innerHTML = `<div style="padding:20px;text-align:center;
            font-family:'Share Tech Mono',monospace;font-size:0.75em;color:rgba(179,229,252,0.3);">
            Žádné logy k zobrazení.</div>`;
    } else {
        container.innerHTML = show.map(l => `
            <div class="dbg-log-line ${l.type}">
                <span class="dbg-log-time">${l.time}</span>
                <span class="dbg-log-type">${l.type.toUpperCase()}</span>
                <span class="dbg-log-msg">${escapeDebugHtml(l.msg)}</span>
            </div>`).join('');
    }

    // Statistiky
    const totalEl  = document.getElementById('dbgLogTotal');
    const warnsEl  = document.getElementById('dbgLogWarns');
    const errorsEl = document.getElementById('dbgLogErrors');
    if (totalEl)  totalEl.textContent  = DebugLogger.getCount();
    if (warnsEl)  warnsEl.textContent  = DebugLogger.getWarnCount();
    if (errorsEl) errorsEl.textContent = DebugLogger.getErrorCount();

    // Skryj badge
    const badge = document.getElementById('debugLogBadge');
    if (badge) badge.style.display = 'none';
}

function escapeDebugHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ============================================================
// 🎛️ OVLÁDÁNÍ PANELU
// ============================================================

function openDebugMenu() {
    const overlay = document.getElementById('debugMenuOverlay');
    const panel   = document.getElementById('debugMenuPanel');
    if (overlay) overlay.style.display = 'block';
    if (panel)   panel.style.display   = 'flex';

    // Aktualizuj data ihned
    updateDebugPrehled();
    updateDebugStatusBar();
}

function closeDebugMenu() {
    const overlay = document.getElementById('debugMenuOverlay');
    const panel   = document.getElementById('debugMenuPanel');
    if (overlay) overlay.style.display = 'none';
    if (panel)   panel.style.display   = 'none';
}

function debugSwitchTab(tabId, btn) {
    // Deaktivuj všechny taby
    document.querySelectorAll('.dbg-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dbg-section').forEach(s => s.classList.remove('active'));

    // Aktivuj zvolený
    btn.classList.add('active');
    const section = document.getElementById('dbgTab-' + tabId);
    if (section) section.classList.add('active');

    // Okamžitá aktualizace
    if (tabId === 'logy') updateDebugLogy();
    if (tabId === 'vykon') updateDebugVykon();
    if (tabId === 'firebase') updateDebugFirebase();
}

// ============================================================
// 🔧 LOG OVLÁDÁNÍ
// ============================================================

function debugScrollLogsBottom() {
    const c = document.getElementById('debugLogContainer');
    if (c) c.scrollTop = c.scrollHeight;
}

function debugFilterLogs(type) {
    updateDebugLogy(type === 'all' ? null : type);
}

function debugClearLogs() {
    DebugLogger.clearLogs();
    updateDebugLogy();
}

// ============================================================
// 🔥 FIREBASE NÁSTROJE
// ============================================================

async function debugTestFirebase() {
    const resultEl = document.getElementById('dbgFbToolResult');
    if (!resultEl) return;
    resultEl.style.display = 'block';
    resultEl.textContent   = '🔄 Testuji spojení...';

    try {
        if (typeof window.__firebaseDebug !== 'undefined') {
            const result = await window.__firebaseDebug.testConnection();
            resultEl.textContent = '✅ Firestore: spojení OK';
            resultEl.style.color = '#00e676';
        } else {
            resultEl.textContent = '⚠️ Firebase debug API není dostupné.';
            resultEl.style.color = '#f0c040';
        }
    } catch(e) {
        resultEl.textContent = '❌ Chyba: ' + e.message;
        resultEl.style.color = '#ef5350';
    }
}

function debugGetUserId() {
    const resultEl = document.getElementById('dbgFbToolResult');
    if (!resultEl) return;
    resultEl.style.display = 'block';

    try {
        if (typeof window.__firebaseDebug !== 'undefined') {
            const uid = window.__firebaseDebug.getCurrentUserId();
            resultEl.textContent = uid ? `👤 UID: ${uid}` : '⚠️ Uživatel není přihlášen';
            resultEl.style.color = uid ? '#4fc3f7' : '#f0c040';
        } else {
            const user = firebase.auth().currentUser;
            resultEl.textContent = user ? `👤 UID: ${user.uid}` : '⚠️ Nepřihlášen';
            resultEl.style.color = '#4fc3f7';
        }
    } catch(e) {
        resultEl.textContent = '❌ ' + e.message;
        resultEl.style.color = '#ef5350';
    }
}

async function debugRefreshCache() {
    const resultEl = document.getElementById('dbgFbToolResult');
    if (!resultEl) return;
    resultEl.style.display = 'block';
    resultEl.textContent   = '🔄 Refreshuji cache...';
    resultEl.style.color   = '#4fc3f7';

    try {
        if (typeof getPasswordsWithCache === 'function') {
            await getPasswordsWithCache(true); // forceRefresh
            resultEl.textContent = '✅ Cache úspěšně obnovena!';
            resultEl.style.color = '#00e676';
            updateDebugFirebase();
        } else {
            resultEl.textContent = '⚠️ getPasswordsWithCache není dostupná.';
            resultEl.style.color = '#f0c040';
        }
    } catch(e) {
        resultEl.textContent = '❌ ' + e.message;
        resultEl.style.color = '#ef5350';
    }
}

console.log('🔧 Vlastni-debug-menu.js načten - Diagnostika online! 🚀');
