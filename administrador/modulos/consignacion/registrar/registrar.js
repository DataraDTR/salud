import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, orderBy, query, where, Timestamp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyD6JY7FaRqjZoN6OzbFHoIXxd-IJL3H-Ek",
    authDomain: "datara-salud.firebaseapp.com",
    projectId: "datara-salud",
    storageBucket: "datara-salud.firebasestorage.app",
    messagingSenderId: "198886910481",
    appId: "1:198886910481:web:abbc345203a423a6329fb0",
    measurementId: "G-MLYVTZPPLD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentPage = 1;
const recordsPerPage = 10;
let allRecords = [];
let filteredRecords = [];
let medicos = [];

const registrarBtn = document.getElementById('registrarBtn');
const limpiarBtn = document.getElementById('limpiarBtn');
const medicoInput = document.getElementById('medico');
const medicoToggle = document.getElementById('medicoToggle');
const medicoDropdown = document.getElementById('medicoDropdown');
const editMedicoInput = document.getElementById('editMedico');
const editMedicoToggle = document.getElementById('editMedicoToggle');
const editMedicoDropdown = document.getElementById('editMedicoDropdown');
const tableBody = document.querySelector('#registrarTable tbody');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageNumbersDiv = document.getElementById('pageNumbers');
const paginationInfo = document.getElementById('paginationInfo');
const buscarAdmision = document.getElementById('buscarAdmision');
const buscarPaciente = document.getElementById('buscarPaciente');
const buscarMedico = document.getElementById('buscarMedico');
const buscarDescripcion = document.getElementById('buscarDescripcion');
const buscarProveedor = document.getElementById('buscarProveedor');
const dateDay = document.getElementById('dateDay');
const fechaDia = document.getElementById('fechaDia');
const dateWeek = document.getElementById('dateWeek');
const fechaDesde = document.getElementById('fechaDesde');
const fechaHasta = document.getElementById('fechaHasta');
const dateMonth = document.getElementById('dateMonth');
const mesSelect = document.getElementById('mesSelect');
const anioSelect = document.getElementById('anioSelect');
const actionsBtn = document.getElementById('actionsBtn');
const actionsMenu = document.getElementById('actionsMenu');
const downloadAll = document.getElementById('downloadAll');
const downloadCurrent = document.getElementById('downloadCurrent');
const registrarMessage = document.getElementById('registrar-message');
const loading = document.getElementById('loading');
const editModal = document.getElementById('editModal');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const deleteModal = document.getElementById('deleteModal');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const historyModal = document.getElementById('historyModal');
const historyContent = document.getElementById('historyContent');
let currentEditId = null;
let currentDeleteId = null;

function showLoading(show) {
    loading.classList.toggle('show', show);
}

function showMessage(message, type) {
    registrarMessage.style.display = 'block';
    registrarMessage.textContent = message;
    registrarMessage.className = `registrar-message-${type}`;
    setTimeout(() => {
        registrarMessage.style.display = 'none';
    }, 3000);
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `registrar-toast ${type}`;
    toast.textContent = message;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }, 100);
}

async function loadMedicos() {
    try {
        showLoading(true);
        const snapshot = await getDocs(collection(db, 'medicos'));
        if (snapshot.empty) {
            console.warn('No se encontraron médicos en la colección "medicos".');
            showMessage('No se encontraron médicos', 'error');
            return;
        }
        medicos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        showMedicoDropdown(medicoInput, medicoDropdown);
        showMedicoDropdown(editMedicoInput, editMedicoDropdown);
    } catch (error) {
        console.error('Error al cargar médicos:', error.code, error.message);
        showMessage(`Error al cargar médicos: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function showMedicoDropdown(input, dropdown) {
    dropdown.innerHTML = '';
    const filter = input.value.toLowerCase();
    const filteredMedicos = medicos.filter(medico => medico.nombre.toLowerCase().includes(filter));
    filteredMedicos.forEach(medico => {
        const div = document.createElement('div');
        div.textContent = medico.nombre;
        div.addEventListener('click', () => {
            input.value = medico.nombre;
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(div);
    });
    dropdown.style.display = filteredMedicos.length > 0 ? 'block' : 'none';
}

function toggleMedicoDropdown(input, dropdown, toggle) {
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    if (dropdown.style.display === 'block') {
        showMedicoDropdown(input, dropdown);
    }
}

async function fetchProductoData(codigo) {
    try {
        const q = query(collection(db, 'productos'), where('codigo', '==', codigo.toUpperCase()));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const producto = snapshot.docs[0].data();
            document.getElementById('referencia').value = producto.referencia || '';
            document.getElementById('proveedor').value = producto.proveedor || '';
            document.getElementById('precioUnitario').value = producto.precioUnitario || '';
            document.getElementById('atributo').value = producto.atributo || '';
            updateTotalItems();
        } else {
            document.getElementById('referencia').value = '';
            document.getElementById('proveedor').value = '';
            document.getElementById('precioUnitario').value = '';
            document.getElementById('atributo').value = '';
            document.getElementById('totalItems').value = '';
        }
    } catch (error) {
        console.error('Error al buscar producto:', error);
        showMessage('Error al buscar producto', 'error');
    }
}

function updateTotalItems() {
    const cantidad = parseInt(document.getElementById('cantidad').value) || 0;
    const precioUnitario = parseFloat(document.getElementById('precioUnitario').value) || 0;
    document.getElementById('totalItems').value = (cantidad * precioUnitario).toFixed(2);
}

async function registerRecord() {
    const admision = document.getElementById('admision').value.trim();
    const paciente = document.getElementById('paciente').value.trim();
    const medico = document.getElementById('medico').value.trim();
    const fechaCX = document.getElementById('fechaCX').value;
    const codigo = document.getElementById('codigo').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const cantidad = parseInt(document.getElementById('cantidad').value) || 0;
    const referencia = document.getElementById('referencia').value;
    const proveedor = document.getElementById('proveedor').value;
    const precioUnitario = parseFloat(document.getElementById('precioUnitario').value) || 0;
    const atributo = document.getElementById('atributo').value;
    const totalItems = parseFloat(document.getElementById('totalItems').value) || 0;

    if (!admision || !paciente || !medico || !fechaCX || !codigo || !descripcion || !cantidad) {
        showMessage('Por favor, complete todos los campos obligatorios', 'error');
        return;
    }

    if (!medicos.some(m => m.nombre.toLowerCase() === medico.toLowerCase())) {
        showMessage('El médico seleccionado no es válido', 'error');
        return;
    }

    try {
        showLoading(true);
        const user = auth.currentUser;
        if (!user) {
            showMessage('Usuario no autenticado', 'error');
            return;
        }
        const registro = {
            admision,
            paciente,
            medico,
            fechaCX,
            codigo,
            descripcion,
            cantidad,
            referencia,
            proveedor,
            precioUnitario,
            atributo,
            totalItems,
            createdAt: Timestamp.fromDate(new Date()),
            createdBy: user.email || 'Anónimo',
            updatedAt: Timestamp.fromDate(new Date()),
            updatedBy: user.email || 'Anónimo'
        };

        await addDoc(collection(db, 'registrar_consignacion'), registro);
        showToast('Registro guardado exitosamente', 'success');

        document.getElementById('codigo').value = '';
        document.getElementById('descripcion').value = '';
        document.getElementById('cantidad').value = '';
        document.getElementById('referencia').value = '';
        document.getElementById('proveedor').value = '';
        document.getElementById('precioUnitario').value = '';
        document.getElementById('atributo').value = '';
        document.getElementById('totalItems').value = '';

        await loadRecords();
    } catch (error) {
        console.error('Error al registrar:', error);
        showMessage('Error al registrar: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function clearAllFields() {
    document.getElementById('admision').value = '';
    document.getElementById('paciente').value = '';
    document.getElementById('medico').value = '';
    document.getElementById('fechaCX').value = '';
    document.getElementById('codigo').value = '';
    document.getElementById('descripcion').value = '';
    document.getElementById('cantidad').value = '';
    document.getElementById('referencia').value = '';
    document.getElementById('proveedor').value = '';
    document.getElementById('precioUnitario').value = '';
    document.getElementById('atributo').value = '';
    document.getElementById('totalItems').value = '';
    medicoDropdown.style.display = 'none';
}

async function loadRecords() {
    try {
        showLoading(true);
        const q = query(collection(db, 'registrar_consignacion'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        allRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        filteredRecords = [...allRecords];
        if (allRecords.length === 0) {
            console.warn('No se encontraron registros en la colección "registrar_consignacion".');
            showMessage('No se encontraron registros', 'info');
        }
        applyFilters();
    } catch (error) {
        console.error('Error al cargar registros:', error.code, error.message);
        showMessage(`Error al cargar registros: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function applyFilters() {
    const admisionFilter = buscarAdmision.value.toLowerCase();
    const pacienteFilter = buscarPaciente.value.toLowerCase();
    const medicoFilter = buscarMedico.value.toLowerCase();
    const descripcionFilter = buscarDescripcion.value.toLowerCase();
    const proveedorFilter = buscarProveedor.value.toLowerCase();
    const dateFilter = document.querySelector('input[name="dateFilter"]:checked')?.value;
    let filtered = [...allRecords];

    filtered = filtered.filter(record => 
        record.admision.toLowerCase().includes(admisionFilter) &&
        record.paciente.toLowerCase().includes(pacienteFilter) &&
        record.medico.toLowerCase().includes(medicoFilter) &&
        record.descripcion.toLowerCase().includes(descripcionFilter) &&
        record.proveedor.toLowerCase().includes(proveedorFilter)
    );

    if (dateFilter === 'day' && fechaDia.value) {
        const selectedDate = new Date(fechaDia.value);
        filtered = filtered.filter(record => {
            const recordDate = record.fechaCX ? new Date(record.fechaCX) : null;
            return recordDate && recordDate.toDateString() === selectedDate.toDateString();
        });
    } else if (dateFilter === 'week' && fechaDesde.value && fechaHasta.value) {
        const startDate = new Date(fechaDesde.value);
        const endDate = new Date(fechaHasta.value);
        filtered = filtered.filter(record => {
            const recordDate = record.fechaCX ? new Date(record.fechaCX) : null;
            return recordDate && recordDate >= startDate && recordDate <= endDate;
        });
    } else if (dateFilter === 'month' && mesSelect.value && anioSelect.value) {
        const selectedMonth = mesSelect.value;
        const selectedYear = anioSelect.value;
        filtered = filtered.filter(record => {
            const recordDate = record.fechaCX ? new Date(record.fechaCX) : null;
            return recordDate && recordDate.getMonth() + 1 === parseInt(selectedMonth) && recordDate.getFullYear() === parseInt(selectedYear);
        });
    }

    filteredRecords = filtered;
    currentPage = 1;
    renderTable();
}

function renderTable() {
    tableBody.innerHTML = '';
    const start = (currentPage - 1) * recordsPerPage;
    const end = start + recordsPerPage;
    const paginatedRecords = filteredRecords.slice(start, end);

    paginatedRecords.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.admision}</td>
            <td>${record.paciente}</td>
            <td>${record.medico}</td>
            <td>${record.fechaCX}</td>
            <td>${record.codigo}</td>
            <td>${record.descripcion}</td>
            <td>${record.cantidad}</td>
            <td>${record.referencia}</td>
            <td>${record.proveedor}</td>
            <td>${record.precioUnitario}</td>
            <td>${record.atributo}</td>
            <td>${record.totalItems}</td>
            <td class="registrar-actions">
                <button class="registrar-btn-edit" data-id="${record.id}"><i class="fas fa-edit"></i></button>
                <button class="registrar-btn-delete" data-id="${record.id}"><i class="fas fa-trash"></i></button>
                <button class="registrar-btn-history" data-id="${record.id}"><i class="fas fa-history"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    updatePagination(start, end);
}

function updatePagination(start, end) {
    const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
    pageNumbersDiv.innerHTML = '';
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
        const firstPage = document.createElement('button');
        firstPage.textContent = '1';
        firstPage.addEventListener('click', () => {
            currentPage = 1;
            renderTable();
        });
        pageNumbersDiv.appendChild(firstPage);
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.className = 'registrar-dots';
            dots.textContent = '...';
            pageNumbersDiv.appendChild(dots);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = i === currentPage ? 'active' : '';
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderTable();
        });
        pageNumbersDiv.appendChild(pageBtn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.className = 'registrar-dots';
            dots.textContent = '...';
            pageNumbersDiv.appendChild(dots);
        }
        const lastPage = document.createElement('button');
        lastPage.textContent = totalPages;
        lastPage.addEventListener('click', () => {
            currentPage = totalPages;
            renderTable();
        });
        pageNumbersDiv.appendChild(lastPage);
    }

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    paginationInfo.textContent = `Mostrando ${Math.min(start + 1, filteredRecords.length)}-${Math.min(end, filteredRecords.length)} de ${filteredRecords.length} registros`;
}

async function openEditModal(id) {
    try {
        showLoading(true);
        const docRef = doc(db, 'registrar_consignacion', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const record = docSnap.data();
            document.getElementById('editAdmision').value = record.admision;
            document.getElementById('editPaciente').value = record.paciente;
            document.getElementById('editMedico').value = record.medico;
            document.getElementById('editFechaCX').value = record.fechaCX;
            document.getElementById('editCodigo').value = record.codigo;
            document.getElementById('editDescripcion').value = record.descripcion;
            document.getElementById('editCantidad').value = record.cantidad;
            document.getElementById('editReferencia').value = record.referencia;
            document.getElementById('editProveedor').value = record.proveedor;
            document.getElementById('editPrecioUnitario').value = record.precioUnitario;
            document.getElementById('editAtributo').value = record.atributo;
            document.getElementById('editTotalItems').value = record.totalItems;
            currentEditId = id;
            editModal.style.display = 'block';
        }
    } catch (error) {
        console.error('Error al cargar registro para editar:', error);
        showMessage('Error al cargar registro: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function saveEdit() {
    const admision = document.getElementById('editAdmision').value.trim();
    const paciente = document.getElementById('editPaciente').value.trim();
    const medico = document.getElementById('editMedico').value.trim();
    const fechaCX = document.getElementById('editFechaCX').value;
    const codigo = document.getElementById('editCodigo').value.trim();
    const descripcion = document.getElementById('editDescripcion').value.trim();
    const cantidad = parseInt(document.getElementById('editCantidad').value) || 0;
    const referencia = document.getElementById('editReferencia').value;
    const proveedor = document.getElementById('editProveedor').value;
    const precioUnitario = parseFloat(document.getElementById('editPrecioUnitario').value) || 0;
    const atributo = document.getElementById('editAtributo').value;
    const totalItems = parseFloat(document.getElementById('editTotalItems').value) || 0;

    if (!admision || !paciente || !medico || !fechaCX || !codigo || !descripcion || !cantidad) {
        showMessage('Por favor, complete todos los campos obligatorios', 'error');
        return;
    }

    if (!medicos.some(m => m.nombre.toLowerCase() === medico.toLowerCase())) {
        showMessage('El médico seleccionado no es válido', 'error');
        return;
    }

    try {
        showLoading(true);
        const user = auth.currentUser;
        if (!user) {
            showMessage('Usuario no autenticado', 'error');
            return;
        }
        const updatedData = {
            admision,
            paciente,
            medico,
            fechaCX,
            codigo,
            descripcion,
            cantidad,
            referencia,
            proveedor,
            precioUnitario,
            atributo,
            totalItems,
            updatedAt: Timestamp.fromDate(new Date()),
            updatedBy: user.email || 'Anónimo'
        };

        const docRef = doc(db, 'registrar_consignacion', currentEditId);
        await updateDoc(docRef, updatedData);
        await addDoc(collection(db, `registrar_consignacion/${currentEditId}/history`), {
            ...updatedData,
            timestamp: Timestamp.fromDate(new Date()),
            user: user.email || 'Anónimo',
            action: 'update'
        });
        showToast('Registro actualizado exitosamente', 'success');
        editModal.style.display = 'none';
        await loadRecords();
    } catch (error) {
        console.error('Error al actualizar registro:', error);
        showMessage('Error al actualizar registro: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function openDeleteModal(id) {
    currentDeleteId = id;
    deleteModal.style.display = 'block';
}

async function confirmDelete() {
    try {
        showLoading(true);
        const user = auth.currentUser;
        if (!user) {
            showMessage('Usuario no autenticado', 'error');
            return;
        }
        const docRef = doc(db, 'registrar_consignacion', currentDeleteId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            await addDoc(collection(db, `registrar_consignacion/${currentDeleteId}/history`), {
                ...docSnap.data(),
                timestamp: Timestamp.fromDate(new Date()),
                user: user.email || 'Anónimo',
                action: 'delete'
            });
            await deleteDoc(docRef);
            showToast('Registro eliminado exitosamente', 'success');
            deleteModal.style.display = 'none';
            await loadRecords();
        }
    } catch (error) {
        console.error('Error al eliminar registro:', error);
        showMessage('Error al eliminar registro: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function openHistoryModal(id) {
    try {
        showLoading(true);
        const q = query(collection(db, `registrar_consignacion/${id}/history`), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        historyContent.innerHTML = '';
        snapshot.forEach(doc => {
            const history = doc.data();
            const entry = document.createElement('div');
            entry.className = 'history-entry';
            entry.innerHTML = `
                <p><strong>Acción:</strong> ${history.action === 'update' ? 'Actualización' : 'Eliminación'}</p>
                <p><strong>Usuario:</strong> ${history.user}</p>
                <p><strong>Fecha:</strong> ${history.timestamp.toDate().toLocaleString()}</p>
                <p><strong>Admisión:</strong> ${history.admision}</p>
                <p><strong>Paciente:</strong> ${history.paciente}</p>
                <p><strong>Médico:</strong> ${history.medico}</p>
                <p><strong>Fecha CX:</strong> ${history.fechaCX}</p>
                <p><strong>Código:</strong> ${history.codigo}</p>
                <p><strong>Descripción:</strong> ${history.descripcion}</p>
                <p><strong>Cantidad:</strong> ${history.cantidad}</p>
                <p><strong>Referencia:</strong> ${history.referencia}</p>
                <p><strong>Proveedor:</strong> ${history.proveedor}</p>
                <p><strong>Precio Unitario:</strong> ${history.precioUnitario}</p>
                <p><strong>Atributo:</strong> ${history.atributo}</p>
                <p><strong>Total Items:</strong> ${history.totalItems}</p>
            `;
            historyContent.appendChild(entry);
        });
        historyModal.style.display = 'block';
    } catch (error) {
        console.error('Error al cargar historial:', error);
        showMessage('Error al cargar historial: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function exportToExcel(records, filename) {
    const data = records.map(record => ({
        Admisión: record.admision,
        Paciente: record.paciente,
        Médico: record.medico,
        'Fecha CX': record.fechaCX,
        Código: record.codigo,
        Descripción: record.descripcion,
        Cantidad: record.cantidad,
        Referencia: record.referencia,
        Proveedor: record.proveedor,
        'Precio Unitario': record.precioUnitario,
        Atributo: record.atributo,
        'Total Items': record.totalItems,
        'Creado': record.createdAt ? record.createdAt.toDate().toLocaleString() : '',
        'Creado por': record.createdBy,
        'Actualizado': record.updatedAt ? record.updatedAt.toDate().toLocaleString() : '',
        'Actualizado por': record.updatedBy
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');
    XLSX.write_file(workbook, filename);
}

function populateYearSelect() {
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= currentYear - 10; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        anioSelect.appendChild(option);
    }
}

document.getElementById('codigo').addEventListener('change', () => {
    const codigo = document.getElementById('codigo').value.trim();
    if (codigo) {
        fetchProductoData(codigo);
    }
});

document.getElementById('cantidad').addEventListener('input', updateTotalItems);

registrarBtn.addEventListener('click', registerRecord);

limpiarBtn.addEventListener('click', clearAllFields);

medicoInput.addEventListener('input', () => showMedicoDropdown(medicoInput, medicoDropdown));
medicoToggle.addEventListener('click', () => toggleMedicoDropdown(medicoInput, medicoDropdown, medicoToggle));
editMedicoInput.addEventListener('input', () => showMedicoDropdown(editMedicoInput, editMedicoDropdown));
editMedicoToggle.addEventListener('click', () => toggleMedicoDropdown(editMedicoInput, editMedicoDropdown, editMedicoToggle));

document.addEventListener('click', (e) => {
    if (!medicoInput.contains(e.target) && !medicoDropdown.contains(e.target) && !medicoToggle.contains(e.target)) {
        medicoDropdown.style.display = 'none';
    }
    if (!editMedicoInput.contains(e.target) && !editMedicoDropdown.contains(e.target) && !editMedicoToggle.contains(e.target)) {
        editMedicoDropdown.style.display = 'none';
    }
    if (!actionsBtn.contains(e.target) && !actionsMenu.contains(e.target)) {
        actionsMenu.style.display = 'none';
    }
});

tableBody.addEventListener('click', (e) => {
    if (e.target.closest('.registrar-btn-edit')) {
        const id = e.target.closest('.registrar-btn-edit').dataset.id;
        openEditModal(id);
    } else if (e.target.closest('.registrar-btn-delete')) {
        const id = e.target.closest('.registrar-btn-delete').dataset.id;
        openDeleteModal(id);
    } else if (e.target.closest('.registrar-btn-history')) {
        const id = e.target.closest('.registrar-btn-history').dataset.id;
        openHistoryModal(id);
    }
});

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
});

nextPageBtn.addEventListener('click', () => {
    if (currentPage < Math.ceil(filteredRecords.length / recordsPerPage)) {
        currentPage++;
        renderTable();
    }
});

buscarAdmision.addEventListener('input', applyFilters);
buscarPaciente.addEventListener('input', applyFilters);
buscarMedico.addEventListener('input', applyFilters);
buscarDescripcion.addEventListener('input', applyFilters);
buscarProveedor.addEventListener('input', applyFilters);
dateDay.addEventListener('change', applyFilters);
fechaDia.addEventListener('change', () => {
    if (dateDay.checked) applyFilters();
});
dateWeek.addEventListener('change', applyFilters);
fechaDesde.addEventListener('change', () => {
    if (dateWeek.checked) applyFilters();
});
fechaHasta.addEventListener('change', () => {
    if (dateWeek.checked) applyFilters();
});
dateMonth.addEventListener('change', applyFilters);
mesSelect.addEventListener('change', () => {
    if (dateMonth.checked) applyFilters();
});
anioSelect.addEventListener('change', () => {
    if (dateMonth.checked) applyFilters();
});

actionsBtn.addEventListener('click', () => {
    actionsMenu.style.display = actionsMenu.style.display === 'block' ? 'none' : 'block';
});

downloadAll.addEventListener('click', (e) => {
    e.preventDefault();
    exportToExcel(allRecords, 'todos_los_registros.xlsx');
});

downloadCurrent.addEventListener('click', (e) => {
    e.preventDefault();
    const start = (currentPage - 1) * recordsPerPage;
    const end = start + recordsPerPage;
    const currentRecords = filteredRecords.slice(start, end);
    exportToExcel(currentRecords, 'registros_pagina_actual.xlsx');
});

saveEditBtn.addEventListener('click', saveEdit);
cancelEditBtn.addEventListener('click', () => {
    editModal.style.display = 'none';
});

confirmDeleteBtn.addEventListener('click', confirmDelete);
cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.style.display = 'none';
});

document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        closeBtn.closest('.modal').style.display = 'none';
    });
});

window.addEventListener('click', (e) => {
    if (e.target === editModal) {
        editModal.style.display = 'none';
    }
    if (e.target === deleteModal) {
        deleteModal.style.display = 'none';
    }
    if (e.target === historyModal) {
        historyModal.style.display = 'none';
    }
});

onAuthStateChanged(auth, user => {
    console.log('Estado de autenticación:', user ? `Usuario autenticado: ${user.email}` : 'No autenticado');
    if (user) {
        loadMedicos();
        loadRecords();
        populateYearSelect();
    } else {
        window.location.href = 'index.html';
    }
});

let resizing = false;
let currentTh = null;

document.querySelectorAll('.resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
        resizing = true;
        currentTh = e.target.parentElement;
        document.body.style.cursor = 'col-resize';
    });
});

document.addEventListener('mousemove', (e) => {
    if (resizing && currentTh) {
        const newWidth = e.clientX - currentTh.getBoundingClientRect().left;
        if (newWidth > 50) {
            currentTh.style.width = `${newWidth}px`;
            const index = Array.from(currentTh.parentElement.children).indexOf(currentTh);
            document.querySelectorAll(`.registrar-table td:nth-child(${index + 1})`).forEach(td => {
                td.style.width = `${newWidth}px`;
            });
        }
    }
});

document.addEventListener('mouseup', () => {
    resizing = false;
    currentTh = null;
    document.body.style.cursor = 'default';
});