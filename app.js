// ============================================
// CONFIGURATION & CONSTANTS
// ============================================
const MONTHS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const AIRLINES = [
    "Mauritania Airlines",
    "Air Sénégal", 
    "Turkish Airlines",
    "Binter",
    "Air Algérie",
    "ASKY",
    "Royal Air Maroc",
    "Tunisair",
    "Air France"
];

const AIRLINE_PREFIXES = {
    "Mauritania Airlines": "L6",
    "Air Sénégal": "HC",
    "Turkish Airlines": "TK",
    "Binter": "NT",
    "Air Algérie": "AH",
    "ASKY": "KP",
    "Royal Air Maroc": "AT",
    "Tunisair": "TU",
    "Air France": "AF"
};

// ============================================
// AUTHENTICATION
// ============================================
const ADMIN_PASSWORD = "admin";
let isAuthenticated = false;

// ============================================
// APPLICATION STATE
// ============================================
let flights = [];
let currentTypeFilter = "ALL";
let lastDeletedFlight = null;
let undoTimeout = null;
let isInitialized = false;

// ============================================
// DOM ELEMENT REFERENCES
// ============================================
const elements = {
    // Table
    flightTableBody: document.getElementById('flightTableBody'),
    totalPassengers: document.getElementById('totalPassengers'),
    totalBabies: document.getElementById('totalBabies'),
    
    // Filters
    monthSelect: document.getElementById('monthSelect'),
    companySelect: document.getElementById('companySelect'),
    searchFrom: document.getElementById('searchFrom'),
    searchTo: document.getElementById('searchTo'),
    searchImm: document.getElementById('searchImm'),
    searchVol: document.getElementById('searchVol'),
    resetFilters: document.getElementById('resetFilters'),
    
    // Type filter buttons
    typeButtons: document.querySelectorAll('[data-type]'),
    
    // Actions
    addFlightBtn: document.getElementById('addFlightBtn'),
    undoBtn: document.getElementById('undoBtn'),
    
    // Modal
    flightModal: document.getElementById('flightModal'),
    flightForm: document.getElementById('flightForm'),
    cancelBtn: document.getElementById('cancelBtn'),
    
    // Form inputs
    fDate: document.getElementById('fDate'),
    fCompany: document.getElementById('fCompany'),
    fImm: document.getElementById('fImm'),
    fVol: document.getElementById('fVol'),
    fType: document.getElementById('fType'),
    fPassengers: document.getElementById('fPassengers'),
    fBabies: document.getElementById('fBabies'),
    
    // Notifications
    notificationContainer: document.getElementById('notificationContainer')
};

// ============================================
// INITIALIZATION
// ============================================
function initializeApp() {
    if (isInitialized) return;
    
    try {
        populateSelects();
        attachEventListeners();
        setupRealtimeListener();
        isInitialized = true;
        showNotification('Application initialisée avec succès', 'success');
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Erreur lors de l\'initialisation', 'error');
    }
}

function populateSelects() {
    // Populate month select
    MONTHS.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = month;
        elements.monthSelect.appendChild(option);
    });
    
    // Populate company selects
    AIRLINES.forEach(airline => {
        // Filter select
        const filterOption = document.createElement('option');
        filterOption.value = airline;
        filterOption.textContent = airline;
        elements.companySelect.appendChild(filterOption);
        
        // Form select
        const formOption = document.createElement('option');
        formOption.value = airline;
        formOption.textContent = airline;
        elements.fCompany.appendChild(formOption);
    });
}

// ============================================
// EVENT LISTENERS
// ============================================
function attachEventListeners() {
    // Filter changes
    const filterElements = [
        elements.monthSelect, elements.companySelect, 
        elements.searchFrom, elements.searchTo
    ];
    
    filterElements.forEach(element => {
        element.addEventListener('change', handleFilterChange);
    });
    
    // Input filters (real-time)
    elements.searchImm.addEventListener('input', handleFilterChange);
    elements.searchVol.addEventListener('input', handleFilterChange);
    
    // Type filter buttons
    elements.typeButtons.forEach(button => {
        button.addEventListener('click', () => handleTypeFilter(button));
    });
    
    // Reset filters
    elements.resetFilters.addEventListener('click', resetFilters);
    
    // Actions
    elements.addFlightBtn.addEventListener('click', openModal);
    elements.undoBtn.addEventListener('click', undoDelete);
    
    // Modal
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.flightModal.addEventListener('click', handleModalBackdropClick);
    elements.flightForm.addEventListener('submit', handleFormSubmit);
    
    // Form interactions
    elements.fCompany.addEventListener('change', updateFlightNumberPrefix);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(event) {
    // Escape to close modal
    if (event.key === 'Escape' && elements.flightModal.classList.contains('active')) {
        closeModal();
    }
    
    // Ctrl/Cmd + N to add new flight
    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        openModal();
    }
}

// ============================================
// MODAL FUNCTIONS
// ============================================
function openModal() {
    requireAuthentication(() => {
        elements.flightModal.classList.add('active');
        resetForm();
        elements.fDate.focus();
        
        // Set default values
        elements.fCompany.value = AIRLINES[0];
        elements.fType.value = 'DEP';
        elements.fPassengers.value = '0';
        elements.fBabies.value = '0';
        
        updateFlightNumberPrefix();
    });
}

function closeModal() {
    elements.flightModal.classList.remove('active');
    resetForm();
}

function handleModalBackdropClick(event) {
    if (event.target === elements.flightModal) {
        closeModal();
    }
}

function resetForm() {
    elements.flightForm.reset();
    clearValidationErrors();
}

// ============================================
// FORM HANDLING
// ============================================
function handleFormSubmit(event) {
    event.preventDefault();
    
    if (validateForm()) {
        const flightData = getFormData();
        addFlight(flightData);
    }
}

function validateForm() {
    clearValidationErrors();
    let isValid = true;
    
    const required = [
        { field: elements.fDate, message: 'La date est requise' },
        { field: elements.fCompany, message: 'La compagnie est requise' },
        { field: elements.fImm, message: 'L\'immatriculation est requise' },
        { field: elements.fVol, message: 'Le numéro de vol est requis' }
    ];
    
    required.forEach(({ field, message }) => {
        if (!field.value.trim()) {
            showFieldError(field, message);
            isValid = false;
        }
    });
    
    // Validate registration format
    if (elements.fImm.value.trim() && !isValidRegistration(elements.fImm.value.trim())) {
        showFieldError(elements.fImm, 'Format d\'immatriculation invalide (ex: 5T-CLC)');
        isValid = false;
    }
    
    return isValid;
}

function isValidRegistration(registration) {
    // Basic validation for registration format (e.g., 5T-CLC, F-GRNT, etc.)
    return /^[A-Z0-9]+-[A-Z0-9]+$/i.test(registration.trim());
}

function showFieldError(field, message) {
    field.classList.add('error');
    
    let errorElement = field.parentNode.querySelector('.field-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        field.parentNode.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
}

function clearValidationErrors() {
    document.querySelectorAll('.field-error').forEach(error => error.remove());
    document.querySelectorAll('.error').forEach(field => field.classList.remove('error'));
}

function getFormData() {
    return {
        date: elements.fDate.value,
        company: elements.fCompany.value,
        registration: elements.fImm.value.trim().toUpperCase(),
        flightNumber: elements.fVol.value.trim().toUpperCase(),
        type: elements.fType.value,
        passengers: parseInt(elements.fPassengers.value) || 0,
        babies: parseInt(elements.fBabies.value) || 0,
        timestamp: Date.now()
    };
}

function updateFlightNumberPrefix() {
    const company = elements.fCompany.value;
    const prefix = AIRLINE_PREFIXES[company];
    const currentValue = elements.fVol.value.trim();
    
    if (prefix && (!currentValue || currentValue.match(/^[A-Z0-9]+-$/))) {
        elements.fVol.value = prefix + '-';
    }
}

// ============================================
// FLIGHT OPERATIONS
// ============================================
async function addFlight(flightData) {
    try {
        elements.flightForm.classList.add('loading');
        
        // Add to Firebase through firebase.js
        if (window.dbService && window.dbService.addFlight) {
            await window.dbService.addFlight(flightData);
        } else {
            throw new Error('Service de base de données non disponible');
        }
        
        closeModal();
        showNotification('Vol ajouté avec succès', 'success');
    } catch (error) {
        console.error('Error adding flight:', error);
        showNotification('Erreur lors de l\'ajout du vol', 'error');
    } finally {
        elements.flightForm.classList.remove('loading');
    }
}

async function deleteFlight(flightId) {
    console.log('Delete flight called with ID:', flightId);
    
    const success = await requireAuthentication(async () => {
        console.log('Authentication passed, proceeding with delete');
        try {
            const flight = flights.find(f => f.id === flightId);
            if (!flight) {
                console.log('Flight not found:', flightId);
                return false;
            }
            
            console.log('Found flight to delete:', flight);
            
            // Store for undo
            lastDeletedFlight = { flight, id: flightId };
            
            // Delete from Firebase
            if (window.dbService && window.dbService.deleteFlight) {
                console.log('Calling dbService.deleteFlight');
                await window.dbService.deleteFlight(flightId);
                showUndoButton();
                showNotification('Vol supprimé', 'warning');
                return true;
            } else {
                console.error('dbService not available');
                throw new Error('Service de base de données non disponible');
            }
        } catch (error) {
            console.error('Error deleting flight:', error);
            showNotification('Erreur lors de la suppression du vol', 'error');
            return false;
        }
    });
    
    console.log('Delete operation result:', success);
    return success;
}

async function undoDelete() {
    if (!lastDeletedFlight) return;
    
    try {
        // Restore to Firebase
        if (window.dbService && window.dbService.addFlight) {
            await window.dbService.addFlight(lastDeletedFlight.flight);
        }
        
        hideUndoButton();
        lastDeletedFlight = null;
        showNotification('Suppression annulée', 'success');
    } catch (error) {
        console.error('Error undoing delete:', error);
        showNotification('Erreur lors de l\'annulation de la suppression', 'error');
    }
}

function showUndoButton() {
    elements.undoBtn.style.display = 'inline-block';
    
    if (undoTimeout) {
        clearTimeout(undoTimeout);
    }
    
    undoTimeout = setTimeout(() => {
        hideUndoButton();
        lastDeletedFlight = null;
    }, 10000); // 10 seconds
}

function hideUndoButton() {
    elements.undoBtn.style.display = 'none';
    
    if (undoTimeout) {
        clearTimeout(undoTimeout);
        undoTimeout = null;
    }
}

// ============================================
// FILTER FUNCTIONS
// ============================================
function handleFilterChange() {
    render();
}

function handleTypeFilter(button) {
    currentTypeFilter = button.dataset.type;
    
    // Update active state
    elements.typeButtons.forEach(btn => btn.classList.remove('btn-active'));
    button.classList.add('btn-active');
    
    render();
}

function resetFilters() {
    elements.monthSelect.value = 'ALL';
    elements.companySelect.value = 'ALL';
    elements.searchFrom.value = '';
    elements.searchTo.value = '';
    elements.searchImm.value = '';
    elements.searchVol.value = '';
    currentTypeFilter = 'ALL';
    
    // Reset active button
    elements.typeButtons.forEach(btn => btn.classList.remove('btn-active'));
    document.querySelector('[data-type="ALL"]').classList.add('btn-active');
    
    render();
    showNotification('Filtres réinitialisés', 'success');
}

function filterFlights() {
    const monthFilter = elements.monthSelect.value;
    const companyFilter = elements.companySelect.value;
    const dateFrom = elements.searchFrom.value;
    const dateTo = elements.searchTo.value;
    const immFilter = elements.searchImm.value.toLowerCase().trim();
    const volFilter = elements.searchVol.value.toLowerCase().trim();
    
    return flights.filter(flight => {
        const flightDate = new Date(flight.date);
        
        // Month filter
        if (monthFilter !== 'ALL' && flightDate.getMonth() !== parseInt(monthFilter)) {
            return false;
        }
        
        // Company filter
        if (companyFilter !== 'ALL' && flight.company !== companyFilter) {
            return false;
        }
        
        // Date range filter
        if (dateFrom && flight.date < dateFrom) {
            return false;
        }
        
        if (dateTo && flight.date > dateTo) {
            return false;
        }
        
        // Type filter
        if (currentTypeFilter !== 'ALL' && flight.type !== currentTypeFilter) {
            return false;
        }
        
        // Registration filter
        if (immFilter && !flight.registration.toLowerCase().includes(immFilter)) {
            return false;
        }
        
        // Flight number filter
        if (volFilter && !flight.flightNumber.toLowerCase().includes(volFilter)) {
            return false;
        }
        
        return true;
    });
}

// ============================================
// RENDER FUNCTIONS
// ============================================
function render() {
    const filteredFlights = filterFlights();
    
    // Sort by date (most recent first) and then by timestamp
    filteredFlights.sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        return (b.timestamp || 0) - (a.timestamp || 0);
    });
    
    renderTable(filteredFlights);
    renderTotals(filteredFlights);
}

function renderTable(filteredFlights) {
    elements.flightTableBody.innerHTML = '';
    
    if (filteredFlights.length === 0) {
        elements.flightTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <p>Aucun vol trouvé</p>
                    <small>Ajoutez un vol ou modifiez vos filtres</small>
                </td>
            </tr>
        `;
        return;
    }
    
    filteredFlights.forEach(flight => {
        const row = createFlightRow(flight);
        elements.flightTableBody.appendChild(row);
    });
}

function createFlightRow(flight) {
    const row = document.createElement('tr');
    
    const formattedDate = formatDateEU(flight.date);
    const typeText = flight.type === 'DEP' ? 'Départ' : 'Arrivée';
    const typeClass = flight.type === 'DEP' ? 'type-depart' : 'type-arrivee';
    
    row.innerHTML = `
        <td>${formattedDate}</td>
        <td>${escapeHtml(flight.company)}</td>
        <td><strong>${escapeHtml(flight.registration)}</strong></td>
        <td>${escapeHtml(flight.flightNumber)}</td>
        <td><span class="type-badge ${typeClass}">${typeText}</span></td>
        <td>${flight.passengers}</td>
        <td>${flight.babies}</td>
        <td>
            <button class="delete-btn" onclick="app.deleteFlight('${flight.id}')">
                Supprimer
            </button>
        </td>
    `;
    
    return row;
}

function renderTotals(filteredFlights) {
    const totalPassengers = filteredFlights.reduce((sum, flight) => sum + flight.passengers, 0);
    const totalBabies = filteredFlights.reduce((sum, flight) => sum + flight.babies, 0);
    
    elements.totalPassengers.textContent = totalPassengers.toLocaleString();
    elements.totalBabies.textContent = totalBabies.toLocaleString();
}

// ============================================
// REAL-TIME UPDATES
// ============================================
function setupRealtimeListener() {
    // This will be called by firebase.js when it's ready
    if (window.dbService && window.dbService.onFlightsUpdate) {
        window.dbService.onFlightsUpdate((updatedFlights) => {
            flights = updatedFlights;
            render();
        });
    }
}

function updateFlightsData(newFlights) {
    flights = newFlights;
    render();
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    elements.notificationContainer.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-out forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Format date to EU standard (dd/mm/yyyy)
 * @param {string} dateString - Date in ISO format (yyyy-mm-dd)
 * @returns {string} Formatted date in dd/mm/yyyy format
 */
function formatDateEU(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}

/**
 * Check if user is authenticated for this session
 * @returns {boolean} True if authenticated
 */
function checkAuthentication() {
    if (isAuthenticated) {
        return true;
    }
    
    // Check sessionStorage for existing authentication
    const sessionAuth = sessionStorage.getItem('isAuthenticated');
    if (sessionAuth === 'true') {
        isAuthenticated = true;
        return true;
    }
    
    return false;
}

/**
 * Prompt for password and authenticate
 * @returns {Promise<boolean>} True if authentication successful
 */
async function authenticate() {
    if (checkAuthentication()) {
        return true;
    }
    
    return new Promise((resolve) => {
        // Create modal for password input
        const modal = document.createElement('div');
        modal.className = 'modal active auth-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Authentification requise</h2>
                <p>Veuillez entrer le mot de passe pour continuer:</p>
                <form id="authForm">
                    <div class="form-group">
                        <label for="passwordInput">Mot de passe</label>
                        <input type="password" id="passwordInput" class="password-input" required autocomplete="current-password">
                    </div>
                    <div class="modal-buttons">
                        <button type="submit" class="btn-success">Valider</button>
                        <button type="button" class="btn-secondary" id="cancelAuth">Annuler</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const passwordInput = document.getElementById('passwordInput');
        const authForm = document.getElementById('authForm');
        const cancelBtn = document.getElementById('cancelAuth');
        
        const cleanup = () => {
            modal.remove();
            passwordInput.value = '';
        };
        
        const handleSubmit = (e) => {
            e.preventDefault();
            const password = passwordInput.value;
            
            if (password === ADMIN_PASSWORD) {
                isAuthenticated = true;
                sessionStorage.setItem('isAuthenticated', 'true');
                cleanup();
                resolve(true);
            } else {
                passwordInput.classList.add('error');
                showNotification('Mot de passe incorrect', 'error');
                passwordInput.value = '';
                passwordInput.focus();
            }
        };
        
        const handleCancel = () => {
            cleanup();
            resolve(false);
        };
        
        authForm.addEventListener('submit', handleSubmit);
        cancelBtn.addEventListener('click', handleCancel);
        
        // Focus on password input
        setTimeout(() => passwordInput.focus(), 100);
        
        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEscape);
                handleCancel();
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}

/**
 * Require authentication before executing an action
 * @param {Function} action - Function to execute if authenticated
 * @returns {Promise<boolean>} True if action was executed
 */
async function requireAuthentication(action) {
    const auth = await authenticate();
    if (auth) {
        await action();
        return true;
    } else {
        showNotification('Action annulée', 'warning');
        return false;
    }
}

// ============================================
// PUBLIC API
// ============================================
window.app = {
    deleteFlight,
    updateFlightsData,
    showNotification
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', initializeApp);

// Add CSS for additional styling
const additionalStyles = `
    .field-error {
        color: #e53e3e;
        font-size: 12px;
        margin-top: 4px;
    }
    
    .error {
        border-color: #e53e3e !important;
        box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.1) !important;
    }
    
    .type-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .type-depart {
        background: #e6fffa;
        color: #047481;
    }
    
    .type-arrivee {
        background: #f0fdf4;
        color: #166534;
    }
    
    @keyframes slideOutRight {
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
