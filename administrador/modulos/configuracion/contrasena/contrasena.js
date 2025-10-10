import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

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

const form = document.getElementById('changePasswordForm');
const message = document.getElementById('message');
const changePasswordBtn = document.getElementById('changePasswordBtn');

onAuthStateChanged(auth, (user) => {
    if (!user) {
        showMessage('Debes estar autenticado para cambiar la contraseña.', 'error');
        setTimeout(() => {
            window.location.href = '../../../../index.html';
        }, 2000);
    }
});

function validatePassword(password) {
    const minLength = 8;
    const maxLength = 20;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength || password.length > maxLength) {
        return 'La contraseña debe tener entre 8 y 20 caracteres.';
    }
    if (!hasUpperCase) {
        return 'La contraseña debe contener al menos una letra mayúscula.';
    }
    if (!hasLowerCase) {
        return 'La contraseña debe contener al menos una letra minúscula.';
    }
    if (!hasNumber) {
        return 'La contraseña debe contener al menos un número.';
    }
    if (!hasSpecialChar) {
        return 'La contraseña debe contener al menos un carácter especial (!@#$%^&*).';
    }
    return null; // Contraseña válida
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const repeatNewPassword = document.getElementById('repeatNewPassword').value;

    if (!currentPassword || !newPassword || !repeatNewPassword) {
        showMessage('Por favor, complete todos los campos.', 'error');
        return;
    }

    if (newPassword !== repeatNewPassword) {
        showMessage('Las nuevas contraseñas no coinciden.', 'error');
        return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
        showMessage(passwordError, 'error');
        return;
    }

    changePasswordBtn.disabled = true;
    changePasswordBtn.textContent = 'Cambiando...';
    showMessage('Procesando cambio de contraseña...', 'loading');

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No hay usuario autenticado.');
        }

        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        await updatePassword(user, newPassword);

        showMessage('Contraseña cambiada exitosamente.', 'success');
        form.reset();
    } catch (error) {
        console.error('Error:', error);
        if (error.code === 'auth/wrong-password') {
            showMessage('La contraseña actual es incorrecta.', 'error');
        } else if (error.code === 'auth/too-many-requests') {
            showMessage('Demasiados intentos. Intente de nuevo más tarde.', 'error');
        } else {
            showMessage('Error al cambiar la contraseña: ' + error.message, 'error');
        }
        resetButtonState();
    }
});

function showMessage(text, type) {
    message.textContent = text;
    message.className = type;
    message.style.display = 'block';
    if (type !== 'loading') {
        setTimeout(() => {
            message.style.display = 'none';
        }, 5000);
    }
}

function resetButtonState() {
    changePasswordBtn.disabled = false;
    changePasswordBtn.textContent = 'Cambiar Contraseña';
}