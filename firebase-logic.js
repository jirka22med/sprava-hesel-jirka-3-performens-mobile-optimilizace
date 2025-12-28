// 🚀 HVĚZDNÁ FLOTILA - OPTIMALIZOVANÝ FIREBASE-LOGIC.JS 🚀
// Vylepšeno admirálem Claude.AI pro více admirála Jiříka
// ⚡ PERFORMANCE + RETRY LOGIKA + OFFLINE SUPPORT ⚡
// 🛡️ 100% BACKWARD COMPATIBLE - OCHRANA EXISTUJÍCÍCH DAT 🛡️
// 🆕 BACKUP KEY & PIN SYSTÉM 🆕

// ========================================
// 🔧 FIREBASE KONFIGURACE
// ========================================

const firebaseConfig = {
    apiKey: "AIzaSyA62qLLzSPSN5LSx7o7Rehv-UgBr5RwgWI",
    authDomain: "sprava-hesel-jirka.firebaseapp.com",
    projectId: "sprava-hesel-jirka",
    storageBucket: "sprava-hesel-jirka.firebasestorage.app",
    messagingSenderId: "736911248601",
    appId: "1:736911248601:web:345f1a1a2b90bbaac002c8",
    measurementId: "G-C8S2XW6ZW8"
};

// ========================================
// 📦 GLOBÁLNÍ PROMĚNNÉ
// ========================================

let app;
let db;
let auth;
let currentUserId = null;

// ========================================
// 🛠️ UTILITY FUNKCE
// ========================================

/**
 * Environment-based logging
 * V produkci můžeš vypnout console.log nastavením isDevelopment = false
 */
const isDevelopment = true; // Změň na false pro produkci

function devLog(message, ...args) {
    if (isDevelopment) {
        console.log(message, ...args);
    }
}

function devError(message, ...args) {
    console.error(message, ...args); // Error vždy zobrazujeme
}

/**
 * Helper funkce pro získání Firestore cesty
 * ✅ BEZPEČNÉ - Zachovává původní strukturu dat
 */
function getFirestorePath(collectionName) {
    if (!currentUserId) {
        throw new Error("User not authenticated - cannot access Firestore");
    }
    
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    
    return db.collection('artifacts')
        .doc(appId)
        .collection('users')
        .doc(currentUserId)
        .collection(collectionName);
}

/**
 * Retry logika s exponential backoff
 * ✅ BEZPEČNÉ - Opakuje operaci při selhání sítě
 */
async function firestoreOperationWithRetry(operation, operationName = 'Firestore operation', maxRetries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            devLog(`🔄 ${operationName} - pokus ${attempt + 1}/${maxRetries}`);
            const result = await operation();
            devLog(`✅ ${operationName} - úspěch`);
            return result;
        } catch (error) {
            lastError = error;
            devError(`❌ ${operationName} - pokus ${attempt + 1} selhal:`, error);
            
            // Pokud je to poslední pokus, vyhodíme chybu
            if (attempt === maxRetries - 1) {
                devError(`💥 ${operationName} - všechny pokusy selhaly`);
                throw error;
            }
            
            // Exponential backoff: 1s, 2s, 4s
            const delay = 1000 * Math.pow(2, attempt);
            devLog(`⏳ Čekám ${delay}ms před dalším pokusem...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

// ========================================
// 🔥 INICIALIZACE FIREBASE
// ========================================

/**
 * Inicializace Firebase s offline persistence
 * ✅ BEZPEČNÉ - Přidává offline support, nemění data
 */
function initializeFirebase() {
    if (app) {
        devLog('📦 Firebase již inicializováno, přeskakuji...');
        return;
    }

    try {
        devLog('🚀 Inicializuji Firebase...');
        
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore(app);
        auth = firebase.auth(app);

        // ⚡ NOVÉ: Offline persistence pro lepší UX
        db.enablePersistence({ synchronizeTabs: true })
            .then(() => {
                devLog('✅ Firestore offline persistence aktivována');
            })
            .catch((err) => {
                if (err.code === 'failed-precondition') {
                    devError('⚠️ Persistence nelze aktivovat: Více tabů otevřeno');
                } else if (err.code === 'unimplemented') {
                    devError('⚠️ Persistence není podporována v tomto prohlížeči');
                } else {
                    devError('⚠️ Chyba při aktivaci persistence:', err);
                }
            });

        // Nastavení posluchače pro změny stavu autentizace
        auth.onAuthStateChanged(handleAuthStateChange);

        // Custom token přihlášení (pro Canvas prostředí)
        attemptCustomTokenSignIn();

        devLog('✅ Firebase úspěšně inicializováno');
    } catch (error) {
        devError('💥 Kritická chyba při inicializaci Firebase:', error);
        throw error;
    }
}

/**
 * Handler pro změny autentizačního stavu
 * ✅ BEZPEČNÉ - Přidán error handling
 */
function handleAuthStateChange(user) {
    try {
        if (user) {
            currentUserId = user.uid;
            devLog("👤 Uživatel přihlášen:", currentUserId);
            
            if (typeof window.onUserAuthenticated === 'function') {
                window.onUserAuthenticated(user);
            } else {
                devError('⚠️ window.onUserAuthenticated není definováno');
            }
        } else {
            currentUserId = null;
            devLog("👤 Uživatel odhlášen");
            
            if (typeof window.onUserAuthenticated === 'function') {
                window.onUserAuthenticated(null);
            }
        }
    } catch (error) {
        devError('❌ Chyba v handleAuthStateChange:', error);
    }
}

/**
 * Pokus o přihlášení custom tokenem (Canvas)
 * ✅ BEZPEČNÉ - Zachovává původní logiku
 */
function attemptCustomTokenSignIn() {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        devLog('🔑 Pokouším se přihlásit custom tokenem...');
        
        auth.signInWithCustomToken(__initial_auth_token)
            .then(() => {
                devLog('✅ Přihlášen custom tokenem (Canvas)');
            })
            .catch(error => {
                devError("❌ Chyba při přihlašování custom tokenem:", error);
            });
    }
}

// ========================================
// 🔐 GOOGLE AUTENTIZACE
// ========================================

/**
 * Přihlášení přes Google
 * ✅ BEZPEČNÉ - Přidán retry mechanismus
 */
async function signInWithGoogleProvider() {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    return firestoreOperationWithRetry(
        async () => {
            return await auth.signInWithPopup(provider);
        },
        'Google Sign In',
        2 // Jen 2 pokusy pro auth
    );
}

// ========================================
// 💾 FIRESTORE OPERACE - HESLA
// ========================================

/**
 * Uložení hesel do Firestore
 * ✅ BEZPEČNÉ - Zachovává strukturu: { passwords: ... }
 * 
 * @param {string} passwords - Šifrovaný string hesel
 */
function savePasswordsToFirestore(passwords) {
    if (!currentUserId) {
        devError("❌ Uživatel není přihlášen. Nelze uložit hesla.");
        return Promise.reject(new Error("Uživatel není přihlášen."));
    }

    return firestoreOperationWithRetry(
        async () => {
            const docRef = getFirestorePath('passwordManager').doc('userPasswords');
            
            await docRef.set({
                passwords: passwords,
                lastModified: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            devLog("💾 Hesla úspěšně uložena do Firestore");
            return true;
        },
        'Save Passwords'
    ).catch(error => {
        devError("❌ Chyba při ukládání hesel do Firestore:", error);
        return Promise.reject(error);
    });
}

/**
 * Načtení hesel z Firestore
 * ✅ BEZPEČNÉ - Zachovává strukturu, vrací data.passwords
 * 
 * @returns {Promise<string|null>} Šifrovaný string hesel nebo null
 */
function loadPasswordsFromFirestore() {
    if (!currentUserId) {
        devError("❌ Uživatel není přihlášen. Nelze načíst hesla.");
        return Promise.resolve(null);
    }

    return firestoreOperationWithRetry(
        async () => {
            const docRef = getFirestorePath('passwordManager').doc('userPasswords');
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                devLog("📥 Hesla načtena z Firestore");
                
                if (data.lastModified) {
                    devLog(`📅 Poslední modifikace: ${data.lastModified.toDate()}`);
                }
                
                return data.passwords || null;
            } else {
                devLog("📭 Dokument s hesly pro tohoto uživatele neexistuje");
                return null;
            }
        },
        'Load Passwords'
    ).catch(error => {
        devError("❌ Chyba při načítání hesel z Firestore:", error);
        return Promise.reject(error);
    });
}

// ========================================
// 🔑 FIRESTORE OPERACE - MASTER KEY
// ========================================

/**
 * Uložení šifrovaného master klíče do Firestore
 * ✅ BEZPEČNÉ - Zachovává strukturu: { encryptedKey: ... }
 * 
 * @param {string} encryptedMasterKey - Šifrovaný master klíč
 */
function saveEncryptedMasterKeyToFirestore(encryptedMasterKey) {
    if (!currentUserId) {
        devError("❌ Uživatel není přihlášen. Nelze uložit master klíč.");
        return Promise.reject(new Error("Uživatel není přihlášen."));
    }

    return firestoreOperationWithRetry(
        async () => {
            const docRef = getFirestorePath('masterKey').doc('keyData');
            
            await docRef.set({
                encryptedKey: encryptedMasterKey,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            devLog("🔑 Šifrovaný master klíč úspěšně uložen do Firestore");
            return true;
        },
        'Save Master Key'
    ).catch(error => {
        devError("❌ Chyba při ukládání šifrovaného master klíče:", error);
        return Promise.reject(error);
    });
}

/**
 * Načtení šifrovaného master klíče z Firestore
 * ✅ BEZPEČNÉ - Zachovává strukturu, vrací data.encryptedKey
 * 
 * @returns {Promise<string|null>} Šifrovaný master klíč nebo null
 */
function loadEncryptedMasterKeyFromFirestore() {
    if (!currentUserId) {
        devError("❌ Uživatel není přihlášen. Nelze načíst master klíč.");
        return Promise.resolve(null);
    }

    return firestoreOperationWithRetry(
        async () => {
            const docRef = getFirestorePath('masterKey').doc('keyData');
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                devLog("🔑 Šifrovaný master klíč načten z Firestore");
                
                if (data.createdAt) {
                    devLog(`📅 Vytvořeno: ${data.createdAt.toDate()}`);
                }
                
                return data.encryptedKey || null;
            } else {
                devLog("📭 Dokument s master klíčem pro tohoto uživatele neexistuje");
                return null;
            }
        },
        'Load Master Key'
    ).catch(error => {
        devError("❌ Chyba při načítání šifrovaného master klíče:", error);
        return Promise.reject(error);
    });
}

// ========================================
// 🆕 FIRESTORE OPERACE - BACKUP KEY
// ========================================

/**
 * Uložení šifrovaného backup key do Firestore
 * ✅ BEZPEČNÉ - Zachovává strukturu: { encryptedBackupKey: ... }
 * 
 * @param {string} encryptedBackupKey - Šifrovaný backup key
 */
function saveBackupKeyToFirestore(encryptedBackupKey) {
    if (!currentUserId) {
        devError("❌ Uživatel není přihlášen. Nelze uložit backup key.");
        return Promise.reject(new Error("Uživatel není přihlášen."));
    }

    return firestoreOperationWithRetry(
        async () => {
            const docRef = getFirestorePath('masterKey').doc('backupData');
            
            await docRef.set({
                encryptedBackupKey: encryptedBackupKey,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            devLog("🔑 Šifrovaný backup key úspěšně uložen do Firestore");
            return true;
        },
        'Save Backup Key'
    ).catch(error => {
        devError("❌ Chyba při ukládání backup key:", error);
        return Promise.reject(error);
    });
}

/**
 * Načtení šifrovaného backup key z Firestore
 * ✅ BEZPEČNÉ - Zachovává strukturu
 * 
 * @returns {Promise<string|null>} Šifrovaný backup key nebo null
 */
function loadBackupKeyFromFirestore() {
    if (!currentUserId) {
        devError("❌ Uživatel není přihlášen. Nelze načíst backup key.");
        return Promise.resolve(null);
    }

    return firestoreOperationWithRetry(
        async () => {
            const docRef = getFirestorePath('masterKey').doc('backupData');
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                devLog("🔑 Šifrovaný backup key načten z Firestore");
                
                if (data.createdAt) {
                    devLog(`📅 Vytvořeno: ${data.createdAt.toDate()}`);
                }
                
                return data.encryptedBackupKey || null;
            } else {
                devLog("📭 Dokument s backup key pro tohoto uživatele neexistuje");
                return null;
            }
        },
        'Load Backup Key'
    ).catch(error => {
        devError("❌ Chyba při načítání backup key:", error);
        return Promise.reject(error);
    });
}

// ========================================
// 🆕 FIRESTORE OPERACE - PIN HASH
// ========================================

/**
 * Uložení PIN hashe do Firestore
 * ✅ BEZPEČNÉ - Ukládá hash, ne plaintext PIN!
 * 
 * @param {string} pinHash - SHA256 hash PINu
 */
function savePinHashToFirestore(pinHash) {
    if (!currentUserId) {
        devError("❌ Uživatel není přihlášen. Nelze uložit PIN hash.");
        return Promise.reject(new Error("Uživatel není přihlášen."));
    }

    return firestoreOperationWithRetry(
        async () => {
            const docRef = getFirestorePath('masterKey').doc('pinData');
            
            await docRef.set({
                pinHash: pinHash,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            devLog("🔢 PIN hash úspěšně uložen do Firestore");
            return true;
        },
        'Save PIN Hash'
    ).catch(error => {
        devError("❌ Chyba při ukládání PIN hashe:", error);
        return Promise.reject(error);
    });
}

/**
 * Načtení PIN hashe z Firestore
 * ✅ BEZPEČNÉ - Načítá hash, ne plaintext PIN
 * 
 * @returns {Promise<string|null>} SHA256 hash PINu nebo null
 */
function loadPinHashFromFirestore() {
    if (!currentUserId) {
        devError("❌ Uživatel není přihlášen. Nelze načíst PIN hash.");
        return Promise.resolve(null);
    }

    return firestoreOperationWithRetry(
        async () => {
            const docRef = getFirestorePath('masterKey').doc('pinData');
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                devLog("🔢 PIN hash načten z Firestore");
                
                if (data.createdAt) {
                    devLog(`📅 Vytvořeno: ${data.createdAt.toDate()}`);
                }
                
                return data.pinHash || null;
            } else {
                devLog("📭 Dokument s PIN hash pro tohoto uživatele neexistuje");
                return null;
            }
        },
        'Load PIN Hash'
    ).catch(error => {
        devError("❌ Chyba při načítání PIN hashe:", error);
        return Promise.reject(error);
    });
}

// ========================================
// 🆕 FIRESTORE OPERACE - PASSWORDS BACKUP
// ========================================

/**
 * Uložení záložních hesel (šifrovaných backup keyem) do Firestore
 * ✅ BEZPEČNÉ - Duplikát hesel šifrovaný jiným klíčem pro recovery
 * 
 * @param {string} passwordsBackup - Hesla šifrovaná backup keyem
 */
function savePasswordsBackupToFirestore(passwordsBackup) {
    if (!currentUserId) {
        devError("❌ Uživatel není přihlášen. Nelze uložit passwords backup.");
        return Promise.reject(new Error("Uživatel není přihlášen."));
    }

    return firestoreOperationWithRetry(
        async () => {
            const docRef = getFirestorePath('passwordManager').doc('passwordsBackup');
            
            await docRef.set({
                passwordsBackup: passwordsBackup,
                lastModified: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            devLog("💾 Passwords backup úspěšně uložen do Firestore");
            return true;
        },
        'Save Passwords Backup'
    ).catch(error => {
        devError("❌ Chyba při ukládání passwords backup:", error);
        return Promise.reject(error);
    });
}

/**
 * Načtení záložních hesel z Firestore
 * ✅ BEZPEČNÉ - Pro recovery workflow
 * 
 * @returns {Promise<string|null>} Hesla šifrovaná backup keyem nebo null
 */
function loadPasswordsBackupFromFirestore() {
    if (!currentUserId) {
        devError("❌ Uživatel není přihlášen. Nelze načíst passwords backup.");
        return Promise.resolve(null);
    }

    return firestoreOperationWithRetry(
        async () => {
            const docRef = getFirestorePath('passwordManager').doc('passwordsBackup');
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                devLog("💾 Passwords backup načten z Firestore");
                
                if (data.lastModified) {
                    devLog(`📅 Poslední modifikace: ${data.lastModified.toDate()}`);
                }
                
                return data.passwordsBackup || null;
            } else {
                devLog("📭 Dokument s passwords backup pro tohoto uživatele neexistuje");
                return null;
            }
        },
        'Load Passwords Backup'
    ).catch(error => {
        devError("❌ Chyba při načítání passwords backup:", error);
        return Promise.reject(error);
    });
}

// ========================================
// 🚀 AUTO-INICIALIZACE
// ========================================

// Inicializace Firebase při načtení scriptu
// Díky defer atributu v HTML se spustí po DOM ready
try {
    initializeFirebase();
    devLog('✅ Firebase-logic.js loaded - Cloudová flotila online! ☁️🚀');
} catch (error) {
    devError('💥 Kritická chyba při startu firebase-logic.js:', error);
}

// ========================================
// 📊 EXPORT PRO DEBUGGING (VOLITELNÉ)
// ========================================

// Pro debugging v konzoli můžeš použít:
// window.__firebaseDebug = { ... }
if (isDevelopment) {
    window.__firebaseDebug = {
        getCurrentUserId: () => currentUserId,
        getFirestoreInstance: () => db,
        getAuthInstance: () => auth,
        testConnection: async () => {
            try {
                if (!currentUserId) {
                    console.log('❌ Uživatel není přihlášen');
                    return false;
                }
                const docRef = getFirestorePath('passwordManager').doc('userPasswords');
                const doc = await docRef.get();
                console.log('✅ Firestore connection OK', doc.exists ? 'Document exists' : 'Document not found');
                return true;
            } catch (error) {
                console.error('❌ Firestore connection FAILED:', error);
                return false;
            }
        },
        // 🆕 Test backup systému
        testBackupSystem: async () => {
            try {
                console.log('🧪 Testování backup systému...');
                
                const backupKey = await loadBackupKeyFromFirestore();
                console.log('🔑 Backup key:', backupKey ? 'EXISTS' : 'NOT FOUND');
                
                const pinHash = await loadPinHashFromFirestore();
                console.log('🔢 PIN hash:', pinHash ? 'EXISTS' : 'NOT FOUND');
                
                const passwordsBackup = await loadPasswordsBackupFromFirestore();
                console.log('💾 Passwords backup:', passwordsBackup ? 'EXISTS' : 'NOT FOUND');
                
                console.log('✅ Backup systém test dokončen');
                return {
                    hasBackupKey: !!backupKey,
                    hasPinHash: !!pinHash,
                    hasPasswordsBackup: !!passwordsBackup
                };
            } catch (error) {
                console.error('❌ Backup systém test selhal:', error);
                return false;
            }
        }
    };
    
    devLog('🔧 Debug mode aktivní. Použij window.__firebaseDebug pro testování.');
}

// ========================================
// 📝 FIRESTORE STRUKTURA
// ========================================

/*
KOMPLETNÍ FIRESTORE STRUKTURA:

artifacts/{appId}/users/{userId}/
├── masterKey/
│   ├── keyData/                  // PŮVODNÍ
│   │   ├── encryptedKey          // Master heslo (šifrované master heslem)
│   │   └── createdAt             // Timestamp
│   ├── backupData/               // 🆕 NOVÉ!
│   │   ├── encryptedBackupKey    // Backup key šifrovaný master heslem
│   │   └── createdAt             // Timestamp
│   └── pinData/                  // 🆕 NOVÉ!
│       ├── pinHash               // SHA256 hash PINu
│       └── createdAt             // Timestamp
│
└── passwordManager/
    ├── userPasswords/            // PŮVODNÍ
    │   ├── passwords             // Hesla šifrovaná master heslem
    │   └── lastModified          // Timestamp
    └── passwordsBackup/          // 🆕 NOVÉ!
        ├── passwordsBackup       // Hesla šifrovaná backup keyem
        └── lastModified          // Timestamp

BEZPEČNOST:
✅ PIN nikdy není uložen jako plaintext (jen SHA256 hash)
✅ Backup key je šifrovaný master heslem
✅ Passwords backup jsou šifrována backup keyem
✅ Bez master hesla NEBO backup key nelze dešifrovat hesla
✅ PIN + backup key jsou nutné pro recovery
✅ 100% BACKWARD COMPATIBLE - existující data fungují stejně
*/