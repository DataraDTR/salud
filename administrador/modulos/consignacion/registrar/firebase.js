// CARGAR MÉDICOS
async function loadMedicos(db) {
    try {
        const querySnapshot = await getDocs(collection(db, "medicos"));
        window.medicos = [];
        querySnapshot.forEach((doc) => {
            window.medicos.push({ id: doc.id, ...doc.data() });
        });
        window.medicos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (error) {
        showToast('Error al cargar médicos: ' + error.message, 'error');
    }
}

// CARGAR REFERENCIAS
async function loadReferencias(db) {
    try {
        const querySnapshot = await getDocs(collection(db, "referencias_implantes"));
        window.referencias = [];
        querySnapshot.forEach((doc) => {
            window.referencias.push({ id: doc.id, ...doc.data() });
        });
        window.referencias.sort((a, b) => a.codigo.localeCompare(b.codigo));
    } catch (error) {
        showToast('Error al cargar referencias: ' + error.message, 'error');
    }
}

// VALIDAR ADMISIÓN
async function validateAdmision(db, admision, excludeId = null) {
    if (!admision?.trim()) return null;
    
    try {
        const q = query(
            collection(db, "registrar_consignacion"), 
            where("admision", "==", admision.trim().toUpperCase())
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) return null;
        
        const doc = querySnapshot.docs[0];
        if (excludeId && doc.id === excludeId) return null;
        
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        console.error('Error validating admision:', error);
        return null;
    }
}

// OBTENER PRODUCTO POR CÓDIGO
async function getProductoByCodigo(db, codigo) {
    if (!codigo?.trim()) return null;
    
    try {
        const q = query(
            collection(db, "productos"), 
            where("codigo", "==", codigo.trim().toUpperCase())
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) return null;
        
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        console.error('Error getting product by code:', error);
        return null;
    }
}

// OBTENER REFERENCIA POR DESCRIPCIÓN
async function getReferenciaByDescripcion(db, descripcion) {
    if (!descripcion?.trim()) return null;
    
    try {
        const q = query(
            collection(db, "referencias_implantes"), 
            where("descripcion", "==", descripcion.trim().toUpperCase())
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) return null;
        
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        console.error('Error getting referencia by descripcion:', error);
        return null;
    }
}

// LOG ACCIONES
async function logAction(db, auth, registroId, action, oldData = null, newData = null) {
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

// CARGAR REGISTROS
async function loadRegistros(db, currentPage, searchParams, dateFilter) {
    window.showLoading();
    try {
        let q = query(collection(db, "registrar_consignacion"), orderBy("fechaCX", "desc"));
        const conditions = [];

        const { searchAdmision, searchPaciente, searchMedico, searchDescripcion, searchProveedor } = searchParams;

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

        const { type, fechaDia, fechaDesde, fechaHasta, mes, anio } = dateFilter;
        
        if (type === 'day' && fechaDia) {
            const start = new Date(fechaDia);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            end.setHours(0, 0, 0, 0);
            conditions.push(where("fechaCX", ">=", start));
            conditions.push(where("fechaCX", "<", end));
        } else if (type === 'week' && fechaDesde && fechaHasta) {
            conditions.push(where("fechaCX", ">=", new Date(fechaDesde)));
            conditions.push(where("fechaCX", "<=", new Date(fechaHasta)));
        } else if (type === 'month' && mes && anio) {
            const start = new Date(parseInt(anio), parseInt(mes) - 1, 1);
            const end = new Date(parseInt(anio), parseInt(mes), 0);
            conditions.push(where("fechaCX", ">=", start));
            conditions.push(where("fechaCX", "<=", end));
        }

        if (currentPage > 1 && window.lastVisible) {
            conditions.push(startAfter(window.lastVisible));
        }
        conditions.push(limit(50));

        q = query(q, ...conditions);
        const querySnapshot = await getDocs(q);

        let tempRegistros = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const registro = { id: doc.id, ...data };
            registro.fechaCX = parseFechaCX(data.fechaCX);
            tempRegistros.push(registro);
        });

        if (searchDescripcion) {
            tempRegistros = tempRegistros.filter(reg => 
                reg.descripcion?.toUpperCase().includes(searchDescripcion.toUpperCase())
            );
        }

        window.registros = tempRegistros;

        if (querySnapshot.docs.length > 0) {
            window.lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
            window.firstVisible = querySnapshot.docs[0];
        } else {
            window.lastVisible = null;
            window.firstVisible = null;
        }

        const totalRecords = await getTotalRecordsCount(db, searchParams, dateFilter);
        renderTable(tempRegistros, totalRecords);
        
        return { registros: tempRegistros, totalRecords };
    } catch (error) {
        console.error('Error loading registros:', error);
        showToast('Error al cargar los registros: ' + error.message, 'error');
        return { registros: [], totalRecords: 0 };
    } finally {
        window.hideLoading();
    }
}

// CONTAR REGISTROS
async function getTotalRecordsCount(db, searchParams, dateFilter) {
    try {
        let countQuery = query(collection(db, "registrar_consignacion"));
        
        const { searchAdmision, searchPaciente, searchMedico, searchProveedor } = searchParams;
        const { type, fechaDia, fechaDesde, fechaHasta, mes, anio } = dateFilter;

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

        if (type === 'day' && fechaDia) {
            const start = new Date(fechaDia);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            countQuery = query(countQuery,
                where("fechaCX", ">=", start),
                where("fechaCX", "<", end)
            );
        } else if (type === 'week' && fechaDesde && fechaHasta) {
            countQuery = query(countQuery,
                where("fechaCX", ">=", new Date(fechaDesde)),
                where("fechaCX", "<=", new Date(fechaHasta))
            );
        } else if (type === 'month' && mes && anio) {
            const start = new Date(parseInt(anio), parseInt(mes) - 1, 1);
            const end = new Date(parseInt(anio), parseInt(mes), 0);
            countQuery = query(countQuery,
                where("fechaCX", ">=", start),
                where("fechaCX", "<=", end)
            );
        }

        const countSnapshot = await getDocs(countQuery);
        return searchParams.searchDescripcion ? window.registros.length : countSnapshot.size;
    } catch (error) {
        console.error('Error counting records:', error);
        return 0;
    }
}

// CREAR REGISTRO
async function createRegistro(db, auth, formData) {
    const { admision, paciente, medico, fechaCX, codigo, descripcion, cantidad } = formData;

    const existing = await validateAdmision(db, admision);
    if (existing) {
        showToast(`❌ La admisión ${admision} ya existe`, 'error');
        return false;
    }

    window.showLoading();
    try {
        let precioUnitario = 0, referencia = '', proveedor = '', atributo = '';

        if (codigo) {
            const producto = await getProductoByCodigo(db, codigo);
            if (producto) {
                precioUnitario = producto.precioUnitario || 0;
                referencia = producto.referencia || '';
                proveedor = producto.proveedor || '';
                atributo = producto.atributo || '';
                descripcion = producto.descripcion || descripcion;
            }
        } else if (descripcion) {
            const refData = await getReferenciaByDescripcion(db, descripcion);
            if (refData) {
                precioUnitario = refData.precioUnitario || 0;
                referencia = refData.referencia || '';
                proveedor = refData.proveedor || '';
                atributo = refData.atributo || '';
                codigo = refData.codigo || codigo;
            }
        }

        const totalItems = cantidad * precioUnitario;

        const registroData = {
            admision,
            paciente,
            medico,
            fechaCX,
            codigo: codigo || '',
            descripcion,
            cantidad,
            referencia,
            proveedor,
            precioUnitario,
            atributo,
            totalItems,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const docRef = await addDoc(collection(db, "registrar_consignacion"), registroData);
        await logAction(db, auth, docRef.id, 'CREADO', null, registroData);

        showToast('✅ Registro creado exitosamente', 'success');
        clearForm();
        window.currentPage = 1;
        window.lastVisible = null;
        await loadRegistros(db, window.currentPage, window.searchParams, window.dateFilter);
        return true;
    } catch (error) {
        console.error('Error creating registro:', error);
        showToast('❌ Error al crear registro: ' + error.message, 'error');
        return false;
    } finally {
        window.hideLoading();
    }
}

// ACTUALIZAR REGISTRO
async function updateRegistro(db, auth, registroId, formData) {
    const { admision, paciente, medico, fechaCX, codigo, descripcion, cantidad } = formData;

    const existing = await validateAdmision(db, admision, registroId);
    if (existing) {
        showToast(`❌ La admisión ${admision} ya existe en otro registro`, 'error');
        return false;
    }

    window.showLoading();
    try {
        let precioUnitario = parseInt(document.getElementById('editPrecioUnitario')?.value?.replace(/[^\d]/g, '')) || 0;
        let referencia = document.getElementById('editReferencia')?.value?.trim() || '';
        let proveedor = document.getElementById('editProveedor')?.value?.trim() || '';
        let atributo = document.getElementById('editAtributo')?.value?.trim() || '';

        if (codigo) {
            const producto = await getProductoByCodigo(db, codigo);
            if (producto) {
                precioUnitario = producto.precioUnitario || precioUnitario;
                referencia = producto.referencia || referencia;
                proveedor = producto.proveedor || proveedor;
                atributo = producto.atributo || atributo;
                descripcion = producto.descripcion || descripcion;
            }
        } else if (descripcion) {
            const refData = await getReferenciaByDescripcion(db, descripcion);
            if (refData) {
                precioUnitario = refData.precioUnitario || precioUnitario;
                referencia = refData.referencia || referencia;
                proveedor = refData.proveedor || proveedor;
                atributo = refData.atributo || atributo;
                codigo = refData.codigo || codigo;
            }
        }

        const totalItems = cantidad * precioUnitario;

        const updatedData = {
            admision,
            paciente,
            medico,
            fechaCX,
            codigo: codigo || '',
            descripcion,
            cantidad,
            referencia,
            proveedor,
            precioUnitario,
            atributo,
            totalItems,
            updatedAt: new Date()
        };

        await updateDoc(doc(db, "registrar_consignacion", registroId), updatedData);
        await logAction(db, auth, registroId, 'MODIFICADO', window.currentEditOldData, updatedData);

        showToast('✅ Registro actualizado exitosamente', 'success');
        closeModal(document.getElementById('editModal'));
        await loadRegistros(db, window.currentPage, window.searchParams, window.dateFilter);
        return true;
    } catch (error) {
        console.error('Error updating registro:', error);
        showToast('❌ Error al actualizar registro: ' + error.message, 'error');
        return false;
    } finally {
        window.hideLoading();
    }
}

// ELIMINAR REGISTRO
async function deleteRegistro(db, auth, registroId) {
    window.showLoading();
    try {
        const registroRef = doc(db, "registrar_consignacion", registroId);
        const registroSnap = await getDoc(registroRef);
        const registroData = registroSnap.data();

        await deleteDoc(registroRef);
        await logAction(db, auth, registroId, 'ELIMINADO', registroData, null);

        showToast('✅ Registro eliminado exitosamente', 'success');
        closeModal(document.getElementById('deleteModal'));
        await loadRegistros(db, window.currentPage, window.searchParams, window.dateFilter);
        return true;
    } catch (error) {
        console.error('Error deleting registro:', error);
        showToast('❌ Error al eliminar registro: ' + error.message, 'error');
        return false;
    } finally {
        window.hideLoading();
    }
}

// HISTORIAL
async function loadHistory(db, registroId, admision) {
    window.showLoading();
    try {
        const q = query(
            collection(db, "registrar_consignacion_historial"), 
            where("registroId", "==", registroId), 
            orderBy("timestamp", "desc"),
            limit(50)
        );
        
        const querySnapshot = await getDocs(q);
        const historyContent = document.getElementById('historyContent');

        historyContent.innerHTML = `
            <div class="history-header">
                <h3>Historial de Admision: ${escapeHtml(admision)}</h3>
                <button class="btn-close-history" onclick="closeModal(document.getElementById('historyModal'))">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        if (querySnapshot.empty) {
            historyContent.innerHTML += '<div class="no-history">No hay historial de cambios</div>';
        } else {
            historyContent.innerHTML += '<div class="history-list">';
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const entry = document.createElement('div');
                entry.className = 'history-entry';
                entry.innerHTML = `
                    <div class="history-header">
                        <span class="action-badge ${data.action.toLowerCase()}">${data.action}</span>
                        <span class="history-date">${data.timestamp?.toDate()?.toLocaleString('es-CL') || 'N/A'}</span>
                    </div>
                    <div class="history-user">Por: ${escapeHtml(data.userFullName || 'N/A')}</div>
                    ${data.oldData || data.newData ? `
                        <div class="history-changes">
                            ${data.oldData ? `<div class="change-section"><strong>Antes:</strong> ${JSON.stringify(data.oldData, null, 2)}</div>` : ''}
                            ${data.newData ? `<div class="change-section"><strong>Después:</strong> ${JSON.stringify(data.newData, null, 2)}</div>` : ''}
                        </div>
                    ` : ''}
                `;
                historyContent.appendChild(entry);
            });
            historyContent.innerHTML += '</div>';
        }

        document.getElementById('historyModal').style.display = 'block';
    } catch (error) {
        console.error('Error loading history:', error);
        showToast('Error al cargar historial: ' + error.message, 'error');
    } finally {
        window.hideLoading();
    }
}