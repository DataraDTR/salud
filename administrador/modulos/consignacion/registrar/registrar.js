import './utils.js';
import './handlers.js';
import './firebase.js';

console.log('window.firebaseModules:', window.firebaseModules);
if (!window.firebaseModules) throw new Error('Firebase modules not loaded');

const { 
    initializeApp, getAuth, setPersistence, browserSessionPersistence, 
    getFirestore, collection, addDoc, getDocs, query, where, doc, 
    updateDoc, deleteDoc, orderBy, getDoc, limit, startAfter 
} = window.firebaseModules;

const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserSessionPersistence);

// VARIABLES GLOBALES
window.currentPage = 1;
window.registros = [];
window.medicos = [];
window.referencias = [];
window.lastVisible = null;
window.searchParams = {
    searchAdmision: '', searchPaciente: '', searchMedico: '', 
    searchDescripcion: '', searchProveedor: ''
};
window.dateFilter = { type: null, fechaDia: null, fechaDesde: null, fechaHasta: null, mes: null, anio: null };

// FUNCIONES GLOBALES
window.showLoading = () => document.getElementById('loading')?.classList.add('show');
window.hideLoading = () => document.getElementById('loading')?.classList.remove('show');
window.goToPage = (page) => {
    window.currentPage = page;
    loadAllRegistros();
};

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await initializeAppData();
});

async function initializeAppData() {
    await Promise.all([loadMedicos(db), loadReferencias(db)]);
    
    if (window.medicos.length) 
        setupAutocomplete('medico', 'medicoToggle', 'medicoDropdown', window.medicos, 'nombre');
    
    if (window.referencias.length) {
        setupAutocomplete('codigo', 'codigoToggle', 'codigoDropdown', window.referencias, 'codigo');
        setupAutocomplete('descripcion', 'descripcionToggle', 'descripcionDropdown', window.referencias, 'descripcion');
    }

    await loadAllRegistros();
}

async function loadAllRegistros() {
    const result = await loadRegistros(db, window.currentPage, window.searchParams, window.dateFilter);
    window.registros = result.registros;
}

function setupEventListeners() {
    // BOTONES PRINCIPALES
    document.getElementById('registrarBtn').addEventListener('click', handleRegister);
    document.getElementById('limpiarBtn').addEventListener('click', () => {
        clearForm();
        showToast('🧹 Formulario limpiado', 'success');
    });

    // DESCARGAS
    document.getElementById('downloadAll').addEventListener('click', handleDownloadAll);
    document.getElementById('downloadCurrent').addEventListener('click', () => {
        exportToExcel(window.registros, `consignaciones_pagina_${window.currentPage}_${new Date().toISOString().split('T')[0]}`);
        showToast('📊 Página actual exportada', 'success');
    });

    // MODALES
    document.getElementById('saveEditBtn').addEventListener('click', handleSaveEdit);
    document.getElementById('confirmDeleteBtn').addEventListener('click', handleDelete);

    // TOTALES
    ['cantidad', 'editCantidad', 'precioUnitario', 'editPrecioUnitario'].forEach(id => 
        document.getElementById(id)?.addEventListener('input', () => 
            updateTotalItems(id.startsWith('edit'))
        )
    );

    // UPPERCASE Y MONTO
    enforceUpperCase([
        ...['admision', 'paciente', 'medico', 'codigo', 'descripcion', 'referencia', 'proveedor', 'atributo'],
        ...['editAdmision', 'editPaciente', 'editMedico', 'editCodigo', 'editDescripcion', 'editReferencia', 'editProveedor', 'editAtributo']
    ].map(id => document.getElementById(id)).filter(Boolean));

    formatMontoInput(document.getElementById('precioUnitario'));
    formatMontoInput(document.getElementById('editPrecioUnitario'));

    // SEARCH Y DATE
    setupSearchListeners();
    setupDateFilters();
    setupPaginationListeners();
}

// HANDLERS
async function handleRegister() {
    const formData = {
        admision: document.getElementById('admision').value?.trim().toUpperCase(),
        paciente: document.getElementById('paciente').value?.trim().toUpperCase(),
        medico: document.getElementById('medico').value?.trim(),
        fechaCX: document.getElementById('fechaCX').value ? new Date(document.getElementById('fechaCX').value) : null,
        codigo: document.getElementById('codigo').value?.trim().toUpperCase(),
        descripcion: document.getElementById('descripcion').value?.trim().toUpperCase(),
        cantidad: parseInt(document.getElementById('cantidad').value) || 0
    };

    if (!formData.admision || !formData.paciente || !formData.medico || !formData.fechaCX || 
        (!formData.codigo && !formData.descripcion) || !formData.cantidad || formData.cantidad <= 0) {
        showToast('❌ Completa todos los campos obligatorios', 'error');
        return;
    }

    await createRegistro(db, auth, formData);
}

async function handleSaveEdit() {
    if (!window.currentEditId) return;
    
    const formData = {
        admision: document.getElementById('editAdmision').value?.trim().toUpperCase(),
        paciente: document.getElementById('editPaciente').value?.trim().toUpperCase(),
        medico: document.getElementById('editMedico').value?.trim(),
        fechaCX: document.getElementById('editFechaCX').value ? new Date(document.getElementById('editFechaCX').value) : null,
        codigo: document.getElementById('editCodigo').value?.trim().toUpperCase(),
        descripcion: document.getElementById('editDescripcion').value?.trim().toUpperCase(),
        cantidad: parseInt(document.getElementById('editCantidad').value) || 0
    };

    if (!formData.admision || !formData.paciente || !formData.medico || !formData.fechaCX || 
        (!formData.codigo && !formData.descripcion) || !formData.cantidad || formData.cantidad <= 0) {
        showToast('❌ Completa todos los campos obligatorios', 'error');
        return;
    }

    await updateRegistro(db, auth, window.currentEditId, formData);
}

async function handleDelete() {
    if (!window.currentDeleteId) return;
    await deleteRegistro(db, auth, window.currentDeleteId);
}

async function handleDownloadAll() {
    window.showLoading();
    try {
        let allQuery = query(collection(db, "registrar_consignacion"), orderBy("fechaCX", "desc"));
        
        const snapshot = await getDocs(allQuery);
        const allRegistros = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, fechaCX: parseFechaCX(data.fechaCX) };
        });

        exportToExcel(allRegistros, `consignaciones_completas_${new Date().toISOString().split('T')[0]}`);
        showToast('📊 Todos los registros exportados exitosamente', 'success');
    } catch (error) {
        console.error('Error exporting all:', error);
        showToast('❌ Error al exportar todos los registros', 'error');
    } finally {
        window.hideLoading();
    }
}

// MODALES GLOBALES
window.openEditModal = async function(id, registro) {
    window.currentEditId = id;
    window.currentEditOldData = { ...registro };

    document.getElementById('editAdmision').value = registro.admision || '';
    document.getElementById('editPaciente').value = registro.paciente || '';
    document.getElementById('editMedico').value = registro.medico || '';
    document.getElementById('editFechaCX').value = registro.fechaCX ? registro.fechaCX.toISOString().split('T')[0] : '';
    document.getElementById('editCodigo').value = registro.codigo || '';
    document.getElementById('editDescripcion').value = registro.descripcion || '';
    document.getElementById('editCantidad').value = registro.cantidad || '';
    document.getElementById('editReferencia').value = registro.referencia || '';
    document.getElementById('editProveedor').value = registro.proveedor || '';
    document.getElementById('editPrecioUnitario').value = registro.precioUnitario ? formatNumberWithThousandsSeparator(registro.precioUnitario) : '';
    document.getElementById('editAtributo').value = registro.atributo || '';
    document.getElementById('editTotalItems').value = formatNumberWithThousandsSeparator(registro.totalItems);

    if (window.medicos.length) 
        setupAutocomplete('editMedico', 'editMedicoToggle', 'editMedicoDropdown', window.medicos, 'nombre');
    
    if (window.referencias.length) {
        setupAutocomplete('editCodigo', 'editCodigoToggle', 'editCodigoDropdown', window.referencias, 'codigo');
        setupAutocomplete('editDescripcion', 'editDescripcionToggle', 'editDescripcionDropdown', window.referencias, 'descripcion');
    }

    document.getElementById('editModal').style.display = 'block';
};

window.openDeleteModal = function(id, admision) {
    window.currentDeleteId = id;
    window.currentDeleteAdmision = admision;
    
    document.querySelector('.delete-modal-text').textContent = 
        `¿Estás seguro de eliminar el registro de admisión "${admision}"?`;
    
    document.getElementById('deleteModal').style.display = 'block';
};

window.openHistoryModal = async function(id, admision) {
    await loadHistory(db, id, admision);
};

// SEARCH, DATE, PAGINATION (IMPLEMENTAR AQUÍ O EN handlers.js)
function setupSearchListeners() {
    const debouncedLoad = debounce(loadAllRegistros, 500);
    
    ['buscarAdmision', 'buscarPaciente', 'buscarMedico', 'buscarDescripcion', 'buscarProveedor'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', (e) => {
            window.searchParams[id.replace('buscar', 'search')] = e.target.value.trim().toUpperCase();
            window.currentPage = 1;
            window.lastVisible = null;
            debouncedLoad();
        });
    });
}

function setupDateFilters() {
    // IMPLEMENTAR LÓGICA DE FECHAS AQUÍ
}

function setupPaginationListeners() {
    document.getElementById('prevPage').addEventListener('click', () => {
        if (window.currentPage > 1) {
            window.currentPage--;
            loadAllRegistros();
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(window.totalRecords / 50);
        if (window.currentPage < totalPages) {
            window.currentPage++;
            loadAllRegistros();
        }
    });
}

// MODALES CLOSE
document.querySelectorAll('.modal .close, .modal-btn-secondary').forEach(btn => 
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal(btn.closest('.modal'));
    })
);

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeModal(e.target);
});