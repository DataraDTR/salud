const { initializeApp, getAuth, onAuthStateChanged, setPersistence, browserSessionPersistence } = window.firebaseModules;
const { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, orderBy, getDoc, writeBatch } = window.firebaseModules;

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
const PAGE_SIZE = 10;
let searchReferencia = '';
let searchCodigo = '';
let searchDescripcion = '';
let searchDetalles = '';
let searchProveedor = '';
let searchTipo = '';
let searchAtributo = '';
let proveedores = [];

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

    input.addEventListener('input', (e) => {
        showSuggestions(e.target.value);
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            list.classList.remove('show');
        }, 200);
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
}

function setupColumnResize() {
    const headers = document.querySelectorAll('.referencias-table th');
    headers.forEach((header, index) => {
        // Remove any existing resize handles
        const existingHandle = header.querySelector('.resize-handle');
        if (existingHandle) existingHandle.remove();

        // Create resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        header.appendChild(resizeHandle);
        header.style.position = 'relative';

        let isResizing = false;
        let startX, startWidth;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.pageX;
            startWidth = header.offsetWidth;
            resizeHandle.classList.add('active');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isResizing) {
                const newWidth = Math.max(80, startWidth + (e.pageX - startX)); // Minimum width 80px
                // Update only the selected header and corresponding cells
                header.style.width = `${newWidth}px`;
                header.style.maxWidth = `${newWidth}px`; // Update max-width to match
                const cells = document.querySelectorAll(`.referencias-table td:nth-child(${index + 1})`);
                cells.forEach(cell => {
                    cell.style.width = `${newWidth}px`;
                    cell.style.maxWidth = `${newWidth}px`; // Update max-width to match
                });
                // Update table width to reflect the sum of all column widths
                const table = document.querySelector('.referencias-table');
                const totalWidth = Array.from(headers).reduce((sum, h) => sum + h.offsetWidth, 0);
                table.style.width = `${totalWidth}px`;
                e.preventDefault();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizeHandle.classList.remove('active');
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('referencias-loading');
    const importProgress = document.getElementById('referencias-import-progress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const toast = document.getElementById('referencias-toast');
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
    const ingresarNewCodeBtn = document.getElementById('ingresarNewCodeBtn');
    const existReferenciaInput = document.getElementById('existReferencia');
    const existDetallesInput = document.getElementById('existDetalles');
    const existPrecioUnitarioInput = document.getElementById('existPrecioUnitario');
    const existCodigoInput = document.getElementById('existCodigo');
    const existProveedorInput = document.getElementById('existProveedor');
    const existDescripcionInput = document.getElementById('existDescripcion');
    const existTipoInput = document.getElementById('existTipo');
    const existAtributoInput = document.getElementById('existAtributo');
    const ingresarExistingCodeBtn = document.getElementById('ingresarExistingCodeBtn');
    const buscarReferenciaInput = document.getElementById('buscarReferencia');
    const buscarCodigoInput = document.getElementById('buscarCodigo');
    const buscarDescripcionInput = document.getElementById('buscarDescripcion');
    const buscarDetallesInput = document.getElementById('buscarDetalles');
    const buscarProveedorInput = document.getElementById('buscarProveedor');
    const buscarTipoInput = document.getElementById('buscarTipo');
    const buscarAtributoInput = document.getElementById('buscarAtributo');
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
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/[^\d]/g, '');
            e.target.value = formatNumberWithThousandsSeparator(value);
        });
    }

    formatMontoInput(precioUnitarioInput);
    formatMontoInput(existPrecioUnitarioInput);
    formatMontoInput(document.getElementById('editPrecioUnitario'));

    function enforceUpperCase(input) {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    [referenciaInput, detallesInput, proveedorInput, descripcionInput, tipoInput, atributoInput,
     existReferenciaInput, existDetallesInput, existCodigoInput, existProveedorInput, existDescripcionInput, existTipoInput, existAtributoInput,
     document.getElementById('editReferencia'), document.getElementById('editDetalles'), document.getElementById('editCodigo'),
     document.getElementById('editProveedor'), document.getElementById('editDescripcion'), document.getElementById('editTipo'), document.getElementById('editAtributo')]
        .forEach(input => input && enforceUpperCase(input));

    function updateDescripcion() {
        const referencia = referenciaInput.value.trim().toUpperCase();
        const detalles = detallesInput.value.trim().toUpperCase();
        descripcionInput.value = referencia && detalles ? `${referencia} ${detalles}` : '';
    }

    function updateExistDescripcion() {
        const referencia = existReferenciaInput.value.trim().toUpperCase();
        const detalles = existDetallesInput.value.trim().toUpperCase();
        existDescripcionInput.value = referencia && detalles ? `${referencia} ${detalles}` : '';
    }

    referenciaInput.addEventListener('input', updateDescripcion);
    detallesInput.addEventListener('input', updateDescripcion);
    existReferenciaInput.addEventListener('input', updateExistDescripcion);
    existDetallesInput.addEventListener('input', updateExistDescripcion);

    document.querySelectorAll('input[name="formType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            newCodeForm.style.display = e.target.value === 'newCode' ? 'flex' : 'none';
            existingCodeForm.style.display = e.target.value === 'existingCode' ? 'flex' : 'none';
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
            progressBar.style.width = '0%';
            progressText.textContent = 'Importando: 0%';
        }
    }

    function showToast(text, type = 'success') {
        if (toast) {
            toast.textContent = text;
            toast.className = `referencias-toast ${type}`;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 5000);
        }
    }

    window.openEditModal = function (id, referencia) {
        currentEditId = id;
        currentEditOldData = { ...referencia };
        document.getElementById('editId').value = id;
        document.getElementById('editReferencia').value = referencia.referencia || '';
        document.getElementById('editDetalles').value = referencia.detalles || '';
        document.getElementById('editPrecioUnitario').value = referencia.precioUnitario ? formatNumberWithThousandsSeparator(referencia.precioUnitario) : '';
        document.getElementById('editCodigo').value = referencia.codigo || '';
        document.getElementById('editProveedor').value = referencia.proveedor || '';
        document.getElementById('editDescripcion').value = referencia.descripcion || '';
        document.getElementById('editTipo').value = referencia.tipo || 'IMPLANTES';
        document.getElementById('editAtributo').value = referencia.atributo || 'COTIZACION';
        editModal.style.display = 'block';
    };

    function closeEditModalHandler() {
        editModal.style.display = 'none';
        currentEditId = null;
        currentEditOldData = null;
        editForm.reset();
        document.getElementById('editProveedorList').classList.remove('show');
    }

    window.openDeleteModal = function (id, referencia) {
        currentDeleteId = id;
        currentDeleteReferencia = referencia;
        deleteText.textContent = `¿Desea eliminar la referencia "${referencia}"?`;
        deleteModal.style.display = 'block';
    };

    function closeDeleteModalHandler() {
        deleteModal.style.display = 'none';
        currentDeleteId = null;
        currentDeleteReferencia = null;
    }

    window.openHistoryModal = function (id, referencia) {
        historyTitle.textContent = `HISTORIAL REFERENCIA ${referencia}`;
        showLoading();
        const q = query(collection(db, "referencias_implantes_historial"), where("referenciaId", "==", id), orderBy("timestamp", "desc"));
        getDocs(q).then((querySnapshot) => {
            hideLoading();
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

        const processedRow = {
            referencia: document.getElementById('editReferencia').value.trim().toUpperCase(),
            detalles: document.getElementById('editDetalles').value.trim().toUpperCase(),
            precioUnitario: document.getElementById('editPrecioUnitario').value.replace(/[^\d]/g, ''),
            codigo: document.getElementById('editCodigo').value.trim().toUpperCase(),
            proveedor: document.getElementById('editProveedor').value.trim().toUpperCase(),
            descripcion: document.getElementById('editDescripcion').value.trim().toUpperCase(),
            tipo: document.getElementById('editTipo').value,
            atributo: document.getElementById('editAtributo').value,
            fullName: window.currentUserData.fullName
        };

        if (processedRow.referencia) {
            showLoading();
            try {
                const existing = await getReferenciaByUniqueKey(processedRow.referencia, currentEditId);
                if (existing) {
                    hideLoading();
                    showToast('La referencia ya existe.', 'error');
                    return;
                }
                await updateDoc(doc(db, "referencias_implantes", currentEditId), {
                    ...processedRow,
                    createdAt: new Date()
                });
                await logAction(currentEditId, 'update', currentEditOldData, processedRow);
                hideLoading();
                showToast(`Referencia ${processedRow.referencia} actualizada exitosamente`, 'success');
                closeEditModalHandler();
                await loadReferencias();
            } catch (error) {
                hideLoading();
                showToast('Error al actualizar la referencia: ' + error.message, 'error');
            }
        } else {
            showToast('Falta la referencia', 'error');
        }
    });

    confirmDelete.addEventListener('click', async () => {
        if (!currentDeleteId || !currentDeleteReferencia) return;

        showLoading();
        try {
            const referenciaDoc = await getDoc(doc(db, "referencias_implantes", currentDeleteId));
            if (referenciaDoc.exists()) {
                const referenciaData = referenciaDoc.data();
                await logAction(currentDeleteId, 'delete', referenciaData);
                await deleteDoc(doc(db, "referencias_implantes", currentDeleteId));
                hideLoading();
                showToast(`Referencia ${currentDeleteReferencia} eliminada exitosamente`, 'success');
                closeDeleteModalHandler();
                await loadReferencias();
            } else {
                hideLoading();
                showToast('La referencia no existe.', 'error');
                closeDeleteModalHandler();
            }
        } catch (error) {
            hideLoading();
            showToast('Error al eliminar la referencia: ' + error.message, 'error');
        }
    });

    if (buscarReferenciaInput) {
        buscarReferenciaInput.addEventListener('input', (e) => {
            searchReferencia = e.target.value.trim().toUpperCase();
            currentPage = 1;
            renderTable();
        });
    }

    if (buscarCodigoInput) {
        buscarCodigoInput.addEventListener('input', (e) => {
            searchCodigo = e.target.value.trim().toUpperCase();
            currentPage = 1;
            renderTable();
        });
    }

    if (buscarDescripcionInput) {
        buscarDescripcionInput.addEventListener('input', (e) => {
            searchDescripcion = e.target.value.trim().toUpperCase();
            currentPage = 1;
            renderTable();
        });
    }

    if (buscarDetallesInput) {
        buscarDetallesInput.addEventListener('input', (e) => {
            searchDetalles = e.target.value.trim().toUpperCase();
            currentPage = 1;
            renderTable();
        });
    }

    if (buscarProveedorInput) {
        buscarProveedorInput.addEventListener('input', (e) => {
            searchProveedor = e.target.value.trim().toUpperCase();
            currentPage = 1;
            renderTable();
        });
    }

    if (buscarTipoInput) {
        buscarTipoInput.addEventListener('change', (e) => {
            searchTipo = e.target.value;
            currentPage = 1;
            renderTable();
        });
    }

    if (buscarAtributoInput) {
        buscarAtributoInput.addEventListener('change', (e) => {
            searchAtributo = e.target.value;
            currentPage = 1;
            renderTable();
        });
    }

    if (ingresarNewCodeBtn) {
        ingresarNewCodeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const processedRow = {
                referencia: referenciaInput.value.trim().toUpperCase(),
                detalles: detallesInput.value.trim().toUpperCase(),
                precioUnitario: precioUnitarioInput.value.replace(/[^\d]/g, ''),
                codigo: '',
                proveedor: proveedorInput.value.trim().toUpperCase(),
                descripcion: descripcionInput.value.trim().toUpperCase(),
                tipo: tipoInput.value,
                atributo: atributoInput.value,
                fullName: window.currentUserData.fullName
            };

            if (processedRow.referencia && processedRow.descripcion) {
                showLoading();
                try {
                    const existing = await getReferenciaByUniqueKey(processedRow.referencia);
                    if (existing) {
                        hideLoading();
                        showToast('La referencia ya existe.', 'error');
                        return;
                    }
                    const docRef = await addDoc(collection(db, "referencias_implantes"), {
                        ...processedRow,
                        createdAt: new Date()
                    });
                    await logAction(docRef.id, 'create', null, processedRow);
                    hideLoading();
                    showToast(`Referencia ${processedRow.referencia} registrada exitosamente`, 'success');
                    referenciaInput.value = '';
                    detallesInput.value = '';
                    precioUnitarioInput.value = '';
                    proveedorInput.value = '';
                    descripcionInput.value = '';
                    tipoInput.value = 'IMPLANTES';
                    atributoInput.value = 'COTIZACION';
                    document.getElementById('proveedorList').classList.remove('show');
                    await loadReferencias();
                } catch (error) {
                    hideLoading();
                    showToast('Error al registrar la referencia: ' + error.message, 'error');
                }
            } else {
                showToast('Faltan referencia o descripción', 'error');
            }
        });
    }

    if (ingresarExistingCodeBtn) {
        ingresarExistingCodeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const processedRow = {
                referencia: existReferenciaInput.value.trim().toUpperCase(),
                detalles: existDetallesInput.value.trim().toUpperCase(),
                precioUnitario: existPrecioUnitarioInput.value.replace(/[^\d]/g, ''),
                codigo: existCodigoInput.value.trim().toUpperCase(),
                proveedor: existProveedorInput.value.trim().toUpperCase(),
                descripcion: existDescripcionInput.value.trim().toUpperCase(),
                tipo: existTipoInput.value,
                atributo: existAtributoInput.value,
                fullName: window.currentUserData.fullName
            };

            if (processedRow.referencia && processedRow.descripcion) {
                showLoading();
                try {
                    const existing = await getReferenciaByUniqueKey(processedRow.referencia);
                    if (existing) {
                        hideLoading();
                        showToast('La referencia ya existe.', 'error');
                        return;
                    }
                    const docRef = await addDoc(collection(db, "referencias_implantes"), {
                        ...processedRow,
                        createdAt: new Date()
                    });
                    await logAction(docRef.id, 'create', null, processedRow);
                    hideLoading();
                    showToast(`Referencia ${processedRow.referencia} registrada exitosamente`, 'success');
                    existReferenciaInput.value = '';
                    existDetallesInput.value = '';
                    existPrecioUnitarioInput.value = '';
                    existCodigoInput.value = '';
                    existProveedorInput.value = '';
                    existDescripcionInput.value = '';
                    existTipoInput.value = 'IMPLANTES';
                    existAtributoInput.value = 'COTIZACION';
                    document.getElementById('existProveedorList').classList.remove('show');
                    await loadReferencias();
                } catch (error) {
                    hideLoading();
                    showToast('Error al registrar la referencia: ' + error.message, 'error');
                }
            } else {
                showToast('Faltan referencia o descripción', 'error');
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
            await loadProveedores();
            setupAutocomplete('proveedor', 'proveedorIcon', 'proveedorList');
            setupAutocomplete('existProveedor', 'existProveedorIcon', 'existProveedorList');
            setupAutocomplete('editProveedor', 'editProveedorIcon', 'editProveedorList');
            await loadReferencias();
        } catch (error) {
            window.currentUserData = { fullName: 'Usuario Invitado', username: 'invitado' };
            showToast('Error al cargar datos del usuario.', 'error');
        }
    });

    async function loadReferencias() {
        showLoading();
        try {
            const querySnapshot = await getDocs(collection(db, "referencias_implantes"));
            referencias = [];
            querySnapshot.forEach((doc) => {
                referencias.push({ id: doc.id, ...doc.data() });
            });
            referencias.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            renderTable();
            hideLoading();
        } catch (error) {
            hideLoading();
            showToast('Error al cargar las referencias: ' + error.message, 'error');
        }
    }

    function getFilteredReferencias() {
        return referencias.filter(referencia =>
            referencia.referencia.toUpperCase().includes(searchReferencia) &&
            (referencia.codigo || '').toUpperCase().includes(searchCodigo) &&
            referencia.descripcion.toUpperCase().includes(searchDescripcion) &&
            referencia.detalles.toUpperCase().includes(searchDetalles) &&
            (referencia.proveedor || '').toUpperCase().includes(searchProveedor) &&
            (searchTipo === '' || referencia.tipo === searchTipo) &&
            (searchAtributo === '' || referencia.atributo === searchAtributo)
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function renderTable() {
        const filteredReferencias = getFilteredReferencias();
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageReferencias = filteredReferencias.slice(start, end);

        if (referenciasBody) {
            referenciasBody.innerHTML = '';
            if (pageReferencias.length === 0) {
                referenciasBody.innerHTML = '<tr><td colspan="9">No hay registros para mostrar.</td></tr>';
            } else {
                pageReferencias.forEach(referencia => {
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
                    `;
                    referenciasBody.appendChild(row);
                });
            }
        }

        updatePagination(filteredReferencias.length);
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
        renderTable();
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(getFilteredReferencias().length / PAGE_SIZE);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });
    }

    actionsBtn.addEventListener('click', () => {
        actionsMenu.style.display = actionsMenu.style.display === 'block' ? 'none' : 'block';
    });

    window.addEventListener('click', (e) => {
        if (!actionsBtn.contains(e.target) && !actionsMenu.contains(e.target)) {
            actionsMenu.style.display = 'none';
        }
    });

    downloadTemplate.addEventListener('click', (e) => {
        e.preventDefault();
        downloadImportTemplate();
        actionsMenu.style.display = 'none';
    });

    importExcel.addEventListener('click', (e) => {
        e.preventDefault();
        fileUpload.click();
        actionsMenu.style.display = 'none';
    });

    downloadAll.addEventListener('click', (e) => {
        e.preventDefault();
        exportToExcel(referencias.map(r => ({
            referencia: r.referencia,
            detalles: r.detalles,
            precioUnitario: formatNumberWithThousandsSeparator(r.precioUnitario),
            codigo: r.codigo,
            proveedor: r.proveedor,
            descripcion: r.descripcion,
            tipo: r.tipo,
            atributo: r.atributo,
            fullName: r.fullName
        })), 'todas_referencias');
        actionsMenu.style.display = 'none';
    });

    downloadPage.addEventListener('click', (e) => {
        e.preventDefault();
        const filtered = getFilteredReferencias();
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageData = filtered.slice(start, end).map(r => ({
            referencia: r.referencia,
            detalles: r.detalles,
            precioUnitario: formatNumberWithThousandsSeparator(r.precioUnitario),
            codigo: r.codigo,
            proveedor: r.proveedor,
            descripcion: r.descripcion,
            tipo: r.tipo,
            atributo: r.atributo,
            fullName: r.fullName
        }));
        exportToExcel(pageData, `referencias_pagina_${currentPage}`);
        actionsMenu.style.display = 'none';
    });

    fileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await importFromExcel(file);
            fileUpload.value = '';
        }
    });

    function exportToExcel(data, filename) {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Referencias");
        XLSX.writeFile(wb, filename + '.xlsx');
    }

    function downloadImportTemplate() {
        const ws = XLSX.utils.aoa_to_sheet([[
            "Referencia", "Detalles", "Precio Unitario", "Código", "Proveedor", "Descripción", "Tipo", "Atributo", "Nombre Completo"
        ], [
            "REF001", "DETALLES EJEMPLO", "10000", "COD001", "PROVEEDOR A", "REF001 DETALLES EJEMPLO", "IMPLANTES", "COTIZACION", "Usuario Ejemplo"
        ]]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, 'template_referencias.xlsx');
    }

    async function importFromExcel(file) {
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, {
                    header: ["referencia", "detalles", "precioUnitario", "codigo", "proveedor", "descripcion", "tipo", "atributo", "fullName"],
                    range: 1,
                    defval: ''
                });

                let addedCount = 0;
                const totalRows = json.length;
                const useBatch = typeof writeBatch === 'function';
                let batch = useBatch ? writeBatch(db) : null;
                const batchSize = 500;
                let batchCount = 0;

                if (!useBatch) {
                    showToast('Advertencia: La importación por lotes no está disponible. Usando método alternativo (más lento).', 'warning');
                }

                showImportProgress(0);

                for (let i = 0; i < json.length; i++) {
                    const row = json[i];
                    const processedRow = {
                        referencia: String(row.referencia || '').trim().toUpperCase(),
                        detalles: String(row.detalles || '').trim().toUpperCase(),
                        precioUnitario: String(row.precioUnitario || '').replace(/[^\d]/g, ''),
                        codigo: String(row.codigo || '').trim().toUpperCase(),
                        proveedor: String(row.proveedor || '').trim().toUpperCase(),
                        descripcion: String(row.descripcion || '').trim().toUpperCase(),
                        tipo: String(row.tipo || 'IMPLANTES').trim().toUpperCase(),
                        atributo: String(row.atributo || 'COTIZACION').trim().toUpperCase(),
                        fullName: String(row.fullName || window.currentUserData.fullName || 'Usuario Invitado'),
                        createdAt: new Date()
                    };

                    if (!processedRow.referencia || !processedRow.descripcion) {
                        showToast(`Fila ${i + 2}: Referencia o descripción no válidas`, 'error');
                        continue;
                    }

                    const existing = await getReferenciaByUniqueKey(processedRow.referencia);
                    if (existing) {
                        showToast(`Fila ${i + 2}: La referencia ${processedRow.referencia} ya existe`, 'error');
                        continue;
                    }

                    if (useBatch) {
                        const referenciaRef = doc(collection(db, "referencias_implantes"));
                        batch.set(referenciaRef, processedRow);
                        batch.set(doc(collection(db, "referencias_implantes_historial")), {
                            referenciaId: referenciaRef.id,
                            action: 'create',
                            timestamp: new Date(),
                            userId: auth.currentUser ? auth.currentUser.uid : null,
                            userFullName: window.currentUserData.fullName || 'Usuario Invitado',
                            username: window.currentUserData.username || 'invitado',
                            oldData: null,
                            newData: processedRow
                        });
                        batchCount += 2;

                        if (batchCount >= batchSize || i === json.length - 1) {
                            await batch.commit();
                            batch = writeBatch(db);
                            batchCount = 0;
                        }
                    } else {
                        const referenciaRef = await addDoc(collection(db, "referencias_implantes"), processedRow);
                        await addDoc(collection(db, "referencias_implantes_historial"), {
                            referenciaId: referenciaRef.id,
                            action: 'create',
                            timestamp: new Date(),
                            userId: auth.currentUser ? auth.currentUser.uid : null,
                            userFullName: window.currentUserData.fullName || 'Usuario Invitado',
                            username: window.currentUserData.username || 'invitado',
                            oldData: null,
                            newData: processedRow
                        });
                    }

                    addedCount++;
                    showImportProgress((i + 1) / totalRows * 100);
                }

                hideImportProgress();
                showToast(`Importación completada: ${addedCount} referencias añadidas`, 'success');
                await loadReferencias();
            };
            reader.readAsArrayBuffer(file);
        } catch (error) {
            hideImportProgress();
            showToast('Error al importar el archivo: ' + error.message, 'error');
        }
    }
});