// Globale Variablen und DOM-Elemente
const enhancedProjects = [];
const projectsGrid = document.getElementById('projectsGrid');
const modal = document.getElementById('projectModal');
const closeBtn = document.querySelector('.close');

/**
 * Dekodiert einen Base64-String korrekt als UTF-8.
 * @param {string | null} base64 - Der Base64-kodierte String.
 * @returns {string | null} Der dekodierte String oder null bei einem Fehler.
 */
function decodeBase64Utf8(base64) {
    if (!base64) return null;
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        return null;
    }
}

/**
 * Konvertiert Markdown in HTML mithilfe der 'marked'-Bibliothek.
 * @param {string} markdown - Der Markdown-Text.
 * @param {string} baseUrl - Die Basis-URL zur Auflösung relativer Bildpfade.
 * @returns {string} Das gerenderte HTML.
 */
function markdownToHtml(markdown, baseUrl) {
    if (!markdown) return '';
    const html = marked.parse(markdown, {
        baseUrl: baseUrl,
        gfm: true,
        breaks: true
    });
    return html.replace(/<img /g, '<img class="readme-image" ');
}

/**
 * Ruft Repository-Daten von der GitHub-API ab.
 * @param {string} repo - Der Repository-Name (z.B. "user/repo").
 * @returns {Promise<object|null>} Ein Objekt mit den API-Daten oder null bei einem Fehler.
 */
async function fetchGitHubData(repo) {
    try {
        const repoResponse = await fetch(`https://api.github.com/repos/${repo}`);
        if (repoResponse.status === 403) { throw new Error('RateLimit'); }
        if (!repoResponse.ok) { console.error(`Repository ${repo} nicht gefunden. Status: ${repoResponse.status}`); return null; }
        const repoData = await repoResponse.json();
        
        const readmeResponse = await fetch(`https://api.github.com/repos/${repo}/readme`);
        const readmeData = await readmeResponse.json();
        
        const defaultBranch = repoData.default_branch;
        const imageUrl = `https://raw.githubusercontent.com/${repo}/${defaultBranch}/images/overview.png`;
        const repoBaseUrl = `https://raw.githubusercontent.com/${repo}/${defaultBranch}/`;
        const readmeContent = decodeBase64Utf8(readmeData.content);

        return {
            description: repoData.description || 'Keine Beschreibung verfügbar',
            language: repoData.language,
            stars: repoData.stargazers_count,
            forks: repoData.forks_count,
            readme: readmeContent,
            topics: repoData.topics || [],
            imageUrl: imageUrl,
            homepage: repoData.homepage,
            repoBaseUrl: repoBaseUrl
        };
    } catch (e) {
        throw e;
    }
}

/**
 * Erstellt und rendert die Projektkarten auf der Seite.
 */
function createProjectCards() {
    projectsGrid.innerHTML = '';
    enhancedProjects.forEach(project => {
        if (!project) return;
        const card = document.createElement('div');
        card.className = 'project-card';
        card.onclick = () => openModal(project);
        const techTags = (project.topics || []).map(tech => `<span class="tech-tag">${tech}</span>`).join('');
        const imageStyle = project.imageUrl ? `style="background-image: url('${project.imageUrl}');"` : '';
        card.innerHTML = `
            <div class="project-image" ${imageStyle}>
                <span class="icon-fallback">${project.icon}</span>
            </div>
            <div class="project-content">
                <h3 class="project-title">${project.title}</h3>
                <p class="project-description">${project.description}</p>
                <div class="project-tech">${techTags}</div>
            </div>`;
        projectsGrid.appendChild(card);
    });
}

/**
 * Öffnet das Modal mit den Details eines Projekts.
 * @param {object} project - Das Projektobjekt.
 */
function openModal(project) {
    document.getElementById('modalTitle').textContent = project.title;
    const subtitleElement = document.getElementById('modalSubtitle');
    let baseSubtitle = `${project.language || 'Software'} Project • ⭐ ${project.stars || 0} • 🍴 ${project.forks || 0}`;
    if (project.hasGhPages === true) {
        let liveDemoUrl = project.homepage;
        if (!liveDemoUrl) {
            const repoParts = project.repo.split('/');
            liveDemoUrl = `https://${repoParts[0]}.github.io/${repoParts[1]}/`;
        }
        baseSubtitle += ` • <a href="${liveDemoUrl}" class="subtitle-link" target="_blank" rel="noopener noreferrer">🚀 Live Demo</a>`;
    }
    subtitleElement.innerHTML = baseSubtitle;
    document.getElementById('githubLink').href = `https://github.com/${project.repo}`;
    const techTags = (project.topics || []).map(tech => `<span class="tech-tag">${tech}</span>`).join('');
    document.getElementById('modalTech').innerHTML = techTags;
    const sliderContainer = document.querySelector('#imageSlider .slider-container');
    if (project.imageUrl) {
        sliderContainer.innerHTML = `<img src="${project.imageUrl}" alt="Projektvorschau für ${project.title}" class="slider-image">`;
    } else {
        sliderContainer.innerHTML = '<div class="slider-placeholder">🖼️</div>';
    }
    const mainContentArea = document.getElementById('main-content-area');
    if (project.readme && project.readme !== 'README nicht verfügbar') {
        mainContentArea.innerHTML = markdownToHtml(project.readme, project.repoBaseUrl);
    } else {
        mainContentArea.innerHTML = `<h3>Beschreibung</h3><p>${project.description}</p>`;
    }
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

/**
 * Schließt das Modal.
 */
function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

/**
 * Initialisiert die Seite: Lädt Projektdaten, ruft API-Daten ab und rendert alles.
 */
async function initializePage() {
    projectsGrid.innerHTML = '<div style="text-align: center; color: white; font-size: 1.2em; grid-column: 1 / -1;">Lade Projekte...</div>';
    
    try {
        // Lade die lokale Projektkonfiguration
        const response = await fetch('projects.json');
        const projectsConfig = await response.json();

        // Rufe die Daten für jedes Projekt von GitHub ab
        const fetchPromises = projectsConfig.map(project => 
            fetchGitHubData(project.repo).then(githubData => ({ ...project, ...githubData }))
        );
        
        const results = await Promise.allSettled(fetchPromises);
        
        const rateLimitError = results.some(result => result.status === 'rejected' && result.reason.message === 'RateLimit');
        
        if (rateLimitError) {
            projectsGrid.innerHTML = `<div class="error-message"><span class="icon">⏳</span><h3>API-Limit erreicht</h3><p>Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in etwa einer Stunde erneut.</p></div>`;
        } else {
            const successfulProjects = results
                .filter(result => result.status === 'fulfilled' && result.value)
                .map(result => result.value);
            
            enhancedProjects.push(...successfulProjects);
            createProjectCards();
        }
    } catch (error) {
        console.error("Fehler beim Initialisieren der Seite:", error);
        projectsGrid.innerHTML = `<div class="error-message"><span class="icon">❌</span><h3>Fehler</h3><p>Die Projektdaten konnten nicht geladen werden.</p></div>`;
    }
}

// Event Listeners
closeBtn.onclick = closeModal;
window.onclick = (event) => { if (event.target === modal) closeModal(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display === 'block') closeModal(); });

// Start der Anwendung
initializePage();