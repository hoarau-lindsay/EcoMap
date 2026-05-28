/* =====================================================
   ECOMAP - script.js
   ===================================================== */


/* =====================================================
   FONCTIONS - Utiles
   ===================================================== */

// Récupère un élément HTML par son id (raccourci)
function getElement(id) {
    return document.getElementById(id);
}

// Modifie le texte d'un élément par son id
function setTexte(id, texte) {
    const el = getElement(id);
    if (el) el.textContent = texte;
}

// Arrondit un nombre à 1 décimale 
function arrondir(nombre) {
    return Math.round(nombre * 10) / 10;
}

// Bloque une valeur entre 0 et 10 (pour les notes)
function limiterEntre0Et10(valeur) {
    if (valeur < 0) return 0;
    if (valeur > 10) return 10;
    return valeur;
}

// Calcule la distance (approximative) entre deux points GPS
function distanceKm(lat1, lng1, lat2, lng2) {
    const dLat = Math.abs(lat1 - lat2);
    const dLng = Math.abs(lng1 - lng2);
    return Math.sqrt(dLat * dLat + dLng * dLng) * 111; // 1 degré ≈ 111 km
}


/* =====================================================
   LA CARTE LEAFLET
   ===================================================== */

// Création de la carte 
const carte = L.map("carte-leaflet", {
    center: [-21.11, 55.53], //Centré sur la Réunion
    zoom: 10
});

// Ajout du fond de carte OpenStreetMap 
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
}).addTo(carte);

// Variable pour stocker le marqueur d'une postion
let marqueurActuel = null;


/* =========== Click sur la carte ============ */

// Détecter l'endroit cliquer pour récupérer ces coordonnées (latitude et longitude)

carte.on("click", async function(evenement) {
    const lat = evenement.latlng.lat;
    const lng = evenement.latlng.lng;

    // On va sur ce lieu et on calcule le potentiel
    await allerVersLieu(lat, lng);
});


/* ========== Barre de Recherche ================= */

const champRecherche = getElement("champ-recherche");
const listeSuggestions = getElement("suggestions");

// Quand l'utilisateur appuie sur Entrée → lancer la recherche
if (champRecherche) {
    champRecherche.addEventListener("keydown", function (evenement) {
        if (evenement.key === "Enter") {
            evenement.preventDefault();
            lancerRecherche();
        }
    });
}


let timeoutSuggestions;

if (champRecherche) {
    champRecherche.addEventListener("input", function () {
        // récupère le texte taper dans la bar de recherche (value) puis supprime les espaces inutiles (trim)
        const texte = champRecherche.value.trim();

         // On attend au moins 3 caractères avant de chercher
        if (texte.length < 3) {
            viderSuggestions();
            return;
        }

        clearTimeout(timeoutSuggestions);

        timeoutSuggestions = setTimeout(() => {
            chercherSuggestions(texte);
        }, 300);
    });
}


/* ========= RECHERCHE D'UN LIEU  ============= */

// Lance la recherche quand on appuie sur Entrée
async function lancerRecherche() {

    // Récupération du texte tapé dans le champ recherche 
    const texte = champRecherche?.value?.trim(); // si il y a un texte (?. = continue si l'élément existe)
    if (!texte) return;                          // si aucun texte tapé (stop - arrêt de la fonction)

    // Créatiopn de l'URL - Appel à l'API Nominatim pour trouver le lieu
    const url = "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(texte) + "&format=json&limit=1"; // NB : encodeURIComponent() adapte le texte pour une URL 

    const reponse = await fetch(url);       // envoie de la requête vers l'API(fetch)
    const resultats = await reponse.json(); // transforme la réponse en données (JSON pour exploitation)

    // Dans le cas où aucun lieu n'a été trouvé
    if (resultats.length === 0) {
        alert("Lieu introuvable. Essayez un autre nom.");
        return;
    }

    const lieu = resultats[0]; // (sinon) on récupère le premier résultat trouvé
    viderSuggestions();        // efface la liste des suggestions affichées 

    // on se rend vers le lieu
    await allerVersLieu(parseFloat(lieu.lat), parseFloat(lieu.lon), lieu.display_name); // NB : parseFloat() transforme (texte en nombres) - display_name = nom complet du lieu
}

/*

async function chercherSuggestions(texte) {

    
    const url = "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(texte) + "&format=json&limit=5"; 

    const reponse = await fetch(url);       
    const resultats = await reponse.json();  

    viderSuggestions(); 

    // Pour chaque lieu trouvé
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
}*/
// Affiche des suggestions pendant que l'utilisateur tape

async function chercherSuggestions(texte) {
    try {
        // création de l'URL pour l'API Nominatim 
        const url = "https://nominatim.openstreetmap.org/search?q=" 
            + encodeURIComponent(texte) 
            + "&format=json&limit=5";   // NB : maximum 5 résultats 

        const reponse = await fetch(url);        // envoie de la requête    
        if (!reponse.ok) return;                 // cas où la requête n'a pas fonctionné 
        const resultats = await reponse.json();  // transformation (JSON)
        if (!Array.isArray(resultats)) return;

        viderSuggestions();                       // vide l'ancienne liste de suggestions avant d'en afficher une nouvelle

        resultats.forEach(function(lieu) {
            const li = document.createElement("li");   //création d'un élément <li> dans HTML 
            li.textContent = lieu.display_name;        // affichage du nom complet du lieu 

            li.onclick = function() {
                champRecherche.value = lieu.display_name;   // met le texte chosii dans le champ de la recherche 
                viderSuggestions();
                allerVersLieu(parseFloat(lieu.lat), parseFloat(lieu.lon), lieu.display_name);
            };

            listeSuggestions?.appendChild(li);  // si elle existe ajoute la liste HTML 
        });

    } catch (e) {
        console.log("Erreur suggestions :", e);
    }
}

// Efface toutes les suggestions affichées
function viderSuggestions() {
    if (listeSuggestions) {
        listeSuggestions.innerHTML = "";
    }
}


/* ============= aller vers un lieu =================== */

// Centre la carte, place un marqueur, et calcule le potentiel
async function allerVersLieu(lat, lng, nomLieu) {
    carte.setView([lat, lng], 10);

    await placerMarqueur(lat, lng, nomLieu);
    await calculerEtAfficherPotentiel(lat, lng);
}


/* ========== Marqueur sur la carte ===================== */

// Place un marqueur et affiche un popup avec le nom du lieu
async function placerMarqueur(lat, lng, nomLieu) {
    // Supprime l'ancien marqueur s'il existe
    if (marqueurActuel) {
        carte.removeLayer(marqueurActuel);
    }

    // Si on n'a pas le nom, on le cherche via l'API
    if (!nomLieu) {
        nomLieu = await trouverNomLieu(lat, lng);
    }

    // Création du nouveau marqueur
    marqueurActuel = L.marker([lat, lng]).addTo(carte);
    marqueurActuel.bindPopup(
        "<strong>" + nomLieu + "</strong><br>" +
        lat.toFixed(4) + ", " + lng.toFixed(4)
    ).openPopup();
}

// Trouve le nom d'un lieu à partir de ses coordonnées
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


/* ============= RÉCUPÉRATION DES DONNÉES MÉTÉO (API Open-Meteo) =============================== */

async function calculerEtAfficherPotentiel(lat, lng) {
    try {
        const url = "https://api.open-meteo.com/v1/forecast" +
            "?latitude=" + lat +
            "&longitude=" + lng +
            "&daily=sunshine_duration,precipitation_sum,wind_speed_10m_max" +
            "&timezone=auto";

        const reponse = await fetch(url);
        const donnees = await reponse.json();

        // Calcul des scores à partir des données météo
        const scores = calculerScores(donnees, lat, lng);

        // Affichage des résultats dans le panneau
        afficherResultats(scores);

    } catch (erreur) {
        console.error("Erreur lors de la récupération météo :", erreur);
    }
}


/* ================== Calcul de la moyenne donnee ================== */

// Calcule la moyenne d'un tableau de nombres

function moyenneTableau(tableau) {

    // Si le tableau n'existe pas ou vide retourne 0
    if (!tableau || tableau.length === 0) return 0;

    let total = 0;
    let compteur = 0;

    tableau.forEach(function(valeur) {

        // Transforme la valeur en nombre valide 
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
   PARTIE 10 — CALCUL DES SCORES ÉNERGÉTIQUES
   ===================================================== */

function calculerScores(donneesMétéo, lat, lng) {

    const daily = donneesMétéo.daily;

    // --- Données de 7 jours ---
    const soleilMoyenEnSecondes = moyenneTableau(daily?.sunshine_duration);
    const ventMoyenKmh          = moyenneTableau(daily?.wind_speed_10m_max);
    const pluieMoyenneMm        = moyenneTableau(daily?.precipitation_sum);


    // -----------------------------------------------
    // SCORE SOLAIRE
    // Plus il y a de soleil → plus le score est élevé
    // On convertit les secondes en heures (÷ 3600)
    // Un bon ensoleillement = 8h/jour ou plus
    // -----------------------------------------------
    const soleilEnHeures = soleilMoyenEnSecondes / 3600;
    const scoreSolaireBrut = (soleilEnHeures / 8) * 10;
    const scoreSolaire = limiterEntre0Et10(arrondir(scoreSolaireBrut));


    // -----------------------------------------------
    // SCORE ÉOLIEN
    // Plus le vent est fort → plus le score est élevé
    // Un bon vent pour l'éolien = 20 km/h ou plus
    // -----------------------------------------------
    const scoreEolienBrut = (ventMoyenKmh / 20) * 10;
    const scoreEolien = limiterEntre0Et10(arrondir(scoreEolienBrut));


    // -----------------------------------------------
    // SCORE HYDRAULIQUE
    // Plus il pleut → plus le score est élevé
    // Une bonne pluviométrie = 5 mm/jour ou plus
    // -----------------------------------------------
    const scoreHydrauliqueBrut = (pluieMoyenneMm / 5) * 10;
    const scoreHydraulique = limiterEntre0Et10(arrondir(scoreHydrauliqueBrut));


    // -----------------------------------------------
    // SCORE GÉOTHERMIE
    // Basé sur la proximité de zones volcaniques connues
    // (indépendant de la météo)
    // -----------------------------------------------
    const scoreGeothermie = calculerScoreGeothermie(lat, lng);


    // -----------------------------------------------
    // SCORE GLOBAL
    // On additionne les 4 notes puis on divise par 4
    // -----------------------------------------------

   
    const somme = scoreSolaire + scoreEolien + scoreHydraulique + scoreGeothermie;
    const scoreGlobal = Math.round((somme / 4) * 10) / 10;
    console.log("Solaire:", scoreSolaire, "Eolien:", scoreEolien, "Hydraulique:", scoreHydraulique, "Géothermie:", scoreGeothermie, "→ Moyenne:", scoreGlobal);


    // On retourne toutes les valeurs dont on a besoin 

    return {
        solaire:     scoreSolaire,
        eolien:      scoreEolien,
        hydraulique: scoreHydraulique,
        geothermie:  scoreGeothermie,
        global:      scoreGlobal,

        // Pour les descriptions dans le panneau
        soleilHeures:   Math.round(soleilEnHeures),
        ventKmh:        Math.round(ventMoyenKmh),
        pluieMm:        pluieMoyenneMm.toFixed(1)
    };
}


/* =============== GEOTHERMIE ======================== */

function calculerScoreGeothermie(lat, lng) {

    // --- ZONES VOLCANIQUES ET GÉOTHERMIQUES MONDIALES ---
   
    // La Réunion Piton de la Fournaise 
    const distanceFournaise = distanceKm(lat, lng, -21.244, 55.708);
    if (distanceFournaise < 15) return arrondir(limiterEntre0Et10(9.5 - distanceFournaise * 0.1));


    // Islande (très forte activité géothermique)
    const distanceIslande = distanceKm(lat, lng, 64.0, -19.0);
    if (distanceIslande < 300) return arrondir(limiterEntre0Et10(9.5 - distanceIslande * 0.005));

    // Sicile / Etna (Italie)
    const distanceEtna = distanceKm(lat, lng, 37.75, 15.0);
    if (distanceEtna < 150) return arrondir(limiterEntre0Et10(8.5 - distanceEtna * 0.01));

    // Hawaii (USA)
    const distanceHawaii = distanceKm(lat, lng, 19.5, -155.5);
    if (distanceHawaii < 200) return arrondir(limiterEntre0Et10(9.0 - distanceHawaii * 0.008));

    // Japon 
    const distanceJapon = distanceKm(lat, lng, 35.7, 137.7);
    if (distanceJapon < 500) return arrondir(limiterEntre0Et10(8.0 - distanceJapon * 0.005));

    // Nouvelle-Zélande
    const distanceNouvelleZelande = distanceKm(lat, lng, -38.5, 176.0);
    if (distanceNouvelleZelande < 300) return arrondir(limiterEntre0Et10(8.5 - distanceNouvelleZelande * 0.008));

    // Indonésie 
    const distanceIndonesie = distanceKm(lat, lng, -7.5, 110.0);
    if (distanceIndonesie < 400) return arrondir(limiterEntre0Et10(8.5 - distanceIndonesie * 0.006));

    // Kenya 
    const distanceKenya = distanceKm(lat, lng, 0.5, 36.0);
    if (distanceKenya < 300) return arrondir(limiterEntre0Et10(7.5 - distanceKenya * 0.007));

    // Ethiopie 
    const distanceEthiopie = distanceKm(lat, lng, 11.5, 40.5);
    if (distanceEthiopie < 300) return arrondir(limiterEntre0Et10(7.0 - distanceEthiopie * 0.007));

    // Mexique 
    const distanceMexique = distanceKm(lat, lng, 19.5, -99.1);
    if (distanceMexique < 400) return arrondir(limiterEntre0Et10(7.0 - distanceMexique * 0.006));

    // Turquie 
    const distanceTurquie = distanceKm(lat, lng, 38.0, 29.0);
    if (distanceTurquie < 300) return arrondir(limiterEntre0Et10(7.5 - distanceTurquie * 0.008));

    // Filipinnes 
    const distanceFilipinnes = distanceKm(lat, lng, 12.5, 122.0);
    if (distanceFilipinnes < 400) return arrondir(limiterEntre0Et10(8.0 - distanceFilipinnes * 0.006));

    // Par défaut : potentiel faible si aucune zone volcanique proche
    return 2.0;
}


/* ====== AFFICHAGE DES RÉSULTATS ================== */

function afficherResultats(scores) {

    // --- Notes sur chaque carte énergie ---
    setTexte("note-solaire",     scores.solaire);
    setTexte("note-eolien",      scores.eolien);
    setTexte("note-hydraulique", scores.hydraulique);
    setTexte("note-geothermie",  scores.geothermie);

    // --- Descriptions sous chaque note ---
    setTexte("desc-solaire",     scores.soleilHeures + "h d'ensoleillement par jour");
    setTexte("desc-eolien",      "Vent moyen : " + scores.ventKmh + " km/h");
    setTexte("desc-hydraulique", "Pluie : " + scores.pluieMm + " mm/jour");
    setTexte("desc-geothermie",  "Basé sur la géologie locale");

    // --- Note globale --- 
    const el = document.getElementById("note-globale-valeur");
    if (el) el.textContent = String(scores.global);

    // --- Commentaire global sous la note ---

    let commentaireGlobal = "";
    if (scores.global > 6) {
        commentaireGlobal = "🌿 Ce lieu présente un excellent potentiel énergétique à exploiter.";
    } else if (scores.global >= 4) {
        commentaireGlobal = "🔍 Potentiel modéré. Une étude complémentaire est recommandée.";
    } else {
        commentaireGlobal = "⚠️ Potentiel limité. Ce lieu n'est pas idéal pour les énergies renouvelables.";
    }
    setTexte("commentaire-global", commentaireGlobal);

    // --- Couleur du panneau note globale selon le score ---
    const panneauNoteGlobale = getElement("note-globale-valeur")?.closest(".note-globale");

    if (panneauNoteGlobale) {
        // On retire d'abord les anciennes couleurs
        panneauNoteGlobale.classList.remove("note-excellente", "note-moyenne", "note-faible");

        if (scores.global > 6) {
            panneauNoteGlobale.classList.add("note-excellente");
        } else if (scores.global >= 4) {
            panneauNoteGlobale.classList.add("note-moyenne");
        } else {
            panneauNoteGlobale.classList.add("note-faible");
        }
    }

    // --- Mise à jour des popups ---
    mettreAJourPopups(scores);
}


/* ====  POPUPS ÉNERGIE =================== */

function mettreAJourPopups(scores) {
    mettreAJourUnPopup("popup-solaire",     scores.solaire,     scores.soleilHeures + "h d'ensoleillement/jour");
    mettreAJourUnPopup("popup-eolien",      scores.eolien,      "Vent moyen : " + scores.ventKmh + " km/h");
    mettreAJourUnPopup("popup-hydraulique", scores.hydraulique, "Pluie : " + scores.pluieMm + " mm/jour");
    mettreAJourUnPopup("popup-geothermie",  scores.geothermie,  "Basé sur l'activité géologique locale");
}

// Met à jour un seul popup avec la note, la couleur et le message
function mettreAJourUnPopup(idPopup, note, description) {
    const popup = getElement(idPopup);
    if (!popup) return;

    // Affiche la note dans le popup
    const noteEl = popup.querySelector(".popup-note");
    if (noteEl) {
        noteEl.textContent = note + " /10";

        // Couleur de la note selon le score
        if (note >= 7) {
            noteEl.style.color = "green";
        } else if (note >= 4) {
            noteEl.style.color = "orange";
        } else {
            noteEl.style.color = "red";
        }
    }

    // Affiche le message selon la note
    const messageEl = popup.querySelector(".popup-message");
    if (messageEl) {
        if (note > 6) {
            messageEl.textContent = "✅ Excellent potentiel énergétique pour ce lieu. Les conditions sont optimales pour un projet viable et durable, avec un fort potentiel de production d’énergie renouvelable.  C’est une opportunité intéressante pour développer un projet à impact positif sur la transition écologique.";
        } else if (note >= 4) {
            messageEl.textContent = "🔍 Potentiel modéré. Le projet est envisageable sous réserve d’une analyse plus approfondie. Avec les bons ajustements et les bons outils, ce site peut devenir une solution énergétique pertinente et durable. Vous pourriez faire partie des premiers à valoriser ce potentiel énergétique sur ce territoire.";
        } else {
            messageEl.textContent = "❌ Potentiel très limité. Les conditions actuelles ne sont pas favorables à un projet rentable. Seules des solutions innovantes ou des adaptations techniques majeures pourraient rendre le site exploitable. Conseil: Il est conseillé d’explorer d’autres sites ou d’autres sources de potentiel énergétique.";
           
        }
    }

    // Affiche la description météo
    const descEl = popup.querySelector(".popup-description");
    if (descEl) {
        descEl.textContent = description;
    }
}


/* ================== POPUPS ================== */

// Ouverture des popups quand on clique sur une carte énergie
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


// Fermeture des popups quand on clique sur la croix (✖)
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



/* ================== FORMULAIRE CONTACT → SUPABASE ================== */

const SUPABASE_URL = "https://ysslpkcxrbytsftlhijf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc2xwa2N4cmJ5dHNmdGxoaWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTU2MTcsImV4cCI6MjA5NTUzMTYxN30._ZF8LfqXnOIxKeaE9oCyyLVJ2Yxk9bIpRec8PyBzcA0";

const formulaire = document.getElementById("formulaire-contact");

if (formulaire) {
    formulaire.addEventListener("submit", async function (e) {
        e.preventDefault(); // empêche le rechargement de la page

        const nom     = document.getElementById("nom").value.trim();
        const email   = document.getElementById("email").value.trim();
        const message = document.getElementById("message").value.trim();

        // Envoi vers Supabase
        const reponse = await fetch(SUPABASE_URL + "/rest/v1/Contacts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": SUPABASE_KEY,
                "Authorization": "Bearer " + SUPABASE_KEY,
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({ nom, email, message })
        });

        const confirmation = document.getElementById("confirmation-envoi");

        if (reponse.ok) {
            // Affiche le message de confirmation
            confirmation?.classList.remove("hidden");
            formulaire.reset(); // vide le formulaire

            // Cache la confirmation après 5 secondes
            setTimeout(() => confirmation?.classList.add("hidden"), 5000);
        } else {
            alert("❌ Erreur lors de l'envoi. Veuillez réessayer.");
        }
    });
}