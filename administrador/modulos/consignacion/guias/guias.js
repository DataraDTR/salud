const { initializeApp, getAuth, onAuthStateChanged, setPersistence, browserSessionPersistence, getFirestore, collection, addDoc, getDocs, query, where, doc, orderBy, getDoc, limit, startAfter, endBefore } = window.firebaseModules;

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

let guias = [];
let currentPage = 1;
const PAGE_SIZE = 50;
let lastVisible = null;
let firstVisible = null;
let searchFolio = '';
let searchEmpresa = '';
let searchFecha = '';
let totalRecords = 0;

async function parseXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");
    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
        throw new Error("Error al parsear XML");
    }

    const getText = (parent, tag) => {
        const elem = parent.querySelector(tag);
        return elem ? elem.textContent.trim() : '';
    };

    const dte = xmlDoc.querySelector("DTE");
    const documento = dte.querySelector("Documento");
    const encabezado = documento.querySelector("Encabezado");
    const idDoc = encabezado.querySelector("IdDoc");
    const emisor = encabezado.querySelector("Emisor");
    const referencia = documento.querySelector("Referencia");

    const parsedData = {
        folio: getText(idDoc, "Folio"),
        fchEmis: getText(idDoc, "FchEmis"),
        rznSoc: getText(emisor, "RznSoc"),
        folioRef: getText(referencia, "FolioRef"),
        fullData: {} // Para almacenar todos los datos parseados
    };

    // Parsear todos los datos en un objeto JSON
    const extractAll = (node) => {
        const obj = {};
        for (let child of node.children) {
            if (child.children.length > 0) {
                obj[child.tagName] = extractAll(child);
            } else {
                obj[child.tagName] = child.textContent.trim();
            }
        }
        return obj;
    };

    parsedData.fullData = extractAll(dte);

    return parsedData;
}

function setupColumnResize() {
    const table = document.querySelector('.guias-table');
    const headers = document.querySelectorAll('.guias-table th');

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
            const newWidth = Math.max(20, startWidth + (clientX - startX));

            header.style.width = `${newWidth}px`;
            header.style.minWidth = `${newWidth}px`;
            header.style.maxWidth = `${newWidth}px`;

            const cells = document.querySelectorAll(`.guias-table td:nth-child(${index + 1})`);
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
    const toastContainer = document.getElementById('guias-toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `guias-toast ${type}`;
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
    const loading = document.getElementById('guias-loading');
    const importProgress = document.getElementById('guias-import-progress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const guiasBody = document.getElementById('guiasBody');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageNumbers = document.getElementById('pageNumbers');
    const paginationInfo = document.getElementById('paginationInfo');
    const buscarFolioInput = document.getElementById('buscarFolio');
    const buscarEmpresaInput = document.getElementById('buscarEmpresa');
    const buscarFechaInput = document.getElementById('buscarFecha');
    const actionsBtn = document.getElementById('actionsBtn');
    const actionsMenu = document.getElementById('actionsMenu');
    const downloadAll = document.getElementById('downloadAll');
    const downloadPage = document.getElementById('downloadPage');
    const fileUpload = document.getElementById('fileUpload');
    const importBtn = document.getElementById('importBtn');
    const viewModal = document.getElementById('viewModal');
    const closeViewModal = document.getElementById('closeViewModal');
    const closeViewBtn = document.getElementById('closeViewBtn');
    const viewContent = document.getElementById('viewContent');

    let currentViewId = null;

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

    window.openViewModal = function (id) {
        currentViewId = id;
        showLoading();
        getDoc(doc(db, "guias_medtronic", id)).then((docSnap) => {
            hideLoading();
            if (docSnap.exists()) {
                const data = docSnap.data();
                viewContent.innerHTML = `<pre>${JSON.stringify(data.fullData, null, 2)}</pre>`;
                viewModal.style.display = 'block';
            } else {
                showToast('La guía no existe.', 'error');
            }
        }).catch((error) => {
            hideLoading();
            showToast('Error al cargar los detalles: ' + error.message, 'error');
        });
    };

    function closeViewModalHandler() {
        viewModal.style.display = 'none';
        currentViewId = null;
        viewContent.innerHTML = '';
    }

    closeViewModal.addEventListener('click', closeViewModalHandler);
    closeViewBtn.addEventListener('click', closeViewModalHandler);
    window.addEventListener('click', (e) => {
        if (e.target === viewModal) closeViewModalHandler();
    });

    const debouncedLoadGuias = debounce(loadGuias, 300);

    if (buscarFolioInput) {
        buscarFolioInput.addEventListener('input', (e) => {
            searchFolio = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadGuias();
        });
    }

    if (buscarEmpresaInput) {
        buscarEmpresaInput.addEventListener('input', (e) => {
            searchEmpresa = e.target.value.trim().toUpperCase();
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadGuias();
        });
    }

    if (buscarFechaInput) {
        buscarFechaInput.addEventListener('change', (e) => {
            searchFecha = e.target.value;
            currentPage = 1;
            lastVisible = null;
            firstVisible = null;
            debouncedLoadGuias();
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', () => {
            fileUpload.click();
        });
    }

    async function loadGuias() {
        showLoading();
        try {
            let q = query(collection(db, "guias_medtronic"), orderBy("createdAt", "desc"));
            const conditions = [];

            if (searchFolio) {
                conditions.push(where("folio", ">=", searchFolio));
                conditions.push(where("folio", "<=", searchFolio + '\uf8ff'));
            }
            if (searchEmpresa) {
                conditions.push(where("rznSoc", ">=", searchEmpresa));
                conditions.push(where("rznSoc", "<=", searchEmpresa + '\uf8ff'));
            }
            if (searchFecha) {
                conditions.push(where("fchEmis", "==", searchFecha));
            }

            if (currentPage > 1 && lastVisible) {
                conditions.push(startAfter(lastVisible));
            }
            conditions.push(limit(PAGE_SIZE));

            q = query(q, ...conditions);

            const querySnapshot = await getDocs(q);
            guias = [];
            querySnapshot.forEach((doc) => {
                guias.push({ id: doc.id, ...doc.data() });
            });

            if (querySnapshot.docs.length > 0) {
                lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
                firstVisible = querySnapshot.docs[0];
            } else {
                lastVisible = null;
                firstVisible = null;
            }

            let countQuery = query(collection(db, "guias_medtronic"));
            if (searchFolio) {
                countQuery = query(countQuery,
                    where("folio", ">=", searchFolio),
                    where("folio", "<=", searchFolio + '\uf8ff')
                );
            }
            if (searchEmpresa) {
                countQuery = query(countQuery,
                    where("rznSoc", ">=", searchEmpresa),
                    where("rznSoc", "<=", searchEmpresa + '\uf8ff')
                );
            }
            if (searchFecha) {
                countQuery = query(countQuery, where("fchEmis", "==", searchFecha));
            }

            const countSnapshot = await getDocs(countQuery);
            totalRecords = countSnapshot.size;

            await renderTable();
            hideLoading();
        } catch (error) {
            hideLoading();
            showToast('Error al cargar las guías: ' + error.message, 'error');
        }
    }

    async function renderTable() {
        if (guiasBody) {
            guiasBody.innerHTML = '';
            if (guias.length === 0) {
                guiasBody.innerHTML = '<tr><td colspan="5">No hay guías para mostrar.</td></tr>';
            } else {
                guias.forEach((guia) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="guias-actions">
                            <button title="Ver Detalles" class="guias-btn-view" onclick="openViewModal('${guia.id}')"><i class="fas fa-eye"></i></button>
                        </td>
                        <td>${guia.rznSoc || ''}</td>
                        <td>${guia.folio || ''}</td>
                        <td>${guia.fchEmis || ''}</td>
                        <td>${guia.folioRef || ''}</td>
                    `;
                    guiasBody.appendChild(row);
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
                    dots.className = 'guias-dots';
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
                    dots.className = 'guias-dots';
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
        loadGuias();
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadGuias();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
            if (currentPage < totalPages) {
                currentPage++;
                loadGuias();
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
            const q = query(collection(db, "guias_medtronic"));
            const querySnapshot = await getDocs(q);
            const allGuias = [];
            querySnapshot.forEach((doc) => {
                allGuias.push({ id: doc.id, ...doc.data() });
            });
            const data = allGuias.map(guia => ({
                Empresa: guia.rznSoc || '',
                Folio: guia.folio || '',
                'Fecha Emisión': guia.fchEmis || '',
                'Folio Referencia': guia.folioRef || ''
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Guias");
            XLSX.writeFile(wb, 'guias_todas.xlsx');
            actionsMenu.style.display = 'none';
            hideLoading();
        } catch (error) {
            hideLoading();
            showToast('Error al descargar las guías: ' + error.message, 'error');
        }
    });

    downloadPage.addEventListener('click', (e) => {
        e.preventDefault();
        const data = guias.map(guia => ({
            Empresa: guia.rznSoc || '',
            Folio: guia.folio || '',
            'Fecha Emisión': guia.fchEmis || '',
            'Folio Referencia': guia.folioRef || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Guias");
        XLSX.writeFile(wb, `guias_pagina_${currentPage}.xlsx`);
        actionsMenu.style.display = 'none';
    });

    fileUpload.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        showLoading();
        try {
            let successCount = 0;
            let errorCount = 0;
            const totalFiles = files.length;

            for (let i = 0; i < totalFiles; i++) {
                const file = files[i];
                const reader = new FileReader();
                await new Promise((resolve) => {
                    reader.onload = async (event) => {
                        try {
                            const xmlString = event.target.result;
                            const parsedData = await parseXML(xmlString);
                            await addDoc(collection(db, "guias_medtronic"), {
                                ...parsedData,
                                createdAt: new Date()
                            });
                            successCount++;
                        } catch (error) {
                            errorCount++;
                        }
                        const progress = ((i + 1) / totalFiles) * 100;
                        showImportProgress(progress);
                        resolve();
                    };
                    reader.readAsText(file);
                });
            }

            hideLoading();
            hideImportProgress();
            showToast(`Importación completada: ${successCount} guías exitosas, ${errorCount} errores`, successCount > 0 ? 'success' : 'error');
            fileUpload.value = '';
            await loadGuias();
        } catch (error) {
            hideLoading();
            hideImportProgress();
            showToast('Error al importar los archivos: ' + error.message, 'error');
            fileUpload.value = '';
        }
    });

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
            await loadGuias();
        } catch (error) {
            window.currentUserData = { fullName: 'Usuario Invitado', username: 'invitado' };
            showToast('Error al cargar datos del usuario.', 'error');
        }
    });
});