// ============================================
// TL ELITE BOSS TRACKER - FIREBASE LIVE SCRIPT
// ============================================

// KONFIGURACJA CHMURY - Twój oryginalny link z Firebase
const FIREBASE_URL = "https://boss-spawn-throneandliberty-default-rtdb.europe-west1.firebasedatabase.app/";

// Baza danych domyślnych bossów (jeśli baza w chmurze jest całkowicie pusta)
const defaultBosses = [
    { id: 1, name: "Pirate Chest King", dungeon: "Daybreak Shore", type: "PvP", x: 64, y: 42 }
];

let bosses = [];
let selectedBoss = null;
const layer = document.getElementById("bossLayer");

// Słownik zapobiegający ciągłemu zapętlaniu się głosu lektora w tej samej sekundzie
let triggeredAlerts = {};

// ============================================
// SYNCHRONIZACJA Z BAZĄ DANYCH W CHMURZE
// ============================================

function loadAllData() {
    // Zabezpieczenie przed przerwaniem ruchu podczas przeciągania ikony myszką
    if (dragBoss !== null) return;

    // Pobieranie struktury bossów z ominięciem pamięci podręcznej (Cache Busting)
    fetch(`${FIREBASE_URL}bosses.json?t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
            if (data) {
                bosses = data;
                
                if (selectedBoss) {
                    let updatedBoss = bosses.find(b => b.id === selectedBoss.id);
                    if (updatedBoss) {
                        selectedBoss = updatedBoss;
                        // Aktualizacja napisów konfiguracji w panelu bocznym
                        let respMinutes = selectedBoss.respawnMinutes || 240;
                        let h = Math.floor(respMinutes / 60);
                        let m = respMinutes % 60;
                        if (document.getElementById("bossRespawnTime")) {
                            document.getElementById("bossRespawnTime").innerText = h > 0 ? `${h}h ${m}m` : `${m}m`;
                        }
                        if (document.getElementById("bossVoiceAlertStatus")) {
                            document.getElementById("bossVoiceAlertStatus").innerText = selectedBoss.voiceEnabled ? "🔊 WŁĄCZONE" : "🔇 WYŁĄCZONE";
                        }
                    }
                }
            } else {
                bosses = JSON.parse(JSON.stringify(defaultBosses));
                saveAllData();
            }
            loadBosses();
        })
        .catch(err => console.error("Błąd pobierania struktury bossów:", err));
}

function saveAllData() {
    fetch(`${FIREBASE_URL}bosses.json`, {
        method: "PUT",
        body: JSON.stringify(bosses)
    }).catch(err => console.error("Błąd zapisu pozycji:", err));
}

function fetchBossHistory(bossId, callback) {
    // Pobieranie historii z chmury z unikalnym znacznikiem czasu
    fetch(`${FIREBASE_URL}history/boss_${bossId}.json?t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
            callback(data || []);
        })
        .catch(err => console.error("Błąd pobierania historii:", err));
}

function saveKillToCloud(bossId, timestamp) {
    fetch(`${FIREBASE_URL}history/boss_${bossId}.json`)
        .then(res => res.json())
        .then(data => {
            let history = data || [];
            
            // Jeśli na początku był znacznik resetu (0), usuwamy go przed dodaniem realnego killa
            if (history[0] === 0) {
                history.shift();
            }

            history.unshift(timestamp);
            history.sort((a, b) => b - a);

            return fetch(`${FIREBASE_URL}history/boss_${bossId}.json`, {
                method: "PUT",
                body: JSON.stringify(history)
            });
        })
        .then(() => {
            if (triggeredAlerts[bossId]) {
                delete triggeredAlerts[bossId];
            }
            if (selectedBoss && selectedBoss.id === bossId) {
                loadHistory();
            }
            updateBossStates();
            updateMapTimers();
        })
        .catch(err => console.error("Błąd zapisu killa:", err));
}

// ============================================
// RENDEROWANIE IKON NA MAPIE
// ============================================
function loadBosses() {
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

    updateBossStates();
    updateMapTimers();
}

function selectBoss(boss) {
    selectedBoss = boss;
    document.getElementById("bossName").innerText = boss.name;
    document.getElementById("bossDungeon").innerText = boss.dungeon;
    document.getElementById("bossType").innerText = boss.type;

    // Prawidłowe ładowanie informacji o ustawieniach dynamicznych bosa
    let respMinutes = boss.respawnMinutes || 240;
    let h = Math.floor(respMinutes / 60);
    let m = respMinutes % 60;
    if (document.getElementById("bossRespawnTime")) {
        document.getElementById("bossRespawnTime").innerText = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    if (document.getElementById("bossVoiceAlertStatus")) {
        document.getElementById("bossVoiceAlertStatus").innerText = boss.voiceEnabled ? "🔊 WŁĄCZONE" : "🔇 WYŁĄCZONE";
    }

    loadHistory();
    updateElapsed();
    updateBossStates();
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
    
    fetch(`${FIREBASE_URL}history/boss_${currentId}.json`)
        .then(res => res.json())
        .then(data => {
            let history = data || [];
            
            // Wstrzykujemy bezpieczny znacznik 0 na początek, informujący o sof-tresecie koloru
            if (history[0] !== 0) {
                history.unshift(0); 
            }

            return fetch(`${FIREBASE_URL}history/boss_${currentId}.json`, {
                method: "PUT",
                body: JSON.stringify(history)
            });
        })
        .then(() => {
            if (triggeredAlerts[currentId]) {
                delete triggeredAlerts[currentId];
            }
            loadHistory();
            updateElapsed();
            updateBossStates();
            updateStatus();
            updateMapTimers();
        })
        .catch(err => console.error("Błąd podczas resetowania bossa:", err));
}

function configureBossAlert() {
    if (selectedBoss == null) {
        alert("First select a boss from the map!");
        return;
    }

    let currentMinutes = selectedBoss.respawnMinutes || 240;
    let minutesInput = prompt(`Enter respawn time in MINUTES for ${selectedBoss.name}:\n(np. 1h 30m = 90, 4h = 240)`, currentMinutes);
    if (minutesInput === null) return; 
    
    let minutes = Number(minutesInput);
    if (isNaN(minutes) || minutes <= 0) {
        alert("Please enter a valid number of minutes!");
        return;
    }

    let currentVoice = selectedBoss.voiceEnabled ? "yes" : "no";
    let voiceInput = prompt(`Enable voice alert for ${selectedBoss.name}? (type: yes / no)`, currentVoice);
    if (voiceInput === null) return; 

    let voiceEnabled = (voiceInput.toLowerCase() === "yes" || voiceInput.toLowerCase() === "y" || voiceInput.toLowerCase() === "tak" || voiceInput.toLowerCase() === "t");

    selectedBoss.respawnMinutes = minutes;
    selectedBoss.voiceEnabled = voiceEnabled;

    let h = Math.floor(minutes / 60);
    let m = minutes % 60;
    document.getElementById("bossRespawnTime").innerText = h > 0 ? `${h}h ${m}m` : `${m}m`;
    document.getElementById("bossVoiceAlertStatus").innerText = voiceEnabled ? "🔊 WŁĄCZONE" : "🔇 WYŁĄCZONE";

    saveAllData();
    alert(`Settings saved for ${selectedBoss.name}!`);
}

function loadHistory() {
    if (selectedBoss == null) return;
    let list = document.getElementById("historyList");
    let currentId = selectedBoss.id;

    fetchBossHistory(currentId, (data) => {
        if (selectedBoss && selectedBoss.id === currentId) {
            list.innerHTML = "";
            
            // Odrzucamy znacznik resetu (0) przy wyświetlaniu listy historycznej w panelu
            realHistory.sort((a, b) => b - a);
            document.getElementById("lastKill").innerText = formatDate(new Date(realHistory[0]));

            realHistory.forEach((time, index) => {
                let li = document.createElement("li");
                li.innerText = formatDate(new Date(time));
                li.style.cursor = "pointer";
                li.title = "Click to remove this entry";
                
                li.onclick = function() {
                    if (!confirm(`Remove this entry:\n${formatDate(new Date(time))}?`)) return;
                    
                    let origIndex = data.indexOf(time);
                    if (origIndex !== -1) data.splice(origIndex, 1);

                    fetch(`${FIREBASE_URL}history/boss_${currentId}.json`, {
                        method: "PUT",
                        body: JSON.stringify(data)
                    }).then(() => {
                        loadHistory();
                        updateBossStates();
                        updateMapTimers();
                    });
                };
                list.appendChild(li);
            });
        }
    });
}

// ============================================
// FORMATOWANIE CZASU I LIVE TIMERY
// ============================================
function formatDate(date) {
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

function playVoiceAlert(bossName, dungeonName) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
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

// WYMUSZONY TEST AUDIO DO SPRAWDZENIA CZY PRZEGLĄDARKA SŁYSZY STRONĘ
function testVoiceAlertDirectly() {
    if (selectedBoss == null) {
        alert("Najpierw kliknij jakiegoś bossa na mapie, żeby go zaznaczyć!");
        return;
    }
    alert("Próbuję odtworzyć dźwięk mowy. Jeśli usłyszysz lektora, system działa.");
    playVoiceAlert(selectedBoss.name, selectedBoss.dungeon);
}

function secondsToString(sec) {
    let h = Math.floor(sec / 3600);
    let m = Math.floor((sec % 3600) / 60);
    let s = Math.floor(sec % 60);
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function updateElapsed() {
    if (selectedBoss == null) {
        document.getElementById("elapsed").innerText = "00:00:00";
        return;
    }
    fetchBossHistory(selectedBoss.id, (data) => {
        // Ignorujemy znacznik resetu przy obliczaniu czasu elapsed
        let realHistory = data.filter(time => time !== 0);
        if (realHistory.length == 0) {
            document.getElementById("elapsed").innerText = "--";
            return;
        }
        realHistory.sort((a, b) => b - a);
        let diff = Math.floor((Date.now() - realHistory[0]) / 1000);
        document.getElementById("elapsed").innerText = secondsToString(diff);
    });
}

function updateClock() {
    let clockEl = document.getElementById("clock");
    if (clockEl) clockEl.innerText = new Date().toLocaleTimeString();
}

function updateMapTimers() {
    bosses.forEach(boss => {
        fetchBossHistory(boss.id, (data) => {
            let timerEl = document.getElementById("timer_" + boss.id);
            if (!timerEl) return;

            // Jeśli na szczycie historii jest 0, wymuszamy czysty stan READY
            if (data.length == 0 || data[0] === 0) {
                timerEl.innerText = "READY";
                timerEl.style.color = "#3b82f6";
                return;
            }

            data.sort((a, b) => b - a);
            let diffInSeconds = Math.floor((Date.now() - data[0]) / 1000);
            let muteStatus = boss.voiceEnabled ? " 🔊" : " 🔇";
            timerEl.innerText = "KILLED " + secondsToString(diffInSeconds) + " AGO" + muteStatus;
            timerEl.style.color = "#ff3030";

            // SYSTEM ODLICZANIA I WYWOŁANIA GŁOSU
            let respawnMinutes = boss.respawnMinutes || 240;
            let totalRespawnSeconds = respawnMinutes * 60;
            let alertTimeSeconds = totalRespawnSeconds - 600; // Dokładnie 10 minut przed końcem

            if (diffInSeconds === alertTimeSeconds && boss.voiceEnabled === true) {
                let lastKillTime = data[0];
                if (triggeredAlerts[boss.id] !== lastKillTime) {
                    playVoiceAlert(boss.name, boss.dungeon);
                    triggeredAlerts[boss.id] = lastKillTime; // Zabezpieczenie przed zapętleniem sekundy
                }
            }
        });
    });
}

function updateBossStates() {
    document.querySelectorAll(".boss").forEach(icon => {
        let id = Number(icon.dataset.id);
        fetchBossHistory(id, (data) => {
            icon.className = "boss";
            if (data.length == 0 || data[0] === 0) {
                icon.classList.add("blue");
                return;
            }
            icon.classList.add("red", "pulse");
        });
    });
}

function updateStatus() {
    if (selectedBoss == null) return;
    let span = document.getElementById("bossStatus");
    if (!span) return;

    fetchBossHistory(selectedBoss.id, (data) => {
        if (data.length == 0 || data[0] === 0) {
            span.innerHTML = '🔵 READY';
            return;
        }
        span.innerHTML = '🔴 KILLED';
    });
}

// ============================================
// DRAG & DROP
// ============================================
let dragBoss = null;

document.addEventListener("mousedown", function(e) {
    if (e.target.classList.contains("boss")) dragBoss = e.target;
});

document.addEventListener("mouseup", function() {
    if (dragBoss) saveAllData();
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
    saveAllData();
    loadBosses();
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
    saveAllData();
    loadBosses();
}

document.getElementById("killButton").onclick = saveKill;
document.getElementById("manualKill").onclick = addManualKill;
document.getElementById("addBoss").onclick = addBoss;
document.getElementById("resetBossState").onclick = resetBossToBlue;
document.getElementById("configureVoiceButton").onclick = configureBossAlert;

// ============================================
// START I INTERWAŁY AUTOMATYCZNE
// ============================================
loadAllData();
updateClock();

setInterval(updateElapsed, 1000);
setInterval(updateClock, 1000);
setInterval(updateStatus, 1000);
setInterval(updateMapTimers, 1000);
setInterval(updateBossStates, 1000);
