/* ============================================================
   script.js — Carte Leaflet + APIs (Nominatim + Open-Meteo)
   ============================================================ */

   
// ouvrir popup selon carte
document.querySelectorAll(".carte-energie").forEach(carte => {

    carte.addEventListener("click", () => {

        let id = carte.id.replace("carte", "popup");

        document.getElementById(id).classList.remove("hidden");
    });
});


document.querySelectorAll(".fermer").forEach(btn => {
    btn.addEventListener("click", (e) => {
        let id = e.target.getAttribute("data-close");
        document.getElementById(id).classList.add("hidden");
    });
});

// clic extérieur
document.querySelectorAll(".popup-energie").forEach(popup => {
    popup.addEventListener("click", (e) => {
        if (e.target === popup) {
            popup.classList.add("hidden");
        }
    });
});

/* ============================================================
   1. INITIALISATION DE LA CARTE LEAFLET
   ============================================================ */

// Création de la carte centrée sur la France par défaut
const carte = L.map('carte-leaflet', {
    center: [46.5, 2.5],
    zoom: 5,
    zoomControl: true,
});

// Tuiles OpenStreetMap (open source, aucune clé API requise)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
}).addTo(carte);

// Marqueur unique (remplacé à chaque clic / recherche)
let marqueur = null;


/* ============================================================
   2. ÉVÉNEMENT : CLIC SUR LA CARTE
   ============================================================ */

carte.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    await placerMarqueur(lat, lng);
    await chargerDonnees(lat, lng);
});


/* ============================================================
   3. RECHERCHE D'ADRESSE (Nominatim + autocomplétion)
   ============================================================ */

const champRecherche  = document.getElementById('champ-recherche');
const btnRecherche    = document.getElementById('btn-recherche');
const listeSuggestions = document.getElementById('suggestions');

let timerAutocomplete = null;

// Autocomplétion : déclenche la recherche 400ms après la dernière frappe
champRecherche.addEventListener('input', () => {
    clearTimeout(timerAutocomplete);
    const valeur = champRecherche.value.trim();

    if (valeur.length < 3) {
        viderSuggestions();
        return;
    }

    timerAutocomplete = setTimeout(() => rechercherSuggestions(valeur), 400);
});

// Lancer la recherche avec le bouton ou la touche Entrée
btnRecherche.addEventListener('click', () => lancerRecherche());
champRecherche.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lancerRecherche();
});

// Ferme les suggestions si on clique ailleurs
document.addEventListener('click', (e) => {
    if (!e.target.closest('.recherche')) viderSuggestions();
});

/**
 * Recherche des suggestions d'autocomplétion via Nominatim
 */
async function rechercherSuggestions(texte) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(texte)}&format=json&limit=5&accept-language=fr`;
        const reponse = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
        const resultats = await reponse.json();

        viderSuggestions();

        if (resultats.length === 0) return;

        resultats.forEach((lieu) => {
            const li = document.createElement('li');
            // Affiche un nom court (avant la première virgule)
            li.textContent = lieu.display_name;
            li.addEventListener('click', () => {
                champRecherche.value = lieu.display_name;
                viderSuggestions();
                allerVersLieu(parseFloat(lieu.lat), parseFloat(lieu.lon), lieu.display_name);
            });
            listeSuggestions.appendChild(li);
        });

    } catch (err) {
        console.error('Erreur autocomplétion :', err);
    }
}

/**
 * Lance une recherche directe depuis le champ texte
 */
async function lancerRecherche() {
    const texte = champRecherche.value.trim();
    if (!texte) return;

    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(texte)}&format=json&limit=1`;
        const reponse = await fetch(url);
        const resultats = await reponse.json();

        if (resultats.length === 0) {
            alert('Lieu introuvable. Essayez un autre terme.');
            return;
        }

        const lieu = resultats[0];
        viderSuggestions();
        await allerVersLieu(parseFloat(lieu.lat), parseFloat(lieu.lon), lieu.display_name);

    } catch (err) {
        console.error('Erreur de recherche :', err);
    }
}

/**
 * Déplace la carte, pose le marqueur et charge les données
 */
async function allerVersLieu(lat, lng, nom) {
    carte.setView([lat, lng], 10);
    await placerMarqueur(lat, lng, nom);
    await chargerDonnees(lat, lng, nom);
}

/**
 * Vide la liste des suggestions
 */
function viderSuggestions() {
    listeSuggestions.innerHTML = '';
}


/* ============================================================
   4. MARQUEUR SUR LA CARTE
   ============================================================ */

/**
 * Place ou déplace le marqueur sur la carte
 */
async function placerMarqueur(lat, lng, nom) {
    if (marqueur) carte.removeLayer(marqueur);

    marqueur = L.marker([lat, lng]).addTo(carte);

    // Si le nom n'est pas fourni, on le récupère par géocodage inversé
    if (!nom) {
        nom = await geocodageInverse(lat, lng);
    }

    marqueur.bindPopup(`<strong>📍 ${nom}</strong><br>${lat.toFixed(4)}, ${lng.toFixed(4)}`).openPopup();

    document.getElementById('lieu-selectionne').textContent = nom;
}

/**
 * Géocodage inversé : coordonnées → nom du lieu (Nominatim)
 */
async function geocodageInverse(lat, lng) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`;
        const reponse = await fetch(url);
        const data = await reponse.json();
        return data.display_name || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    } catch {
        return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    }
}


/* ============================================================
   5. RÉCUPÉRATION DES DONNÉES CLIMATIQUES (Open-Meteo)
   ============================================================ */

/**
 * Charge les données météo/climatiques via Open-Meteo
 * et met à jour le panneau de potentiel
 */
async function chargerDonnees(lat, lng) {
    afficherChargement(true);

    try {
        // Open-Meteo : données horaires et journalières (gratuit, sans clé API)
        const url = `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${lat}&longitude=${lng}` +
            `&daily=sunshine_duration,precipitation_sum,wind_speed_10m_max` +
            `&hourly=wind_speed_10m` +
            `&current=wind_speed_10m,temperature_2m` +
            `&timezone=auto` +
            `&forecast_days=7`;

        const reponse = await fetch(url);
        const data = await reponse.json();

        const potentiel = calculerPotentiel(data, lat);
        afficherPotentiel(potentiel);

    } catch (err) {
        console.error('Erreur Open-Meteo :', err);
        document.getElementById('lieu-selectionne').textContent = '⚠️ Erreur de récupération des données';
    } finally {
        afficherChargement(false);
    }
}


/* ============================================================
   6. CALCUL DU POTENTIEL ÉNERGÉTIQUE
   ============================================================ */

/**
 * Calcule les scores sur 10 pour chaque énergie
 * à partir des données météo et de la latitude
 */
function calculerPotentiel(data, lat) {
    const daily = data.daily;

    // --- SOLAIRE ---
    // sunshine_duration : secondes de soleil par jour (max théorique ≈ 43 200 s = 12h)
    const soleilMoyen = moyenne(daily.sunshine_duration || []);
    const scoreSolaire = normaliser(soleilMoyen, 0, 40000);

    // Bonus latitude équatoriale (plus ensoleillé près de l'équateur)
    const bonusLatitude = 1 - (Math.abs(lat) / 90) * 0.3;
    const scoreSolaireFinal = Math.min(10, scoreSolaire * bonusLatitude * 10);

    // --- ÉOLIEN ---
    // wind_speed_10m_max : vitesse max quotidienne en km/h
    const ventMoyen = moyenne(daily.wind_speed_10m_max || []);
    // Potentiel éolien significatif à partir de ~15 km/h, excellent à 50+
    const scoreEolien = Math.min(10, normaliser(ventMoyen, 5, 55) * 10);

    // --- HYDRAULIQUE ---
    // precipitation_sum : précipitations en mm/jour
    const precipMoyenne = moyenne(daily.precipitation_sum || []);
    // Score basé sur les précipitations (bon à partir de 3mm/j)
    const scoreHydraulique = Math.min(10, normaliser(precipMoyenne, 0, 8) * 10);

    // --- GÉOTHERMIQUE ---
    // Estimé à partir de la position géographique (données géologiques simplifiées)
    // Les zones volcaniques / tectoniques ont un meilleur potentiel
    const scoreGeothermie = estimerGeothermie(lat, data.longitude || 0);

    // --- NOTE GLOBALE (moyenne pondérée) ---
    const noteGlobale = (
        scoreSolaireFinal * 0.35 +
        scoreEolien      * 0.30 +
        scoreHydraulique * 0.20 +
        scoreGeothermie  * 0.15
    );

    return {
        solaire:     arrondir(scoreSolaireFinal),
        eolien:      arrondir(scoreEolien),
        hydraulique: arrondir(scoreHydraulique),
        geothermie:  arrondir(scoreGeothermie),
        globale:     arrondir(noteGlobale),
        ventMoyen:   Math.round(ventMoyen),
        precipMoyenne: precipMoyenne.toFixed(1),
        soleilMoyen: Math.round(soleilMoyen / 3600), // en heures
    };
}

/**
 * Estime le potentiel géothermique en fonction de la localisation
 * (simplifié - basé sur des zones géologiques connues)
 */
function estimerGeothermie(lat, lng) {
    // Zones à fort potentiel géothermique (simplifié)
    const zonesActives = [
        { lat: 64, lng: -19, rayon: 10 }, // Islande
        { lat: 38, lng: 15, rayon: 8 },   // Sicile / Italie du Sud
        { lat: -8, lng: 115, rayon: 5 },  // Bali
        { lat: 21, lng: -157, rayon: 8 }, // Hawaï
        { lat: -38, lng: 176, rayon: 8 }, // Nouvelle-Zélande
        { lat: 55, lng: 160, rayon: 10 }, // Kamtchatka
        { lat: -15, lng: 55.5, rayon: 4 }, // La Réunion
    ];

    let score = 3.5; // Score de base modéré

    zonesActives.forEach((zone) => {
        const dist = Math.sqrt(Math.pow(lat - zone.lat, 2) + Math.pow(lng - zone.lng, 2));
        if (dist < zone.rayon) {
            score = Math.max(score, 10 - (dist / zone.rayon) * 4);
        }
    });

    return Math.min(10, score);
}

/**
 * Calcule la moyenne d'un tableau de nombres
 */
function moyenne(tableau) {
    if (!tableau || tableau.length === 0) return 0;
    const valeurs = tableau.filter(v => v !== null && v !== undefined);
    return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

/**
 * Normalise une valeur entre min et max → [0, 1]
 */
function normaliser(valeur, min, max) {
    return Math.max(0, Math.min(1, (valeur - min) / (max - min)));
}

/**
 * Arrondit à 1 décimale
 */
function arrondir(n) {
    return Math.round(n * 10) / 10;
}


/* ============================================================
   7. MISE À JOUR DE L'INTERFACE
   ============================================================ */

/**
 * Affiche les scores dans le panneau latéral
 */
function afficherPotentiel(p) {

    // Note globale
    document.getElementById('note-globale-valeur').textContent = p.globale;

    // Solaire
    document.getElementById('note-solaire').textContent = p.solaire;
    document.getElementById('barre-solaire').style.width = `${p.solaire * 10}%`;
    document.getElementById('desc-solaire').textContent =
        `~${p.soleilMoyen}h de soleil/j · ${labelNote(p.solaire)}`;
    coloriserNote('note-solaire', p.solaire);

    // Éolien
    document.getElementById('note-eolien').textContent = p.eolien;
    document.getElementById('barre-eolien').style.width = `${p.eolien * 10}%`;
    document.getElementById('desc-eolien').textContent =
        `Vent moyen : ${p.ventMoyen} km/h · ${labelNote(p.eolien)}`;
    coloriserNote('note-eolien', p.eolien);

    // Hydraulique
    document.getElementById('note-hydraulique').textContent = p.hydraulique;
    document.getElementById('barre-hydraulique').style.width = `${p.hydraulique * 10}%`;
    document.getElementById('desc-hydraulique').textContent =
        `Précip. : ${p.precipMoyenne} mm/j · ${labelNote(p.hydraulique)}`;
    coloriserNote('note-hydraulique', p.hydraulique);

    // Géothermie
    document.getElementById('note-geothermie').textContent = p.geothermie;
    document.getElementById('barre-geothermie').style.width = `${p.geothermie * 10}%`;
    document.getElementById('desc-geothermie').textContent = labelNote(p.geothermie);
    coloriserNote('note-geothermie', p.geothermie);

    // Couleur de la barre latérale des cartes énergie
    coloriserBordure('carte-solaire',     p.solaire);
    coloriserBordure('carte-eolien',      p.eolien);
    coloriserBordure('carte-hydraulique', p.hydraulique);
    coloriserBordure('carte-geothermie',  p.geothermie);
}

/**
 * Retourne un label texte selon la note
 */
function labelNote(note) {
    if (note >= 8)  return '🟢 Excellent';
    if (note >= 6)  return '🟡 Bon potentiel';
    if (note >= 4)  return '🟠 Potentiel modéré';
    return '🔴 Potentiel limité';
}

/**
 * Colorise la note selon sa valeur (vert / orange / rouge)
 */
function coloriserNote(id, note) {
    const el = document.getElementById(id);
    if (!el) return;
    if (note >= 7)      el.style.color = '#4a7c59'; // vert
    else if (note >= 4) el.style.color = '#f39c12'; // orange
    else                el.style.color = '#e74c3c'; // rouge
}

/**
 * Colorise la bordure gauche de la carte énergie
 */
function coloriserBordure(id, note) {
    const el = document.getElementById(id);
    if (!el) return;
    if (note >= 7)      el.style.borderLeftColor = '#4a7c59';
    else if (note >= 4) el.style.borderLeftColor = '#f39c12';
    else                el.style.borderLeftColor = '#e74c3c';
}

/**
 * Affiche ou cache l'indicateur de chargement
 */
function afficherChargement(visible) {
    const el = document.getElementById('chargement');
    el.classList.toggle('hidden', !visible);
}