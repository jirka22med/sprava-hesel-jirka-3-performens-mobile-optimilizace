// 🚀 HVĚZDNÁ FLOTILA - OPTIMALIZOVANÝ FIREBASE-LOGIC.JS 🚀
// Vylepšeno admirálem Claude.AI pro více admirála Jiříka
// ⚡ PERFORMANCE + RETRY LOGIKA + OFFLINE SUPPORT ⚡
// 🛡️ 100% BACKWARD COMPATIBLE - OCHRANA EXISTUJÍCÍCH DAT 🛡️

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
                lastModified: firebase.firestore.FieldValue.serverTimestamp() // ⚡ NOVÉ: Timestamp
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
                
                // ⚡ NOVÉ: Log timestampu pokud existuje
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
                createdAt: firebase.firestore.FieldValue.serverTimestamp() // ⚡ NOVÉ: Timestamp
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
                
                // ⚡ NOVÉ: Log timestampu pokud existuje
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
        }
    };
    
    devLog('🔧 Debug mode aktivní. Použij window.__firebaseDebug pro testování.');
}