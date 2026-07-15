// ============================================
// TL GLOBAL REGION TRACKER - LIVE CORE SCRIPT
// ============================================

const FIREBASE_URL = "https://boss-spawn-throneandliberty-default-rtdb.europe-west1.firebasedatabase.app/";
const DISCORD_WEBHOOK_URL = "TUTAJ_WKLEJ_SWOJ_LINK_Z_DISCORDA_WEBHOOKA";

// Oficjalne powiązanie 8 dungeonów z Twoimi nowymi strefami i domyślnym czasem 4h (240 minut)
const staticDungeons = [
    { id: 0, name: "Temple of Truth", zone: "yellow", filename: "temple_of_truth", defaultMin: 240 },
    { id: 1, name: "Crimson Estate", zone: "yellow", filename: "crimson_estate", defaultMin: 240 },
    { id: 2, name: "Bercant Estate", zone: "yellow", filename: "bercant_estate", defaultMin: 240 },
    { id: 3, name: "Syleus's Abyss", zone: "red", filename: "syleus_abyss", defaultMin: 240 },
    { id: 4, name: "Shadowed Crypt", zone: "red", filename: "shadowed_crypt", defaultMin: 240 },
    { id: 5, name: "Temple of Sylaveth", zone: "blue", filename: "temple_of_sylaveth", defaultMin: 240 },
    { id: 6, name: "Ant Nest", zone: "blue", filename: "ant_nest", defaultMin: 240 },
    { id: 7, name: "Sanctum of Desire", zone: "blue", filename: "sanctum_of_desire", defaultMin: 240 }
];

let dungeonStates = {}; 
let activeIndex = null;
let triggeredAlerts = {};

// ============================================
// FUNKCJE PRZEŁĄCZANIA I PODMIANY MAP W LOCIE
// ============================================

function changeTacticalMap(type, filename, displayName) {
    const worldMap = document.getElementById("worldMap");
    const subMap = document.getElementById("subMap");
    const svgOverlay = document.getElementById("svgOverlay");
    const htmlOverlay = document.getElementById("htmlOverlay");
    const backBtn = document.getElementById("backToWorldBtn");
    const viewDisplay = document.getElementById("viewLocationName");
    
    // 1. Aktualizacja napisów na środku paska topbar
    if (viewDisplay) {
        viewDisplay.innerText = displayName.toUpperCase();
        viewDisplay.style.color = "#ffd54f"; // Jaskrawy żółty kolor taktyczny
    }

    // 2. Budowanie ścieżki i ładowanie obrazu sub-mapy
    if (type === 'region') {
        subMap.src = `images/region-${filename}.png`;
    } else if (type === 'dungeon') {
        subMap.src = `images/dungeon-${filename}.png`;
    }

    // 3. Przełączanie widoczności elementów w oknie aplikacji
    if (worldMap) worldMap.style.display = "none";
    if (svgOverlay) svgOverlay.style.display = "none";
    if (htmlOverlay) htmlOverlay.style.display = "none";
    
    if (subMap) subMap.classList.remove("hide-submap");
    if (backBtn) {
        backBtn.classList.remove("hide-btn");
        backBtn.classList.add("show-back-btn");
    }
}

function resetToWorldMap() {
    const worldMap = document.getElementById("worldMap");
    const subMap = document.getElementById("subMap");
    const svgOverlay = document.getElementById("svgOverlay");
    const htmlOverlay = document.getElementById("htmlOverlay");
    const backBtn = document.getElementById("backToWorldBtn");
    const viewDisplay = document.getElementById("viewLocationName");

    // Przywrócenie napisu WORLD MAP na środku paska
    if (viewDisplay) {
        viewDisplay.innerText = "WORLD MAP";
        viewDisplay.style.color = "#00e676"; // Powrót do zielonego standardu
    }

    // Przywrócenie widoczności głównych warstw mapy świata
    if (worldMap) worldMap.style.display = "block";
    if (svgOverlay) svgOverlay.style.display = "block";
    if (htmlOverlay) htmlOverlay.style.display = "block";
    
    if (subMap) {
        subMap.classList.add("hide-submap");
        subMap.src = "";
    }
    if (backBtn) {
        backBtn.classList.remove("show-back-btn");
        backBtn.classList.add("hide-btn");
    }
}

// Ręczne podpięcie funkcji przełączania pod przyciski HTML, aby zapobiec konfliktom
window.changeTacticalMap = changeTacticalMap;
window.resetToWorldMap = resetToWorldMap;

// ============================================
// SYNCHRONIZACJA Z BAZĄ DANYCH FIREBASE
// ============================================

function syncTimersData() {
    fetch(`${FIREBASE_URL}region_timers.json?t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
            dungeonStates = data || {};
            
            staticDungeons.forEach(d => {
                if (!dungeonStates[`dungeon_${d.id}`]) {
                    dungeonStates[`dungeon_${d.id}`] = {
                        killTimestamp: 0,
                        customMinutes: d.defaultMin
                    };
                }
            });
            
            updateSidebarUI();
            recalculateMapCounters();
        })
        .catch(err => console.error("Error connecting with Firebase:", err));
}

function uploadDungeonState(id) {
    fetch(`${FIREBASE_URL}region_timers/dungeon_${id}.json`, {
        method: "PUT",
        body: JSON.stringify(dungeonStates[`dungeon_${id}`])
    }).catch(err => console.error("Error saving to Firebase:", err));
}

// ============================================
// LOGIKA SELEKCJI DUNGEONÓW Z PANELU BOCZNEGO
// ============================================

function selectDungeon(index) {
    activeIndex = index;
    
    document.querySelectorAll(".dungeon-btn").forEach((btn, idx) => {
        if (idx === index) btn.classList.add("active");
        else btn.classList.remove("active");
    });

    document.querySelectorAll(".map-zone").forEach(p => {
        if (p.className && p.className.baseVal) {
            p.className.baseVal = p.className.baseVal.replace(/\bglow-\w+\b/g, "").trim();
        }
    });

    const targetZone = staticDungeons[index].zone;
    const pathEl = document.getElementById(`region-${targetZone}`);
    if (pathEl && pathEl.className && pathEl.className.baseVal) {
        pathEl.className.baseVal += ` glow-${targetZone}`;
    }

    updateSidebarUI();
    
    // Automatyczne wejście w widok szczegółowy po kliknięciu dungeonu z listy
    changeTacticalMap('dungeon', staticDungeons[index].filename, staticDungeons[index].name);
}
window.selectDungeon = selectDungeon;

function updateSidebarUI() {
    if (activeIndex === null) return;
    const d = staticDungeons[activeIndex];
    const state = dungeonStates[`dungeon_${d.id}`] || { killTimestamp: 0, customMinutes: d.defaultMin };

    document.getElementById("curName").innerText = d.name;
    document.getElementById("curConfigTime").innerText = `${Math.floor(state.customMinutes / 60)}h (${state.customMinutes}m)`;

    if (state.killTimestamp === 0) {
        document.getElementById("curStatus").innerHTML = '<span style="color: #00e676;">🔵 READY</span>';
        document.getElementById("curTimer").innerText = "READY";
    } else {
        document.getElementById("curStatus").innerHTML = '<span style="color: #ff3333;">🔴 COOLDOWN ACTIVE</span>';
    }
}

// ============================================
// STEROWANIE PANELU STEROWANIA ZABÓJSTWAMI
// ============================================

function registerKill() {
    if (activeIndex === null) return;
    const id = staticDungeons[activeIndex].id;
    
    dungeonStates[`dungeon_${id}`].killTimestamp = Date.now();
    if (triggeredAlerts[id]) delete triggeredAlerts[id];

    uploadDungeonState(id);
    updateSidebarUI();
    recalculateMapCounters();
}
window.registerKill = registerKill;

function resetToReady() {
    if (activeIndex === null) return;
    const id = staticDungeons[activeIndex].id;

    if (!confirm(`Reset ${staticDungeons[activeIndex].name} to READY?`)) return;

    dungeonStates[`dungeon_${id}`].killTimestamp = 0;
    if (triggeredAlerts[id]) delete triggeredAlerts[id];

    uploadDungeonState(id);
    updateSidebarUI();
    recalculateMapCounters();
}
window.resetToReady = resetToReady;

function manuallyChangeMinutes() {
    if (activeIndex === null) return;
    const id = staticDungeons[activeIndex].id;
    const currentState = dungeonStates[`dungeon_${id}`];

    let input = prompt(`Modify respawn timer for ${staticDungeons[activeIndex].name} (in MINUTES):`, currentState.customMinutes);
    if (input === null) return;

    let parsedVal = Number(input);
    if (isNaN(parsedVal) || parsedVal <= 0) {
        alert("Please enter a valid amount of minutes!");
        return;
    }

    currentState.customMinutes = parsedVal;
    if (triggeredAlerts[id]) delete triggeredAlerts[id];

    uploadDungeonState(id);
    updateSidebarUI();
    recalculateMapCounters();
}
window.manuallyChangeMinutes = manuallyChangeMinutes;

// ============================================
// PRZELICZANIE LICZNIKÓW W DÓŁ (COUNTDOWN TIMERY)
// ============================================

function recalculateMapCounters() {
    let activeZoneTimers = { yellow: null, purple: null, red: null, blue: null };

    staticDungeons.forEach(d => {
        const state = dungeonStates[`dungeon_${d.id}`];
        if (!state || state.killTimestamp === 0) return;

        let totalDurationSec = state.customMinutes * 60;
        let elapsedSec = Math.floor((Date.now() - state.killTimestamp) / 1000);
        let remainingSec = totalDurationSec - elapsedSec;

        if (remainingSec > 0) {
            if (activeZoneTimers[d.zone] === null || remainingSec < activeZoneTimers[d.zone].sec) {
                activeZoneTimers[d.zone] = { sec: remainingSec, dungeonObj: d, stamp: state.killTimestamp };
            }
        }
    });

    ["yellow", "purple", "red", "blue"].forEach(zone => {
        const timerEl = document.getElementById(`zone-timer-${zone}`);
        if (!timerEl) return;

        const data = activeZoneTimers[zone];
        if (data === null) {
            timerEl.classList.add("hide");
            timerEl.classList.remove("alert-active");
            timerEl.innerText = "00:00:00";
        } else {
            timerEl.classList.remove("hide");
            timerEl.innerText = secondsToString(data.sec);

            if (data.sec <= 600) { 
                timerEl.classList.add("alert-active");

                if (triggeredAlerts[data.dungeonObj.id] !== data.stamp) {
                    playVoiceAlert(data.dungeonObj.name);
                    sendDiscordNotification(data.dungeonObj.name);
                    triggeredAlerts[data.dungeonObj.id] = data.stamp;
                }
            } else {
                timerEl.classList.remove("alert-active");
            }
        }
    });

    if (activeIndex !== null) {
        const activeD = staticDungeons[activeIndex];
        const activeState = dungeonStates[`dungeon_${activeD.id}`];
        if (activeState && activeState.killTimestamp !== 0) {
            let total = activeState.customMinutes * 60;
            let elap = Math.floor((Date.now() - activeState.killTimestamp) / 1000);
            let rem = total - elap;
            if (rem > 0) document.getElementById("curTimer").innerText = secondsToString(rem);
            else document.getElementById("curTimer").innerText = "READY";
        }
    }
}

function playVoiceAlert(dungeonName) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const text = `Attention. Elite boss will respawn in ten minutes at ${dungeonName}.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}

function sendDiscordNotification(dungeonName) {
    if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes("TUTAJ_WKLEJ")) return;

    const msg = `🔔 **[@here] Elite Boss Alert!**\nBoss will respawn in **10 minutes** at dungeon: **${dungeonName}**!`;
    fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: msg, username: "TL Global Tracker" })
    }).catch(err => console.error("Discord integration post failed:", err));
}

function secondsToString(sec) {
    let h = Math.floor(sec / 3600);
    let m = Math.floor((sec % 3600) / 60);
    let s = Math.floor(sec % 60);
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function updateClock() {
    const el = document.getElementById("clock");
    if (el) el.innerText = new Date().toLocaleTimeString();
}

updateClock();
syncTimersData();
setInterval(updateClock, 1000);
setInterval(recalculateMapCounters, 1000);
setInterval(syncTimersData, 5000);
