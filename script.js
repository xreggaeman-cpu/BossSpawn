// ============================================
// TL ELITE BOSS TRACKER - FIREBASE LIVE SCRIPT
// ============================================

// KONFIGURACJA CHMURY - Twój oryginalny link z Firebase
const FIREBASE_URL = "https://boss-spawn-throneandliberty-default-rtdb.europe-west1.firebasedatabase.app/";


// Baza danych domyślnych bossów (jeśli baza w chmurze jest całkowicie pusta)
const defaultBosses = [
    { id: 1, name: "Pirate Chest King", dungeon: "Daybreak Shore", type: "PvP", x: 64, y: 42, respawnMinutes: 240, voiceEnabled: true }
];

// LOKALNA PAMIĘĆ PODRĘCZNA (Single Source of Truth)
let bosses = [];
let cachedHistory = {}; // Format: { boss_1: [timestamps], boss_2: [...] }
let selectedBoss = null;

const layer = document.getElementById("bossLayer");

// ============================================
// SYNCHRONIZACJA Z BAZĄ DANYCH W CHMURZE
// ============================================

// Centralna funkcja pobierająca wszystko jednym zapytaniem co 5 sekund
function syncWithCloud() {
    if (dragBoss !== null) return;

    // Pobieramy cały główny węzeł bazy danych z cache bustingiem
    fetch(`${FIREBASE_URL}.json?t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
            if (!data) {
                // Jeśli baza jest całkowicie pusta, inicjalizujemy domyślne dane
                bosses = JSON.parse(JSON.stringify(defaultBosses));
                cachedHistory = {};
                saveBossesList();
                renderBossesOnMap();
                return;
            }

            // Aktualizujemy pamięć podręczną z danych z chmury
            bosses = data.bosses || [];
            cachedHistory = data.history || {};

            // Odświeżamy referencję wybranego bossa, jeśli jakiś jest zaznaczony
            if (selectedBoss) {
                let updatedBoss = bosses.find(b => b.id === selectedBoss.id);
                if (updatedBoss) selectedBoss = updatedBoss;
            }

            // Zapobiega ciągłemu czyszczeniu mapy, jeśli liczba bossów się nie zmieniła
            const activeIcons = document.querySelectorAll(".boss");
            if (activeIcons.length !== bosses.length) {
                renderBossesOnMap();
            } else {
                // Jeśli liczba się zgadza, tylko odświeżamy teksty i kolory na ekranie
                updateUIComponents();
            }
        })
        .catch(err => console.error("Błąd globalnej synchronizacji:", err));
}

// Zapisuje wyłącznie strukturę, pozycje i ustawienia czasu bossów
function saveBossesList() {
    fetch(`${FIREBASE_URL}bosses.json`, {
        method: "PUT",
        body: JSON.stringify(bosses)
    }).catch(err => console.error("Błąd zapisu pozycji i konfiguracji:", err));
}

// Lokalny pomocnik - pobiera historię bezpośrednio z pamięci RAM zamiast z sieci
function getLocalHistory(bossId) {
    return cachedHistory[`boss_${bossId}`] || [];
}

function saveKillToCloud(bossId, timestamp) {
    let history = JSON.parse(JSON.stringify(getLocalHistory(bossId)));
    
    if (history[0] === 0) {
        history.shift();
    }

    history.unshift(timestamp);
    history.sort((a, b) => b - a);

    // Wysyłamy zmienioną historię dla konkretnego bossa
    fetch(`${FIREBASE_URL}history/boss_${bossId}.json`, {
        method: "PUT",
        body: JSON.stringify(history)
    })
    .then(() => {
        // Aktualizujemy lokalny cache natychmiast, żeby UI nie czekało na kolejny cykl syncWithCloud
        cachedHistory[`boss_${bossId}`] = history;
        
        let currentBoss = bosses.find(b => b.id === bossId);
        if (currentBoss) currentBoss.voiceAlertTriggered = false; // Gotowy na nowy alert mowy

        updateUIComponents();
        if (selectedBoss && selectedBoss.id === bossId) {
            renderHistoryListUI();
        }
    })
    .catch(err => console.error("Błąd zapisu killa:", err));
}

// ============================================
// RENDEROWANIE IKON NA MAPIE
// ============================================
function renderBossesOnMap() {
    if (!layer) return;
    layer.innerHTML = "";

    bosses.forEach(boss => {
        let container = document.createElement("div");
        container.className = "boss-container";
        container.style.left = boss.x + "%";
        container.style.top = boss.y + "%";

        let timerDiv = document.createElement("div");
        timerDiv.className = "boss-timer";
        timerDiv.id = "timer_" + boss.id;
        timerDiv.innerText = "READY";
        container.appendChild(timerDiv);

        let div = document.createElement("div");
        div.className = "boss";
        div.dataset.id = boss.id;
        div.title = boss.name;

        div.onclick = (e) => {
            e.stopPropagation();
            selectBoss(boss);
        };
        
        container.appendChild(div);
        layer.appendChild(container);
    });

    updateUIComponents();
}

function selectBoss(boss) {
    selectedBoss = boss;
    document.getElementById("bossName").innerText = boss.name;
    document.getElementById("bossDungeon").innerText = boss.dungeon;
    document.getElementById("bossType").innerText = boss.type;

    // Przeliczanie minut na czytelny format Xh Ym w panelu bocznym
    let respTimeText = "Not set";
    if (boss.respawnMinutes) {
        let h = Math.floor(boss.respawnMinutes / 60);
        let m = boss.respawnMinutes % 60;
        respTimeText = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    document.getElementById("bossRespawnTime").innerText = respTimeText;
    document.getElementById("bossVoiceAlertStatus").innerText = boss.voiceEnabled ? "🔊 ON (10m before)" : "🔇 OFF";

    renderHistoryListUI();
    updateUIComponents();
}

// ============================================
// REJESTRACJA ZABÓJSTW
// ============================================
function saveKill() {
    if (selectedBoss == null) return;
    saveKillToCloud(selectedBoss.id, Date.now());
}

function addManualKill() {
    if (selectedBoss == null) {
        alert("Choose Boss!");
        return;
    }

    let value = prompt("Time kill\nfor example:\n23:30");
    if (value == null || value.trim() == "") return;

    let split = value.split(":");
    if (split.length != 2) {
        alert("Error! Use GG:MM");
        return;
    }

    let hours = Number(split[0]);
    let minutes = Number(split[1]);

    if (isNaN(hours) || hours < 0 || hours > 23 || isNaN(minutes) || minutes < 0 || minutes > 59) {
        alert("An invalid hour or minute was entered!");
        return;
    }

    let d = new Date();
    d.setHours(hours, minutes, 0, 0);

    if (d.getTime() > Date.now()) {
        d.setDate(d.getDate() - 1);
    }

    saveKillToCloud(selectedBoss.id, d.getTime());
}

function resetBossToBlue() {
    if (selectedBoss == null) {
        alert("First choose boss!");
        return;
    }
    if (!confirm(`Reset Boss: ${selectedBoss.name} to READY without deleting history?`)) return;

    let currentId = selectedBoss.id;
    let history = JSON.parse(JSON.stringify(getLocalHistory(currentId)));
    
    if (history[0] !== 0) {
        history.unshift(0); 
    }

    fetch(`${FIREBASE_URL}history/boss_${currentId}.json`, {
        method: "PUT",
        body: JSON.stringify(history)
    })
    .then(() => {
        cachedHistory[`boss_${currentId}`] = history;
        
        let currentBoss = bosses.find(b => b.id === currentId);
        if (currentBoss) currentBoss.voiceAlertTriggered = false; // Reset flagi alertu mowy

        renderHistoryListUI();
        updateUIComponents();
    })
    .catch(err => console.error("Błąd podczas resetowania bossa:", err));
}

function configureBossAlert() {
    alert("Uruchamiam test głosu. Kliknij OK i posłuchaj głośników...");
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Kasuje ewentualną kolejkę
        
        const testUtterance = new SpeechSynthesisUtterance("Test systemu mowy. Jeśli mnie słyszysz, powiadomienia głosowe działają poprawnie.");
        testUtterance.lang = 'pl-PL';
        testUtterance.rate = 1.0;
        testUtterance.pitch = 1.0;
        
        window.speechSynthesis.speak(testUtterance);
    } else {
        alert("Twoja przeglądarka blokuje syntezator mowy!");
    }
}


// Odpowiada tylko za wygenerowanie elementów <li> w panelu bocznym
function renderHistoryListUI() {
    if (selectedBoss == null) return;
    let list = document.getElementById("historyList");
    let currentId = selectedBoss.id;
    let data = getLocalHistory(currentId);

    list.innerHTML = "";
    
    let realHistory = data.filter(time => time !== 0);

    if (realHistory.length == 0) {
        list.innerHTML = "<li>No history</li>";
        document.getElementById("lastKill").innerText = "---";
        return;
    }

    realHistory.sort((a, b) => b - a);
function playVoiceAlert(bossName, dungeonName) {
    if ('speechSynthesis' in window) {
        const messageText = `10 minut do spawnu bossa ${bossName}. Dungeon ${dungeonName}`;
        const utterance = new SpeechSynthesisUtterance(messageText);
        utterance.lang = 'pl-PL';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn("Twoja przeglądarka nie obsługuje syntezatora mowy.");
    }
}

function secondsToString(sec) {
    let h = Math.floor(sec / 3600);
    let m = Math.floor((sec % 3600) / 60);
    let s = Math.floor(sec % 60);
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function updateUIComponents() {
    updateLocalElapsed();
    updateLocalMapTimers();
    updateLocalBossIconsAndStatus();
}

function updateLocalElapsed() {
    if (selectedBoss == null) {
        document.getElementById("elapsed").innerText = "00:00:00";
        return;
    }
    let data = getLocalHistory(selectedBoss.id);
    let realHistory = data.filter(time => time !== 0);
    if (realHistory.length == 0) {
        document.getElementById("elapsed").innerText = "--";
        return;
    }
    realHistory.sort((a, b) => b - a);
    let diff = Math.floor((Date.now() - realHistory[0]) / 1000);
    document.getElementById("elapsed").innerText = secondsToString(diff);
}

function updateClock() {
    let clockEl = document.getElementById("clock");
    if (clockEl) clockEl.innerText = new Date().toLocaleTimeString();
}

function updateLocalMapTimers() {
    bosses.forEach(boss => {
        let timerEl = document.getElementById("timer_" + boss.id);
        if (!timerEl) return;
        
        let data = getLocalHistory(boss.id);
        if (data.length == 0 || data[0] === 0) {
            timerEl.innerText = "READY";
            timerEl.style.color = "#3b82f6";
            boss.voiceAlertTriggered = false;
            return;
        }
        
        let sorted = [...data].sort((a, b) => b - a);
        let diffInSeconds = Math.floor((Date.now() - sorted[0]) / 1000);
        let muteStatus = boss.voiceEnabled ? " 🔊" : " 🔇";
        timerEl.innerText = "KILLED " + secondsToString(diffInSeconds) + " AGO" + muteStatus;
        timerEl.style.color = "#ff3030";
        
        let respawnMinutes = boss.respawnMinutes || 240;
        let totalRespawnSeconds = respawnMinutes * 60;
        let alertTimeSeconds = totalRespawnSeconds - 600;
        
        if (diffInSeconds === alertTimeSeconds && boss.voiceEnabled === true) {
            if (!boss.voiceAlertTriggered) {
                playVoiceAlert(boss.name, boss.dungeon);
                boss.voiceAlertTriggered = true;
            }
        }
        if (diffInSeconds > alertTimeSeconds && boss.voiceAlertTriggered === undefined) {
            boss.voiceAlertTriggered = true;
        }
    });
}

function updateLocalBossIconsAndStatus() {
    document.querySelectorAll(".boss").forEach(icon => {
        let id = Number(icon.dataset.id);
        let data = getLocalHistory(id);
        icon.className = "boss";
        if (data.length == 0 || data[0] === 0) {
            icon.classList.add("blue");
        } else {
            icon.classList.add("red", "pulse");
        }
    });
    
    if (selectedBoss == null) return;
    let span = document.getElementById("bossStatus");
    if (!span) return;
    
    let data = getLocalHistory(selectedBoss.id);
    if (data.length == 0 || data[0] === 0) {
        span.innerHTML = '🔵 READY';
    } else {
        span.innerHTML = '🔴 KILLED';
    }
}

// ============================================
// DRAG & DROP
// ============================================
let dragBoss = null;

document.addEventListener("mousedown", function(e) {
    if (e.target.classList.contains("boss")) dragBoss = e.target;
});

document.addEventListener("mouseup", function() {
    if (dragBoss) saveBossesList();
    dragBoss = null;
});

document.addEventListener("mousemove", function(e) {
    if (!dragBoss) return;
    const map = document.getElementById("mapWrapper");
    if (!map) return;
    
    const rect = map.getBoundingClientRect();
    let x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    let y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    
    let container = dragBoss.parentElement;
    if (container && container.classList.contains("boss-container")) {
        container.style.left = x + "%";
        container.style.top = y + "%";
    }
    
    let id = Number(dragBoss.dataset.id);
    let boss = bosses.find(b => b.id === id);
    if (boss) {
        boss.x = x;
        boss.y = y;
    }
});

document.addEventListener("contextmenu", function(e) {
    if (!e.target.classList.contains("boss")) return;
    e.preventDefault();
    
    let id = Number(e.target.dataset.id);
    let boss = bosses.find(b => b.id === id);
    if (!boss) return;
    
    if (!confirm(`Usunąć bossa: ${boss.name}?`)) return;
    
    let index = bosses.findIndex(b => b.id === id);
    bosses.splice(index, 1);
    
    if (selectedBoss && selectedBoss.id === id) {
        selectedBoss = null;
        document.getElementById("bossName").innerText = "---";
        document.getElementById("bossDungeon").innerText = "---";
        document.getElementById("bossType").innerText = "---";
        document.getElementById("lastKill").innerText = "---";
        document.getElementById("bossStatus").innerText = "READY";
        document.getElementById("elapsed").innerText = "00:00:00";
        document.getElementById("historyList").innerHTML = "";
    }
    
    fetch(`${FIREBASE_URL}history/boss_${id}.json`, { method: "DELETE" });
    saveBossesList();
    renderBossesOnMap();
});

function addBoss() {
    let name = prompt("Boss name:");
    if (!name) return;
    let dungeon = prompt("Dungeon / Region:", "Unknown");
    let type = prompt("Type (PvP / Mini / Peace):", "PvP");
    
    let minutesInput = prompt("Enter respawn time in MINUTES:\n(np. 1h 30m = 90, 4h = 240)", "240");
    let minutes = Number(minutesInput) || 240;
    
    let voicePrompt = prompt("Enable voice alert 10m before spawn? (type: yes / no)", "no");
    let voiceEnabled = (voicePrompt && (voicePrompt.toLowerCase() === "yes" || voicePrompt.toLowerCase() === "y" || voicePrompt.toLowerCase() === "tak" || voicePrompt.toLowerCase() === "t"));
    
    bosses.push({
        id: Date.now(),
        name: name,
        dungeon: dungeon,
        type: type,
        x: 50,
        y: 50,
        respawnMinutes: minutes,
        voiceEnabled: voiceEnabled
    });
    saveBossesList();
    renderBossesOnMap();
}

document.getElementById("killButton").onclick = saveKill;
document.getElementById("manualKill").onclick = addManualKill;
document.getElementById("addBoss").onclick = addBoss;
document.getElementById("resetBossState").onclick = resetBossToBlue;
document.getElementById("configureVoiceButton").onclick = configureBossAlert;

// ============================================
// START I LOKALNE INTERWAŁY AUTOMATYCZNE
// ============================================
updateClock();
syncWithCloud();

setInterval(updateUIComponents, 1000);
setInterval(updateClock, 1000);
setInterval(syncWithCloud, 5000);

///
///setInterval(updateElapsed, 1000);
//setInterval(updateClock, 1000);
//setInterval(updateStatus, 1000);
//setInterval(updateMapTimers, 1000);  // Sprawdzanie chmury co 1 sekundę
//setInterval(updateBossStates, 1000); // Odświeżanie kolorów co 1 sekundę
//setInterval(loadAllData, 10000);      // Błyskawiczna synchronizacja struktury co 1 sekundę
