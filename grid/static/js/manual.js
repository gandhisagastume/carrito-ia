document.addEventListener('DOMContentLoaded', () => {
    // ── CSRF helper ──
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

    // ── Estado ──
    let isSending = false;
    const espIpInput = document.getElementById('espIp');
    const commandLog = document.getElementById('commandLog');
    const carStatus = document.getElementById('carStatus');

    // ── Log helpers ──
    function addLogEntry(icon, text, colorClass = 'text-gray-300') {
        // Quitar el placeholder si existe
        if (commandLog.children.length === 1 && commandLog.children[0].classList.contains('italic')) {
            commandLog.innerHTML = '';
        }

        const entry = document.createElement('div');
        entry.className = `log-entry flex items-center gap-2 px-2 py-1 rounded log-flash ${colorClass}`;
        const time = new Date().toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        entry.innerHTML = `<span class="text-gray-500 text-xs">${time}</span><span>${icon}</span><span>${text}</span>`;
        commandLog.insertBefore(entry, commandLog.firstChild);

        // Limitar a 50 entradas
        while (commandLog.children.length > 50) {
            commandLog.removeChild(commandLog.lastChild);
        }
    }

    document.getElementById('btnClearLog').addEventListener('click', () => {
        commandLog.innerHTML = '<div class="text-gray-500 italic text-center py-2">Presiona un boton para enviar un comando</div>';
    });

    // ── Enviar comando ──
    async function sendCommand(action) {
        const ip = espIpInput.value.trim();
        if (!ip) {
            addLogEntry('⚠️', 'Falta la IP del ESP8266', 'text-yellow-400');
            return;
        }

        if (isSending) {
            addLogEntry('⏳', 'Espera a que termine el comando anterior...', 'text-yellow-400');
            return;
        }

        isSending = true;
        carStatus.innerText = 'Enviando...';
        carStatus.className = 'text-yellow-400 font-bold text-sm';

        const actionLabels = {
            'FORWARD':  { icon: '⬆️', text: 'Avanzar' },
            'BACKWARD': { icon: '⬇️', text: 'Retroceder' },
            'LEFT':     { icon: '↪️', text: 'Giro Izquierda 90°' },
            'RIGHT':    { icon: '↩️', text: 'Giro Derecha 90°' },
            'STOP':     { icon: '🛑', text: 'Detener' }
        };
        const label = actionLabels[action];

        try {
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || getCookie('csrftoken');
            const res = await fetch('/api/manual-command/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ esp_ip: ip, action: action })
            });
            const data = await res.json();

            if (data.success) {
                addLogEntry(label.icon, `${label.text} — Enviado a ${ip}`, 'text-green-400');
                carStatus.innerText = 'Listo';
                carStatus.className = 'text-green-400 font-bold text-sm';
            } else {
                addLogEntry('❌', `${label.text} — Error: ${data.error || 'Desconocido'}`, 'text-red-400');
                carStatus.innerText = 'Error';
                carStatus.className = 'text-red-400 font-bold text-sm';
            }
        } catch (e) {
            addLogEntry('❌', `${label.text} — Fallo de red: ${e.message}`, 'text-red-400');
            carStatus.innerText = 'Desconectado';
            carStatus.className = 'text-red-400 font-bold text-sm';
        } finally {
            isSending = false;
            // Restaurar estado luego de un rato si estaba en error
            setTimeout(() => {
                if (carStatus.innerText !== 'Enviando...') {
                    carStatus.innerText = 'Listo';
                    carStatus.className = 'text-green-400 font-bold text-sm';
                }
            }, 2000);
        }
    }

    // ── Botones ──
    document.querySelectorAll('.control-btn').forEach(btn => {
        const action = btn.dataset.action;
        btn.addEventListener('click', () => sendCommand(action));
    });

    // ── Teclado ──
    const keyMap = {
        'ArrowUp':    'FORWARD',
        'w':          'FORWARD',
        'W':          'FORWARD',
        'ArrowDown':  'BACKWARD',
        's':          'BACKWARD',
        'S':          'BACKWARD',
        'ArrowLeft':  'LEFT',
        'a':          'LEFT',
        'A':          'LEFT',
        'ArrowRight': 'RIGHT',
        'd':          'RIGHT',
        'D':          'RIGHT',
        ' ':          'STOP'
    };

    document.addEventListener('keydown', (e) => {
        if (keyMap[e.key]) {
            e.preventDefault();
            const action = keyMap[e.key];
            const btn = document.querySelector(`.control-btn[data-action="${action}"]`);
            if (btn) {
                btn.classList.add('active-hold');
                sendCommand(action);
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (keyMap[e.key]) {
            const action = keyMap[e.key];
            const btn = document.querySelector(`.control-btn[data-action="${action}"]`);
            if (btn) btn.classList.remove('active-hold');
        }
    });

    // ── Verificar ESP (misma lógica que grid.js) ──
    document.getElementById('btnCheckEsp').addEventListener('click', async () => {
        const ip = espIpInput.value.trim();
        const statusIcon = document.getElementById('espStatus');
        const statusText = document.getElementById('espStatusText');
        const btn = document.getElementById('btnCheckEsp');

        if (!ip) {
            addLogEntry('⚠️', 'Ingresa una IP para verificar', 'text-yellow-400');
            return;
        }

        btn.disabled = true;
        btn.innerText = '⏳';
        statusIcon.className = 'w-3 h-3 rounded-full bg-yellow-500 animate-pulse';
        statusText.innerText = 'Buscando...';
        statusText.className = 'text-xs text-yellow-500 w-24';

        try {
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || getCookie('csrftoken');
            const res = await fetch('/api/check-esp/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ esp_ip: ip })
            });
            const data = await res.json();

            if (data.success) {
                statusIcon.className = 'w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]';
                statusText.innerText = 'Conectado';
                statusText.className = 'text-xs text-green-400 font-bold w-24';
                addLogEntry('✅', `ESP8266 conectado en ${ip}`, 'text-green-400');
            } else {
                statusIcon.className = 'w-3 h-3 rounded-full bg-red-500';
                statusText.innerText = 'Error IP';
                statusText.className = 'text-xs text-red-400 w-24';
                addLogEntry('❌', `No se pudo conectar a ${ip}`, 'text-red-400');
            }
        } catch (e) {
            statusIcon.className = 'w-3 h-3 rounded-full bg-red-500';
            statusText.innerText = 'Fallo de Red';
            statusText.className = 'text-xs text-red-400 w-24';
            addLogEntry('❌', `Fallo de red al contactar ${ip}`, 'text-red-400');
        } finally {
            btn.disabled = false;
            btn.innerText = 'Verificar';
        }
    });
});
