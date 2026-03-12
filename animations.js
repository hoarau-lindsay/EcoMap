/* ============================================================
   animations.js — Dynamisme de l'interface utilisateur
   Effets visuels, scroll, navigation active, formulaire
   ============================================================ */


/* ============================================================
   1. LIEN DE NAVIGATION ACTIF AU SCROLL
   ============================================================ */

const sections    = document.querySelectorAll('main section, header');
const liensMenu   = document.querySelectorAll('.lien-menu');

const observateurSections = new IntersectionObserver((entrees) => {
    entrees.forEach((entree) => {
        if (entree.isIntersecting) {
            // Retire la classe active de tous les liens
            liensMenu.forEach(l => l.classList.remove('actif'));
            // Ajoute la classe active au lien correspondant à la section visible
            const id = entree.target.id;
            const lienActif = document.querySelector(`.lien-menu[href="#${id}"]`);
            if (lienActif) lienActif.classList.add('actif');
        }
    });
}, {
    threshold: 0.4, // La section doit être visible à 40%
});

sections.forEach(s => observateurSections.observe(s));


/* ============================================================
   2. APPARITION DES SECTIONS AU SCROLL (fade-in)
   ============================================================ */

const elementsFadeIn = document.querySelectorAll(
    '.bloc-formule, .carte-membre, .carte-energie, .section-carte h2, .titre-section'
);

// On ajoute la classe CSS pour préparer l'animation
elementsFadeIn.forEach(el => {
    el.classList.add('scroll-hidden');
});

const observateurFade = new IntersectionObserver((entrees) => {
    entrees.forEach((entree) => {
        if (entree.isIntersecting) {
            entree.target.classList.add('scroll-visible');
            observateurFade.unobserve(entree.target); // Animation une seule fois
        }
    });
}, {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px',
});

elementsFadeIn.forEach(el => observateurFade.observe(el));

// Injection des styles d'animation scroll directement en JS
// (pour éviter de polluer le CSS avec des classes utilitaires)
const styleScroll = document.createElement('style');
styleScroll.textContent = `
    .scroll-hidden {
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.6s ease, transform 0.6s ease;
    }
    .scroll-visible {
        opacity: 1;
        transform: translateY(0);
    }
`;
document.head.appendChild(styleScroll);


/* ============================================================
   3. OMBRE DE LA NAVIGATION AU SCROLL
   ============================================================ */

const nav = document.querySelector('.bar-navigation');

window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
        nav.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.18)';
    } else {
        nav.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    }
});


/* ============================================================
   4. COMPTEUR ANIMÉ POUR LA NOTE GLOBALE
   ============================================================ */

/**
 * Anime un chiffre de 0 vers sa valeur cible
 * @param {HTMLElement} el  - Élément dont le textContent sera mis à jour
 * @param {number} cible    - Valeur finale
 * @param {number} duree    - Durée en ms (défaut 800)
 */
function animerCompteur(el, cible, duree = 800) {
    const debut = performance.now();
    const valeurDebut = 0;

    function etape(maintenant) {
        const progres = Math.min((maintenant - debut) / duree, 1);
        // Easing ease-out
        const eased = 1 - Math.pow(1 - progres, 3);
        const valeur = valeurDebut + (cible - valeurDebut) * eased;
        el.textContent = valeur.toFixed(1);
        if (progres < 1) requestAnimationFrame(etape);
    }

    requestAnimationFrame(etape);
}

// Expose la fonction pour que script.js puisse l'appeler
window.animerCompteur = animerCompteur;

// Hook sur la mise à jour de la note globale
const observateurNote = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        const el = mutation.target;
        const valeur = parseFloat(el.textContent);
        if (!isNaN(valeur) && valeur > 0) {
            animerCompteur(el, valeur);
        }
    });
});

const noteGlobaleEl = document.getElementById('note-globale-valeur');
if (noteGlobaleEl) {
    observateurNote.observe(noteGlobaleEl, { characterData: false, childList: true, subtree: true });
}


/* ============================================================
   5. FORMULAIRE DE CONTACT — SIMULATION D'ENVOI
   ============================================================ */

const formulaire       = document.getElementById('formulaire-contact');
const confirmationEnvoi = document.getElementById('confirmation-envoi');

if (formulaire) {
    formulaire.addEventListener('submit', (e) => {
        e.preventDefault(); // Empêche le rechargement de la page

        const btn = formulaire.querySelector('.bouton-envoyer');
        btn.textContent = 'Envoi en cours...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        // Simulation d'un délai réseau (à remplacer par un vrai fetch vers un backend)
        setTimeout(() => {
            confirmationEnvoi.classList.remove('hidden');
            formulaire.reset();

            btn.textContent = 'Envoyer';
            btn.disabled = false;
            btn.style.opacity = '1';

            // Cache la confirmation après 5 secondes
            setTimeout(() => {
                confirmationEnvoi.classList.add('hidden');
            }, 5000);

        }, 1200);
    });
}


/* ============================================================
   6. EFFET "RIPPLE" AU CLIC SUR LE BOUTON CTA
   ============================================================ */

const boutonCta = document.querySelector('.bouton-cta');

if (boutonCta) {
    boutonCta.addEventListener('click', function (e) {
        // Crée un cercle d'ondulation au point de clic
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const taille = Math.max(rect.width, rect.height);

        ripple.style.cssText = `
            position: absolute;
            width: ${taille}px;
            height: ${taille}px;
            left: ${e.clientX - rect.left - taille / 2}px;
            top: ${e.clientY - rect.top - taille / 2}px;
            background: rgba(255,255,255,0.35);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple-anim 0.6s ease-out;
            pointer-events: none;
        `;

        // Style d'animation ripple injecté une seule fois
        if (!document.getElementById('ripple-style')) {
            const s = document.createElement('style');
            s.id = 'ripple-style';
            s.textContent = `
                @keyframes ripple-anim {
                    to { transform: scale(2.5); opacity: 0; }
                }
            `;
            document.head.appendChild(s);
        }

        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
    });
}


/* ============================================================
   7. TOOLTIP PERSONNALISÉ SUR LES CARTES ÉNERGIE
   ============================================================ */

const infosTooltip = {
    'carte-solaire':     "☀️ Basé sur la durée d'ensoleillement journalier (Open-Meteo)",
    'carte-eolien':      "💨 Basé sur la vitesse maximale du vent sur 7 jours",
    'carte-hydraulique': "💧 Basé sur les précipitations moyennes journalières",
    'carte-geothermie':  "🌋 Estimé selon la proximité de zones géothermiques actives",
};

Object.entries(infosTooltip).forEach(([id, texte]) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.title = texte; // Tooltip natif simple (peut être remplacé par une lib)
    el.style.cursor = 'help';
});
