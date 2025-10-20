const { initializeApp, getAuth, onAuthStateChanged, setPersistence, browserSessionPersistence, getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, orderBy, getDoc, limit, startAfter, endBefore } = window.firebaseModules;

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
const auth = getAuth(app);
const db = getFirestore(app);

setPersistence(auth, browserSessionPersistence);

let registros = [];
let currentPage = 1;
const PAGE_SIZE = 50;
let lastVisible = null;
let firstVisible = null;
let searchAdmision = '';
let searchPaciente = '';
let searchDescripcion = '';
let searchProveedor = '';
let searchMedico = '';
let searchFechaTipo = 'day';
let searchFechaDia = '';
let searchFechaDesde = '';
let searchFechaHasta = '';
let searchMes = '';
let searchAnio = '';
let totalRecords = 0;

function formatNumberWithThousandsSeparator(number) {
    if (!number) return '';
    const cleaned = String(number).replace(/[^\d]/g, '');
    return cleaned ? Number(cleaned).toLocaleString('es-CL') : '';
}

async function getRegistroByUniqueKey(admision, excludeId = null) {
    if (!admision) return null;
    const q = query(collection(db, "registrar_consignacion"), where("admision", "==", admision.trim().toUpperCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        if (excludeId && doc.id === excludeId) return null;
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

async function logAction(registroId, action, oldData = null, newData = null) {
    if (!window.currentUserData) return;
    await addDoc(collection(db, "registrar_consignacion_historial"), {
        registroId,
        action,
        timestamp: new Date(),
        userId: auth.currentUser ? auth.currentUser.uid : null,
        userFullName: window.currentUserData.fullName || 'Usuario Invitado',
        username: window.currentUserData.username || 'invitado',
        oldData,
        newData
    });
}

function setupColumnResize() {
    const table = document.querySelector('.registrar-table');
    const headers = document.querySelectorAll('.registrar-table th');

    const initialWidths = [
        100, // Acciones
        130, // Admisión
        200, // Paciente
        200, // Médico
        120, // Fecha CX
        100, // Código
        300, // Descripción
        80,  // Cantidad
        130, // Referencia
        150, // Proveedor
        100, // Precio Unitario
        120, // Atributo
        100  // Total Items
    ];

    headers.forEach((header, index) => {
        header.style.width = `${initialWidths[index]}px`;
        header.style.minWidth = `${initialWidths[index]}px`;
        header.style.maxWidth = `${initialWidths[index]}px`;
        const cells = document.querySelectorAll(`.registrar-table td:nth-child(${index + 1})`);
        cells.forEach(cell => {
            cell.style.width = `${initialWidths[index]}px`;
            cell.style.minWidth = `${initialWidths[index]}px`;
            cell.style.maxWidth = `${initialWidths[index]}px`;
        });
    });

    headers.forEach((header, index) => {
        const existingHandle = header.querySelector('.resize-handle');
        if (existingHandle) existingHandle.remove();

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        header.appendChild(resizeHandle);
        header.style.position = 'relative';

        let isResizing = false;
        let startX, startWidth;

        const startResize = (e) => {
            isResizing = true;
            startX = e.pageX || (e.touches && e.touches[0].pageX);
            startWidth = header.getBoundingClientRect().width;
            resizeHandle.classList.add('active');
            e.preventDefault();
        };

        const resize = (e) => {
            if (!isResizing) return;
            const clientX = e.pageX || (e.touches && e.touches[0].pageX);
            if (!clientX) return;
            const newWidth = Math.max(20, Math.min(2000, startWidth + (clientX - startX)));

            header.style.width = `${newWidth}px`;
            header.style.minWidth = `${newWidth}px`;
            header.style.maxWidth = `${newWidth}px`;

            const cells = document.querySelectorAll(`.registrar-table td:nth-child(${index + 1})`);
            cells.forEach(cell => {
                cell.style.width = `${newWidth}px`;
                cell.style.minWidth = `${newWidth}px`;
                cell.style.maxWidth = `${newWidth}px`;
            });

            e.preventDefault();
        };

        const stopResize = () => {
            if (isResizing) {
                isResizing = false;
                resizeHandle.classList.remove('active');
            }
        };

        resizeHandle.addEventListener('mousedown', startResize);
        resizeHandle.addEventListener('touchstart', startResize, { passive: false });
        document.addEventListener('mousemove', resize);
        document.addEventListener('touchmove', resize, { passive: false });
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchend', stopResize);
    });
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showToast(text, type = 'success') {
    const toastContainer = document.getElementById('registrar-toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `registrar-toast ${type}`;
    toast.textContent = text;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('registrar-loading');
    const registrarBody = document.getElementById('registrarBody');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageNumbers = document.getElementById('pageNumbers');
    const paginationInfo = document.getElementById('paginationInfo');
    const admisionInput = document.getElementById('admision');
    const pacienteInput = document.getElementById('paciente');
    const medicoInput = document.getElementById('medico');
    const fechaCXInput = document.getElementById('fechaCX');
    const codigoInput = document.getElementById('codigo');
    const descripcionInput = document.getElementById('descripcion');
    const cantidadInput = document.getElementById('cantidad');
    const referenciaInput = document.getElementById('referencia');
    const proveedorInput = document.getElementById('proveedor');
    const precioUnitarioInput = document.getElementById('precioUnitario');
    const atributoInput = document.getElementById('atributo');
    const totalItemsInput = document.getElementById('totalItems');
    const registrarBtn = document.getElementById('registrarBtn');
    const buscarAdmisionInput = document.getElementById('buscarAdmision');
    const buscarPacienteInput = document.getElementById('buscarPaciente');
    const buscarDescripcionInput = document.getElementById('buscarDescripcion');
    const buscarProveedorInput = document.getElementById('buscarProveedor');
    const buscarMedicoInput = document.getElementById('buscarMedico');
    const dateDay = document.getElementById('dateDay');
    const dateWeek = document.getElementById('dateWeek');
    const dateMonth = document.getElementById('dateMonth');
    const fechaDiaInput = document.getElementById('fechaDia');
    const fechaDesdeInput = document.getElementById('fechaDesde');
    const fechaHastaInput = document.getElementById('fechaHasta');
    const mesSelect = document.getElementById('mesSelect');
    const anioSelect = document.getElementById('anioSelect');
    const actionsBtn = document.getElementById('actionsBtn');
    const actionsMenu = document.getElementById('actionsMenu');
    const downloadAll = document.getElementById('downloadAll');
    const downloadPage = document.getElementById('downloadPage');
    const editModal = document.getElementById('editModal');
    const deleteModal = document.getElementById('deleteModal');
    const historyModal = document.getElementById('historyModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const cancelEdit = document.getElementById('cancelEdit');
    const editForm = document.getElementById('editForm');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    const deleteText = document.getElementById('deleteText');
    const closeHistory = document.getElementById('closeHistory');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const historyTitle = document.getElementById('historyTitle');
    const historyContent = document.getElementById('historyContent');

    let currentEditId = null;
    let currentEditOldData = null;
    let currentDeleteId = null;
    let currentDeleteAdmision = null;

    function formatMontoInput(input) {
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/[^\d]/g, '');
            e.target.value = formatNumberWithThousandsSeparator(value);
        });
    }

    formatMontoInput(precioUnitarioInput);
    formatMontoInput(document.getElementById('editPrecioUnitario'));

    function enforceUpperCase(input) {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    [admisionInput, pacienteInput, medicoInput, codigoInput, descripcionInput,
        buscarAdmisionInput, buscarPacienteInput, buscarDescripcionInput, buscarProveedorInput, buscarMedicoInput,
        document.getElementById('editAdmision'), document.getElementById('editPaciente'), document.getElementById('editMedico'),
        document.getElementById('editCodigo'), document.getElementById('editDescripcion')]
        .forEach(input => input && enforceUpperCase(input));

    document.querySelectorAll('input[name="dateType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            searchFechaTipo = e.target.value;
            dateDay.style.display = searchFechaTipo === 'day' ? 'flex' : 'none';
            dateWeek.style.display = searchFechaTipo === 'week' ? 'flex' : 'none';
            dateMonth.style.display = searchFechaTipo === 'month' ? 'flex' : 'none';
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            loadRegistros();
        });
    });

    window.showLoading = function () {
        if (loading) loading.classList.add('show');
    };

    window.hideLoading = function () {
        if (loading) loading.classList.remove('show');
    };

    window.openEditModal = function (id, registro) {
        currentEditId = id;
        currentEditOldData = { ...registro };
        document.getElementById('editId').value = id;
        document.getElementById('editAdmision').value = registro.admision || '';
        document.getElementById('editPaciente').value = registro.paciente || '';
        document.getElementById('editMedico').value = registro.medico || '';
        document.getElementById('editFechaCX').value = registro.fechaCX || '';
        document.getElementById('editCodigo').value = registro.codigo || '';
        document.getElementById('editDescripcion').value = registro.descripcion || '';
        document.getElementById('editCantidad').value = registro.cantidad || '';
        document.getElementById('editReferencia').value = registro.referencia || '';
        document.getElementById('editProveedor').value = registro.proveedor || '';
        document.getElementById('editPrecioUnitario').value = registro.precioUnitario ? formatNumberWithThousandsSeparator(registro.precioUnitario) : '';
        document.getElementById('editAtributo').value = registro.atributo || '';
        document.getElementById('editTotalItems').value = registro.totalItems || '';
        editModal.style.display = 'block';
    };

    function closeEditModalHandler() {
        editModal.style.display = 'none';
        currentEditId = null;
        currentEditOldData = null;
        editForm.reset();
    }

    window.openDeleteModal = function (id, admision) {
        currentDeleteId = id;
        currentDeleteAdmision = admision;
        deleteText.textContent = `¿Desea eliminar el registro con admisión "${admision}"?`;
        deleteModal.style.display = 'block';
    };

    function closeDeleteModalHandler() {
        deleteModal.style.display = 'none';
        currentDeleteId = null;
        currentDeleteAdmision = null;
    }

    window.openHistoryModal = function (id, admision) {
        historyTitle.textContent = `Historial Registro ${admision}`;
        showLoading();
        const q = query(collection(db, "registrar_consignacion_historial"), where("registroId", "==", id), orderBy("timestamp", "desc"));
        getDocs(q).then((querySnapshot) => {
            hideLoading();
            let html = '';
            querySnapshot.forEach((doc) => {
                const log = doc.data();
                const date = log.timestamp ? log.timestamp.toDate().toLocaleString('es-CL') : 'Fecha inválida';
                if (log.action === 'create') {
                    html += `<div class="history-entry">Creado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date}</div>`;
                } else if (log.action === 'update') {
                    html += `<div class="history-entry">Modificado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date} | Admisión: ${log.oldData ? log.oldData.admision : 'N/A'} → ${log.newData ? log.newData.admision : 'N/A'}</div>`;
                } else if (log.action === 'delete') {
                    html += `<div class="history-entry">Eliminado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date}</div>`;
                }
            });
            historyContent.innerHTML = html || '<div>No hay historial disponible.</div>';
            historyModal.style.display = 'block';
        }).catch((error) => {
            hideLoading();
            showToast('Error al cargar el historial: ' + error.message, 'error');
        });
    };

    function closeHistoryModalHandler() {
        historyModal.style.display = 'none';
        historyContent.innerHTML = '';
    }

    closeEditModal.addEventListener('click', closeEditModalHandler);
    cancelEdit.addEventListener('click', closeEditModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModalHandler();
    });

    closeDeleteModal.addEventListener('click', closeDeleteModalHandler);
    cancelDelete.addEventListener('click', closeDeleteModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModalHandler();
    });

    closeHistory.addEventListener('click', closeHistoryModalHandler);
    closeHistoryBtn.addEventListener('click', closeHistoryModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === historyModal) closeHistoryModalHandler();
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEditId) return;

        let processedRow = {
            admision: document.getElementById('editAdmision').value.trim().toUpperCase(),
            paciente: document.getElementById('editPaciente').value.trim().toUpperCase(),
            medico: document.getElementById('editMedico').value.trim().toUpperCase(),
            fechaCX: document.getElementById('editFechaCX').value,
            codigo: document.getElementById('editCodigo').value.trim().toUpperCase(),
            descripcion: document.getElementById('editDescripcion').value.trim().toUpperCase(),
            cantidad: parseInt(document.getElementById('editCantidad').value) || 0,
            referencia: document.getElementById('editReferencia').value.trim().toUpperCase(),
            proveedor: document.getElementById('editProveedor').value.trim().toUpperCase(),
            precioUnitario: document.getElementById('editPrecioUnitario').value.replace(/[^\d]/g, ''),
            atributo: document.getElementById('editAtributo').value.trim().toUpperCase(),
            totalItems: document.getElementById('editTotalItems').value.trim().toUpperCase(),
            fullName: window.currentUserData.fullName,
            createdAt: new Date()
        };

        if (processedRow.admision) {
            showLoading();
            try {
                const existingReg = await getRegistroByUniqueKey(processedRow.admision, currentEditId);
                if (existingReg) {
                    hideLoading();
                    showToast('La admisión ya existe.', 'error');
                    return;
                }
                await updateDoc(doc(db, "registrar_consignacion", currentEditId), processedRow);
                await logAction(currentEditId, 'update', currentEditOldData, processedRow);
                hideLoading();
                showToast(`Registro ${processedRow.admision} actualizado exitosamente`, 'success');
                closeEditModalHandler();
                await loadRegistros();
            } catch (error) {
                hideLoading();
                showToast('Error al actualizar el registro: ' + error.message, 'error');
            }
        } else {
            showToast('Falta la admisión', 'error');
        }
    });

    confirmDelete.addEventListener('click', async () => {
        if (!currentDeleteId || !currentDeleteAdmision) return;

        showLoading();
        try {
            const registroDoc = await getDoc(doc(db, "registrar_consignacion", currentDeleteId));
            if (registroDoc.exists()) {
                const registroData = registroDoc.data();
                await logAction(currentDeleteId, 'delete', registroData);
                await deleteDoc(doc(db, "registrar_consignacion", currentDeleteId));
                hideLoading();
                showToast(`Registro ${currentDeleteAdmision} eliminado exitosamente`, 'success');
                closeDeleteModalHandler();
                await loadRegistros();
            } else {
                hideLoading();
                showToast('El registro no existe.', 'error');
                closeDeleteModalHandler();
            }
        } catch (error) {
            hideLoading();
            showToast('Error al eliminar el registro: ' + error.message, 'error');
        }
    });

    const debouncedLoadRegistros = debounce(loadRegistros, 300);

    if (buscarAdmisionInput) {
        buscarAdmisionInput.addEventListener('input', (e) => {
            searchAdmision = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (buscarPacienteInput) {
        buscarPacienteInput.addEventListener('input', (e) => {
            searchPaciente = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (buscarDescripcionInput) {
        buscarDescripcionInput.addEventListener('input', (e) => {
            searchDescripcion = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (buscarProveedorInput) {
        buscarProveedorInput.addEventListener('input', (e) => {
            searchProveedor = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (buscarMedicoInput) {
        buscarMedicoInput.addEventListener('input', (e) => {
            searchMedico = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (fechaDiaInput) {
        fechaDiaInput.addEventListener('change', (e) => {
            searchFechaDia = e.target.value;
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (fechaDesdeInput) {
        fechaDesdeInput.addEventListener('change', (e) => {
            searchFechaDesde = e.target.value;
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (fechaHastaInput) {
        fechaHastaInput.addEventListener('change', (e) => {
            searchFechaHasta = e.target.value;
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (mesSelect) {
        mesSelect.addEventListener('change', (e) => {
            searchMes = e.target.value;
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    if (anioSelect) {
        anioSelect.addEventListener('change', (e) => {
            searchAnio = e.target.value;
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadRegistros();
        });
    }

    async function loadRegistros() {
        showLoading();
        try {
            let q = query(collection(db, "registrar_consignacion"), orderBy("createdAt", "desc"));
            const conditions = [];

            if (searchAdmision) {
                conditions.push(where("admision", ">=", searchAdmision));
                conditions.push(where("admision", "<=", searchAdmision + '\uf8ff'));
            }
            if (searchPaciente) {
                conditions.push(where("paciente", ">=", searchPaciente));
                conditions.push(where("paciente", "<=", searchPaciente + '\uf8ff'));
            }
            if (searchDescripcion) {
                conditions.push(where("descripcion", ">=", searchDescripcion));
                conditions.push(where("descripcion", "<=", searchDescripcion + '\uf8ff'));
            }
            if (searchProveedor) {
                conditions.push(where("proveedor", ">=", searchProveedor));
                conditions.push(where("proveedor", "<=", searchProveedor + '\uf8ff'));
            }
            if (searchMedico) {
                conditions.push(where("medico", ">=", searchMedico));
                conditions.push(where("medico", "<=", searchMedico + '\uf8ff'));
            }

            if (searchFechaTipo === 'day' && searchFechaDia) {
                conditions.push(where("fechaCX", "==", searchFechaDia));
            } else if (searchFechaTipo === 'week' && searchFechaDesde && searchFechaHasta) {
                conditions.push(where("fechaCX", ">=", searchFechaDesde));
                conditions.push(where("fechaCX", "<=", searchFechaHasta));
            } else if (searchFechaTipo === 'month' && searchMes && searchAnio) {
                const fechaInicioMes = `${searchAnio}-${searchMes}-01`;
                const fechaFinMes = new Date(searchAnio, parseInt(searchMes), 0).toISOString().split('T')[0];
                conditions.push(where("fechaCX", ">=", fechaInicioMes));
                conditions.push(where("fechaCX", "<=", fechaFinMes));
            }

            if (currentPage > 1 && lastVisible) {
                conditions.push(startAfter(lastVisible));
            }
            conditions.push(limit(PAGE_SIZE));

            q = query(q, ...conditions);

            const querySnapshot = await getDocs(q);
            registros = [];
            querySnapshot.forEach((doc) => {
                registros.push({ id: doc.id, ...doc.data() });
            });

            if (querySnapshot.docs.length > 0) {
                lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
                firstVisible = querySnapshot.docs[0];
            } else {
                lastVisible = null;
                firstVisible = null;
            }

            let countQuery = query(collection(db, "registrar_consignacion"));
            if (searchAdmision) {
                countQuery = query(countQuery, where("admision", ">=", searchAdmision), where("admision", "<=", searchAdmision + '\uf8ff'));
            }
            if (searchPaciente) {
                countQuery = query(countQuery, where("paciente", ">=", searchPaciente), where("paciente", "<=", searchPaciente + '\uf8ff'));
            }
            if (searchDescripcion) {
                countQuery = query(countQuery, where("descripcion", ">=", searchDescripcion), where("descripcion", "<=", searchDescripcion + '\uf8ff'));
            }
            if (searchProveedor) {
                countQuery = query(countQuery, where("proveedor", ">=", searchProveedor), where("proveedor", "<=", searchProveedor + '\uf8ff'));
            }
            if (searchMedico) {
                countQuery = query(countQuery, where("medico", ">=", searchMedico), where("medico", "<=", searchMedico + '\uf8ff'));
            }
            if (searchFechaTipo === 'day' && searchFechaDia) {
                countQuery = query(countQuery, where("fechaCX", "==", searchFechaDia));
            } else if (searchFechaTipo === 'week' && searchFechaDesde && searchFechaHasta) {
                countQuery = query(countQuery, where("fechaCX", ">=", searchFechaDesde), where("fechaCX", "<=", searchFechaHasta));
            } else if (searchFechaTipo === 'month' && searchMes && searchAnio) {
                const fechaInicioMes = `${searchAnio}-${searchMes}-01`;
                const fechaFinMes = new Date(searchAnio, parseInt(searchMes), 0).toISOString().split('T')[0];
                countQuery = query(countQuery, where("fechaCX", ">=", fechaInicioMes), where("fechaCX", "<=", fechaFinMes));
            }

            const countSnapshot = await getDocs(countQuery);
            totalRecords = countSnapshot.size;

            renderTable();
            hideLoading();
        } catch (error) {
            hideLoading();
            showToast('Error al cargar los registros: ' + error.message, 'error');
        }
    }

    function renderTable() {
        if (registrarBody) {
            registrarBody.innerHTML = '';
            if (registros.length === 0) {
                registrarBody.innerHTML = '<tr><td colspan="13">No hay registros para mostrar.</td></tr>';
            } else {
                registros.forEach(registro => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="registrar-actions">
                            <button title="Editar" class="registrar-btn-edit" onclick="openEditModal('${registro.id}', ${JSON.stringify(registro).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                            <button title="Eliminar" class="registrar-btn-delete" onclick="openDeleteModal('${registro.id}', '${registro.admision}')"><i class="fas fa-trash"></i></button>
                            <button title="Ver Historial" class="registrar-btn-history" onclick="openHistoryModal('${registro.id}', '${registro.admision}')"><i class="fas fa-history"></i></button>
                        </td>
                        <td>${registro.admision || ''}</td>
                        <td>${registro.paciente || ''}</td>
                        <td>${registro.medico || ''}</td>
                        <td>${registro.fechaCX || ''}</td>
                        <td>${registro.codigo || ''}</td>
                        <td>${registro.descripcion || ''}</td>
                        <td>${registro.cantidad || ''}</td>
                        <td>${registro.referencia || ''}</td>
                        <td>${registro.proveedor || ''}</td>
                        <td>${formatNumberWithThousandsSeparator(registro.precioUnitario)}</td>
                        <td>${registro.atributo || ''}</td>
                        <td>${registro.totalItems || ''}</td>
                    `;
                    registrarBody.appendChild(row);
                });
            }
        }

        updatePagination(totalRecords);
        setupColumnResize();
    }

    function updatePagination(total) {
        const totalPages = Math.ceil(total / PAGE_SIZE);
        const startRecord = (currentPage - 1) * PAGE_SIZE + 1;
        const endRecord = Math.min(currentPage * PAGE_SIZE, total);
        const recordsThisPage = endRecord - startRecord + 1;

        if (paginationInfo) {
            paginationInfo.textContent = `Página ${currentPage} de ${totalPages} | ${recordsThisPage} registros en esta página de ${total}`;
        }

        if (prevBtn) prevBtn.disabled = currentPage === 1;
        if (nextBtn) nextBtn.disabled = currentPage === totalPages;

        if (pageNumbers) {
            pageNumbers.innerHTML = '';
            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(totalPages, startPage + 4);

            if (startPage > 1) {
                const btn = document.createElement('button');
                btn.textContent = '1';
                btn.className = 1 === currentPage ? 'active' : '';
                btn.addEventListener('click', () => goToPage(1));
                pageNumbers.appendChild(btn);
                if (startPage > 2) {
                    const dots = document.createElement('span');
                    dots.textContent = '...';
                    dots.className = 'registrar-dots';
                    pageNumbers.appendChild(dots);
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = i === currentPage ? 'active' : '';
                btn.addEventListener('click', () => goToPage(i));
                pageNumbers.appendChild(btn);
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    const dots = document.createElement('span');
                    dots.textContent = '...';
                    dots.className = 'registrar-dots';
                    pageNumbers.appendChild(dots);
                }
                const btn = document.createElement('button');
                btn.textContent = totalPages;
                btn.className = totalPages === currentPage ? 'active' : '';
                btn.addEventListener('click', () => goToPage(totalPages));
                pageNumbers.appendChild(btn);
            }
        }
    }

    function goToPage(page) {
        currentPage = page;
        loadRegistros();
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadRegistros();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
            if (currentPage < totalPages) {
                currentPage++;
                loadRegistros();
            }
        });
    }

    if (actionsBtn) {
        actionsBtn.addEventListener('click', () => {
            actionsMenu.style.display = actionsMenu.style.display === 'block' ? 'none' : 'block';
        });
    }

    window.addEventListener('click', (e) => {
        if (actionsBtn && actionsMenu && !actionsBtn.contains(e.target) && !actionsMenu.contains(e.target)) {
            actionsMenu.style.display = 'none';
        }
    });

    if (downloadAll) {
        downloadAll.addEventListener('click', async (e) => {
            e.preventDefault();
            showLoading();
            try {
                const q = query(collection(db, "registrar_consignacion"));
                const querySnapshot = await getDocs(q);
                const allRegistros = [];
                querySnapshot.forEach((doc) => {
                    allRegistros.push({ id: doc.id, ...doc.data() });
                });
                const data = allRegistros.map(reg => ({
                    Admisión: reg.admision || '',
                    Paciente: reg.paciente || '',
                    Médico: reg.medico || '',
                    'Fecha CX': reg.fechaCX || '',
                    Código: reg.codigo || '',
                    Descripción: reg.descripcion || '',
                    Cantidad: reg.cantidad || '',
                    Referencia: reg.referencia || '',
                    Proveedor: reg.proveedor || '',
                    'Precio Unitario': reg.precioUnitario ? formatNumberWithThousandsSeparator(reg.precioUnitario) : '',
                    Atributo: reg.atributo || '',
                    'Total Items': reg.totalItems || ''
                }));
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Registros");
                XLSX.writeFile(wb, 'registrar_consignacion_todos.xlsx');
                actionsMenu.style.display = 'none';
                hideLoading();
            } catch (error) {
                hideLoading();
                showToast('Error al descargar los registros: ' + error.message, 'error');
            }
        });
    }

    if (downloadPage) {
        downloadPage.addEventListener('click', (e) => {
            e.preventDefault();
            const data = registros.map(reg => ({
                Admisión: reg.admision || '',
                Paciente: reg.paciente || '',
                Médico: reg.medico || '',
                'Fecha CX': reg.fechaCX || '',
                Código: reg.codigo || '',
                Descripción: reg.descripcion || '',
                Cantidad: reg.cantidad || '',
                Referencia: reg.referencia || '',
                Proveedor: reg.proveedor || '',
                'Precio Unitario': reg.precioUnitario ? formatNumberWithThousandsSeparator(reg.precioUnitario) : '',
                Atributo: reg.atributo || '',
                'Total Items': reg.totalItems || ''
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Registros");
            XLSX.writeFile(wb, `registrar_consignacion_pagina_${currentPage}.xlsx`);
            actionsMenu.style.display = 'none';
        });
    }

    if (registrarBtn) {
        registrarBtn.addEventListener('click', async () => {
            let processedRow = {
                admision: admisionInput.value.trim().toUpperCase(),
                paciente: pacienteInput.value.trim().toUpperCase(),
                medico: medicoInput.value.trim().toUpperCase(),
                fechaCX: fechaCXInput.value,
                codigo: codigoInput.value.trim().toUpperCase(),
                descripcion: descripcionInput.value.trim().toUpperCase(),
                cantidad: parseInt(cantidadInput.value) || 0,
                referencia: referenciaInput.value.trim().toUpperCase(),
                proveedor: proveedorInput.value.trim().toUpperCase(),
                precioUnitario: precioUnitarioInput.value.replace(/[^\d]/g, ''),
                atributo: atributoInput.value.trim().toUpperCase(),
                totalItems: totalItemsInput.value.trim().toUpperCase(),
                fullName: window.currentUserData ? window.currentUserData.fullName : 'Usuario Invitado',
                createdAt: new Date()
            };

            if (processedRow.admision) {
                showLoading();
                try {
                    const existingReg = await getRegistroByUniqueKey(processedRow.admision);
                    if (existingReg) {
                        hideLoading();
                        showToast('La admisión ya existe.', 'error');
                        return;
                    }
                    const docRef = await addDoc(collection(db, "registrar_consignacion"), processedRow);
                    await logAction(docRef.id, 'create', null, processedRow);
                    hideLoading();
                    showToast(`Registro ${processedRow.admision} ingresado exitosamente`, 'success');
                    [admisionInput, pacienteInput, medicoInput, fechaCXInput, codigoInput, descripcionInput, cantidadInput,
                        referenciaInput, proveedorInput, precioUnitarioInput, atributoInput, totalItemsInput].forEach(input => input.value = '');
                    await loadRegistros();
                } catch (error) {
                    hideLoading();
                    showToast('Error al ingresar el registro: ' + error.message, 'error');
                }
            } else {
                showToast('Falta la admisión', 'error');
            }
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.replace('../index.html');
            return;
        }
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                window.currentUserData = userDoc.data();
            } else {
                window.currentUserData = { fullName: user.displayName || 'Usuario Invitado', username: user.email || 'invitado' };
            }
            await loadRegistros();
        } catch (error) {
            window.currentUserData = { fullName: 'Usuario Invitado', username: 'invitado' };
            showToast('Error al cargar datos del usuario: ' + error.message, 'error');
        }
    });
});