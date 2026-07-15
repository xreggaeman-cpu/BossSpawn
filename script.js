// ========================================================
// MINI-SKRYPT OBSŁUGI MAP REGIONALNYCH I DUNGEONÓW
// ========================================================

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

let activeIndex = null;

// Funkcja otwierająca mapę regionu lub dungeonu
function showRegion(type, filename, displayName, dungeonIndex) {
    const worldMap = document.getElementById("worldMap");
    const subMap = document.getElementById("subMap");
    const svgOverlay = document.getElementById("svgOverlay");
    const backBtn = document.getElementById("backToWorldBtn");
    const viewDisplay = document.getElementById("viewLocationName");
    
    // 1. Jeśli kliknięto dungeon, zapisujemy jego indeks i wstrzykujemy dane do panelu
    if (typeof dungeonIndex !== 'undefined') {
        activeIndex = dungeonIndex;
        
        document.querySelectorAll(".dungeon-btn").forEach((btn, idx) => {
            if (idx === dungeonIndex) btn.classList.add("active");
            else btn.classList.remove("active");
        });
        
        if (document.getElementById("curName")) {
            document.getElementById("curName").innerText = displayName;
        }
    }

    // 2. Aktualizacja paska górnego
    if (viewDisplay) {
        viewDisplay.innerText = displayName.toUpperCase();
        viewDisplay.style.color = "#ffd54f"; // Żółty kolor taktyczny
    }

    // 3. Wczytanie odpowiedniej sub-mapy z folderu images/
    if (type === 'region') {
        subMap.src = `images/region-${filename}.png`;
    } else if (type === 'dungeon') {
        subMap.src = `images/dungeon-${filename}.png`;
    }

    // 4. Przełączanie widoczności
    if (worldMap) worldMap.style.display = "none";
    if (svgOverlay) svgOverlay.style.display = "none";
    
    if (subMap) subMap.classList.remove("hide-submap");
    if (backBtn) {
        backBtn.classList.remove("hide-btn");
        backBtn.classList.add("show-back-btn");
    }
}

// Funkcja powrotu na mapę świata
function showWorldMap() {
    const worldMap = document.getElementById("worldMap");
    const subMap = document.getElementById("subMap");
    const svgOverlay = document.getElementById("svgOverlay");
    const backBtn = document.getElementById("backToWorldBtn");
    const viewDisplay = document.getElementById("viewLocationName");

    if (viewDisplay) {
        viewDisplay.innerText = "WORLD MAP";
        viewDisplay.style.color = "#00e676"; // Powrót do zielonego standardu
    }

    if (worldMap) worldMap.style.display = "block";
    if (svgOverlay) svgOverlay.style.display = "block";
    
    if (subMap) {
        subMap.classList.add("hide-submap");
        subMap.src = "";
    }
    if (backBtn) {
        backBtn.classList.remove("show-back-btn");
        backBtn.classList.add("hide-btn");
    }
}

// Globalna dostępność funkcji dla elementów HTML
window.showRegion = showRegion;
window.showWorldMap = showWorldMap;

// Czysty, niezawodny zegarek
setInterval(() => {
    const clockEl = document.getElementById("clock");
    if (clockEl) clockEl.innerText = new Date().toLocaleTimeString();
}, 1000);
