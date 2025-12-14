// 🚀 HVĚZDNÁ FLOTILA - OPTIMALIZOVANÝ SCRIPT.JS 🚀
// Vylepšeno admirálem Claude.AI pro více admirála Jiříka
// ⚡ PERFORMANCE OPTIMALIZACE + CACHING + SECURITY ⚡

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
 * Zpracování master key inputu
 */
async function handleMasterKeyInput() {
    const enteredKey = document.getElementById('masterKeyInputField')?.value;
    
    if (!enteredKey) {
        showFleetNotification('⚠️ Zadejte master heslo!', true);
        return;
    }

    if (isNewMasterKeySetup) {
        // Nový uživatel - nastavení master key
        masterKeyStore.set(enteredKey);
        const encryptedMasterKey = CryptoJS.AES.encrypt(masterKeyStore.get(), enteredKey).toString();
        
        try {
            await saveEncryptedMasterKeyToFirestore(encryptedMasterKey);
            document.getElementById('masterKeyInputModal').classList.add('hidden');
            document.getElementById('mainContent').classList.remove('hidden');
            document.getElementById('appFooter').classList.remove('hidden');
            showFleetNotification('✅ Warpový skok úspěšný! Master heslo nastaveno a uloženo do cloudu!');
            await loadPasswords();
        } catch (error) {
            console.error("Chyba při ukládání nového master klíče:", error);
            showFleetNotification('❌ Chyba při ukládání master klíče do cloudu.', true);
        }
    } else {
        // Existující uživatel - ověření master key
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
                document.getElementById('masterKeyInputModal').classList.add('hidden');
                document.getElementById('mainContent').classList.remove('hidden');
                document.getElementById('appFooter').classList.remove('hidden');
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
    const footer = document.getElementById('appFooter'); // 1. Najít patičku
    
    if (mainContent) mainContent.classList.add('hidden');
    if (footer) footer.classList.add('hidden');          // 2. Skrýt patičku (TOTO TAM CHYBÍ)
    if (loginForm) loginForm.classList.remove('hidden');
}

// ========================================
// 💾 SPRÁVA HESEL
// ========================================

/**
 * Uložení hesla - OPTIMALIZOVÁNO
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
 * Smazání hesla - OPTIMALIZOVÁNO
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
 * Import z TXT - OPTIMALIZOVÁNO
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

