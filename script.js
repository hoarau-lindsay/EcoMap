/* =====================================================
   ECOMAP - script.js
   ===================================================== */


/* =====================================================
   FONCTIONS - Utiles
   ===================================================== */

function getElement(id) {
    return document.getElementById(id);
}

function setTexte(id, texte) {
    const el = getElement(id);
    if (el) el.textContent = texte;
}

function arrondir(nombre) {
    return Math.round(nombre * 10) / 10;
}

function limiterEntre0Et10(valeur) {
    if (valeur < 0) return 0;
    if (valeur > 10) return 10;
    return valeur;
}

function distanceKm(lat1, lng1, lat2, lng2) {
    const dLat = Math.abs(lat1 - lat2);
    const dLng = Math.abs(lng1 - lng2);
    return Math.sqrt(dLat * dLat + dLng * dLng) * 111;
}


/* =====================================================
   LA CARTE LEAFLET
   ===================================================== */

const carte = L.map("carte-leaflet", {
    center: [-21.11, 55.53],
    zoom: 10
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
}).addTo(carte);

let marqueurActuel = null;


/* =========== Clic sur la carte ============ */

carte.on("click", async function(evenement) {
    const lat = evenement.latlng.lat;
    const lng = evenement.latlng.lng;
    await allerVersLieu(lat, lng);
});


/* =====================================================
   RECHERCHE D'UN LIEU (API Nominatim)
   ===================================================== */

// Lance la recherche quand on appuie sur Entrée
async function lancerRecherche() {
    const texte = champRecherche?.value?.trim();
    if (!texte) return;

    const url = "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(texte) + "&format=json&limit=1";

    const reponse = await fetch(url);
    const resultats = await reponse.json();

    if (resultats.length === 0) {
        alert("Lieu introuvable. Essayez un autre nom.");
        return;
    }

    const lieu = resultats[0];
    viderSuggestions();

    await allerVersLieu(parseFloat(lieu.lat), parseFloat(lieu.lon), lieu.display_name);
}

// Affiche des suggestions pendant que l'utilisateur tape
async function chercherSuggestions(texte) {
    const url = "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(texte) + "&format=json&limit=5";

    const reponse = await fetch(url);
    const resultats = await reponse.json();

    viderSuggestions();

    resultats.forEach(function(lieu) {
        const li = document.createElement("li");
        li.textContent = lieu.display_name;

        li.onclick = function() {
            champRecherche.value = lieu.display_name;
            viderSuggestions();
            allerVersLieu(parseFloat(lieu.lat), parseFloat(lieu.lon), lieu.display_name);
        };

        listeSuggestions?.appendChild(li);
    });
}

// Efface toutes les suggestions affichées
function viderSuggestions() {
    if (listeSuggestions) {
        listeSuggestions.innerHTML = "";
    }
}


/* =====================================================
   NAVIGATION VERS UN LIEU
   ===================================================== */

async function allerVersLieu(lat, lng, nomLieu) {
    carte.setView([lat, lng], 10);
    await placerMarqueur(lat, lng, nomLieu);
    await calculerEtAfficherPotentiel(lat, lng);
}


/* =====================================================
   MARQUEUR SUR LA CARTE
   ===================================================== */

async function placerMarqueur(lat, lng, nomLieu) {
    if (marqueurActuel) {
        carte.removeLayer(marqueurActuel);
    }

    if (!nomLieu) {
        nomLieu = await trouverNomLieu(lat, lng);
    }

    marqueurActuel = L.marker([lat, lng]).addTo(carte);
    marqueurActuel.bindPopup(
        "<strong>" + nomLieu + "</strong><br>" +
        lat.toFixed(4) + ", " + lng.toFixed(4)
    ).openPopup();
}

async function trouverNomLieu(lat, lng) {
    try {
        const url = "https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lng + "&format=json&accept-language=fr";
        const reponse = await fetch(url);
        const data = await reponse.json();
        return data.display_name || (lat.toFixed(3) + ", " + lng.toFixed(3));
    } catch (erreur) {
        return lat.toFixed(3) + ", " + lng.toFixed(3);
    }
}


/* =====================================================
   DONNÉES MÉTÉO (API Open-Meteo)
   ===================================================== */

async function calculerEtAfficherPotentiel(lat, lng) {
    try {
        const url = "https://api.open-meteo.com/v1/forecast" +
            "?latitude=" + lat +
            "&longitude=" + lng +
            "&daily=sunshine_duration,precipitation_sum,wind_speed_10m_max" +
            "&timezone=auto";

        const reponse = await fetch(url);
        const donnees = await reponse.json();

        const scores = calculerScores(donnees, lat, lng);
        afficherResultats(scores);

    } catch (erreur) {
        console.error("Erreur lors de la récupération météo :", erreur);
    }
}


/* =====================================================
   MOYENNE D'UN TABLEAU
   ===================================================== */

function moyenneTableau(tableau) {
    if (!tableau || tableau.length === 0) return 0;

    let total = 0;
    let compteur = 0;

    tableau.forEach(function(valeur) {
        const nombre = Number(valeur);
        if (Number.isFinite(nombre)) {
            total += nombre;
            compteur++;
        }
    });

    if (compteur === 0) return 0;
    return total / compteur;
}


/* =====================================================
   CALCUL DES SCORES ÉNERGÉTIQUES
   ===================================================== */

function calculerScores(donneesMétéo, lat, lng) {

    const daily = donneesMétéo.daily;

    const soleilMoyenEnSecondes = moyenneTableau(daily?.sunshine_duration);
    const ventMoyenKmh          = moyenneTableau(daily?.wind_speed_10m_max);
    const pluieMoyenneMm        = moyenneTableau(daily?.precipitation_sum);

    // SCORE SOLAIRE — 8h/jour = score 10
    const soleilEnHeures   = soleilMoyenEnSecondes / 3600;
    const scoreSolaire     = limiterEntre0Et10(arrondir((soleilEnHeures / 8) * 10));

    // SCORE ÉOLIEN — 20 km/h = score 10
    const scoreEolien      = limiterEntre0Et10(arrondir((ventMoyenKmh / 20) * 10));

    // SCORE HYDRAULIQUE — 5 mm/jour = score 10
    const scoreHydraulique = limiterEntre0Et10(arrondir((pluieMoyenneMm / 5) * 10));

    // SCORE GÉOTHERMIE — basé sur les zones volcaniques
    const scoreGeothermie  = calculerScoreGeothermie(lat, lng);

    // SCORE GLOBAL — moyenne des 4
    const somme       = scoreSolaire + scoreEolien + scoreHydraulique + scoreGeothermie;
    const scoreGlobal = Math.round((somme / 4) * 10) / 10;

    return {
        solaire:      scoreSolaire,
        eolien:       scoreEolien,
        hydraulique:  scoreHydraulique,
        geothermie:   scoreGeothermie,
        global:       scoreGlobal,
        soleilHeures: Math.round(soleilEnHeures),
        ventKmh:      Math.round(ventMoyenKmh),
        pluieMm:      pluieMoyenneMm.toFixed(1)
    };
}


/* =====================================================
   SCORE GÉOTHERMIQUE
   ===================================================== */

function calculerScoreGeothermie(lat, lng) {

    const distanceFournaise = distanceKm(lat, lng, -21.244, 55.708);
    if (distanceFournaise < 15) return arrondir(limiterEntre0Et10(9.5 - distanceFournaise * 0.1));

    const distanceIslande = distanceKm(lat, lng, 64.0, -19.0);
    if (distanceIslande < 300) return arrondir(limiterEntre0Et10(9.5 - distanceIslande * 0.005));

    const distanceEtna = distanceKm(lat, lng, 37.75, 15.0);
    if (distanceEtna < 150) return arrondir(limiterEntre0Et10(8.5 - distanceEtna * 0.01));

    const distanceHawaii = distanceKm(lat, lng, 19.5, -155.5);
    if (distanceHawaii < 200) return arrondir(limiterEntre0Et10(9.0 - distanceHawaii * 0.008));

    const distanceJapon = distanceKm(lat, lng, 35.7, 137.7);
    if (distanceJapon < 500) return arrondir(limiterEntre0Et10(8.0 - distanceJapon * 0.005));

    const distanceNouvelleZelande = distanceKm(lat, lng, -38.5, 176.0);
    if (distanceNouvelleZelande < 300) return arrondir(limiterEntre0Et10(8.5 - distanceNouvelleZelande * 0.008));

    const distanceIndonesie = distanceKm(lat, lng, -7.5, 110.0);
    if (distanceIndonesie < 400) return arrondir(limiterEntre0Et10(8.5 - distanceIndonesie * 0.006));

    const distanceKenya = distanceKm(lat, lng, 0.5, 36.0);
    if (distanceKenya < 300) return arrondir(limiterEntre0Et10(7.5 - distanceKenya * 0.007));

    const distanceEthiopie = distanceKm(lat, lng, 11.5, 40.5);
    if (distanceEthiopie < 300) return arrondir(limiterEntre0Et10(7.0 - distanceEthiopie * 0.007));

    const distanceMexique = distanceKm(lat, lng, 19.5, -99.1);
    if (distanceMexique < 400) return arrondir(limiterEntre0Et10(7.0 - distanceMexique * 0.006));

    const distanceTurquie = distanceKm(lat, lng, 38.0, 29.0);
    if (distanceTurquie < 300) return arrondir(limiterEntre0Et10(7.5 - distanceTurquie * 0.008));

    const distanceFilipinnes = distanceKm(lat, lng, 12.5, 122.0);
    if (distanceFilipinnes < 400) return arrondir(limiterEntre0Et10(8.0 - distanceFilipinnes * 0.006));

    return 2.0;
}


/* =====================================================
   AFFICHAGE DES RÉSULTATS
   ===================================================== */

function afficherResultats(scores) {

    setTexte("note-solaire",     scores.solaire);
    setTexte("note-eolien",      scores.eolien);
    setTexte("note-hydraulique", scores.hydraulique);
    setTexte("note-geothermie",  scores.geothermie);

    setTexte("desc-solaire",     scores.soleilHeures + "h d'ensoleillement par jour");
    setTexte("desc-eolien",      "Vent moyen : " + scores.ventKmh + " km/h");
    setTexte("desc-hydraulique", "Pluie : " + scores.pluieMm + " mm/jour");
    setTexte("desc-geothermie",  "Basé sur la géologie locale");

    // Note globale
    const el = document.getElementById("note-globale-valeur");
    if (el) el.textContent = String(scores.global);

    // Commentaire global
    let commentaireGlobal = "";
    if (scores.global > 6) {
        commentaireGlobal = "🌿 Ce lieu présente un excellent potentiel énergétique à exploiter.";
    } else if (scores.global >= 4) {
        commentaireGlobal = "🔍 Potentiel modéré. Une étude complémentaire est recommandée.";
    } else {
        commentaireGlobal = "⚠️ Potentiel limité. Ce lieu n'est pas idéal pour les énergies renouvelables.";
    }
    setTexte("commentaire-global", commentaireGlobal);

    // Couleur du panneau note globale
    const panneau = getElement("note-globale-valeur")?.closest(".note-globale");
    if (panneau) {
        panneau.classList.remove("note-excellente", "note-moyenne", "note-faible");

        if (scores.global > 6) {
            panneau.classList.add("note-excellente");
        } else if (scores.global >= 4) {
            panneau.classList.add("note-moyenne");
        } else {
            panneau.classList.add("note-faible");
        }
    }

    mettreAJourPopups(scores);
}


/* =====================================================
   POPUPS
   ===================================================== */

function mettreAJourPopups(scores) {
    mettreAJourUnPopup("popup-solaire",     scores.solaire,     scores.soleilHeures + "h d'ensoleillement/jour");
    mettreAJourUnPopup("popup-eolien",      scores.eolien,      "Vent moyen : " + scores.ventKmh + " km/h");
    mettreAJourUnPopup("popup-hydraulique", scores.hydraulique, "Pluie : " + scores.pluieMm + " mm/jour");
    mettreAJourUnPopup("popup-geothermie",  scores.geothermie,  "Basé sur l'activité géologique locale");
}

function mettreAJourUnPopup(idPopup, note, description) {
    const popup = getElement(idPopup);
    if (!popup) return;

    const noteEl = popup.querySelector(".popup-note");
    if (noteEl) {
        noteEl.textContent = note + " /10";
        if (note >= 7)      noteEl.style.color = "green";
        else if (note >= 4) noteEl.style.color = "orange";
        else                noteEl.style.color = "red";
    }

    const messageEl = popup.querySelector(".popup-message");
    if (messageEl) {
        if (note > 6) {
            messageEl.textContent = "✅ Excellent potentiel énergétique pour ce lieu. Les conditions sont optimales pour un projet viable et durable, avec un fort potentiel de production d'énergie renouvelable. C'est une opportunité intéressante pour développer un projet à impact positif sur la transition écologique.";
        } else if (note >= 4) {
            messageEl.textContent = "🔍 Potentiel modéré. Le projet est envisageable sous réserve d'une analyse plus approfondie. Avec les bons ajustements et les bons outils, ce site peut devenir une solution énergétique pertinente et durable.";
        } else {
            messageEl.textContent = "❌ Potentiel très limité. Les conditions actuelles ne sont pas favorables à un projet rentable. Seules des solutions innovantes ou des adaptations techniques majeures pourraient rendre le site exploitable.";
        }
    }

    const descEl = popup.querySelector(".popup-description");
    if (descEl) {
        descEl.textContent = description;
    }
}


/* =====================================================
   OUVERTURE ET FERMETURE DES POPUPS
   ===================================================== */

getElement("carte-solaire")?.addEventListener("click", function() {
    getElement("popup-solaire")?.classList.remove("hidden");
});
getElement("carte-eolien")?.addEventListener("click", function() {
    getElement("popup-eolien")?.classList.remove("hidden");
});
getElement("carte-hydraulique")?.addEventListener("click", function() {
    getElement("popup-hydraulique")?.classList.remove("hidden");
});
getElement("carte-geothermie")?.addEventListener("click", function() {
    getElement("popup-geothermie")?.classList.remove("hidden");
});

getElement("close-solaire")?.addEventListener("click", function() {
    getElement("popup-solaire")?.classList.add("hidden");
});
getElement("close-eolien")?.addEventListener("click", function() {
    getElement("popup-eolien")?.classList.add("hidden");
});
getElement("close-hydraulique")?.addEventListener("click", function() {
    getElement("popup-hydraulique")?.classList.add("hidden");
});
getElement("close-geothermie")?.addEventListener("click", function() {
    getElement("popup-geothermie")?.classList.add("hidden");
});


/* =====================================================
   BARRE DE RECHERCHE
   — Placés ICI, après toutes les fonctions,
     pour être sûr que lancerRecherche() et
     chercherSuggestions() sont bien définies
   ===================================================== */

const champRecherche   = getElement("champ-recherche");
const listeSuggestions = getElement("suggestions");

// Entrée → lancer la recherche
if (champRecherche) {
    champRecherche.addEventListener("keydown", function(evenement) {
        if (evenement.key === "Enter") {
            lancerRecherche();
        }
    });
}

// Frappe → afficher les suggestions
if (champRecherche) {
    champRecherche.addEventListener("input", function() {
        const texte = champRecherche.value.trim();

        if (texte.length < 3) {
            viderSuggestions();
            return;
        }

        chercherSuggestions(texte);
    });
}