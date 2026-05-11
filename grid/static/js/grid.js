document.addEventListener('DOMContentLoaded', () => {
    const GRID_SIZE = 8;
    const gridContainer = document.getElementById('gridContainer');
    
    // State
    let startPos = [0, 0];
    let goalPos = [7, 7];
    let obstacles = new Set();
    let cellCosts = {}; // "r,c" -> cost
    let currentMode = 'start'; // start, goal, obstacle, cost, eraser
    let activeCellForCost = null;
    let isDragging = false;
    
    // Chess pieces for obstacles
    const pieces = ['♜', '♞', '♝', '♛'];
    
    // SVGs
    const carSVG = `<svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]"><rect x="3" y="11" width="18" height="8" rx="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/><path d="M4 11V7a2 2 0 0 1 2-2h5l3 4"/></svg>`;
    const goalSVG = `<svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;

    function initGrid() {
        gridContainer.innerHTML = '';
        cellCosts = {};
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                // Initialize with random cost between 1 and 9
                cellCosts[`${r},${c}`] = Math.floor(Math.random() * 9) + 1;
                
                const cell = document.createElement('div');
                cell.className = `grid-cell ${(r + c) % 2 === 0 ? 'cell-light' : 'cell-dark'}`;
                cell.dataset.r = r;
                cell.dataset.c = c;
                
                // Add overlay divs for animations
                const overlay = document.createElement('div');
                overlay.className = 'overlay';
                overlay.id = `overlay-${r}-${c}`;
                cell.appendChild(overlay);

                // Add content container
                const content = document.createElement('div');
                content.className = 'text-4xl piece flex items-center justify-center';
                content.id = `content-${r}-${c}`;
                cell.appendChild(content);
                
                // Cost badge
                const costBadge = document.createElement('div');
                costBadge.className = 'cost-badge hidden';
                costBadge.id = `cost-${r}-${c}`;
                costBadge.innerText = '1';
                cell.appendChild(costBadge);

                // Events
                cell.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    handleCellClick(r, c);
                });
                cell.addEventListener('mouseenter', (e) => {
                    if (isDragging) handleCellClick(r, c);
                });

                gridContainer.appendChild(cell);
            }
        }
        
        document.body.addEventListener('mouseup', () => {
            isDragging = false;
        });

        updateGridVisuals();
    }

    function handleCellClick(r, c) {
        // Clear previous path/explored visuals when editing
        clearVisuals();
        const cellKey = `${r},${c}`;

        if (currentMode === 'start') {
            if (startPos && startPos[0] === r && startPos[1] === c) {
                startPos = null; // Toggle off
            } else {
                startPos = [r, c];
                if (goalPos && goalPos[0] === r && goalPos[1] === c) goalPos = null;
                obstacles.delete(cellKey);
            }
        } 
        else if (currentMode === 'goal') {
            if (goalPos && goalPos[0] === r && goalPos[1] === c) {
                goalPos = null; // Toggle off
            } else {
                goalPos = [r, c];
                if (startPos && startPos[0] === r && startPos[1] === c) startPos = null;
                obstacles.delete(cellKey);
            }
        } 
        else if (currentMode === 'obstacle') {
            if ((startPos && startPos[0] === r && startPos[1] === c) || 
                (goalPos && goalPos[0] === r && goalPos[1] === c)) {
                return; // Can't overwrite start/goal with obstacle
            }
            if (obstacles.has(cellKey)) {
                obstacles.delete(cellKey); // Toggle off
            } else {
                obstacles.add(cellKey);
            }
        } 
        else if (currentMode === 'cost') {
            if (!isDragging) { // Only trigger cost modal on click, not drag
                activeCellForCost = cellKey;
                document.getElementById('costInput').value = cellCosts[activeCellForCost] || 1;
                document.getElementById('costModal').classList.add('active');
            }
            return; // don't update grid immediately
        }

        updateGridVisuals();
    }

    function updateGridVisuals() {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const content = document.getElementById(`content-${r}-${c}`);
                const costBadge = document.getElementById(`cost-${r}-${c}`);
                content.innerText = '';
                
                // Show cost badge
                const cost = cellCosts[`${r},${c}`] || 1;
                costBadge.innerText = cost;
                
                // Only show badge if it's not start, goal, or obstacle to keep it clean, 
                // or just always show it. Let's show it always except if obstacle.
                if (obstacles.has(`${r},${c}`)) {
                    costBadge.classList.add('hidden');
                } else {
                    costBadge.classList.remove('hidden');
                }

                if (startPos && startPos[0] === r && startPos[1] === c) {
                    content.innerHTML = carSVG;
                } else if (goalPos && goalPos[0] === r && goalPos[1] === c) {
                    content.innerHTML = goalSVG;
                } else if (obstacles.has(`${r},${c}`)) {
                    // Just use a random piece based on coordinates so it stays consistent
                    const piece = pieces[(r * 7 + c * 11) % pieces.length];
                    // Using a white stroke so it's visible on both black and white cells
                    content.innerHTML = `<span class="text-black drop-shadow-lg" style="-webkit-text-stroke: 1.5px rgba(255,255,255,0.9); font-size: 50px;">${piece}</span>`;
                }
            }
        }
    }

    function clearVisuals() {
        document.querySelectorAll('.overlay').forEach(el => {
            el.className = 'overlay';
            el.innerHTML = '';
        });
        document.getElementById('reasoningBody').innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 italic py-4">Sin datos</td></tr>';
        document.getElementById('instructionsList').innerHTML = '<div class="text-gray-500 italic text-center mt-4">Calcula la ruta primero</div>';
        document.getElementById('btnSendEsp').disabled = true;
    }

    // Modal Handlers
    document.getElementById('btnSaveCost').addEventListener('click', () => {
        if (activeCellForCost) {
            const val = parseInt(document.getElementById('costInput').value) || 1;
            cellCosts[activeCellForCost] = val;
            updateGridVisuals();
        }
        document.getElementById('costModal').classList.remove('active');
    });

    document.getElementById('btnCancelCost').addEventListener('click', () => {
        document.getElementById('costModal').classList.remove('active');
    });

    document.getElementById('btnResultClose').addEventListener('click', () => {
        document.getElementById('resultModal').classList.remove('active');
    });

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => {
                b.classList.remove('active', 'border-green-500');
                b.classList.add('border-transparent');
            });
            const target = e.currentTarget;
            target.classList.add('active', 'border-green-500');
            target.classList.remove('border-transparent');
            currentMode = target.dataset.mode;
            
            // Update helper text
            const helper = document.getElementById('modeHelper');
            if (currentMode === 'start') helper.innerText = "Haz click para colocar el inicio. Haz click de nuevo para quitarlo.";
            else if (currentMode === 'goal') helper.innerText = "Haz click para colocar la meta. Haz click de nuevo para quitarla.";
            else if (currentMode === 'obstacle') helper.innerText = "Arrastra o haz click para colocar obstáculos. Click de nuevo para quitarlos.";
            else if (currentMode === 'cost') helper.innerText = "Haz click en una celda para cambiar su costo de movimiento.";
        });
    });

    // Clear Button
    document.getElementById('btnClear').addEventListener('click', () => {
        startPos = null;
        goalPos = null;
        obstacles.clear();
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                cellCosts[`${r},${c}`] = 1; // Reset all costs to 1 on clear, or random? Let's make them 1 for a clean slate
            }
        }
        clearVisuals();
        updateGridVisuals();
    });

    // Generate Maze Button
    document.getElementById('btnMaze').addEventListener('click', () => {
        obstacles.clear();
        clearVisuals();
        
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                // Random costs
                cellCosts[`${r},${c}`] = Math.floor(Math.random() * 9) + 1;
                
                // Random obstacles with ~30% probability
                if (Math.random() < 0.3) {
                    // Don't place on start or goal
                    if (!((startPos && startPos[0] === r && startPos[1] === c) || 
                          (goalPos && goalPos[0] === r && goalPos[1] === c))) {
                        obstacles.add(`${r},${c}`);
                    }
                }
            }
        }
        updateGridVisuals();
    });

    // CSRF helper
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

    // A* Calculate
    let lastInstructions = [];
    
    document.getElementById('btnCalculate').addEventListener('click', async () => {
        if (!startPos || !goalPos) {
            alert('Debes definir Inicio y Meta.');
            return;
        }
        
        clearVisuals();
        const btn = document.getElementById('btnCalculate');
        btn.disabled = true;
        btn.innerHTML = '⏳ Calculando...';

        const data = {
            size: GRID_SIZE,
            start: startPos,
            goal: goalPos,
            initial_orientation: document.getElementById('startOrientation').value,
            obstacles: Array.from(obstacles).map(str => {
                const parts = str.split(',');
                return [parseInt(parts[0]), parseInt(parts[1])];
            }),
            cell_costs: cellCosts
        };

        try {
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || getCookie('csrftoken');
            const res = await fetch('/api/calculate/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (result.success) {
                lastInstructions = result.instructions;
                await animateAStar(result.explored, result.path);
                showResultModal(true, result);
                renderInstructions(result.instructions);
                document.getElementById('btnSendEsp').disabled = false;
            } else {
                await animateAStar(result.explored, []);
                showResultModal(false, result);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión al servidor");
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🚀 Calcular A*';
        }
    });

    async function animateAStar(explored, path) {
        const reasoningBody = document.getElementById('reasoningBody');
        reasoningBody.innerHTML = '';
        
        // Animamos explorados
        for (let i = 0; i < explored.length; i++) {
            const step = explored[i];
            const r = step.node[0];
            const c = step.node[1];
            
            // Si no es start o goal, pintamos
            if (!(r === startPos[0] && c === startPos[1]) && !(r === goalPos[0] && c === goalPos[1])) {
                const overlay = document.getElementById(`overlay-${r}-${c}`);
                if (!overlay.classList.contains('explored')) {
                    overlay.classList.add('explored');
                    overlay.innerHTML = `<div class="text-[8px] font-mono absolute bottom-1 left-1 leading-none text-white opacity-70">f:${step.f}<br>g:${step.g}</div>`;
                }
            }
            
            // Add table row
            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-700 hover:bg-gray-700";
            tr.innerHTML = `
                <td class="py-1">${step.step}</td>
                <td>(${r},${c})</td>
                <td>${step.g}</td>
                <td>${step.h}</td>
                <td class="text-blue-400 font-bold">${step.f}</td>
            `;
            reasoningBody.appendChild(tr);
            
            // Auto scroll to bottom
            reasoningBody.parentElement.parentElement.scrollTop = reasoningBody.parentElement.parentElement.scrollHeight;
            
            await new Promise(r => setTimeout(r, 20)); // Delay animation
        }
        
        // Animamos camino
        for (let i = 0; i < path.length; i++) {
            const node = path[i];
            const r = node[0];
            const c = node[1];
            
            if (!(r === startPos[0] && c === startPos[1]) && !(r === goalPos[0] && c === goalPos[1])) {
                const overlay = document.getElementById(`overlay-${r}-${c}`);
                overlay.className = 'overlay path'; // remove explored class, add path class
            }
            await new Promise(r => setTimeout(r, 50));
        }
    }

    function showResultModal(success, data) {
        const modal = document.getElementById('resultModal');
        const icon = document.getElementById('resultIcon');
        const title = document.getElementById('resultTitle');
        
        if (success) {
            icon.innerText = '✅';
            title.innerText = '¡Ruta Encontrada!';
            title.className = 'text-2xl font-bold mb-2 text-green-400';
            document.getElementById('resExplored').innerText = data.explored.length;
            document.getElementById('resLength').innerText = data.path.length;
            document.getElementById('resCost').innerText = data.total_cost;
        } else {
            icon.innerText = '❌';
            title.innerText = 'Ruta NO Encontrada';
            title.className = 'text-2xl font-bold mb-2 text-red-500';
            document.getElementById('resExplored').innerText = data.explored.length;
            document.getElementById('resLength').innerText = '-';
            document.getElementById('resCost').innerText = '-';
        }
        
        modal.classList.add('active');
    }

    function renderInstructions(instructions) {
        const list = document.getElementById('instructionsList');
        list.innerHTML = '';
        
        instructions.forEach((inst, idx) => {
            const div = document.createElement('div');
            div.className = 'bg-gray-700 p-2 rounded flex items-center justify-between';
            
            let icon = '';
            let text = '';
            let detail = '';
            
            if (inst.action === 'FORWARD') {
                icon = '⬆️';
                text = 'Avanzar';
                detail = `${inst.distance_cm} cm (${inst.cells} celdas)`;
            } else if (inst.action === 'TURN_RIGHT') {
                icon = '➡️';
                text = 'Girar Derecha';
                detail = '90°';
            } else if (inst.action === 'TURN_LEFT') {
                icon = '⬅️';
                text = 'Girar Izquierda';
                detail = '90°';
            } else if (inst.action === 'STOP') {
                icon = '🛑';
                text = 'Detener';
                detail = '';
            }
            
            div.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="w-6 text-center">${icon}</span>
                    <span class="font-bold text-gray-200">${text}</span>
                </div>
                <span class="text-xs text-yellow-400 font-mono">${detail}</span>
            `;
            list.appendChild(div);
        });
    }

    // Send to ESP
    document.getElementById('btnSendEsp').addEventListener('click', async () => {
        if (!lastInstructions || lastInstructions.length === 0) return;
        
        const ip = document.getElementById('espIp').value;
        const btn = document.getElementById('btnSendEsp');
        const originalText = btn.innerText;
        btn.innerText = 'Enviando...';
        btn.disabled = true;
        
        try {
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || getCookie('csrftoken');
            const res = await fetch('/api/send-to-cart/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    esp_ip: ip,
                    instructions: lastInstructions
                })
            });
            const data = await res.json();
            
            if (data.success) {
                alert(`¡Instrucciones enviadas! (Simulación a ${ip})`);
            }
        } catch (e) {
            alert('Error al enviar al ESP.');
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });

    // Check ESP Connection
    document.getElementById('btnCheckEsp').addEventListener('click', async () => {
        const ip = document.getElementById('espIp').value;
        const statusIcon = document.getElementById('espStatus');
        const statusText = document.getElementById('espStatusText');
        const btn = document.getElementById('btnCheckEsp');
        
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
            } else {
                statusIcon.className = 'w-3 h-3 rounded-full bg-red-500';
                statusText.innerText = 'Error IP';
                statusText.className = 'text-xs text-red-400 w-24';
                alert('No se pudo conectar al carrito. Verifica la IP y que estés conectado a su red WiFi.');
            }
        } catch (e) {
            statusIcon.className = 'w-3 h-3 rounded-full bg-red-500';
            statusText.innerText = 'Fallo de Red';
            statusText.className = 'text-xs text-red-400 w-24';
        } finally {
            btn.disabled = false;
            btn.innerText = 'Verificar';
        }
    });

    initGrid();
});
