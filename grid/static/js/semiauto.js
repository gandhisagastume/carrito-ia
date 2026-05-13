document.addEventListener('DOMContentLoaded', () => {
    const btnCheckEsp = document.getElementById('btnCheckEsp');
    const espIpInput = document.getElementById('espIp');
    const espStatus = document.getElementById('espStatus');
    const espStatusText = document.getElementById('espStatusText');
    const commandLog = document.getElementById('commandLog');
    const btnClearLog = document.getElementById('btnClearLog');
    
    const btnForward = document.getElementById('btnForward');
    const btnLeft = document.getElementById('btnLeft');
    const btnRight = document.getElementById('btnRight');
    
    const cooldownOverlay = document.getElementById('cooldownOverlay');
    const cooldownBar = document.getElementById('cooldownBar');

    const COOLDOWN_MS = 1500; // 1.5s delay
    let onCooldown = false;
    let keyIsDown = false; // To prevent hold-down repeat

    // 1. ESP Status Checker
    btnCheckEsp.addEventListener('click', async () => {
        const ip = espIpInput.value.trim();
        if (!ip) return;

        btnCheckEsp.textContent = '...';
        try {
            const res = await fetch('/api/check-esp/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ esp_ip: ip })
            });
            const data = await res.json();
            
            if (data.success) {
                espStatus.classList.replace('bg-gray-500', 'bg-green-500');
                espStatus.classList.replace('bg-red-500', 'bg-green-500');
                espStatusText.textContent = 'Conectado';
                espStatusText.classList.replace('text-gray-400', 'text-green-400');
                espStatusText.classList.replace('text-red-400', 'text-green-400');
                logEvent('info', 'ESP8266 Conectado exitosamente');
            } else {
                setEspDisconnected();
                logEvent('error', `Error conexión: ${data.error}`);
            }
        } catch (e) {
            setEspDisconnected();
            logEvent('error', 'Error de red al verificar ESP');
        }
        btnCheckEsp.textContent = 'Verificar';
    });

    function setEspDisconnected() {
        espStatus.classList.replace('bg-green-500', 'bg-red-500');
        espStatus.classList.replace('bg-gray-500', 'bg-red-500');
        espStatusText.textContent = 'Error';
        espStatusText.classList.replace('text-green-400', 'text-red-400');
        espStatusText.classList.replace('text-gray-400', 'text-red-400');
    }

    // 2. Command Sending
    async function sendCommand(action) {
        if (onCooldown) {
            console.log("Cooldown activo, ignorando comando");
            return;
        }

        const ip = espIpInput.value.trim();
        if (!ip) {
            alert('Por favor, ingresa la IP del ESP8266 y verifícala.');
            return;
        }

        // Generate the instructions array based on action
        let instructions = [];
        if (action === 'FORWARD') {
            instructions = [{ action: 'FORWARD', distance_cm: 25.0 }];
        } else if (action === 'LEFT') {
            instructions = [{ action: 'TURN_LEFT', degrees: 90 }];
        } else if (action === 'RIGHT') {
            instructions = [{ action: 'TURN_RIGHT', degrees: 90 }];
        } else {
            return;
        }

        // Start Cooldown UX
        startCooldown();

        logEvent('command', `Enviando pulso: ${action} ...`);

        try {
            const res = await fetch('/api/send-to-cart/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    esp_ip: ip,
                    instructions: instructions
                })
            });

            const data = await res.json();
            if (data.success) {
                logEvent('success', `✔ Comando ${action} enviado a la ESP`);
            } else {
                logEvent('error', `✖ Error: ${data.error}`);
            }
        } catch (e) {
            logEvent('error', `✖ Error de red: ${e.message}`);
        }
    }

    // 3. Cooldown Logic
    function startCooldown() {
        onCooldown = true;
        
        // Block UI
        cooldownOverlay.classList.remove('hidden');
        cooldownOverlay.classList.add('flex');
        
        btnForward.classList.add('btn-disabled');
        btnLeft.classList.add('btn-disabled');
        btnRight.classList.add('btn-disabled');
        
        // Animate bar
        cooldownBar.style.transition = 'none';
        cooldownBar.style.width = '100%';
        
        // Force reflow
        void cooldownBar.offsetWidth;
        
        cooldownBar.style.transition = `width ${COOLDOWN_MS}ms linear`;
        cooldownBar.style.width = '0%';

        setTimeout(() => {
            onCooldown = false;
            
            // Unblock UI
            cooldownOverlay.classList.add('hidden');
            cooldownOverlay.classList.remove('flex');
            
            btnForward.classList.remove('btn-disabled');
            btnLeft.classList.remove('btn-disabled');
            btnRight.classList.remove('btn-disabled');
            
        }, COOLDOWN_MS);
    }

    // 4. Input Listeners (Buttons)
    btnForward.addEventListener('click', () => { if(!keyIsDown) sendCommand('FORWARD'); });
    btnLeft.addEventListener('click', () => { if(!keyIsDown) sendCommand('LEFT'); });
    btnRight.addEventListener('click', () => { if(!keyIsDown) sendCommand('RIGHT'); });

    // 5. Input Listeners (Keyboard)
    window.addEventListener('keydown', (e) => {
        if (keyIsDown) return; // Prevent hold-down repeat
        if (onCooldown) return;
        if (e.target.tagName === 'INPUT') return;

        let action = null;
        let btnElement = null;

        switch(e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                action = 'FORWARD';
                btnElement = btnForward;
                break;
            case 'a':
            case 'arrowleft':
                action = 'LEFT';
                btnElement = btnLeft;
                break;
            case 'd':
            case 'arrowright':
                action = 'RIGHT';
                btnElement = btnRight;
                break;
        }

        if (action) {
            e.preventDefault(); // Evitar scroll
            keyIsDown = true; // Block until keyup
            btnElement.classList.add('active-hold');
            sendCommand(action);
        }
    });

    window.addEventListener('keyup', (e) => {
        keyIsDown = false; // Allow next press
        btnForward.classList.remove('active-hold');
        btnLeft.classList.remove('active-hold');
        btnRight.classList.remove('active-hold');
    });

    // 6. Utils
    function logEvent(type, message) {
        if (commandLog.children.length === 1 && commandLog.children[0].classList.contains('italic')) {
            commandLog.innerHTML = '';
        }

        const div = document.createElement('div');
        div.className = 'log-entry py-1 border-b border-gray-700 log-flash flex gap-2';

        const time = new Date().toLocaleTimeString();
        let icon = 'ℹ️';
        let color = 'text-gray-300';

        if (type === 'error') { icon = '❌'; color = 'text-red-400'; }
        else if (type === 'success') { icon = '✅'; color = 'text-green-400'; }
        else if (type === 'command') { icon = '🚀'; color = 'text-yellow-400'; }

        div.innerHTML = `
            <span class="text-gray-500">[${time}]</span>
            <span>${icon}</span>
            <span class="${color}">${message}</span>
        `;
        
        commandLog.prepend(div);
        
        if (commandLog.children.length > 50) {
            commandLog.removeChild(commandLog.lastChild);
        }
    }

    btnClearLog.addEventListener('click', () => {
        commandLog.innerHTML = '<div class="text-gray-500 italic text-center py-2">Esperando instrucción...</div>';
    });

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});
