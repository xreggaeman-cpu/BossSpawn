// ============================================
// TL ELITE BOSS TRACKER - FIREBASE LIVE SCRIPT
// ============================================

// KONFIGURACJA CHMURY - Tutaj wklej link skopiowany ze swojej konsoli Firebase!
const FIREBASE_URL = "https://boss-spawn-throneandliberty-default-rtdb.europe-west1.firebasedatabase.app/";

// Baza danych domyślnych bossów (jeśli baza w chmurze jest całkowicie pusta)
const defaultBosses = [
    { id: 1, name: "Pirate Chest King", dungeon: "Daybreak Shore", type: "PvP", x: 64, y: 42 }
];

let bosses = [];
let selectedBoss = null;
const layer = document.getElementById("bossLayer");

// ============================================
// SYNCHRONIZACJA Z BAZĄ DANYCH W CHMURZE
// ============================================

function loadAllData() {
    fetch(`${FIREBASE_URL}bosses.json`)
        .then(res => res.json())
        .then(data => {
            if (data) {
                bosses = data;
                
                // POPRAWKA: Jeśli miałeś wybranego bossa, upewniamy się, że obiekt referencji wciąż istnieje
                if (selectedBoss) {
                    let updatedBoss = bosses.find(b => b.id === selectedBoss.id);
                    if (updatedBoss) selectedBoss = updatedBoss;
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
    fetch(`${FIREBASE_URL}history/boss_${bossId}.json`)
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
            history.unshift(timestamp);
            history.sort((a, b) => b - a);

            return fetch(`${FIREBASE_URL}history/boss_${bossId}.json`, {
                method: "PUT",
                body: JSON.stringify(history)
            });
        })
        .then(() => {
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
        timerDiv.innerText = "Ładowanie...";
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

    let value = prompt("Time kill\nlike:\n23:30");
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

function loadHistory() {
    if (selectedBoss == null) return;
    let list = document.getElementById("historyList");
    let currentId = selectedBoss.id;

    fetchBossHistory(currentId, (data) => {
        if (selectedBoss && selectedBoss.id === currentId) {
            list.innerHTML = "";
            if (data.length == 0) {
                list.innerHTML = "<li>No history</li>";
                document.getElementById("lastKill").innerText = "---";
                return;
            }

            data.sort((a, b) => b - a);
            document.getElementById("lastKill").innerText = formatDate(new Date(data[0]));

            data.forEach((time, index) => {
                let li = document.createElement("li");
                li.innerText = formatDate(new Date(time));
                li.style.cursor = "pointer";
                li.title = "Kliknij, aby usunąć ten wpis";
                
                li.onclick = function() {
                    if (!confirm(`Usunąć ten wpis z historii:\n${formatDate(new Date(time))}?`)) return;
                    data.splice(index, 1);
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
        if (data.length == 0) {
            document.getElementById("elapsed").innerText = "--";
            return;
        }
        data.sort((a, b) => b - a);
        let diff = Math.floor((Date.now() - data[0]) / 1000);
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

            if (data.length == 0) {
                timerEl.innerText = "READY";
                timerEl.style.color = "#3b82f6";
                return;
            }

            data.sort((a, b) => b - a);
            let respawnTime = 3 * 3600; // 3 godziny w sekundach
            let diffInSeconds = Math.floor((Date.now() - data[0]) / 1000);
            let timeLeft = respawnTime - diffInSeconds;

            if (timeLeft <= 0) {
                // KLUCZOWA ZMIANA: Gdy licznik spadnie poniżej zera, obliczamy ile sekund minęło OD respawnu
                let secondsAgo = Math.abs(timeLeft); // Zamieniamy wartość ujemną na dodatnią
                
                timerEl.innerText = "SPAWNED " + secondsToString(secondsAgo) + " AGO";
                timerEl.style.color = "#ff3030";
            } else {
                timerEl.innerText = secondsToString(timeLeft);
                timerEl.style.color = "#fff";
            }
        });
    });
}


function updateBossStates() {
    document.querySelectorAll(".boss").forEach(icon => {
        let id = Number(icon.dataset.id);
        fetchBossHistory(id, (data) => {
            icon.className = "boss";
            if (data.length == 0) {
                icon.classList.add("blue");
                return;
            }
            data.sort((a, b) => b - a);
            let respawnTime = 3 * 3600;
            let diffInSeconds = Math.floor((Date.now() - data[0]) / 1000);
            let timeLeft = respawnTime - diffInSeconds;

            if (timeLeft > 3600) icon.classList.add("green");
            else if (timeLeft <= 3600 && timeLeft > 1800) icon.classList.add("yellow");
            else if (timeLeft <= 1800 && timeLeft > 600) icon.classList.add("orange");
            else {
                icon.classList.add("red");
                icon.classList.add("pulse");
            }
        });
    });
}

function updateStatus() {
    if (selectedBoss == null) return;
    let span = document.getElementById("bossStatus");
    if (!span) return;

    fetchBossHistory(selectedBoss.id, (data) => {
        if (data.length == 0) {
            span.innerHTML = '<span style="color: #3b82f6;">🔵 NEW</span>';
            return;
        }
        data.sort((a, b) => b - a);
        let respawnTime = 3 * 3600;
        let diffInSeconds = Math.floor((Date.now() - data[0]) / 1000);
        let timeLeft = respawnTime - diffInSeconds;

        if (timeLeft > 3600) span.innerHTML = '<span style="color: #00d26a;">🟢 Fresh Kill</span>';
                else if (timeLeft <= 3600 && timeLeft > 1800) span.innerHTML = '🟡 Almost';
        else if (timeLeft <= 1800 && timeLeft > 600) span.innerHTML = '🟠 Soon';
        else span.innerHTML = '🔴 SHOULD BE UP';
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

// Usunięcie bossa z chmury
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
        document.getElementById("bossStatus").innerText = "NEW";
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

    bosses.push({ id: Date.now(), name: name, dungeon: dungeon, type: type, x: 50, y: 50 });
    saveAllData();
    loadBosses();
}

document.getElementById("killButton").onclick = saveKill;
document.getElementById("manualKill").onclick = addManualKill;
document.getElementById("addBoss").onclick = addBoss;

// ============================================
// START I INTERWAŁY AUTOMATYCZNE
// ============================================
loadAllData();
updateClock();

setInterval(updateElapsed, 1000);
setInterval(updateClock, 1000);
setInterval(updateStatus, 1000);
setInterval(updateMapTimers, 2000);  // Sprawdzanie chmury co 2 sekundy
setInterval(loadAllData, 5000); // Pobiera listę bossów i ich pozycje z chmury co 5 sekund

setInterval(updateBossStates, 6000); // Odświeżanie kolorów co 6 sekund

