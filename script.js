// 🚀 HVĚZDNÁ FLOTILA - OPRAVENÁ SCRIPT.JS 🚀
// Opraveno admirálem Claude.AI pro více admirála Jiříka
// ✅ FIX #1: Synchronizace passwordsBackup při každé změně
// ✅ FIX #2: Povinný backup setup pro existující uživatele
// ✅ FIX #3: BackupKey v paměti pro auto-sync

// ========================================
// 📦 GLOBÁLNÍ PROMĚNNÉ A KONSTANTY
// ========================================

const STORAGE_KEY = 'encryptedPasswords';
const EMAIL_KEY = 'registeredEmail';
const CACHE_TTL = 5000; // 5 sekund cache

// Bezpečnější správa masterKey pomocí closure
let masterKeyStore = (() => {
    let _key = '';
    return {
        set: (key) => { _key = key; },
        get: () => _key,
        clear: () => { _key = ''; },
        exists: () => _key.length > 0
    };
})();

// 🆕 NOVÉ: Backup Key Store (stejný pattern jako masterKey)
let backupKeyStore = (() => {
    let _key = '';
    return {
        set: (key) => { _key = key; },
        get: () => _key,
        clear: () => { _key = ''; },
        exists: () => _key.length > 0
    };
})();

let otpCode = '';
let isNewMasterKeySetup = false;

// Cache pro Firestore data
let passwordsCache = {
    data: null,
    timestamp: null,
    isValid() {
        return this.data !== null && 
               this.timestamp !== null && 
               (Date.now() - this.timestamp) < CACHE_TTL;
    },
    set(data) {
        this.data = data;
        this.timestamp = Date.now();
    },
    clear() {
        this.data = null;
        this.timestamp = null;
    }
};

// 🆕 NOVÉ PROMĚNNÉ PRO PIN & BACKUP
let userPinHash = null; // SHA256 hash PINu
let hasBackupSetup = false; // Zda uživatel má nastavenou zálohu

// ========================================
// 🔧 UTILITY FUNKCE
// ========================================

/**
 * Bezpečná toast notifikace místo alert()
 */
function showFleetNotification(message, isError = false) {
    const toast = document.getElementById("fleetToast");
    
    if (!toast) {
        console.warn('Toast element not found, falling back to console');
        console.log(message);
        return;
    }
    
    toast.textContent = message;
    
    if (isError) {
        toast.style.borderColor = "var(--danger-color)";
        toast.style.boxShadow = "0 0 15px rgba(244, 67, 54, 0.4)";
    } else {
        toast.style.borderColor = "var(--success-color)";
        toast.style.boxShadow = "0 0 15px rgba(76, 175, 80, 0.4)";
    }

    toast.className = "toast-notification show";

    setTimeout(() => { 
        toast.className = toast.className.replace("show", ""); 
    }, 6000);
}

/**
 * Debounce wrapper pro input události (budoucí použití)
 */
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

// ========================================
// 🔐 ŠIFROVÁNÍ A DEŠIFROVÁNÍ
// ========================================

/**
 * Šifrování dat s error handling
 */
function encryptData(data) {
    try {
        if (!masterKeyStore.exists()) {
            throw new Error("Master klíč není nastaven pro šifrování dat.");
        }
        return CryptoJS.AES.encrypt(JSON.stringify(data), masterKeyStore.get()).toString();
    } catch (error) {
        console.error("Chyba při šifrování:", error);
        showFleetNotification('❌ Chyba při šifrování dat.', true);
        throw error;
    }
}

/**
 * Dešifrování dat s error handling
 */
function decryptData(cipher) {
    try {
        if (!masterKeyStore.exists()) {
            throw new Error("Master klíč není nastaven pro dešifrování dat.");
        }
        const bytes = CryptoJS.AES.decrypt(cipher, masterKeyStore.get());
        const txt = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!txt) {
            throw new Error("Dešifrování selhalo - možná nesprávné heslo");
        }
        
        return JSON.parse(txt);
    } catch (error) {
        console.error("Chyba při dešifrování:", error);
        showFleetNotification('❌ Chyba při dešifrování hesel. Zkontrolujte master heslo.', true);
        return [];
    }
}

// ========================================
// 🆕 HELPER FUNKCE PRO PIN
// ========================================

/**
 * Hash PIN pomocí SHA256
 */
function hashPin(pin) {
    return CryptoJS.SHA256(pin).toString();
}

/**
 * Ověření PINu
 */
function verifyPin(enteredPin) {
    if (!userPinHash) {
        console.error("PIN hash není načten");
        return false;
    }
    const enteredHash = hashPin(enteredPin);
    return enteredHash === userPinHash;
}

/**
 * Validace PINu (4-6 číslic)
 */
function validatePin(pin) {
    if (!pin || pin.length < 4 || pin.length > 6) {
        showFleetNotification('⚠️ PIN musí mít 4-6 číslic!', true);
        return false;
    }
    if (!/^\d+$/.test(pin)) {
        showFleetNotification('⚠️ PIN může obsahovat pouze číslice!', true);
        return false;
    }
    return true;
}

/**
 * Validace hesla (min 12 znaků)
 */
function validatePassword(password, fieldName = "Heslo") {
    if (!password || password.length < 12) {
        showFleetNotification(`⚠️ ${fieldName} musí mít alespoň 12 znaků!`, true);
        return false;
    }
    return true;
}

// ========================================
// 🆕 SYNCHRONIZACE PASSWORDS BACKUP
// ========================================

/**
 * ✅ FIX #1: Aktualizace passwordsBackup při každé změně hesel
 * Volá se po každém savePassword(), deletePassword(), importFromTxt()
 */
async function syncPasswordsBackup(passwords) {
    try {
        // Kontrola, zda máme BackupKey v paměti
        if (!backupKeyStore.exists()) {
            console.warn('⚠️ BackupKey není v paměti. Sync přeskočen.');
            return false;
        }

        console.log('🔄 Synchronizuji passwordsBackup...');

        // Zašifruj hesla BackupKey (pro recovery)
        const passwordsBackup = CryptoJS.AES.encrypt(
            JSON.stringify(passwords), 
            backupKeyStore.get()
        ).toString();

        // Ulož do Firestore
        await savePasswordsBackupToFirestore(passwordsBackup);

        console.log('✅ PasswordsBackup synchronizován!');
        return true;

    } catch (error) {
        console.error('❌ Chyba při synchronizaci passwordsBackup:', error);
        // Neházíme chybu - tichý fail, aby to nezastavilo hlavní operaci
        return false;
    }
}

// ========================================
// 📊 FIRESTORE OPERACE S CACHING
// ========================================

/**
 * Načtení hesel s cachingem
 */
async function getPasswordsWithCache(forceRefresh = false) {
    try {
        if (!forceRefresh && passwordsCache.isValid()) {
            console.log('📦 Používám cache pro hesla');
            return passwordsCache.data;
        }

        console.log('🔄 Načítám hesla z Firestore');
        const encryptedList = await loadPasswordsFromFirestore();
        
        if (encryptedList) {
            const decrypted = decryptData(encryptedList);
            passwordsCache.set(decrypted);
            return decrypted;
        }
        
        return [];
    } catch (error) {
        console.error("Chyba při načítání hesel:", error);
        showFleetNotification('❌ Chyba při načítání hesel z cloudu.', true);
        return [];
    }
}

/**
 * Uložení hesel a invalidace cache
 */
async function savePasswordsWithCache(passwords) {
    try {
        const encrypted = encryptData(passwords);
        await savePasswordsToFirestore(encrypted);
        passwordsCache.set(passwords); // Aktualizuj cache
        return true;
    } catch (error) {
        console.error("Chyba při ukládání hesel:", error);
        showFleetNotification('❌ Chyba při ukládání hesel do cloudu.', true);
        throw error;
    }
}

// ========================================
// 🎨 UI FUNKCE
// ========================================

/**
 * Přepnutí viditelnosti hesla
 */
function togglePasswordVisibility(inputId, buttonElement) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        buttonElement.innerHTML = '🔓 Skrýt';
    } else {
        input.type = 'password';
        buttonElement.innerHTML = '🔒 Zobrazit';
    }
}

/**
 * Vyčištění formuláře
 */
function clearForm() {
    ['service', 'username', 'password'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
}

/**
 * Vyčištění tabulky
 */
function clearTable() {
    const tbody = document.querySelector('#passwordTable tbody');
    if (tbody) {
        tbody.innerHTML = '';
    }
}

// ========================================
// 🔐 AUTENTIZACE A MASTER KEY
// ========================================

/**
 * Zobrazení master key modalu
 */
function showMasterKeyInputModal(isNewUser) {
    isNewMasterKeySetup = isNewUser;
    const modal = document.getElementById('masterKeyInputModal');
    const messageElement = document.getElementById('masterKeyInputModalMessage');
    const inputField = document.getElementById('masterKeyInputField');

    if (!modal || !messageElement || !inputField) {
        console.error('Modal elements not found');
        return;
    }

    if (isNewUser) {
        messageElement.innerHTML = '🚀 <strong>Vítejte na palubě, admirále!</strong><br>Nastavte si master heslo pro šifrování vašich dat:';
        inputField.placeholder = 'Vytvořte silné master heslo';
    } else {
        messageElement.innerHTML = '🔐 <strong>Vítejte zpět!</strong><br>Zadejte své master heslo pro dešifrování dat:';
        inputField.placeholder = 'Zadejte master heslo';
    }
    
    inputField.value = '';
    modal.classList.remove('hidden');
}

/**
 * ✅ FIX #2: AKTUALIZOVANÁ funkce pro zpracování master key inputu
 * Přidáno: Automatické přesměrování na setup backup & PIN pro existující uživatele
 */
async function handleMasterKeyInput() {
    const enteredKey = document.getElementById('masterKeyInputField')?.value;
    
    if (!enteredKey) {
        showFleetNotification('⚠️ Zadejte master heslo!', true);
        return;
    }

    if (isNewMasterKeySetup) {
        // NOVÝ UŽIVATEL - nastavení master key
        masterKeyStore.set(enteredKey);
        const encryptedMasterKey = CryptoJS.AES.encrypt(masterKeyStore.get(), enteredKey).toString();
        
        try {
            await saveEncryptedMasterKeyToFirestore(encryptedMasterKey);
            
            // ⚡ NOVÉ: Po nastavení master hesla jdi na setup backup & PIN
            showSetupBackupModal();
            
        } catch (error) {
            console.error("Chyba při ukládání nového master klíče:", error);
            showFleetNotification('❌ Chyba při ukládání master klíče do cloudu.', true);
        }
    } else {
        // EXISTUJÍCÍ UŽIVATEL - ověření master key
        try {
            const encryptedMasterKeyFromFirestore = await loadEncryptedMasterKeyFromFirestore();
            
            if (!encryptedMasterKeyFromFirestore) {
                showFleetNotification('❌ Chyba: Šifrovaný master klíč nebyl nalezen ve Firestore.', true);
                return;
            }
            
            const bytes = CryptoJS.AES.decrypt(encryptedMasterKeyFromFirestore, enteredKey);
            const decryptedMasterKey = bytes.toString(CryptoJS.enc.Utf8);

            if (decryptedMasterKey) {
                masterKeyStore.set(decryptedMasterKey);
                
                // ⚡ NOVÉ: Načti PIN hash
                userPinHash = await loadPinHashFromFirestore();
                
                // ✅ FIX #2: Kontrola, zda existuje backup setup
                const encryptedBackupKey = await loadBackupKeyFromFirestore();
                hasBackupSetup = !!encryptedBackupKey;
                
                // ✅ FIX #2: POKUD NEMÁ BACKUP SETUP → VYNUTIT SETUP!
                if (!hasBackupSetup) {
                    console.log('⚠️ Starý uživatel bez backup setupu. Přesměrovávám na setup...');
                    
                    showFleetNotification('⚠️ Pro zvýšení bezpečnosti je nutné nastavit Backup Key a PIN!', true);
                    
                    // Zavři master key modal a otevři setup backup modal
                    document.getElementById('masterKeyInputModal').classList.add('hidden');
                    showSetupBackupModal();
                    
                    return; // NEPOUŠTÍME DO APLIKACE!
                }
                
                // ✅ POKUD MÁ BACKUP SETUP → Dešifruj BackupKey a ulož do paměti
                try {
                    const backupKeyBytes = CryptoJS.AES.decrypt(encryptedBackupKey, masterKeyStore.get());
                    const backupKey = backupKeyBytes.toString(CryptoJS.enc.Utf8);
                    
                    if (backupKey) {
                        backupKeyStore.set(backupKey);
                        console.log('✅ BackupKey načten do paměti');
                    } else {
                        console.warn('⚠️ Nelze dešifrovat BackupKey');
                    }
                } catch (error) {
                    console.error('❌ Chyba při dešifrování BackupKey:', error);
                }
                
                // Vše OK → Pustit do aplikace
                document.getElementById('masterKeyInputModal').classList.add('hidden');
                document.getElementById('mainContent').classList.remove('hidden');
                document.getElementById('appFooter').classList.remove('hidden');
                
                // Zobraz tlačítko "Změnit heslo" pokud má backup setup
                if (hasBackupSetup) {
                    const changeBtn = document.getElementById('changeMasterPasswordBtn');
                    if (changeBtn) changeBtn.style.display = 'inline-block';
                }
                
                showFleetNotification('✅ Přihlášení úspěšné! Hesla načtena z hvězdné flotily.');
                await loadPasswords();
            } else {
                showFleetNotification('❌ Nesprávné master heslo. Zkuste to znovu.', true);
            }
        } catch (error) {
            console.error("Chyba při dešifrování master klíče:", error);
            showFleetNotification('❌ Chyba při dešifrování master klíče. Zkontrolujte heslo.', true);
        }
    }
}

/**
 * Přihlášení přes Google
 */
async function signInWithGoogle() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.classList.add('hidden');
    
    try {
        await signInWithGoogleProvider();
    } catch (error) {
        console.error("Chyba při přihlášení přes Google:", error);
        showFleetNotification('❌ Chyba při přihlášení přes Google. Zkuste to znovu.', true);
        if (loginForm) loginForm.classList.remove('hidden');
    }
}

/**
 * Callback po autentizaci uživatele
 */
window.onUserAuthenticated = async (user) => {
    if (user) {
        console.log("Uživatel ověřen:", user.uid);
        
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.classList.add('hidden');
        
        const footer = document.getElementById('appFooter');
        if (footer) footer.classList.add('hidden'); 
       
        try {
            const encryptedMasterKeyFromFirestore = await loadEncryptedMasterKeyFromFirestore();
            
            if (encryptedMasterKeyFromFirestore) {
                showMasterKeyInputModal(false);
            } else {
                showMasterKeyInputModal(true);
            }
        } catch (error) {
            console.error("Chyba při zpracování autentizace:", error);
            showFleetNotification('❌ Chyba při načítání uživatelských dat. Zkuste se přihlásit znovu.', true);
            logout();
        }
    } else {
        console.log("Uživatel odhlášen.");
        logout();
    }
};

/**
 * Potvrzení odhlášení
 */
function confirmLogout() {
    if (confirm('🚀 Opravdu chcete ukončit warpový skok a odhlásit se?')) {
        logout();
    }
}

/**
 * Odhlášení uživatele
 */
function logout() {
    masterKeyStore.clear();
    backupKeyStore.clear(); // ✅ Vyčisti BackupKey z paměti
    passwordsCache.clear();
    clearTable();
    
    if (typeof auth !== 'undefined' && auth) {
        auth.signOut()
            .then(() => {
                console.log("Uživatel odhlášen z Firebase.");
                showFleetNotification('👋 Odhlášení úspěšné. Můžete se vrátit na palubu kdykoliv!');
            })
            .catch((error) => {
                console.error("Chyba při odhlašování z Firebase:", error);
            });
    }
    
    const mainContent = document.getElementById('mainContent');
    const loginForm = document.getElementById('loginForm');
    const footer = document.getElementById('appFooter');
    
    if (mainContent) mainContent.classList.add('hidden');
    if (footer) footer.classList.add('hidden');
    if (loginForm) loginForm.classList.remove('hidden');
}

// ========================================
// 🆕 SETUP BACKUP & PIN (NOVÝ UŽIVATEL)
// ========================================

/**
 * Zobrazení setup backup modalu po vytvoření master hesla
 */
function showSetupBackupModal() {
    document.getElementById('masterKeyInputModal').classList.add('hidden');
    document.getElementById('setupBackupModal').classList.remove('hidden');
}

/**
 * ✅ AKTUALIZOVÁNO: Dokončení setupu backup key a PIN
 * Přidáno: Uložení BackupKey do paměti pro automatickou synchronizaci
 */
async function completeBackupSetup() {
    const backupKey = document.getElementById('setupBackupKey')?.value;
    const confirmBackupKey = document.getElementById('confirmSetupBackupKey')?.value;
    const pin = document.getElementById('setupPin')?.value;
    const confirmPin = document.getElementById('confirmSetupPin')?.value;

    // Validace backup key
    if (!validatePassword(backupKey, "Backup key")) return;
    if (backupKey !== confirmBackupKey) {
        showFleetNotification('⚠️ Backup keys se neshodují!', true);
        return;
    }

    // Validace PIN
    if (!validatePin(pin)) return;
    if (pin !== confirmPin) {
        showFleetNotification('⚠️ PINy se neshodují!', true);
        return;
    }

    try {
        // 1. Zašifruj backup key pomocí master hesla
        const encryptedBackupKey = CryptoJS.AES.encrypt(backupKey, masterKeyStore.get()).toString();
        
        // 2. Vytvoř PIN hash
        const pinHash = hashPin(pin);
        
        // 3. Načti aktuální hesla
        const currentPasswords = await getPasswordsWithCache(true);
        
        // 4. Zašifruj hesla TAKÉ pomocí backup key (pro recovery)
        const passwordsBackup = CryptoJS.AES.encrypt(JSON.stringify(currentPasswords), backupKey).toString();
        
        // 5. Ulož vše do Firestore
        await saveBackupKeyToFirestore(encryptedBackupKey);
        await savePinHashToFirestore(pinHash);
        await savePasswordsBackupToFirestore(passwordsBackup);
        
        // 6. ✅ NOVÉ: Ulož BackupKey do paměti (pro automatickou sync)
        backupKeyStore.set(backupKey);
        userPinHash = pinHash;
        hasBackupSetup = true;
        
        console.log('✅ BackupKey uložen do paměti pro auto-sync');
        
        // 7. Zavři modal a zobraz hlavní obsah
        document.getElementById('setupBackupModal').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        document.getElementById('appFooter').classList.remove('hidden');
        
        showFleetNotification('✅ Backup key a PIN úspěšně nastaveny! Tvoje data jsou chráněna.');
        
        // 8. Vyčisti inputy
        document.getElementById('setupBackupKey').value = '';
        document.getElementById('confirmSetupBackupKey').value = '';
        document.getElementById('setupPin').value = '';
        document.getElementById('confirmSetupPin').value = '';
        
        await loadPasswords();
        
    } catch (error) {
        console.error("Chyba při setupu backup:", error);
        showFleetNotification('❌ Chyba při nastavení zálohy. Zkuste to znovu.', true);
    }
}

// ========================================
// 🆕 ZMĚNA MASTER HESLA
// ========================================

/**
 * Zobrazení modalu pro změnu master hesla
 */
function showChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.remove('hidden');
}

/**
 * Zavření modalu pro změnu hesla
 */
function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.add('hidden');
    // Vyčisti inputy
    document.getElementById('oldMasterPassword').value = '';
    document.getElementById('changePinVerify').value = '';
    document.getElementById('newMasterPassword').value = '';
    document.getElementById('confirmNewMasterPassword').value = '';
}

/**
 * Změna master hesla
 */
async function changeMasterPassword() {
    const oldPassword = document.getElementById('oldMasterPassword')?.value;
    const pinVerify = document.getElementById('changePinVerify')?.value;
    const newPassword = document.getElementById('newMasterPassword')?.value;
    const confirmPassword = document.getElementById('confirmNewMasterPassword')?.value;

    // Validace
    if (!oldPassword || !pinVerify || !newPassword || !confirmPassword) {
        showFleetNotification('⚠️ Vyplň všechna pole!', true);
        return;
    }

    // Ověř staré master heslo
    if (oldPassword !== masterKeyStore.get()) {
        showFleetNotification('❌ Staré master heslo je nesprávné!', true);
        return;
    }

    // Ověř PIN
    if (!validatePin(pinVerify)) return;
    if (!verifyPin(pinVerify)) {
        showFleetNotification('❌ Nesprávný PIN!', true);
        return;
    }

    // Validace nového hesla
    if (!validatePassword(newPassword, "Nové heslo")) return;
    if (newPassword !== confirmPassword) {
        showFleetNotification('⚠️ Nová hesla se neshodují!', true);
        return;
    }

    // Kontrola, že nové heslo je jiné než staré
    if (oldPassword === newPassword) {
        showFleetNotification('⚠️ Nové heslo musí být jiné než staré!', true);
        return;
    }

    try {
        showFleetNotification('🔄 Měním master heslo... Může to chvíli trvat.');

        // 1. Načti a dešifruj hesla starým master keyem
        const encryptedList = await loadPasswordsFromFirestore();
        if (!encryptedList) {
            throw new Error("Žádná hesla k dešifrování");
        }
        
        const decryptedPasswords = decryptData(encryptedList);

        // 2. Zašifruj hesla NOVÝM master keyem
        const newEncryptedPasswords = CryptoJS.AES.encrypt(
            JSON.stringify(decryptedPasswords), 
            newPassword
        ).toString();

        // 3. Zašifruj nový master key (sám sebou)
        const newEncryptedMasterKey = CryptoJS.AES.encrypt(newPassword, newPassword).toString();

        // 4. ✅ Přešifruj BackupKey pomocí NOVÉHO master hesla
        const currentBackupKey = backupKeyStore.get();
        const newEncryptedBackupKey = CryptoJS.AES.encrypt(currentBackupKey, newPassword).toString();

        // 5. Ulož do Firestore
        await savePasswordsToFirestore(newEncryptedPasswords);
        await saveEncryptedMasterKeyToFirestore(newEncryptedMasterKey);
        await saveBackupKeyToFirestore(newEncryptedBackupKey);
        
        // 6. ✅ NEPŘEŠIFROVÁVAT passwordsBackup - zůstává stejný (zašifrovaný BackupKey)
        // Není potřeba, protože passwordsBackup je šifrovaný BackupKey, který se nemění

        // 7. Aktualizuj master key v paměti
        masterKeyStore.set(newPassword);

        // 8. Invaliduj cache
        passwordsCache.clear();

        // 9. Zavři modal
        closeChangePasswordModal();

        showFleetNotification('✅ Master heslo úspěšně změněno! Všechna hesla byla znovu zašifrována.');

        // 10. Reload hesel
        await loadPasswords();

    } catch (error) {
        console.error("Chyba při změně master hesla:", error);
        showFleetNotification('❌ Chyba při změně hesla. Zkuste to znovu.', true);
    }
}

// ========================================
// 🆕 RECOVERY (ZAPOMENUTÉ HESLO)
// ========================================

/**
 * Zobrazení recovery modalu
 */
function showRecoveryModal() {
    document.getElementById('masterKeyInputModal').classList.add('hidden');
    document.getElementById('recoveryModal').classList.remove('hidden');
}

/**
 * Zavření recovery modalu
 */
function closeRecoveryModal() {
    document.getElementById('recoveryModal').classList.add('hidden');
    document.getElementById('masterKeyInputModal').classList.remove('hidden');
    // Vyčisti inputy
    document.getElementById('recoveryBackupKey').value = '';
    document.getElementById('recoveryPin').value = '';
}

/**
 * Obnova přístupu pomocí backup key a PIN
 */
async function recoverAccess() {
    const backupKey = document.getElementById('recoveryBackupKey')?.value;
    const pin = document.getElementById('recoveryPin')?.value;

    // Validace
    if (!backupKey || !pin) {
        showFleetNotification('⚠️ Vyplň backup key i PIN!', true);
        return;
    }

    if (!validatePin(pin)) return;

    try {
        showFleetNotification('🔄 Ověřuji backup key a PIN...');

        // 1. Načti PIN hash z Firestore
        const storedPinHash = await loadPinHashFromFirestore();
        if (!storedPinHash) {
            showFleetNotification('❌ PIN hash nenalezen. Nemáš nastavenou zálohu.', true);
            return;
        }

        // 2. Ověř PIN
        const enteredPinHash = hashPin(pin);
        if (enteredPinHash !== storedPinHash) {
            showFleetNotification('❌ Nesprávný PIN!', true);
            return;
        }

        // 3. Načti passwordsBackup z Firestore
        const passwordsBackup = await loadPasswordsBackupFromFirestore();
        if (!passwordsBackup) {
            showFleetNotification('❌ Záložní hesla nenalezena.', true);
            return;
        }

        // 4. Pokus se dešifrovat pomocí backup key
        let decryptedPasswords;
        try {
            const bytes = CryptoJS.AES.decrypt(passwordsBackup, backupKey);
            const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedText) {
                throw new Error("Dešifrování selhalo");
            }
            
            decryptedPasswords = JSON.parse(decryptedText);
        } catch (error) {
            showFleetNotification('❌ Nesprávný backup key! Dešifrování selhalo.', true);
            return;
        }

        // 5. Úspěch! Ulož dešifrovaná hesla dočasně
        window._recoveredPasswords = decryptedPasswords;
        window._recoveredBackupKey = backupKey; // ✅ Ulož i BackupKey pro pozdější použití
        userPinHash = storedPinHash; // Ulož PIN hash do paměti

        // 6. Zavři recovery modal a zobraz modal pro nové master heslo
        document.getElementById('recoveryModal').classList.add('hidden');
        document.getElementById('newMasterPasswordModal').classList.remove('hidden');

        showFleetNotification('✅ Přístup obnoven! Nyní vytvoř nové master heslo.');

    } catch (error) {
        console.error("Chyba při recovery:", error);
        showFleetNotification('❌ Chyba při obnově přístupu. Zkontroluj backup key a PIN.', true);
    }
}

/**
 * ✅ AKTUALIZOVÁNO: Nastavení nového master hesla po recovery
 * Přidáno: Uložení BackupKey do paměti pro automatickou synchronizaci
 */
async function setNewMasterPasswordAfterRecovery() {
    const newPassword = document.getElementById('recoveryNewMasterPassword')?.value;
    const confirmPassword = document.getElementById('recoveryConfirmNewMasterPassword')?.value;

    // Validace
    if (!validatePassword(newPassword, "Nové heslo")) return;
    if (newPassword !== confirmPassword) {
        showFleetNotification('⚠️ Hesla se neshodují!', true);
        return;
    }

    // Kontrola, že máme dešifrovaná hesla z recovery
    if (!window._recoveredPasswords) {
        showFleetNotification('❌ Chyba: Žádná obnovená hesla k uložení.', true);
        return;
    }

    try {
        showFleetNotification('🔄 Nastavuji nové master heslo...');

        const recoveredPasswords = window._recoveredPasswords;
        const recoveredBackupKey = window._recoveredBackupKey; // ✅ BackupKey z recovery

        // 1. Zašifruj hesla NOVÝM master keyem
        const newEncryptedPasswords = CryptoJS.AES.encrypt(
            JSON.stringify(recoveredPasswords), 
            newPassword
        ).toString();

        // 2. Zašifruj nový master key (sám sebou)
        const newEncryptedMasterKey = CryptoJS.AES.encrypt(newPassword, newPassword).toString();

        // 3. ✅ Přešifruj EXISTUJÍCÍ BackupKey (ne generovat nový!)
        const newEncryptedBackupKey = CryptoJS.AES.encrypt(recoveredBackupKey, newPassword).toString();
        
        // 4. ✅ Přešifruj passwordsBackup pomocí EXISTUJÍCÍHO BackupKey
        const newPasswordsBackup = CryptoJS.AES.encrypt(
            JSON.stringify(recoveredPasswords), 
            recoveredBackupKey
        ).toString();

        // 5. Ulož vše do Firestore
        await savePasswordsToFirestore(newEncryptedPasswords);
        await saveEncryptedMasterKeyToFirestore(newEncryptedMasterKey);
        await saveBackupKeyToFirestore(newEncryptedBackupKey);
        await savePasswordsBackupToFirestore(newPasswordsBackup);

        // 6. Nastav nový master key v paměti
        masterKeyStore.set(newPassword);
        
        // 7. ✅ NOVÉ: Ulož BackupKey do paměti (pro automatickou sync)
        backupKeyStore.set(recoveredBackupKey);
        hasBackupSetup = true;

        // 8. Vyčisti dočasná data
        delete window._recoveredPasswords;
        delete window._recoveredBackupKey;

        // 9. Invaliduj cache
        passwordsCache.clear();

        // 10. Zavři modal a zobraz hlavní obsah
        document.getElementById('newMasterPasswordModal').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        document.getElementById('appFooter').classList.remove('hidden');

        showFleetNotification('✅ Nové master heslo nastaveno! Tvoje hesla byla znovu zašifrována.');

        // 11. Reload hesel
        await loadPasswords();

    } catch (error) {
        console.error("Chyba při nastavení nového master hesla:", error);
        showFleetNotification('❌ Chyba při nastavení nového hesla. Zkuste to znovu.', true);
    }
}

// ========================================
// 💾 SPRÁVA HESEL
// ========================================

/**
 * ✅ FIX #1: Uložení hesla - AKTUALIZOVÁNO s auto-sync
 */
async function savePassword() {
    const service = document.getElementById('service')?.value;
    const user = document.getElementById('username')?.value;
    const pwd = document.getElementById('password')?.value;
    
    if (!service || !user || !pwd) {
        showFleetNotification('⚠️ Vyplňte všechna pole před warpovým skokem!', true);
        return;
    }
    
    if (!masterKeyStore.exists()) {
        showFleetNotification('❌ Master heslo není nastaveno. Přihlaste se prosím.', true);
        return;
    }

    try {
        const list = await getPasswordsWithCache();
        list.push({ service, username: user, password: pwd });
        
        await savePasswordsWithCache(list);
        
        // ✅ FIX #1: Automaticky synchronizuj passwordsBackup
        await syncPasswordsBackup(list);
        
        await loadPasswords();
        clearForm();
        showFleetNotification('✅ Heslo úspěšně uloženo do hvězdné databáze!');
    } catch (error) {
        console.error("Chyba při ukládání hesla:", error);
        showFleetNotification('❌ Chyba při ukládání hesla.', true);
    }
}

/**
 * Načtení hesel - OPTIMALIZOVÁNO s DocumentFragment
 */
async function loadPasswords() {
    clearTable();
    
    if (!masterKeyStore.exists()) {
        console.warn('Master heslo není nastaveno. Nelze načíst hesla.');
        return;
    }

    try {
        const list = await getPasswordsWithCache();
        
        const tbody = document.querySelector('#passwordTable tbody');
        const emptyState = document.getElementById('emptyState');
        const table = document.getElementById('passwordTable');
        
        if (!tbody || !emptyState || !table) {
            console.error('Table elements not found');
            return;
        }
        
        if (list.length === 0) {
            table.classList.add('hidden');
            emptyState.classList.remove('hidden');
        } else {
            table.classList.remove('hidden');
            emptyState.classList.add('hidden');
            
            // ⚡ OPTIMALIZACE: Použití DocumentFragment pro jeden reflow
            const fragment = document.createDocumentFragment();
            
            list.forEach((e, i) => {
                const row = document.createElement('tr');
                
                // Escapování HTML pro bezpečnost
                const escapedService = String(e.service).replace(/[&<>"']/g, (char) => {
                    const entities = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
                    return entities[char];
                });
                const escapedUsername = String(e.username).replace(/[&<>"']/g, (char) => {
                    const entities = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
                    return entities[char];
                });
                const escapedPassword = String(e.password).replace(/[&<>"']/g, (char) => {
                    const entities = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
                    return entities[char];
                });
                
                row.innerHTML = `
                    <td>${escapedService}</td>
                    <td>${escapedUsername}</td>
                    <td>${escapedPassword}</td>
                    <td><button class="delete-btn" onclick="deletePassword(${i})" title="Smazat toto heslo">🗑️ Smazat</button></td>
                `;
                
                fragment.appendChild(row);
            });
            
            tbody.appendChild(fragment); // ✅ Jeden reflow místo stovek!
        }
    } catch (error) {
        console.error("Chyba při načítání hesel:", error);
        showFleetNotification('❌ Chyba při načítání hesel z cloudu.', true);
    }
}

/**
 * ✅ FIX #1: Smazání hesla - AKTUALIZOVÁNO s auto-sync
 */
async function deletePassword(idx) {
    if (!masterKeyStore.exists()) {
        showFleetNotification('❌ Master heslo není nastaveno. Přihlaste se prosím.', true);
        return;
    }
    
    try {
        const list = await getPasswordsWithCache();
        
        if (list.length === 0 || idx >= list.length) {
            showFleetNotification('❌ Heslo nenalezeno.', true);
            return;
        }
        
        const serviceToDelete = list[idx].service;
        
        if (confirm(`🗑️ Opravdu chcete smazat heslo pro službu "${serviceToDelete}"?`)) {
            list.splice(idx, 1);
            await savePasswordsWithCache(list);
            
            // ✅ FIX #1: Automaticky synchronizuj passwordsBackup
            await syncPasswordsBackup(list);
            
            await loadPasswords();
            showFleetNotification('✅ Heslo bylo úspěšně odstraněno z databáze!');
        }
    } catch (error) {
        console.error("Chyba při mazání hesla:", error);
        showFleetNotification('❌ Chyba při mazání hesla.', true);
    }
}

// ========================================
// 📤 EXPORT A IMPORT
// ========================================

/**
 * Export do TXT - OPTIMALIZOVÁNO
 */
async function exportToTxt() {
    if (!masterKeyStore.exists()) {
        showFleetNotification('❌ Nejsi přihlášen – masterKey chybí!', true);
        return;
    }
    
    try {
        const list = await getPasswordsWithCache();
        
        if (list.length === 0) {
            showFleetNotification('⚠️ Žádná data k exportu. Databáze je prázdná.', true);
            return;
        }
        
        // ⚡ OPTIMALIZACE: Použití pole místo string concatenace
        const lines = [
            '🚀 HVĚZDNÁ FLOTILA - EXPORT HESEL 🚀',
            '═══════════════════════════════════════',
            '',
            `Master key: ${masterKeyStore.get()}`,
            '',
            `Celkový počet hesel: ${list.length}`,
            '═══════════════════════════════════════',
            ''
        ];
        
        list.forEach((e, index) => {
            lines.push(`[${index + 1}] Služba: ${e.service}`);
            lines.push(`    Uživatel: ${e.username}`);
            lines.push(`    Heslo: ${e.password}`);
            lines.push('---');
            lines.push('');
        });
        
        lines.push('═══════════════════════════════════════');
        lines.push('Export dokončen - Warpový pohon online! 🖖');
        
        const txt = lines.join('\n');
        
        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `hesla_flotila_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        
        // Cleanup
        URL.revokeObjectURL(a.href);
        
        showFleetNotification('✅ Export dokončen! Soubor byl úspěšně stažen.');
    } catch (error) {
        console.error("Chyba při exportu:", error);
        showFleetNotification('❌ Chyba při exportu dat.', true);
    }
}

/**
 * Trigger import file picker
 */
function triggerImport() {
    const importFile = document.getElementById('importFile');
    if (importFile) importFile.click();
}

/**
 * ✅ FIX #1: Import z TXT - AKTUALIZOVÁNO s auto-sync
 */
async function importFromTxt(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!masterKeyStore.exists()) {
        showFleetNotification('❌ Nejste přihlášeni! Pro import musíte být přihlášeni.', true);
        return;
    }

    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const content = e.target.result;
            
            // Validace master key
            const masterKeyMatch = content.match(/Master key:\s*(.+)/);
            if (!masterKeyMatch) {
                showFleetNotification('❌ Soubor neobsahuje platný master key!', true);
                return;
            }
            
            const fileMasterKey = masterKeyMatch[1].trim();
            if (fileMasterKey !== masterKeyStore.get()) {
                const confirmImport = confirm('⚠️ Master key v souboru se liší od vašeho současného klíče. Chcete pokračovat?\n\n(Doporučujeme zálohovat současná data před importem!)');
                if (!confirmImport) return;
            }

            // ⚡ OPTIMALIZACE: Efektivnější parsing
            const passwordBlocks = content.split('---');
            const importedPasswords = [];
            
            // Regex patterns předkompilované
            const serviceRegex = /Služba:\s*(.+)/;
            const userRegex = /Uživatel:\s*(.+)/;
            const passRegex = /Heslo:\s*(.+)/;
            
            for (let i = 0; i < passwordBlocks.length - 1; i++) {
                const block = passwordBlocks[i];
                const serviceMatch = block.match(serviceRegex);
                const userMatch = block.match(userRegex);
                const passMatch = block.match(passRegex);
                
                if (serviceMatch && userMatch && passMatch) {
                    importedPasswords.push({
                        service: serviceMatch[1].trim(),
                        username: userMatch[1].trim(),
                        password: passMatch[1].trim()
                    });
                }
            }

            if (importedPasswords.length === 0) {
                showFleetNotification('❌ Ve souboru nebyla nalezena žádná platná hesla!', true);
                return;
            }

            const action = confirm(`📥 Nalezeno ${importedPasswords.length} hesel.\n\nKlikněte OK pro PŘIDÁNÍ k současným heslům\nKlikněte Cancel pro NAHRAZENÍ všech hesel.`);
            
            let finalPasswords = importedPasswords;
            
            if (action) {
                const currentPasswords = await getPasswordsWithCache();
                finalPasswords = [...currentPasswords, ...importedPasswords];
            }
            
            await savePasswordsWithCache(finalPasswords);
            
            // ✅ FIX #1: Automaticky synchronizuj passwordsBackup
            await syncPasswordsBackup(finalPasswords);
            
            await loadPasswords();
            showFleetNotification(`✅ Import dokončen! ${importedPasswords.length} hesel bylo ${action ? 'přidáno' : 'nahrazeno'}.\n\nWarpový skok úspěšný! 🚀`);
            
        } catch (error) {
            console.error("Chyba při importu:", error);
            showFleetNotification('❌ Chyba při importu dat.', true);
        }
        
        // Reset input
        event.target.value = '';
    };

    reader.onerror = function() {
        showFleetNotification('❌ Chyba při čtení souboru.', true);
    };

    reader.readAsText(file);
}

// ========================================
// 🕒 AUTOMATICKÉ NASTAVENÍ ROKU
// ========================================
const yearSpan = document.getElementById('currentYear');
if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
}

// ========================================
// 🚀 INICIALIZACE
// ========================================

// Inicializace se provede automaticky díky defer atributu v HTML
// DOMContentLoaded listener není potřeba

console.log('✅ Script.js loaded - Warpový pohon online! 🚀');