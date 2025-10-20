const { initializeApp, getAuth, onAuthStateChanged, setPersistence, browserSessionPersistence, getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, orderBy, getDoc, limit, startAfter } = window.firebaseModules;

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

let referencias = [];
let currentPage = 1;
const PAGE_SIZE = 50;
let lastVisible = null;
let firstVisible = null;
let searchReferencia = '';
let searchCodigo = '';
let searchDescripcion = '';
let searchDetalles = '';
let searchProveedor = '';
let searchTipo = '';
let searchAtributo = '';
let mostrarPendientes = false;
let proveedores = [];
let totalRecords = 0;

function formatNumberWithThousandsSeparator(number) {
    if (!number) return '';
    const cleaned = String(number).replace(/[^\d]/g, '');
    return cleaned ? Number(cleaned).toLocaleString('es-CL') : '';
}

async function getReferenciaByUniqueKey(referencia, excludeId = null) {
    if (!referencia) return null;
    const q = query(collection(db, "referencias_implantes"), where("referencia", "==", referencia.trim().toUpperCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        if (excludeId && doc.id === excludeId) return null;
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

async function getCodigoByUniqueKey(codigo, excludeId = null) {
    if (!codigo || codigo === 'PENDIENTE' || codigo === '0' || codigo === '') return null;
    const q = query(collection(db, "referencias_implantes"), where("codigo", "==", codigo.trim().toUpperCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        if (excludeId && doc.id === excludeId) return null;
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

async function loadProveedores() {
    try {
        const querySnapshot = await getDocs(collection(db, "empresas"));
        proveedores = [];
        querySnapshot.forEach((doc) => {
            proveedores.push({ id: doc.id, ...doc.data() });
        });
        proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (error) {
        showToast('Error al cargar proveedores: ' + error.message, 'error');
    }
}

function setupAutocomplete(inputId, iconId, listId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    const list = document.getElementById(listId);

    function showSuggestions(value) {
        list.innerHTML = '';
        if (!value) {
            list.classList.remove('show');
            return;
        }
        const filtered = proveedores.filter(p => p.nombre.toUpperCase().includes(value.toUpperCase()));
        if (filtered.length === 0) {
            list.classList.remove('show');
            return;
        }
        filtered.forEach(proveedor => {
            const div = document.createElement('div');
            div.textContent = proveedor.nombre.toUpperCase();
            div.addEventListener('click', () => {
                input.value = proveedor.nombre.toUpperCase();
                list.innerHTML = '';
                list.classList.remove('show');
            });
            list.appendChild(div);
        });
        list.classList.add('show');
    }

    function showAllProveedores() {
        list.innerHTML = '';
        proveedores.forEach(proveedor => {
            const div = document.createElement('div');
            div.textContent = proveedor.nombre.toUpperCase();
            div.addEventListener('click', () => {
                input.value = proveedor.nombre.toUpperCase();
                list.innerHTML = '';
                list.classList.remove('show');
            });
            list.appendChild(div);
        });
        list.classList.add('show');
    }

    input.addEventListener('input', (e) => showSuggestions(e.target.value));
    input.addEventListener('blur', () => {
        setTimeout(() => list.classList.remove('show'), 200);
    });
    icon.addEventListener('click', () => {
        if (list.classList.contains('show')) {
            list.classList.remove('show');
        } else {
            showAllProveedores();
        }
    });
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !icon.contains(e.target) && !list.contains(e.target)) {
            list.classList.remove('show');
        }
    });
}

async function logAction(referenciaId, action, oldData = null, newData = null) {
    if (!window.currentUserData) return;
    try {
        await addDoc(collection(db, "referencias_implantes_historial"), {
            referenciaId,
            action,
            timestamp: new Date(),
            userId: auth.currentUser ? auth.currentUser.uid : null,
            userFullName: window.currentUserData.fullName || 'Usuario Invitado',
            username: window.currentUserData.username || 'invitado',
            oldData,
            newData
        });
    } catch (error) {
        showToast('Error al registrar acción: ' + error.message, 'error');
    }
}

function enableColumnResizing() {
    const table = document.getElementById('referenciasTable');
    if (!table) return;

    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
        header.addEventListener('mousedown', (e) => {
            const rect = header.getBoundingClientRect();
            if (e.clientX > rect.right - 10 && e.clientX < rect.right + 5) {
                e.preventDefault();
                document.body.classList.add('resizing');
                const startX = e.clientX;
                const startWidth = header.offsetWidth;
                const minWidth = parseInt(getComputedStyle(header).minWidth) || 50;
                const maxWidth = 2000;

                const cells = table.querySelectorAll(`tr td:nth-child(${index + 1}), tr th:nth-child(${index + 1})`);
                cells.forEach(cell => {
                    cell.style.maxWidth = 'none';
                    cell.style.width = `${startWidth}px`;
                });

                const onMouseMove = (moveEvent) => {
                    let newWidth = startWidth + (moveEvent.clientX - startX);
                    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
                    cells.forEach(cell => {
                        cell.style.width = `${newWidth}px`;
                        cell.style.maxWidth = 'none';
                    });
                };

                const onMouseUp = () => {
                    document.body.classList.remove('resizing');
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.removeEventListener('mouseleave', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                document.addEventListener('mouseleave', onMouseUp);
            }
        });
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
    const toastContainer = document.getElementById('referencias-toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `referencias-toast ${type}`;
    toast.textContent = text;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('referencias-loading');
    const importProgress = document.getElementById('referencias-import-progress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const referenciasBody = document.getElementById('referenciasBody');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageNumbers = document.getElementById('pageNumbers');
    const paginationInfo = document.getElementById('paginationInfo');
    const newCodeForm = document.getElementById('newCodeForm');
    const existingCodeForm = document.getElementById('existingCodeForm');
    const referenciaInput = document.getElementById('referencia');
    const detallesInput = document.getElementById('detalles');
    const precioUnitarioInput = document.getElementById('precioUnitario');
    const proveedorInput = document.getElementById('proveedor');
    const descripcionInput = document.getElementById('descripcion');
    const tipoInput = document.getElementById('tipo');
    const atributoInput = document.getElementById('atributo');
    const existReferenciaInput = document.getElementById('existReferencia');
    const existDetallesInput = document.getElementById('existDetalles');
    const existPrecioUnitarioInput = document.getElementById('existPrecioUnitario');
    const existCodigoInput = document.getElementById('existCodigo');
    const existProveedorInput = document.getElementById('existProveedor');
    const existDescripcionInput = document.getElementById('existDescripcion');
    const existTipoInput = document.getElementById('existTipo');
    const existAtributoInput = document.getElementById('existAtributo');
    const buscarReferenciaInput = document.getElementById('buscarReferencia');
    const buscarCodigoInput = document.getElementById('buscarCodigo');
    const buscarDescripcionInput = document.getElementById('buscarDescripcion');
    const buscarDetallesInput = document.getElementById('buscarDetalles');
    const buscarProveedorInput = document.getElementById('buscarProveedor');
    const buscarTipoInput = document.getElementById('buscarTipo');
    const buscarAtributoInput = document.getElementById('buscarAtributo');
    const mostrarPendientesCheckbox = document.getElementById('mostrarPendientes');
    const actionsBtn = document.getElementById('actionsBtn');
    const actionsMenu = document.getElementById('actionsMenu');
    const downloadTemplate = document.getElementById('downloadTemplate');
    const importExcel = document.getElementById('importExcel');
    const downloadAll = document.getElementById('downloadAll');
    const downloadPage = document.getElementById('downloadPage');
    const fileUpload = document.getElementById('fileUpload');
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
    let currentDeleteReferencia = null;

    function formatMontoInput(input) {
        if (!input) return;
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/[^\d]/g, '');
            e.target.value = formatNumberWithThousandsSeparator(value);
        });
    }

    formatMontoInput(precioUnitarioInput);
    formatMontoInput(existPrecioUnitarioInput);
    formatMontoInput(document.getElementById('editPrecioUnitario'));

    function enforceUpperCase(input) {
        if (!input) return;
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    [referenciaInput, detallesInput, proveedorInput, descripcionInput, tipoInput, atributoInput,
     existReferenciaInput, existDetallesInput, existCodigoInput, existProveedorInput, existDescripcionInput, existTipoInput, existAtributoInput,
     document.getElementById('editReferencia'), document.getElementById('editDetalles'), document.getElementById('editCodigo'),
     document.getElementById('editProveedor'), document.getElementById('editDescripcion'), document.getElementById('editTipo'),
     document.getElementById('editAtributo'), document.getElementById('editEstado')]
        .forEach(input => enforceUpperCase(input));

    function updateDescripcion() {
        const referencia = referenciaInput?.value.trim().toUpperCase() || '';
        const detalles = detallesInput?.value.trim().toUpperCase() || '';
        if (descripcionInput) {
            descripcionInput.value = referencia && detalles ? `${referencia} ${detalles}` : '';
        }
    }

    function updateExistDescripcion() {
        const referencia = existReferenciaInput?.value.trim().toUpperCase() || '';
        const detalles = existDetallesInput?.value.trim().toUpperCase() || '';
        if (existDescripcionInput) {
            existDescripcionInput.value = referencia && detalles ? `${referencia} ${detalles}` : '';
        }
    }

    if (referenciaInput) referenciaInput.addEventListener('input', updateDescripcion);
    if (detallesInput) detallesInput.addEventListener('input', updateDescripcion);
    if (existReferenciaInput) existReferenciaInput.addEventListener('input', updateExistDescripcion);
    if (existDetallesInput) existDetallesInput.addEventListener('input', updateExistDescripcion);

    document.querySelectorAll('input[name="formType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (newCodeForm) newCodeForm.style.display = e.target.value === 'newCode' ? 'flex' : 'none';
            if (existingCodeForm) existingCodeForm.style.display = e.target.value === 'existingCode' ? 'flex' : 'none';
        });
    });

    window.showLoading = function () {
        if (loading) loading.classList.add('show');
    };

    window.hideLoading = function () {
        if (loading) loading.classList.remove('show');
    };

    function showImportProgress(percent) {
        if (importProgress && progressBar && progressText) {
            importProgress.classList.add('show');
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `Importando: ${Math.round(percent)}%`;
        }
    }

    function hideImportProgress() {
        if (importProgress) {
            importProgress.classList.remove('show');
            if (progressBar) progressBar.style.width = '0%';
            if (progressText) progressText.textContent = 'Importando: 0%';
        }
    }

    window.openEditModal = function (id, referencia) {
        currentEditId = id;
        currentEditOldData = { ...referencia };
        const fields = {
            'editId': id,
            'editReferencia': referencia.referencia || '',
            'editDetalles': referencia.detalles || '',
            'editPrecioUnitario': referencia.precioUnitario ? formatNumberWithThousandsSeparator(referencia.precioUnitario) : '',
            'editCodigo': referencia.codigo || '',
            'editProveedor': referencia.proveedor || '',
            'editDescripcion': referencia.descripcion || '',
            'editTipo': referencia.tipo || 'IMPLANTES',
            'editAtributo': referencia.atributo || 'COTIZACION',
            'editEstado': referencia.estado || 'ACTIVO'
        };
        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.value = value;
        });
        if (editModal) editModal.style.display = 'block';
    };

    function closeEditModalHandler() {
        if (editModal) editModal.style.display = 'none';
        currentEditId = null;
        currentEditOldData = null;
        if (editForm) editForm.reset();
        const editProveedorList = document.getElementById('editProveedorList');
        if (editProveedorList) editProveedorList.classList.remove('show');
    }

    window.openDeleteModal = function (id, referencia) {
        currentDeleteId = id;
        currentDeleteReferencia = referencia;
        if (deleteText) deleteText.textContent = `¿Desea eliminar la referencia "${referencia}"?`;
        if (deleteModal) deleteModal.style.display = 'block';
    };

    function closeDeleteModalHandler() {
        if (deleteModal) deleteModal.style.display = 'none';
        currentDeleteId = null;
        currentDeleteReferencia = null;
    }

    window.openHistoryModal = async function (id, referencia) {
        if (historyTitle) historyTitle.textContent = `HISTORIAL REFERENCIA ${referencia}`;
        showLoading();
        try {
            const q = query(collection(db, "referencias_implantes_historial"), where("referenciaId", "==", id), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            let html = '';
            querySnapshot.forEach((doc) => {
                const log = doc.data();
                const date = log.timestamp ? log.timestamp.toDate().toLocaleString('es-CL') : 'Fecha inválida';
                if (log.action === 'create') {
                    html += `<div class="history-entry">Creado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date}</div>`;
                } else if (log.action === 'update') {
                    html += `<div class="history-entry">Modificado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date} | Referencia: ${log.oldData ? log.oldData.referencia : 'N/A'} → ${log.newData ? log.newData.referencia : 'N/A'}</div>`;
                } else if (log.action === 'delete') {
                    html += `<div class="history-entry">Eliminado | ${log.userFullName || 'Desconocido'} | ${log.username || 'desconocido'} | ${date}</div>`;
                }
            });
            if (historyContent) historyContent.innerHTML = html || '<div>No hay historial disponible.</div>';
            if (historyModal) historyModal.style.display = 'block';
        } catch (error) {
            showToast('Error al cargar el historial: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    };

    function closeHistoryModalHandler() {
        if (historyModal) historyModal.style.display = 'none';
        if (historyContent) historyContent.innerHTML = '';
    }

    if (closeEditModal) closeEditModal.addEventListener('click', closeEditModalHandler);
    if (cancelEdit) cancelEdit.addEventListener('click', closeEditModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModalHandler();
    });

    if (closeDeleteModal) closeDeleteModal.addEventListener('click', closeDeleteModalHandler);
    if (cancelDelete) cancelDelete.addEventListener('click', closeDeleteModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModalHandler();
    });

    if (closeHistory) closeHistory.addEventListener('click', closeHistoryModalHandler);
    if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', closeHistoryModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === historyModal) closeHistoryModalHandler();
    });

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentEditId) return;

            const processedRow = {
                referencia: document.getElementById('editReferencia')?.value.trim().toUpperCase() || '',
                detalles: document.getElementById('editDetalles')?.value.trim().toUpperCase() || '',
                precioUnitario: document.getElementById('editPrecioUnitario')?.value.replace(/[^\d]/g, '') || '',
                codigo: document.getElementById('editCodigo')?.value.trim().toUpperCase() || 'PENDIENTE',
                proveedor: document.getElementById('editProveedor')?.value.trim().toUpperCase() || '',
                descripcion: document.getElementById('editDescripcion')?.value.trim().toUpperCase() || '',
                tipo: document.getElementById('editTipo')?.value || 'IMPLANTES',
                atributo: document.getElementById('editAtributo')?.value || 'COTIZACION',
                estado: document.getElementById('editEstado')?.value || 'ACTIVO',
                fullName: window.currentUserData?.fullName || ''
            };

            if (processedRow.codigo === '' || processedRow.codigo === '0') {
                processedRow.codigo = 'PENDIENTE';
            }

            if (processedRow.referencia) {
                showLoading();
                try {
                    const existingRef = await getReferenciaByUniqueKey(processedRow.referencia, currentEditId);
                    if (existingRef) {
                        showToast('La referencia ya existe.', 'error');
                        return;
                    }
                    const existingCod = await getCodigoByUniqueKey(processedRow.codigo, currentEditId);
                    if (existingCod) {
                        showToast('El código ya existe.', 'error');
                        return;
                    }
                    await updateDoc(doc(db, "referencias_implantes", currentEditId), {
                        ...processedRow,
                        createdAt: new Date()
                    });
                    await logAction(currentEditId, 'update', currentEditOldData, processedRow);
                    showToast(`Referencia ${processedRow.referencia} actualizada exitosamente`, 'success');
                    closeEditModalHandler();
                    await loadReferencias();
                } catch (error) {
                    showToast('Error al actualizar la referencia: ' + error.message, 'error');
                } finally {
                    hideLoading();
                }
            } else {
                showToast('Falta la referencia', 'error');
            }
        });
    }

    if (confirmDelete) {
        confirmDelete.addEventListener('click', async () => {
            if (!currentDeleteId || !currentDeleteReferencia) return;

            showLoading();
            try {
                const referenciaDoc = await getDoc(doc(db, "referencias_implantes", currentDeleteId));
                if (referenciaDoc.exists()) {
                    const referenciaData = referenciaDoc.data();
                    await logAction(currentDeleteId, 'delete', referenciaData);
                    await deleteDoc(doc(db, "referencias_implantes", currentDeleteId));
                    showToast(`Referencia ${currentDeleteReferencia} eliminada exitosamente`, 'success');
                    closeDeleteModalHandler();
                    await loadReferencias();
                } else {
                    showToast('La referencia no existe.', 'error');
                    closeDeleteModalHandler();
                }
            } catch (error) {
                showToast('Error al eliminar la referencia: ' + error.message, 'error');
            } finally {
                hideLoading();
            }
        });
    }

    const debouncedLoadReferencias = debounce(loadReferencias, 300);

    if (buscarReferenciaInput) {
        buscarReferenciaInput.addEventListener('input', (e) => {
            searchReferencia = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadReferencias();
        });
    }

    if (buscarCodigoInput) {
        buscarCodigoInput.addEventListener('input', (e) => {
            searchCodigo = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadReferencias();
        });
    }

    if (buscarDescripcionInput) {
        buscarDescripcionInput.addEventListener('input', (e) => {
            searchDescripcion = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadReferencias();
        });
    }

    if (buscarDetallesInput) {
        buscarDetallesInput.addEventListener('input', (e) => {
            searchDetalles = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadReferencias();
        });
    }

    if (buscarProveedorInput) {
        buscarProveedorInput.addEventListener('input', (e) => {
            searchProveedor = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadReferencias();
        });
    }

    if (buscarTipoInput) {
        buscarTipoInput.addEventListener('change', (e) => {
            searchTipo = e.target.value;
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadReferencias();
        });
    }

    if (buscarAtributoInput) {
        buscarAtributoInput.addEventListener('change', (e) => {
            searchAtributo = e.target.value;
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadReferencias();
        });
    }

    if (mostrarPendientesCheckbox) {
        mostrarPendientesCheckbox.addEventListener('change', (e) => {
            mostrarPendientes = e.target.checked;
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadReferencias();
        });
    }

    async function loadReferencias() {
        showLoading();
        try {
            let q = query(collection(db, "referencias_implantes"), orderBy("createdAt", "desc"));
            const conditions = [];

            if (searchReferencia) {
                conditions.push(where("referencia", ">=", searchReferencia));
                conditions.push(where("referencia", "<=", searchReferencia + '\uf8ff'));
            }
            if (searchCodigo) {
                conditions.push(where("codigo", ">=", searchCodigo));
                conditions.push(where("codigo", "<=", searchCodigo + '\uf8ff'));
            }
            if (searchDetalles) {
                conditions.push(where("detalles", ">=", searchDetalles));
                conditions.push(where("detalles", "<=", searchDetalles + '\uf8ff'));
            }
            if (searchProveedor) {
                conditions.push(where("proveedor", ">=", searchProveedor));
                conditions.push(where("proveedor", "<=", searchProveedor + '\uf8ff'));
            }
            if (searchTipo) {
                conditions.push(where("tipo", "==", searchTipo));
            }
            if (searchAtributo) {
                conditions.push(where("atributo", "==", searchAtributo));
            }
            if (mostrarPendientes) {
                conditions.push(where("codigo", "==", "PENDIENTE"));
            }

            if (currentPage > 1 && lastVisible) {
                conditions.push(startAfter(lastVisible));
            }
            conditions.push(limit(PAGE_SIZE));

            q = query(collection(db, "referencias_implantes"), orderBy("createdAt", "desc"), ...conditions);

            const querySnapshot = await getDocs(q);
            referencias = [];
            querySnapshot.forEach((doc) => {
                referencias.push({ id: doc.id, ...doc.data() });
            });

            if (searchDescripcion) {
                referencias = referencias.filter(ref =>
                    ref.descripcion && ref.descripcion.toUpperCase().includes(searchDescripcion)
                );
            }

            if (querySnapshot.docs.length > 0) {
                lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
                firstVisible = querySnapshot.docs[0];
            } else {
                lastVisible = null;
                firstVisible = null;
            }

            let countQuery = query(collection(db, "referencias_implantes"));
            if (searchReferencia) {
                countQuery = query(countQuery, where("referencia", ">=", searchReferencia), where("referencia", "<=", searchReferencia + '\uf8ff'));
            }
            if (searchCodigo) {
                countQuery = query(countQuery, where("codigo", ">=", searchCodigo), where("codigo", "<=", searchCodigo + '\uf8ff'));
            }
            if (searchDetalles) {
                countQuery = query(countQuery, where("detalles", ">=", searchDetalles), where("detalles", "<=", searchDetalles + '\uf8ff'));
            }
            if (searchProveedor) {
                countQuery = query(countQuery, where("proveedor", ">=", searchProveedor), where("proveedor", "<=", searchProveedor + '\uf8ff'));
            }
            if (searchTipo) {
                countQuery = query(countQuery, where("tipo", "==", searchTipo));
            }
            if (searchAtributo) {
                countQuery = query(countQuery, where("atributo", "==", searchAtributo));
            }
            if (mostrarPendientes) {
                countQuery = query(countQuery, where("codigo", "==", "PENDIENTE"));
            }

            const countSnapshot = await getDocs(countQuery);
            totalRecords = countSnapshot.size;

            if (searchDescripcion) {
                totalRecords = referencias.length;
            }

            renderTable();
        } catch (error) {
            showToast('Error al cargar las referencias: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    function renderTable() {
        if (referenciasBody) {
            referenciasBody.innerHTML = '';
            if (referencias.length === 0) {
                referenciasBody.innerHTML = '<tr><td colspan="10">No hay registros para mostrar.</td></tr>';
            } else {
                referencias.forEach(referencia => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="referencias-actions">
                            <button title="Editar" class="referencias-btn-edit" onclick="openEditModal('${referencia.id}', ${JSON.stringify(referencia).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                            <button title="Eliminar" class="referencias-btn-delete" onclick="openDeleteModal('${referencia.id}', '${referencia.referencia}')"><i class="fas fa-trash"></i></button>
                            <button title="Ver Historial" class="referencias-btn-history" onclick="openHistoryModal('${referencia.id}', '${referencia.referencia}')"><i class="fas fa-history"></i></button>
                        </td>
                        <td>${referencia.referencia || ''}</td>
                        <td>${referencia.detalles || ''}</td>
                        <td>${formatNumberWithThousandsSeparator(referencia.precioUnitario)}</td>
                        <td>${referencia.codigo || ''}</td>
                        <td>${referencia.proveedor || ''}</td>
                        <td>${referencia.descripcion || ''}</td>
                        <td>${referencia.tipo || ''}</td>
                        <td>${referencia.atributo || ''}</td>
                        <td>${referencia.estado || 'ACTIVO'}</td>
                    `;
                    referenciasBody.appendChild(row);
                });
            }
        }

        updatePagination(totalRecords);
        enableColumnResizing();
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
                    dots.className = 'referencias-dots';
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
                    dots.className = 'referencias-dots';
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
        loadReferencias();
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadReferencias();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
            if (currentPage < totalPages) {
                currentPage++;
                loadReferencias();
            }
        });
    }

    if (actionsBtn) {
        actionsBtn.addEventListener('click', () => {
            if (actionsMenu) {
                actionsMenu.style.display = actionsMenu.style.display === 'block' ? 'none' : 'block';
            }
        });
    }

    window.addEventListener('click', (e) => {
        if (actionsBtn && actionsMenu && !actionsBtn.contains(e.target) && !actionsMenu.contains(e.target)) {
            actionsMenu.style.display = 'none';
        }
    });

    if (downloadTemplate) {
        downloadTemplate.addEventListener('click', (e) => {
            e.preventDefault();
            const templateData = [{
                referencia: '',
                detalles: '',
                precioUnitario: '',
                codigo: '',
                proveedor: '',
                descripcion: '',
                tipo: 'IMPLANTES',
                atributo: 'COTIZACION',
                estado: 'ACTIVO'
            }];
            const ws = XLSX.utils.json_to_sheet(templateData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Template");
            XLSX.writeFile(wb, 'formato_importacion_referencias.xlsx');
            if (actionsMenu) actionsMenu.style.display = 'none';
        });
    }

    if (importExcel) {
        importExcel.addEventListener('click', (e) => {
            e.preventDefault();
            if (fileUpload) fileUpload.click();
            if (actionsMenu) actionsMenu.style.display = 'none';
        });
    }

    if (downloadAll) {
        downloadAll.addEventListener('click', async (e) => {
            e.preventDefault();
            showLoading();
            try {
                const q = query(collection(db, "referencias_implantes"));
                const querySnapshot = await getDocs(q);
                const allReferencias = [];
                querySnapshot.forEach((doc) => {
                    allReferencias.push({ id: doc.id, ...doc.data() });
                });
                const data = allReferencias.map(ref => ({
                    Referencia: ref.referencia || '',
                    Detalles: ref.detalles || '',
                    'Precio Unitario': ref.precioUnitario ? formatNumberWithThousandsSeparator(ref.precioUnitario) : '',
                    Código: ref.codigo || '',
                    Proveedor: ref.proveedor || '',
                    Descripción: ref.descripcion || '',
                    Tipo: ref.tipo || '',
                    Atributo: ref.atributo || '',
                    Estado: ref.estado || 'ACTIVO'
                }));
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Referencias");
                XLSX.writeFile(wb, 'referencias_todas.xlsx');
                if (actionsMenu) actionsMenu.style.display = 'none';
            } catch (error) {
                showToast('Error al descargar los registros: ' + error.message, 'error');
            } finally {
                hideLoading();
            }
        });
    }

    if (downloadPage) {
        downloadPage.addEventListener('click', (e) => {
            e.preventDefault();
            const data = referencias.map(ref => ({
                Referencia: ref.referencia || '',
                Detalles: ref.detalles || '',
                'Precio Unitario': ref.precioUnitario ? formatNumberWithThousandsSeparator(ref.precioUnitario) : '',
                Código: ref.codigo || '',
                Proveedor: ref.proveedor || '',
                Descripción: ref.descripcion || '',
                Tipo: ref.tipo || '',
                Atributo: ref.atributo || '',
                Estado: ref.estado || 'ACTIVO'
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Referencias");
            XLSX.writeFile(wb, `referencias_pagina_${currentPage}.xlsx`);
            if (actionsMenu) actionsMenu.style.display = 'none';
        });
    }

    if (fileUpload) {
        fileUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            showLoading();
            try {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

                    let successCount = 0;
                    let errorCount = 0;
                    const totalRows = jsonData.length - 1;

                    for (let i = 1; i <= totalRows; i++) {
                        const row = jsonData[i];
                        let processedRow = {
                            referencia: row[0] ? String(row[0]).trim().toUpperCase() : '',
                            detalles: row[1] ? String(row[1]).trim().toUpperCase() : '',
                            precioUnitario: row[2] ? String(row[2]).replace(/[^\d]/g, '') : '',
                            codigo: row[3] ? String(row[3]).trim().toUpperCase() : 'PENDIENTE',
                            proveedor: row[4] ? String(row[4]).trim().toUpperCase() : '',
                            descripcion: row[5] ? String(row[5]).trim().toUpperCase() : '',
                            tipo: row[6] ? String(row[6]).trim().toUpperCase() : 'IMPLANTES',
                            atributo: row[7] ? String(row[7]).trim().toUpperCase() : 'COTIZACION',
                            estado: 'ACTIVO',
                            fullName: window.currentUserData?.fullName || ''
                        };

                        if (processedRow.codigo === '' || processedRow.codigo === '0') {
                            processedRow.codigo = 'PENDIENTE';
                        }

                        if (!['IMPLANTES', 'INSUMO'].includes(processedRow.tipo)) {
                            processedRow.tipo = 'IMPLANTES';
                        }

                        if (!['COTIZACION', 'CONSIGNACION'].includes(processedRow.atributo)) {
                            processedRow.atributo = 'COTIZACION';
                        }

                        if (processedRow.referencia && processedRow.descripcion) {
                            try {
                                const existingRef = await getReferenciaByUniqueKey(processedRow.referencia);
                                if (existingRef) {
                                    errorCount++;
                                    continue;
                                }
                                const existingCod = await getCodigoByUniqueKey(processedRow.codigo);
                                if (existingCod) {
                                    errorCount++;
                                    continue;
                                }
                                const docRef = await addDoc(collection(db, "referencias_implantes"), {
                                    ...processedRow,
                                    createdAt: new Date()
                                });
                                await logAction(docRef.id, 'create', null, processedRow);
                                successCount++;
                            } catch (error) {
                                errorCount++;
                            }
                        } else {
                            errorCount++;
                        }

                        const progress = (i / totalRows) * 100;
                        showImportProgress(progress);
                    }

                    showToast(`Importación completada: ${successCount} registros exitosos, ${errorCount} errores`, successCount > 0 ? 'success' : 'error');
                    fileUpload.value = '';
                    await loadReferencias();
                };
                reader.readAsArrayBuffer(file);
            } catch (error) {
                showToast('Error al importar el archivo: ' + error.message, 'error');
                fileUpload.value = '';
            } finally {
                hideLoading();
                hideImportProgress();
            }
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.replace('../index.html');
            return;
        }

        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                window.currentUserData = userDoc.data();
            }
            await loadProveedores();
            setupAutocomplete('proveedor', 'proveedorIcon', 'proveedorList');
            setupAutocomplete('existProveedor', 'existProveedorIcon', 'existProveedorList');
            setupAutocomplete('editProveedor', 'editProveedorIcon', 'editProveedorList');
            await loadReferencias();
        } catch (error) {
            showToast('Error al inicializar: ' + error.message, 'error');
        }
    });
});