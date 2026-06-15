// ✏️ HVĚZDNÁ FLOTILA - EDITOR HESEL (PŘÍPOJNÝ MODUL) ✏️
// moldarovi-editor-hesel.js
// Samostatný modul pro editaci uložených hesel přímo v tabulce
// Vytvořeno admirálem Claude.AI pro více admirála Jiříka

// ============================================
// 🎨 DYNAMICKÝ CSS PRO EDIT TLAČÍTKO
// Injektuje se bez zásahu do style.css
// ============================================
(function injectEditStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* ✏️ EDIT TLAČÍTKO V TABULCE HESEL */
        .edit-btn {
            background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
            padding: 8px 16px;
            font-size: var(--font-small, 0.8rem);
        }
        .edit-btn:hover {
            box-shadow: 0 8px 25px rgba(255, 152, 0, 0.45);
        }
    `;
    document.head.appendChild(style);
})();

// ============================================
// 📦 INJEKCE MODÁLNÍHO OKNA DO DOM
// Stejný pattern jako generator-hesel.js
// ============================================
document.addEventListener('DOMContentLoaded', () => {

    const modalHTML = `
    <div id="editPasswordModal" class="masterkey-modal-overlay hidden" style="z-index: 1002;">
        <div class="masterkey-modal-content" style="max-width: 450px;">
            <h2>✏️ Editace hesla</h2>

            <!-- Skrytý index záznamu v poli hesel -->
            <input type="hidden" id="editPasswordIdx">

            <div class="form-group">
                <label for="editService">🌐 Služba:</label>
                <input type="text" id="editService" placeholder="např. Google, Facebook, GitHub...">
            </div>

            <div class="form-group">
                <label for="editUsername">👤 Uživatelské jméno:</label>
                <input type="text" id="editUsername" placeholder="např. admiral@starfleet.com">
            </div>

            <div class="form-group">
                <label for="editPasswordField">🔑 Heslo:</label>
                <div class="password-input-group">
                    <input type="password" id="editPasswordField" placeholder="Zadejte heslo...">
                    <button type="button" class="password-toggle"
                        onclick="togglePasswordVisibility('editPasswordField', this)"
                        title="Přepnout viditelnost hesla">🔒 Zobrazit</button>
                    <button type="button" class="export-btn"
                        onclick="openGeneratorForEdit()"
                        title="Otevřít generátor hesel">🎲 Generátor</button>
                </div>
            </div>

            <div class="masterkey-modal-buttons" style="display: flex; flex-direction: column; gap: 10px;">
                <button class="confirm-ok" onclick="saveEditedPasswordFromModal()"
                    style="width: 100%; margin: 0; background: var(--gradient-success);">
                    💾 Uložit změny
                </button>
                <button class="cancel-btn" onclick="closeEditModal()"
                    style="width: 100%; margin: 0; margin-top: 5px;">
                    ❌ Zrušit
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // ============================================
    // 🔄 OVERRIDE useGeneratedPassword
    // Pokud je editor otevřen → heslo jde do editPasswordField
    // Pokud editor zavřen   → původní chování (hlavní formulář)
    // ============================================
    if (typeof window.useGeneratedPassword === 'function') {
        const _original = window.useGeneratedPassword;

        window.useGeneratedPassword = function () {
            const editModal = document.getElementById('editPasswordModal');
            const isEditorOpen = editModal && !editModal.classList.contains('hidden');

            if (isEditorOpen) {
                const pwd = document.getElementById('generatedPasswordDisplay')?.innerText;
                if (!pwd || pwd === 'Klikni na Generovat') return;

                const editField = document.getElementById('editPasswordField');
                editField.value = pwd;

                // Zobraz heslo aby uživatel viděl co bylo vloženo
                if (editField.type === 'password') {
                    const toggleBtn = editField.parentElement.querySelector('.password-toggle');
                    if (toggleBtn) toggleBtn.click();
                }

                if (typeof closeGeneratorModal === 'function') closeGeneratorModal();
                if (typeof showFleetNotification === 'function') {
                    showFleetNotification('✅ Vygenerované heslo vloženo do editoru!');
                }
            } else {
                // Editor zavřen → normální chování pro hlavní formulář
                _original();
            }
        };
    }
});

// ============================================
// 🔓 OTEVŘENÍ EDITAČNÍHO MODALU
// ============================================

/**
 * Otevře editor s předvyplněnými daty z daného indexu v poli hesel.
 * Voláno z tlačítka ✏️ v každém řádku tabulky.
 */
async function openEditModal(idx) {
    try {
        const list = await getPasswordsWithCache();

        if (!list || !list[idx]) {
            if (typeof showFleetNotification === 'function') {
                showFleetNotification('❌ Záznam nenalezen.', true);
            }
            return;
        }

        const entry = list[idx];

        // Předvyplnění polí aktuálními hodnotami
        document.getElementById('editPasswordIdx').value   = idx;
        document.getElementById('editService').value       = entry.service  || '';
        document.getElementById('editUsername').value      = entry.username || '';
        document.getElementById('editPasswordField').value = entry.password || '';

        // Reset toggle — heslo vždy začíná skryté
        const pwdField  = document.getElementById('editPasswordField');
        pwdField.type   = 'password';
        const toggleBtn = pwdField.parentElement.querySelector('.password-toggle');
        if (toggleBtn) toggleBtn.innerHTML = '🔒 Zobrazit';

        // Otevři modal
        document.getElementById('editPasswordModal').classList.remove('hidden');

        // Focus na první pole pro rychlé editování
        document.getElementById('editService').focus();

    } catch (error) {
        console.error('❌ Chyba při otevírání editoru:', error);
        if (typeof showFleetNotification === 'function') {
            showFleetNotification('❌ Chyba při načítání záznamu.', true);
        }
    }
}

/**
 * Zavře editační modal a vyčistí všechna pole.
 */
function closeEditModal() {
    document.getElementById('editPasswordModal').classList.add('hidden');
    document.getElementById('editPasswordIdx').value   = '';
    document.getElementById('editService').value       = '';
    document.getElementById('editUsername').value      = '';
    document.getElementById('editPasswordField').value = '';
}

/**
 * Otevře generátor hesel v kontextu editačního modalu.
 * Override useGeneratedPassword zajistí správné cílové pole.
 */
function openGeneratorForEdit() {
    if (typeof openGeneratorModal === 'function') {
        openGeneratorModal();
    } else {
        if (typeof showFleetNotification === 'function') {
            showFleetNotification('⚠️ Generátor hesel není načten.', true);
        }
    }
}

// ============================================
// 💾 ULOŽENÍ EDITOVANÉHO HESLA
// ============================================

/**
 * Přečte data z modalu, zvaliduje a uloží aktualizovaný záznam do Firestore.
 * Automaticky synchonizuje passwordsBackup po uložení.
 */
async function saveEditedPasswordFromModal() {
    const idx      = parseInt(document.getElementById('editPasswordIdx').value);
    const service  = document.getElementById('editService').value.trim();
    const username = document.getElementById('editUsername').value.trim();
    const password = document.getElementById('editPasswordField').value;

    // Validace — všechna pole jsou povinná
    if (!service || !username || !password) {
        if (typeof showFleetNotification === 'function') {
            showFleetNotification('⚠️ Vyplň všechna pole!', true);
        }
        return;
    }

    if (isNaN(idx) || idx < 0) {
        if (typeof showFleetNotification === 'function') {
            showFleetNotification('❌ Chyba: Neplatný index záznamu.', true);
        }
        return;
    }

    try {
        const list = await getPasswordsWithCache();

        if (!list || idx >= list.length) {
            if (typeof showFleetNotification === 'function') {
                showFleetNotification('❌ Záznam nenalezen. Možná byl mezitím smazán.', true);
            }
            return;
        }

        // Aktualizace záznamu na daném indexu
        list[idx] = { service, username, password };

        // Uložení do Firestore (AES šifrovaně přes masterKey)
        await savePasswordsWithCache(list);

        // Automatická synchronizace passwordsBackup (stejně jako savePassword/deletePassword)
        await syncPasswordsBackup(list);

        // Zavři modal a vyčisti pole
        closeEditModal();

        // Obnov tabulku
        await loadPasswords();

        if (typeof showFleetNotification === 'function') {
            showFleetNotification(`✅ Heslo pro "${service}" bylo úspěšně aktualizováno!`);
        }

    } catch (error) {
        console.error('❌ Chyba při ukládání editovaného hesla:', error);
        if (typeof showFleetNotification === 'function') {
            showFleetNotification('❌ Chyba při ukládání. Zkus to znovu.', true);
        }
    }
}

console.log('✏️ Moldarovi-editor-hesel.js načten - Editor hesel online! 🚀');
