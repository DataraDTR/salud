console.log('window.firebaseModules al inicio de registrar.js:', window.firebaseModules);
if (!window.firebaseModules) {
    console.error('window.firebaseModules no está definido. Asegúrate de que el script de Firebase se cargue primero en registrar.html.');
    throw new Error('Firebase modules not loaded');
}
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
let medicos = [];
let currentPage = 1;
const PAGE_SIZE = 50;
let lastVisible = null;
let firstVisible = null;
let totalRecords = 0;
let searchAdmision = '';
let searchPaciente = '';
let searchMedico = '';
let searchDescripcion = '';
let searchProveedor = '';
let dateFilter = null;
let fechaDia = null;
let fechaDesde = null;
let fechaHasta = null;
let mes = null;
let anio = null;

function formatNumberWithThousandsSeparator(number) {
    if (!number) return '';
    const cleaned = String(number).replace(/[^\d]/g, '');
    return cleaned ? Number(cleaned).toLocaleString('es-CL') : '';
}

function parseFechaCX(fecha) {
    if (!fecha) return null;
    if (fecha.toDate && typeof fecha.toDate === 'function') {
        return fecha.toDate();
    } else if (typeof fecha === 'string') {
        const parsed = new Date(fecha);
        return isNaN(parsed) ? null : parsed;
    } else if (fecha instanceof Date) {
        return fecha;
    }
    return null;
}

async function loadMedicos() {
    try {
        const querySnapshot = await getDocs(collection(db, "medicos"));
        medicos = [];
        querySnapshot.forEach((doc) => {
            medicos.push({ id: doc.id, ...doc.data() });
        });
        medicos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (error) {
        showToast('Error al cargar médicos: ' + error.message, 'error');
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
        const filtered = medicos.filter(m => m.nombre.toLowerCase().includes(value.toLowerCase()));
        if (filtered.length === 0) {
            list.classList.remove('show');
            return;
        }
        filtered.forEach(medico => {
            const div = document.createElement('div');
            div.textContent = medico.nombre;
            div.addEventListener('click', () => {
                input.value = medico.nombre;
                list.innerHTML = '';
                list.classList.remove('show');
            });
            list.appendChild(div);
        });
        list.classList.add('show');
    }

    function showAllMedicos() {
        list.innerHTML = '';
        medicos.forEach(medico => {
            const div = document.createElement('div');
            div.textContent = medico.nombre;
            div.addEventListener('click', () => {
                input.value = medico.nombre;
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
            showAllMedicos();
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !icon.contains(e.target) && !list.contains(e.target)) {
            list.classList.remove('show');
        }
    });
}

async function logAction(registroId, action, oldData = null, newData = null) {
    if (!window.currentUserData) return;
    try {
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
    } catch (error) {
        console.error('Error al registrar acción en historial:', error);
    }
}

function setupColumnResize() {
    const table = document.querySelector('.registrar-table');
    const headers = document.querySelectorAll('.registrar-table th');

    const initialWidths = [
        100, // Admisión
        130, // Paciente
        200, // Médico
        120, // Fecha CX
        100, // Código
        300, // Descripción
        80,  // Cantidad
        130, // Referencia
        150, // Proveedor
        100, // Precio Unitario
        120, // Atributo
        100, // Total Items
        100  // Acciones
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
            startWidth = parseFloat(getComputedStyle(header).width);
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
    const toastContainer = document.getElementById('toastContainer');
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

async function validateAdmision(admision, excludeId = null) {
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

async function getProductoByCodigo(codigo) {
    if (!codigo) return null;
    const q = query(collection(db, "productos"), where("codigo", "==", codigo.trim().toUpperCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('loading');
    const registrarTable = document.getElementById('registrarTable');
    const registrarBody = registrarTable.querySelector('tbody');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    const pageNumbers = document.getElementById('pageNumbers');
    const paginationInfo = document.getElementById('paginationInfo');
    const registrarBtn = document.getElementById('registrarBtn');
    const limpiarBtn = document.getElementById('limpiarBtn');
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
    const buscarAdmisionInput = document.getElementById('buscarAdmision');
    const buscarPacienteInput = document.getElementById('buscarPaciente');
    const buscarMedicoInput = document.getElementById('buscarMedico');
    const buscarDescripcionInput = document.getElementById('buscarDescripcion');
    const buscarProveedorInput = document.getElementById('buscarProveedor');
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
    const downloadCurrent = document.getElementById('downloadCurrent');
    const editModal = document.getElementById('editModal');
    const deleteModal = document.getElementById('deleteModal');
    const historyModal = document.getElementById('historyModal');
    const editAdmisionInput = document.getElementById('editAdmision');
    const editPacienteInput = document.getElementById('editPaciente');
    const editMedicoInput = document.getElementById('editMedico');
    const editFechaCXInput = document.getElementById('editFechaCX');
    const editCodigoInput = document.getElementById('editCodigo');
    const editDescripcionInput = document.getElementById('editDescripcion');
    const editCantidadInput = document.getElementById('editCantidad');
    const editReferenciaInput = document.getElementById('editReferencia');
    const editProveedorInput = document.getElementById('editProveedor');
    const editPrecioUnitarioInput = document.getElementById('editPrecioUnitario');
    const editAtributoInput = document.getElementById('editAtributo');
    const editTotalItemsInput = document.getElementById('editTotalItems');
    const saveEditBtn = document.getElementById('saveEditBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const medicoToggle = document.getElementById('medicoToggle');
    const medicoDropdown = document.getElementById('medicoDropdown');
    const editMedicoToggle = document.getElementById('editMedicoToggle');
    const editMedicoDropdown = document.getElementById('editMedicoDropdown');
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
    formatMontoInput(editPrecioUnitarioInput);

    function enforceUpperCase(input) {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    [admisionInput, pacienteInput, medicoInput, codigoInput, descripcionInput, referenciaInput, proveedorInput, atributoInput,
        editAdmisionInput, editPacienteInput, editMedicoInput, editCodigoInput, editDescripcionInput, editReferenciaInput, editProveedorInput, editAtributoInput]
        .forEach(input => input && enforceUpperCase(input));

    function clearForm() {
        admisionInput.value = '';
        pacienteInput.value = '';
        medicoInput.value = '';
        fechaCXInput.value = '';
        codigoInput.value = '';
        descripcionInput.value = '';
        cantidadInput.value = '';
        referenciaInput.value = '';
        proveedorInput.value = '';
        precioUnitarioInput.value = '';
        atributoInput.value = '';
        totalItemsInput.value = '';
        medicoDropdown.classList.remove('show');
    }

    window.showLoading = function () {
        if (loading) loading.classList.add('show');
    };

    window.hideLoading = function () {
        if (loading) loading.classList.remove('show');
    };

    function closeModal(modal) {
        modal.style.display = 'none';
        if (modal === editModal) {
            currentEditId = null;
            currentEditOldData = null;
            editMedicoDropdown.classList.remove('show');
        } else if (modal === deleteModal) {
            currentDeleteId = null;
            currentDeleteAdmision = null;
        } else if (modal === historyModal) {
            historyContent.innerHTML = '';
        }
    }

    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeModal(closeBtn.closest('.modal'));
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });

    cancelEditBtn.addEventListener('click', () => closeModal(editModal));
    cancelDeleteBtn.addEventListener('click', () => closeModal(deleteModal));

    async function loadRegistros() {
        showLoading();
        try {
            let q = query(collection(db, "registrar_consignacion"), orderBy("fechaCX", "desc"));
            const conditions = [];

            if (searchAdmision) {
                conditions.push(where("admision", ">=", searchAdmision));
                conditions.push(where("admision", "<=", searchAdmision + '\uf8ff'));
            }
            if (searchPaciente) {
                conditions.push(where("paciente", ">=", searchPaciente));
                conditions.push(where("paciente", "<=", searchPaciente + '\uf8ff'));
            }
            if (searchMedico) {
                conditions.push(where("medico", ">=", searchMedico));
                conditions.push(where("medico", "<=", searchMedico + '\uf8ff'));
            }
            if (searchProveedor) {
                conditions.push(where("proveedor", ">=", searchProveedor));
                conditions.push(where("proveedor", "<=", searchProveedor + '\uf8ff'));
            }
            if (dateFilter === 'day' && fechaDia) {
                const start = new Date(fechaDia);
                const end = new Date(fechaDia);
                end.setDate(end.getDate() + 1);
                conditions.push(where("fechaCX", ">=", start));
                conditions.push(where("fechaCX", "<", end));
            } else if (dateFilter === 'week' && fechaDesde && fechaHasta) {
                conditions.push(where("fechaCX", ">=", new Date(fechaDesde)));
                conditions.push(where("fechaCX", "<=", new Date(fechaHasta)));
            } else if (dateFilter === 'month' && mes && anio) {
                const start = new Date(anio, mes - 1, 1);
                const end = new Date(anio, mes, 1);
                conditions.push(where("fechaCX", ">=", start));
                conditions.push(where("fechaCX", "<", end));
            }

            if (currentPage > 1 && lastVisible) {
                conditions.push(startAfter(lastVisible));
            }
            conditions.push(limit(PAGE_SIZE));

            q = query(q, ...conditions);

            const querySnapshot = await getDocs(q);
            let tempRegistros = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                try {
                    data.fechaCX = parseFechaCX(data.fechaCX);
                    tempRegistros.push({ id: doc.id, ...data });
                } catch (error) {
                    console.warn(`Error al procesar fechaCX para el documento ${doc.id}:`, error);
                    data.fechaCX = null;
                    tempRegistros.push({ id: doc.id, ...data });
                }
            });

            if (searchDescripcion) {
                tempRegistros = tempRegistros.filter(reg => 
                    reg.descripcion && reg.descripcion.toUpperCase().includes(searchDescripcion)
                );
            }

            registros = tempRegistros;

            if (querySnapshot.docs.length > 0) {
                lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
                firstVisible = querySnapshot.docs[0];
            } else {
                lastVisible = null;
                firstVisible = null;
            }

            let countQuery = query(collection(db, "registrar_consignacion"));
            if (searchAdmision) {
                countQuery = query(countQuery,
                    where("admision", ">=", searchAdmision),
                    where("admision", "<=", searchAdmision + '\uf8ff')
                );
            }
            if (searchPaciente) {
                countQuery = query(countQuery,
                    where("paciente", ">=", searchPaciente),
                    where("paciente", "<=", searchPaciente + '\uf8ff')
                );
            }
            if (searchMedico) {
                countQuery = query(countQuery,
                    where("medico", ">=", searchMedico),
                    where("medico", "<=", searchMedico + '\uf8ff')
                );
            }
            if (searchProveedor) {
                countQuery = query(countQuery,
                    where("proveedor", ">=", searchProveedor),
                    where("proveedor", "<=", searchProveedor + '\uf8ff')
                );
            }
            if (dateFilter === 'day' && fechaDia) {
                const start = new Date(fechaDia);
                const end = new Date(fechaDia);
                end.setDate(end.getDate() + 1);
                countQuery = query(countQuery,
                    where("fechaCX", ">=", start),
                    where("fechaCX", "<", end)
                );
            } else if (dateFilter === 'week' && fechaDesde && fechaHasta) {
                countQuery = query(countQuery,
                    where("fechaCX", ">=", new Date(fechaDesde)),
                    where("fechaCX", "<=", new Date(fechaHasta))
                );
            } else if (dateFilter === 'month' && mes && anio) {
                const start = new Date(anio, mes - 1, 1);
                const end = new Date(anio, mes, 1);
                countQuery = query(countQuery,
                    where("fechaCX", ">=", start),
                    where("fechaCX", "<", end)
                );
            }

            const countSnapshot = await getDocs(countQuery);
            totalRecords = countSnapshot.size;

            if (searchDescripcion) {
                totalRecords = registros.length;
            }

            renderTable();
            hideLoading();
        } catch (error) {
            hideLoading();
            showToast('Error al cargar los registros: ' + error.message, 'error');
            console.error('Detalles del error:', error);
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
                        <td>${registro.admision || ''}</td>
                        <td>${registro.paciente || ''}</td>
                        <td>${registro.medico || ''}</td>
                        <td>${registro.fechaCX ? registro.fechaCX.toLocaleDateString('es-CL') : ''}</td>
                        <td>${registro.codigo || ''}</td>
                        <td>${registro.descripcion || ''}</td>
                        <td>${registro.cantidad || ''}</td>
                        <td>${registro.referencia || ''}</td>
                        <td>${registro.proveedor || ''}</td>
                        <td>${formatNumberWithThousandsSeparator(registro.precioUnitario)}</td>
                        <td>${registro.atributo || ''}</td>
                        <td>${registro.totalItems || ''}</td>
                        <td class="registrar-actions">
                            <button title="Editar" class="registrar-btn-edit" onclick="openEditModal('${registro.id}', ${JSON.stringify(registro).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                            <button title="Eliminar" class="registrar-btn-delete" onclick="openDeleteModal('${registro.id}', '${registro.admision}')"><i class="fas fa-trash"></i></button>
                            <button title="Ver Historial" class="registrar-btn-history" onclick="openHistoryModal('${registro.id}', '${registro.admision}')"><i class="fas fa-history"></i></button>
                        </td>
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

        if (prevPage) prevPage.disabled = currentPage === 1;
        if (nextPage) nextPage.disabled = currentPage === totalPages;

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

    if (prevPage) {
        prevPage.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadRegistros();
            }
        });
    }

    if (nextPage) {
        nextPage.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
            if (currentPage < totalPages) {
                currentPage++;
                loadRegistros();
            }
        });
    }

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

    if (buscarMedicoInput) {
        buscarMedicoInput.addEventListener('input', (e) => {
            searchMedico = e.target.value.trim().toUpperCase();
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

    if (dateDay) {
        dateDay.addEventListener('change', (e) => {
            if (e.target.checked) {
                dateFilter = 'day';
                fechaDia = fechaDiaInput.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (dateWeek) {
        dateWeek.addEventListener('change', (e) => {
            if (e.target.checked) {
                dateFilter = 'week';
                fechaDesde = fechaDesdeInput.value;
                fechaHasta = fechaHastaInput.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (dateMonth) {
        dateMonth.addEventListener('change', (e) => {
            if (e.target.checked) {
                dateFilter = 'month';
                mes = mesSelect.value;
                anio = anioSelect.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (fechaDiaInput) {
        fechaDiaInput.addEventListener('change', (e) => {
            if (dateDay.checked) {
                fechaDia = e.target.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (fechaDesdeInput) {
        fechaDesdeInput.addEventListener('change', (e) => {
            if (dateWeek.checked) {
                fechaDesde = e.target.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (fechaHastaInput) {
        fechaHastaInput.addEventListener('change', (e) => {
            if (dateWeek.checked) {
                fechaHasta = e.target.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (mesSelect) {
        mesSelect.addEventListener('change', (e) => {
            if (dateMonth.checked) {
                mes = e.target.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
            }
        });
    }

    if (anioSelect) {
        anioSelect.addEventListener('change', (e) => {
            if (dateMonth.checked) {
                anio = e.target.value;
                currentPage = 1;
                lastVisible = null;
                firstVisible = null;
                debouncedLoadRegistros();
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

    downloadAll.addEventListener('click', async (e) => {
        e.preventDefault();
        showLoading();
        try {
            const q = query(collection(db, "registrar_consignacion"), orderBy("fechaCX", "desc"));
            const querySnapshot = await getDocs(q);
            const allRegistros = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                data.fechaCX = parseFechaCX(data.fechaCX);
                allRegistros.push({ id: doc.id, ...data });
            });
            const data = allRegistros.map(reg => ({
                Admisión: reg.admision || '',
                Paciente: reg.paciente || '',
                Médico: reg.medico || '',
                'Fecha CX': reg.fechaCX ? reg.fechaCX.toLocaleDateString('es-CL') : '',
                Código: reg.codigo || '',
                Descripción: reg.descripcion || '',
                Cantidad: reg.cantidad || '',
                Referencia: reg.referencia || '',
                Proveedor: reg.proveedor || '',
                'Precio Unitario': reg.precioUnitario ? formatNumberWithThousandsSeparator(reg.precioUnitario) : '',
                Atributo: reg.atributo || '',
                'Total Items': reg.totalItems || ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');
            XLSX.writeFile(workbook, 'registros_completos.xlsx');
            showToast('Registros completos descargados con éxito', 'success');
            hideLoading();
        } catch (error) {
            hideLoading();
            showToast('Error al descargar registros: ' + error.message, 'error');
        }
    });

    downloadCurrent.addEventListener('click', (e) => {
        e.preventDefault();
        const data = registros.map(reg => ({
            Admisión: reg.admision || '',
            Paciente: reg.paciente || '',
            Médico: reg.medico || '',
            'Fecha CX': reg.fechaCX ? reg.fechaCX.toLocaleDateString('es-CL') : '',
            Código: reg.codigo || '',
            Descripción: reg.descripcion || '',
            Cantidad: reg.cantidad || '',
            Referencia: reg.referencia || '',
            Proveedor: reg.proveedor || '',
            'Precio Unitario': reg.precioUnitario ? formatNumberWithThousandsSeparator(reg.precioUnitario) : '',
            Atributo: reg.atributo || '',
            'Total Items': reg.totalItems || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Hoja Actual');
        XLSX.writeFile(workbook, 'registros_hoja_actual.xlsx');
        showToast('Hoja actual descargada con éxito', 'success');
    });

    registrarBtn.addEventListener('click', async () => {
        showLoading();
        try {
            const admision = admisionInput.value.trim().toUpperCase();
            const paciente = pacienteInput.value.trim().toUpperCase();
            const medico = medicoInput.value.trim();
            const fechaCX = fechaCXInput.value ? new Date(fechaCXInput.value) : null;
            const codigo = codigoInput.value.trim().toUpperCase();
            const descripcion = descripcionInput.value.trim().toUpperCase();
            const cantidad = parseInt(cantidadInput.value) || 0;

            if (!admision || !paciente || !medico || !fechaCX || !codigo || !descripcion || !cantidad) {
                showToast('Por favor, completa todos los campos requeridos.', 'error');
                hideLoading();
                return;
            }

            const existingAdmision = await validateAdmision(admision);
            if (existingAdmision) {
                showToast('El número de admisión ya existe.', 'error');
                hideLoading();
                return;
            }

            const producto = await getProductoByCodigo(codigo);
            if (!producto) {
                showToast('Código de producto no encontrado.', 'error');
                hideLoading();
                return;
            }

            const totalItems = producto.precioUnitario * cantidad;

            const registro = {
                admision,
                paciente,
                medico,
                fechaCX,
                codigo,
                descripcion,
                cantidad,
                referencia: producto.referencia || '',
                proveedor: producto.proveedor || '',
                precioUnitario: producto.precioUnitario || 0,
                atributo: producto.atributo || '',
                totalItems
            };

            const docRef = await addDoc(collection(db, "registrar_consignacion"), registro);
            await logAction(docRef.id, 'create', null, registro);
            showToast('Registro añadido con éxito', 'success');
            clearForm();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            await loadRegistros();
        } catch (error) {
            showToast('Error al registrar: ' + error.message, 'error');
            hideLoading();
        }
    });

    limpiarBtn.addEventListener('click', clearForm);

    window.openEditModal = function (id, registro) {
        currentEditId = id;
        currentEditOldData = { ...registro };
        editAdmisionInput.value = registro.admision || '';
        editPacienteInput.value = registro.paciente || '';
        editMedicoInput.value = registro.medico || '';
        editFechaCXInput.value = registro.fechaCX ? registro.fechaCX.toISOString().split('T')[0] : '';
        editCodigoInput.value = registro.codigo || '';
        editDescripcionInput.value = registro.descripcion || '';
        editCantidadInput.value = registro.cantidad || '';
        editReferenciaInput.value = registro.referencia || '';
        editProveedorInput.value = registro.proveedor || '';
        editPrecioUnitarioInput.value = registro.precioUnitario ? formatNumberWithThousandsSeparator(registro.precioUnitario) : '';
        editAtributoInput.value = registro.atributo || '';
        editTotalItemsInput.value = registro.totalItems || '';
        editModal.style.display = 'block';
    };

    saveEditBtn.addEventListener('click', async () => {
        showLoading();
        try {
            const admision = editAdmisionInput.value.trim().toUpperCase();
            const paciente = editPacienteInput.value.trim().toUpperCase();
            const medico = editMedicoInput.value.trim();
            const fechaCX = editFechaCXInput.value ? new Date(editFechaCXInput.value) : null;
            const codigo = editCodigoInput.value.trim().toUpperCase();
            const descripcion = editDescripcionInput.value.trim().toUpperCase();
            const cantidad = parseInt(editCantidadInput.value) || 0;

            if (!admision || !paciente || !medico || !fechaCX || !codigo || !descripcion || !cantidad) {
                showToast('Por favor, completa todos los campos requeridos.', 'error');
                hideLoading();
                return;
            }

            const existingAdmision = await validateAdmision(admision, currentEditId);
            if (existingAdmision) {
                showToast('El número de admisión ya existe.', 'error');
                hideLoading();
                return;
            }

            const producto = await getProductoByCodigo(codigo);
            if (!producto) {
                showToast('Código de producto no encontrado.', 'error');
                hideLoading();
                return;
            }

            const totalItems = producto.precioUnitario * cantidad;

            const updatedRegistro = {
                admision,
                paciente,
                medico,
                fechaCX,
                codigo,
                descripcion,
                cantidad,
                referencia: producto.referencia || '',
                proveedor: producto.proveedor || '',
                precioUnitario: producto.precioUnitario || 0,
                atributo: producto.atributo || '',
                totalItems
            };

            const docRef = doc(db, "registrar_consignacion", currentEditId);
            await updateDoc(docRef, updatedRegistro);
            await logAction(currentEditId, 'update', currentEditOldData, updatedRegistro);
            showToast('Registro actualizado con éxito', 'success');
            closeModal(editModal);
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            await loadRegistros();
        } catch (error) {
            showToast('Error al actualizar: ' + error.message, 'error');
            hideLoading();
        }
    });

    window.openDeleteModal = function (id, admision) {
        currentDeleteId = id;
        currentDeleteAdmision = admision;
        deleteModal.style.display = 'block';
    };

    confirmDeleteBtn.addEventListener('click', async () => {
        showLoading();
        try {
            const docRef = doc(db, "registrar_consignacion", currentDeleteId);
            const registroData = registros.find(reg => reg.id === currentDeleteId);
            await deleteDoc(docRef);
            await logAction(currentDeleteId, 'delete', registroData);
            showToast('Registro eliminado con éxito', 'success');
            closeModal(deleteModal);
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            await loadRegistros();
        } catch (error) {
            showToast('Error al eliminar: ' + error.message, 'error');
            hideLoading();
        }
    });

    window.openHistoryModal = async function (id, admision) {
        showLoading();
        try {
            const q = query(collection(db, "registrar_consignacion_historial"), where("registroId", "==", id), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            historyContent.innerHTML = '';
            if (querySnapshot.empty) {
                historyContent.innerHTML = '<p>No hay historial para este registro.</p>';
            } else {
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const entry = document.createElement('div');
                    entry.className = 'history-entry';
                    entry.innerHTML = `
                        <p><strong>Acción:</strong> ${data.action}</p>
                        <p><strong>Usuario:</strong> ${data.userFullName} (${data.username})</p>
                        <p><strong>Fecha:</strong> ${data.timestamp.toDate().toLocaleString('es-CL')}</p>
                        ${data.oldData ? `<p><strong>Datos Antiguos:</strong> ${JSON.stringify(data.oldData, null, 2)}</p>` : ''}
                        ${data.newData ? `<p><strong>Datos Nuevos:</strong> ${JSON.stringify(data.newData, null, 2)}</p>` : ''}
                    `;
                    historyContent.appendChild(entry);
                });
            }
            historyModal.style.display = 'block';
            hideLoading();
        } catch (error) {
            showToast('Error al cargar historial: ' + error.message, 'error');
            hideLoading();
        }
    };

    codigoInput.addEventListener('blur', async () => {
        const codigo = codigoInput.value.trim().toUpperCase();
        if (codigo) {
            const producto = await getProductoByCodigo(codigo);
            if (producto) {
                descripcionInput.value = producto.descripcion || '';
                referenciaInput.value = producto.referencia || '';
                proveedorInput.value = producto.proveedor || '';
                precioUnitarioInput.value = producto.precioUnitario ? formatNumberWithThousandsSeparator(producto.precioUnitario) : '';
                atributoInput.value = producto.atributo || '';
                const cantidad = parseInt(cantidadInput.value) || 0;
                totalItemsInput.value = cantidad && producto.precioUnitario ? cantidad * producto.precioUnitario : '';
            } else {
                showToast('Código no encontrado.', 'error');
            }
        }
    });

    editCodigoInput.addEventListener('blur', async () => {
        const codigo = editCodigoInput.value.trim().toUpperCase();
        if (codigo) {
            const producto = await getProductoByCodigo(codigo);
            if (producto) {
                editDescripcionInput.value = producto.descripcion || '';
                editReferenciaInput.value = producto.referencia || '';
                editProveedorInput.value = producto.proveedor || '';
                editPrecioUnitarioInput.value = producto.precioUnitario ? formatNumberWithThousandsSeparator(producto.precioUnitario) : '';
                editAtributoInput.value = producto.atributo || '';
                const cantidad = parseInt(editCantidadInput.value) || 0;
                editTotalItemsInput.value = cantidad && producto.precioUnitario ? cantidad * producto.precioUnitario : '';
            } else {
                showToast('Código no encontrado.', 'error');
            }
        }
    });

    cantidadInput.addEventListener('input', () => {
        const cantidad = parseInt(cantidadInput.value) || 0;
        const precioUnitario = parseInt(precioUnitarioInput.value.replace(/[^\d]/g, '')) || 0;
        totalItemsInput.value = cantidad && precioUnitario ? cantidad * precioUnitario : '';
    });

    editCantidadInput.addEventListener('input', () => {
        const cantidad = parseInt(editCantidadInput.value) || 0;
        const precioUnitario = parseInt(editPrecioUnitarioInput.value.replace(/[^\d]/g, '')) || 0;
        editTotalItemsInput.value = cantidad && precioUnitario ? cantidad * precioUnitario : '';
    });

    function populateAnioSelect() {
        const currentYear = new Date().getFullYear();
        for (let year = currentYear - 5; year <= currentYear + 5; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) option.selected = true;
            anioSelect.appendChild(option);
        }
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            window.currentUserData = userDoc.exists() ? userDoc.data() : {};
            await loadMedicos();
            setupAutocomplete('medico', 'medicoToggle', 'medicoDropdown');
            setupAutocomplete('editMedico', 'editMedicoToggle', 'editMedicoDropdown');
            populateAnioSelect();
            await loadRegistros();
        } else {
            window.location.href = 'index.html';
        }
    });
});