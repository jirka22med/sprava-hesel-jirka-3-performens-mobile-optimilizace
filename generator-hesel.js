// 🚀 HVĚZDNÁ FLOTILA - GENERÁTOR HESEL (PŘÍPOJNÝ MODUL) 🚀
// Vytvořeno pro více admirála Jiříka
// Samostatný modul pro generování ultra-silných hesel s vlastním modálním oknem

/**
 * Přidání modálního okna do DOMu po načtení skriptu
 * Tímto udržujeme index.html čistý a plně v režii velitele
 */
document.addEventListener('DOMContentLoaded', () => {
    const modalHTML = `
    <div id="generatorModal" class="masterkey-modal-overlay hidden" style="z-index: 1002;">
        <div class="masterkey-modal-content" style="max-width: 450px;">
            <h2>🎲 Generátor hesel</h2>
            
            <div class="form-group">
                <div style="font-size: 1.4em; letter-spacing: 2px; padding: 20px 10px; background: rgba(0,0,0,0.4); border: 1px solid var(--accent-color); border-radius: var(--radius-small); margin-bottom: 15px; word-break: break-all; min-height: 70px; display: flex; align-items: center; justify-content: center; color: var(--accent-color); text-shadow: var(--text-glow);" id="generatedPasswordDisplay">
                    Klikni na Generovat
                </div>
            </div>
            
            <div class="form-group" style="text-align: left; margin-bottom: 20px;">
                <label for="pwdLength" style="display: flex; justify-content: space-between;">
                    <span>Délka hesla:</span> 
                    <span id="pwdLengthValue" style="color: var(--accent-color); font-weight: bold; font-size: 1.2em;">16</span>
                </label>
                <input type="range" id="pwdLength" min="12" max="64" value="16" style="width: 100%; cursor: pointer; accent-color: var(--accent-color); margin-top: 10px;" oninput="document.getElementById('pwdLengthValue').innerText = this.value">
            </div>
            
            <div class="form-group" style="text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: var(--radius-small); border: 1px solid rgba(0, 204, 255, 0.2);">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; text-transform: none; font-size: 0.9em; margin: 0;">
                    <input type="checkbox" id="incUppercase" checked style="width: 18px; height: 18px; margin: 0; accent-color: var(--accent-color);"> A-Z (Velká)
                </label>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; text-transform: none; font-size: 0.9em; margin: 0;">
                    <input type="checkbox" id="incLowercase" checked style="width: 18px; height: 18px; margin: 0; accent-color: var(--accent-color);"> a-z (Malá)
                </label>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; text-transform: none; font-size: 0.9em; margin: 0;">
                    <input type="checkbox" id="incNumbers" checked style="width: 18px; height: 18px; margin: 0; accent-color: var(--accent-color);"> 0-9 (Čísla)
                </label>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; text-transform: none; font-size: 0.9em; margin: 0;">
                    <input type="checkbox" id="incSymbols" checked style="width: 18px; height: 18px; margin: 0; accent-color: var(--accent-color);"> !@#$ (Symboly)
                </label>
            </div>

            <div class="masterkey-modal-buttons" style="display: flex; flex-direction: column; gap: 10px;">
                <button class="confirm-ok" onclick="generateNewPassword()" style="width: 100%; margin: 0; background: var(--gradient-primary);">🎲 Vygenerovat nové</button>
                <div style="display: flex; gap: 10px;">
                    <button class="export-btn" onclick="copyGeneratedPassword()" style="flex: 1; margin: 0;">📋 Kopírovat</button>
                    <button class="import-btn" onclick="useGeneratedPassword()" style="flex: 1; margin: 0; background: var(--gradient-success);">✅ Použít</button>
                </div>
                <button class="cancel-btn" onclick="closeGeneratorModal()" style="width: 100%; margin: 0; margin-top: 5px;">❌ Zavřít okno</button>
            </div>
        </div>
    </div>
    `;
    
    // Přidání modálního okna na úplný konec <body>
    document.body.insertAdjacentHTML('beforeend', modalHTML);
});

/**
 * Funkce pro otevření modálního okna (voláno z index.html)
 */
function openGeneratorModal() {
    const modal = document.getElementById('generatorModal');
    if (modal) {
        modal.classList.remove('hidden');
        generateNewPassword(); // Okamžitě vygeneruje první heslo při otevření
    }
}

/**
 * Funkce pro zavření modálního okna
 */
function closeGeneratorModal() {
    const modal = document.getElementById('generatorModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Hlavní logika pro vygenerování ultra-silného hesla
 */
function generateNewPassword() {
    const length = parseInt(document.getElementById('pwdLength').value);
    const hasUpper = document.getElementById('incUppercase').checked;
    const hasLower = document.getElementById('incLowercase').checked;
    const hasNumbers = document.getElementById('incNumbers').checked;
    const hasSymbols = document.getElementById('incSymbols').checked;

    if (!hasUpper && !hasLower && !hasNumbers && !hasSymbols) {
        if (typeof showFleetNotification === 'function') {
            showFleetNotification('⚠️ Veličiteli, musíte vybrat alespoň jednu sadu znaků!', true);
        } else {
            alert('Musíte vybrat alespoň jednu sadu znaků!');
        }
        return;
    }

    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+~|}{[]:;?><,./-=';

    let chars = '';
    let password = '';
    
    // Zajištění, že heslo bude obsahovat alespoň jeden znak od každého vybraného typu
    if (hasUpper) {
        chars += upper;
        password += upper[Math.floor(Math.random() * upper.length)];
    }
    if (hasLower) {
        chars += lower;
        password += lower[Math.floor(Math.random() * lower.length)];
    }
    if (hasNumbers) {
        chars += numbers;
        password += numbers[Math.floor(Math.random() * numbers.length)];
    }
    if (hasSymbols) {
        chars += symbols;
        password += symbols[Math.floor(Math.random() * symbols.length)];
    }

    // Doplnění hesla na požadovanou délku
    while (password.length < length) {
        password += chars[Math.floor(Math.random() * chars.length)];
    }

    // Zamíchání hesla (aby garantované znaky nebyly vždy na začátku)
    password = password.split('').sort(() => 0.5 - Math.random()).join('');

    // Zobrazení na displeji
    document.getElementById('generatedPasswordDisplay').innerText = password;
}

/**
 * Zkopíruje vygenerované heslo do systémové schránky
 */
async function copyGeneratedPassword() {
    const pwd = document.getElementById('generatedPasswordDisplay').innerText;
    if (pwd === 'Klikni na Generovat') return;
    
    try {
        await navigator.clipboard.writeText(pwd);
        if (typeof showFleetNotification === 'function') {
            showFleetNotification('📋 Vygenerované heslo zkopírováno do schránky!');
        }
    } catch (err) {
        console.error('Chyba při kopírování:', err);
        if (typeof showFleetNotification === 'function') {
            showFleetNotification('❌ Kopírování selhalo.', true);
        }
    }
}

/**
 * Vezme heslo a vloží ho přímo do formuláře pro přidání nového hesla
 */
function useGeneratedPassword() {
    const pwd = document.getElementById('generatedPasswordDisplay').innerText;
    if (pwd === 'Klikni na Generovat') return;

    // Cílíme na hlavní input pro heslo ve tvé aplikaci (id="password")
    const passwordInput = document.getElementById('password'); 
    
    if (passwordInput) {
        passwordInput.value = pwd;
        closeGeneratorModal();
        if (typeof showFleetNotification === 'function') {
            showFleetNotification('✅ Bezpečné heslo bylo vloženo do formuláře!');
        }
        
        // Změní typ inputu na text, abys viděl, co jsi vložil
        if (passwordInput.type === 'password') {
            const toggleBtn = passwordInput.parentElement.querySelector('.password-toggle');
            if(toggleBtn) toggleBtn.click();
        }
    } else {
        if (typeof showFleetNotification === 'function') {
            showFleetNotification('❌ Vstupní pole pro uložení hesla nebylo nalezeno.', true);
        }
    }
}