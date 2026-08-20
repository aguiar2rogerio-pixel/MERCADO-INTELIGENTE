    let state = {
        items: [], 
        history: [], 
        itemBank: {}, 
        marketBank: [], 
        buyerBank: [], 
        selectedMonthYear: ""
    };

    const STORAGE_KEY = 'smart_shopping_list_v6';

    const MONTH_NAMES = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    let currentEditingHistoryId = null;

    function capitalizeName(name) {
        let trimmed = String(name ?? '').trim();
        if (!trimmed) return "";
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }

    // Compara textos sem diferenciar maiúsculas, minúsculas ou acentos.
    function normalizeText(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('pt-BR')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function compareText(a, b) {
        return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { sensitivity: 'base' });
    }

    function safeNumber(value, fallback = 0) {
        const number = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
        return Number.isFinite(number) ? number : fallback;
    }

    function normalizeItem(item, index = 0) {
        const name = capitalizeName(item?.name);
        const qty = Math.max(0, safeNumber(item?.qty, 0));
        const price = Math.max(0, safeNumber(item?.price, 0));
        const lastPrice = Math.max(0, safeNumber(item?.lastPrice, price));
        return {
            ...item,
            id: Number.isFinite(item?.id) ? item.id : Date.now() + index,
            name,
            qty,
            type: item?.type === 'kg' ? 'kg' : 'un',
            price,
            checked: Boolean(item?.checked),
            lastPrice
        };
    }

    function normalizeState(raw = {}) {
        const next = { ...state, ...(raw && typeof raw === 'object' ? raw : {}) };
        next.items = Array.isArray(next.items)
            ? next.items.filter(item => item && typeof item === 'object' && capitalizeName(item.name)).map(normalizeItem)
            : [];
        next.history = Array.isArray(next.history)
            ? next.history.filter(purchase => purchase && typeof purchase === 'object').map((purchase, index) => ({
                ...purchase,
                id: Number.isFinite(purchase.id) ? purchase.id : Date.now() + index,
                date: String(purchase.date || ''),
                total: Math.max(0, safeNumber(purchase.total, 0)),
                market: capitalizeName(purchase.market) || 'Não Informado',
                buyer: capitalizeName(purchase.buyer) || 'Não Informado',
                items: Array.isArray(purchase.items) ? purchase.items.filter(item => item && typeof item === 'object').map(normalizeItem) : []
            }))
            : [];
        next.marketBank = Array.isArray(next.marketBank)
            ? [...new Set(next.marketBank.map(capitalizeName).filter(Boolean))].sort(compareText)
            : [];
        next.buyerBank = Array.isArray(next.buyerBank)
            ? [...new Set(next.buyerBank.map(capitalizeName).filter(Boolean))].sort(compareText)
            : [];

        const normalizedBank = {};
        if (next.itemBank && typeof next.itemBank === 'object') {
            Object.entries(next.itemBank).forEach(([rawName, value]) => {
                const displayName = capitalizeName(value && typeof value === 'object' && value.name ? value.name : rawName);
                const key = normalizeText(displayName || rawName);
                if (!key) return;
                normalizedBank[key] = {
                    name: displayName || rawName,
                    price: Math.max(0, safeNumber(value && typeof value === 'object' ? value.price : value, 0)),
                    type: value && typeof value === 'object' && value.type === 'kg' ? 'kg' : 'un'
                };
            });
        }
        next.items.forEach(item => {
            const key = normalizeText(item.name);
            if (key && !normalizedBank[key]) {
                normalizedBank[key] = { name: item.name, price: item.price, type: item.type };
            }
        });
        next.itemBank = normalizedBank;
        return next;
    }

    async function init() {
        if (navigator.storage && navigator.storage.persist) {
            await navigator.storage.persist();
        }

        let saved = localStorage.getItem(STORAGE_KEY) || 
                    localStorage.getItem('smart_shopping_list_v1');
                    
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                state = normalizeState(parsed);
            } catch (e) {
                console.error("Erro ao carregar dados:", e);
            }
        }

        if (!state.selectedMonthYear) {
            const now = new Date();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            state.selectedMonthYear = `${m}/${now.getFullYear()}`;
        }

        render();
        setupEventListeners();
    }

    function save() {
        state = normalizeState(state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function addItem(name) {
        if (!name.trim()) return;
        
        const formattedName = capitalizeName(name);
        const key = normalizeText(formattedName);
        const duplicate = state.items.find(item => normalizeText(item.name) === key);
        if (duplicate) {
            openEditModal(duplicate.id);
            return;
        }
        
        let lastPrice = 0;
        let lastType = 'un';

        if (state.itemBank[key]) {
            if (typeof state.itemBank[key] === 'object') {
                lastPrice = state.itemBank[key].price || 0;
                lastType = state.itemBank[key].type || 'un';
            } else {
                lastPrice = state.itemBank[key];
            }
        }
        
        const newItem = {
            id: Date.now(),
            name: formattedName,
            qty: 1,
            type: lastType,
            price: lastPrice,
            checked: false,
            lastPrice: lastPrice
        };
        
        state.items.push(newItem);
        save();
        render();
    }

    function parseWeight(val) {
        let num = parseFloat(val.toString().replace(',', '.'));
        if (isNaN(num)) return 0;
        return num;
    }

    function updateItem(id, updates) {
        const idx = state.items.findIndex(i => i.id === id);
        if (idx !== -1) {
            const previousItem = state.items[idx];
            const previousKey = normalizeText(previousItem.name);
            if (updates.qty !== undefined) {
                updates.qty = parseWeight(updates.qty);
            }
            if (updates.name !== undefined && updates.name.trim() !== "") {
                updates.name = capitalizeName(updates.name);
            }
            
            const nextItem = normalizeItem({ ...state.items[idx], ...updates });
            const duplicate = state.items.find((item, itemIndex) => itemIndex !== idx && normalizeText(item.name) === normalizeText(nextItem.name));
            if (duplicate) {
                openEditModal(duplicate.id);
                return;
            }
            state.items[idx] = nextItem;
            
            const key = normalizeText(state.items[idx].name);
            if (previousKey !== key) {
                delete state.itemBank[previousKey];
            }
            state.itemBank[key] = {
                name: state.items[idx].name,
                price: state.items[idx].price,
                type: state.items[idx].type
            };
            
            save();
            render();
        }
    }

    function toggleItem(id) {
        const item = state.items.find(i => i.id === id);
        if (item) {
            item.checked = !item.checked;
            save();
            render();
        }
    }

    function deleteItem(id) {
        state.items = state.items.filter(i => i.id !== id);
        save();
        render();
    }

    function finishPurchase() {
        const realTotal = calculateRealTotal();
        const checkedItems = state.items.filter(i => i.checked);

        if (realTotal > 0 || checkedItems.length > 0) {
            document.getElementById('finishMarket').value = '';
            document.getElementById('finishBuyer').value = '';
            document.getElementById('modalFinishPurchase').style.display = 'flex';
        }
    }

    function confirmFinishPurchase() {
        const marketInput = document.getElementById('finishMarket').value.trim();
        const buyerInput = document.getElementById('finishBuyer').value.trim();

        const market = marketInput ? capitalizeName(marketInput) : "Não Informado";
        const buyer = buyerInput ? capitalizeName(buyerInput) : "Não Informado";

        if (marketInput && !state.marketBank.includes(market)) {
            state.marketBank.push(market);
        }
        if (buyerInput && !state.buyerBank.includes(buyer)) {
            state.buyerBank.push(buyer);
        }

        const realTotal = calculateRealTotal();
        const checkedItems = state.items.filter(i => i.checked);
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR');
        
        const itemsToSave = checkedItems.map(i => ({
            name: i.name,
            qty: i.qty,
            type: i.type,
            price: i.price
        }));

        state.history.unshift({ 
            id: Date.now(), 
            date: dateStr, 
            total: realTotal,
            market: market,
            buyer: buyer,
            items: itemsToSave 
        });
        
        const m = String(now.getMonth() + 1).padStart(2, '0');
        state.selectedMonthYear = `${m}/${now.getFullYear()}`;
        
        state.items = state.items.filter(i => !i.checked).map(i => {
            const key = normalizeText(i.name);
            let lastPrice = 0;
            if (state.itemBank[key]) {
                lastPrice = typeof state.itemBank[key] === 'object' ? state.itemBank[key].price : state.itemBank[key];
            }
            return {
                ...i,
                price: lastPrice
            };
        });
        
        document.getElementById('modalFinishPurchase').style.display = 'none';
        save();
        render();
        alert('Compra finalizada com sucesso!');
    }

    function calculateEstimatedTotal() {
        return state.items
            .filter(i => !i.checked)
            .reduce((acc, i) => acc + (i.qty * (i.price > 0 ? i.price : (i.lastPrice || 0))), 0);
    }

    function calculateRealTotal() {
        return state.items
            .filter(i => i.checked)
            .reduce((acc, i) => acc + (i.qty * (i.price || 0)), 0);
    }

    function getMonthYearFromKey(dateStr) {
        if (!dateStr) return "";
        const parts = dateStr.split('/');
        if (parts.length < 3) return "";
        return `${parts[1]}/${parts[2]}`;
    }

    function render() {
        const listTodo = document.getElementById('list-todo');
        const listCart = document.getElementById('list-cart');
        const historyContainer = document.getElementById('history-container');
        const pillsContainer = document.getElementById('monthPillsContainer');
        const divBreakdown = document.getElementById('div-breakdown');
        
        listTodo.innerHTML = '';
        listCart.innerHTML = '';
        divBreakdown.innerHTML = '';
        
        let todoCount = 0;
        let cartCount = 0;

        const sortedItems = [...state.items].sort((a, b) => compareText(a.name, b.name));

        sortedItems.forEach(item => {
            if (item.checked) {
                cartCount++;
                listCart.appendChild(createItemElement(item, cartCount));
            } else {
                todoCount++;
                listTodo.appendChild(createItemElement(item, todoCount));
            }
        });

        document.getElementById('count-todo').innerText = `${todoCount} ${todoCount === 1 ? 'item' : 'itens'}`;
        document.getElementById('count-cart').innerText = `${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`;

        document.getElementById('val-estimated').innerText = `R$ ${calculateEstimatedTotal().toFixed(2).replace('.', ',')}`;
        document.getElementById('val-real').innerText = `R$ ${calculateRealTotal().toFixed(2).replace('.', ',')}`;

        const monthMap = new Set();
        const now = new Date();
        const currentMY = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        monthMap.add(currentMY);

        state.history.forEach(h => {
            const my = getMonthYearFromKey(h.date);
            if (my) monthMap.add(my);
        });

        const sortedMonths = Array.from(monthMap).sort((a, b) => {
            const [mA, aA] = a.split('/').map(Number);
            const [mB, aB] = b.split('/').map(Number);
            return (aB * 12 + mB) - (aA * 12 + mA);
        });

        pillsContainer.innerHTML = '';
        sortedMonths.forEach(my => {
            const [mStr, yStr] = my.split('/');
            const monthIndex = parseInt(mStr, 10) - 1;
            const labelText = `${MONTH_NAMES[monthIndex]} / ${yStr}`;

            const button = document.createElement('button');
            button.className = `pill ${state.selectedMonthYear === my ? 'active' : ''}`;
            button.innerText = labelText;
            button.onclick = () => {
                state.selectedMonthYear = my;
                save();
                render();
            };
            pillsContainer.appendChild(button);
        });

        let totalSelectedMonth = 0;
        let breakdown = {};
        historyContainer.innerHTML = '';

        const filteredHistory = state.history.filter(h => getMonthYearFromKey(h.date) === state.selectedMonthYear);

        filteredHistory.forEach(h => {
            totalSelectedMonth += h.total;

            const pBuyer = h.buyer || "Não Informado";
            if (!breakdown[pBuyer]) breakdown[pBuyer] = 0;
            breakdown[pBuyer] += h.total;

            const pMarket = h.market || "Não Informado";

            const div = document.createElement('div');
            div.className = 'history-item';
            const info = document.createElement('div');
            info.className = 'history-item-info';
            const date = document.createElement('span');
            date.innerText = `📅 ${h.date}`;
            const details = document.createElement('span');
            details.className = 'history-item-sub';
            details.innerText = `${pMarket} (${pBuyer})`;
            info.append(date, details);
            const total = document.createElement('b');
            total.innerText = `R$ ${safeNumber(h.total).toFixed(2).replace('.', ',')}`;
            div.append(info, total);
            div.onclick = () => openHistoryViewModal(h);
            historyContainer.appendChild(div);
        });

        if (filteredHistory.length === 0) {
            historyContainer.innerHTML = `<div style="text-align:center; color:gray; padding:16px; font-size:0.85rem;">Nenhuma compra neste mês.</div>`;
        }

        const [selM, selY] = state.selectedMonthYear.split('/');
        const activeMonthName = MONTH_NAMES[parseInt(selM, 10) - 1];
        document.getElementById('label-total-month').innerText = `Total de ${activeMonthName}:`;
        document.getElementById('total-month').innerText = `R$ ${totalSelectedMonth.toFixed(2).replace('.', ',')}`;

        const buyers = Object.keys(breakdown);
        if (buyers.length > 0) {
            const title = document.createElement('div');
            title.className = 'breakdown-title';
            title.innerText = 'Resumo por Colaboração';
            divBreakdown.appendChild(title);

            buyers.sort(compareText).forEach(b => {
                const row = document.createElement('div');
                row.className = 'breakdown-row';
                const buyerLabel = document.createElement('span');
                buyerLabel.innerText = `👤 ${b}`;
                const buyerTotal = document.createElement('b');
                buyerTotal.innerText = `R$ ${safeNumber(breakdown[b]).toFixed(2).replace('.', ',')}`;
                row.append(buyerLabel, buyerTotal);
                divBreakdown.appendChild(row);
            });
        }
    }

    function createItemElement(item, index) {
        const div = document.createElement('div');
        div.className = `list-item ${item.checked ? 'checked' : ''}`;
        
        const subtext = item.type === 'un'
            ? `${item.qty} un x R$ ${safeNumber(item.price).toFixed(2)}`
            : `${safeNumber(item.qty).toFixed(3)} kg x R$ ${safeNumber(item.price).toFixed(2)}`;

        const checkbox = document.createElement('button');
        checkbox.type = 'button';
        checkbox.className = `checkbox ${item.checked ? 'checked' : ''}`;
        checkbox.setAttribute('aria-label', item.checked ? `Desmarcar ${item.name}` : `Marcar ${item.name} como comprado`);
        checkbox.onclick = event => {
            event.stopPropagation();
            toggleItem(item.id);
        };

        const itemInfo = document.createElement('button');
        itemInfo.type = 'button';
        itemInfo.className = 'item-info';
        itemInfo.onclick = () => openEditModal(item.id);
        const itemName = document.createElement('span');
        itemName.className = 'item-name';
        itemName.innerText = `${index}. ${item.name}`;
        const itemDetails = document.createElement('span');
        itemDetails.className = 'item-details';
        itemDetails.innerText = `${subtext} = R$ ${(safeNumber(item.qty) * safeNumber(item.price)).toFixed(2)}`;
        itemInfo.append(itemName, itemDetails);

        const actions = document.createElement('div');
        actions.className = 'item-actions';
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn-icon';
        deleteButton.setAttribute('aria-label', `Excluir ${item.name}`);
        deleteButton.innerText = '✕';
        deleteButton.onclick = event => {
            event.stopPropagation();
            deleteItem(item.id);
        };
        actions.appendChild(deleteButton);
        div.append(checkbox, itemInfo, actions);
        return div;
    }

    let editingId = null;

    function openEditModal(id) {
        editingId = id;
        const item = state.items.find(i => i.id === id);
        if (!item) return;

        document.getElementById('editItemName').value = item.name;
        document.getElementById('editType').value = item.type;
        document.getElementById('editQty').value = item.type === 'kg' ? item.qty.toFixed(3) : item.qty;
        document.getElementById('editPrice').value = item.price || '';
        
        document.getElementById('modalEdit').style.display = 'flex';
    }

    function openHistoryViewModal(purchase) {
        currentEditingHistoryId = purchase.id;
        
        document.getElementById('historyViewTitle').innerText = `Detalhes (${purchase.date})`;
        document.getElementById('editHistoryMarket').value = purchase.market === "Não Informado" ? "" : purchase.market;
        document.getElementById('editHistoryBuyer').value = purchase.buyer === "Não Informado" ? "" : purchase.buyer;
        document.getElementById('historyViewTotal').innerText = `R$ ${purchase.total.toFixed(2).replace('.', ',')}`;
        
        const listContainer = document.getElementById('historyViewList');
        listContainer.innerHTML = '';

        if (!purchase.items || purchase.items.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; color:gray; padding:20px;">Esta compra não possui listagem de itens salva.</div>`;
        } else {
            const sortedHistoryItems = [...purchase.items].sort((a, b) => compareText(a.name, b.name));
            
            sortedHistoryItems.forEach(i => {
                const row = document.createElement('div');
                row.className = 'history-preview-row';
                const qtyFormatted = i.type === 'kg' ? safeNumber(i.qty).toFixed(3) : safeNumber(i.qty);
                const itemInfo = document.createElement('div');
                const itemName = document.createElement('b');
                itemName.innerText = capitalizeName(i.name);
                const itemDetails = document.createElement('span');
                itemDetails.innerText = `${qtyFormatted} ${i.type} x R$ ${safeNumber(i.price).toFixed(2).replace('.', ',')}`;
                itemInfo.append(itemName, document.createElement('br'), itemDetails);
                const itemTotal = document.createElement('div');
                itemTotal.style.alignSelf = 'center';
                const itemTotalLabel = document.createElement('b');
                itemTotalLabel.innerText = `R$ ${(safeNumber(i.qty) * safeNumber(i.price)).toFixed(2).replace('.', ',')}`;
                itemTotal.appendChild(itemTotalLabel);
                row.append(itemInfo, itemTotal);
                listContainer.appendChild(row);
            });
        }

        document.getElementById('modalHistoryView').style.display = 'flex';
    }

    function setupLiveSuggestions(inputId, suggestionsId, bankKey) {
        const input = document.getElementById(inputId);
        const suggestions = document.getElementById(suggestionsId);

        input.onkeyup = () => {
            const val = normalizeText(input.value);
            if (val.length < 1) {
                suggestions.style.display = 'none';
                return;
            }

            const matches = state[bankKey]
                .filter(name => normalizeText(name).startsWith(val))
                .sort(compareText);

            if (matches.length > 0) {
                suggestions.innerHTML = '';
                matches.forEach(m => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerText = m;
                    div.onclick = () => {
                        input.value = m;
                        suggestions.style.display = 'none';
                    };
                    suggestions.appendChild(div);
                });
                suggestions.style.display = 'block';
            } else {
                suggestions.style.display = 'none';
            }
        };

        input.onfocus = () => {
            if (input.value === "" && state[bankKey].length > 0) {
                const sorted = [...state[bankKey]].sort(compareText);
                suggestions.innerHTML = '';
                sorted.forEach(m => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerText = m;
                    div.onclick = () => {
                        input.value = m;
                        suggestions.style.display = 'none';
                    };
                    suggestions.appendChild(div);
                });
                suggestions.style.display = 'block';
            }
        };
    }

    function setupEventListeners() {
        const input = document.getElementById('itemInput');
        const btnAdd = document.getElementById('btnAdd');
        const suggestions = document.getElementById('suggestions');

        btnAdd.onclick = () => {
            addItem(input.value);
            input.value = '';
            suggestions.style.display = 'none';
        };

        input.onkeyup = (e) => {
            if (e.key === 'Enter') {
                btnAdd.onclick();
                return;
            }
            
            const val = normalizeText(input.value);
            if (val.length < 1) {
                suggestions.style.display = 'none';
                return;
            }

            const matches = Object.entries(state.itemBank)
                .map(([key, value]) => ({ key, name: value && typeof value === 'object' && value.name ? value.name : key }))
                .filter(entry => normalizeText(entry.name).startsWith(val))
                .sort((a, b) => compareText(a.name, b.name));

            if (matches.length > 0) {
                suggestions.innerHTML = '';
                matches.forEach(m => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerText = capitalizeName(m.name);
                    div.onclick = () => {
                        input.value = capitalizeName(m.name);
                        suggestions.style.display = 'none';
                        btnAdd.onclick();
                    };
                    suggestions.appendChild(div);
                });
                suggestions.style.display = 'block';
            } else {
                suggestions.style.display = 'none';
            }
        };

        setupLiveSuggestions('finishMarket', 'marketSuggestions', 'marketBank');
        setupLiveSuggestions('finishBuyer', 'buyerSuggestions', 'buyerBank');
        
        setupLiveSuggestions('editHistoryMarket', 'editHistoryMarketSuggestions', 'marketBank');
        setupLiveSuggestions('editHistoryBuyer', 'editHistoryBuyerSuggestions', 'buyerBank');

        document.addEventListener('click', (e) => {
            if (e.target !== input) suggestions.style.display = 'none';
            if (e.target !== document.getElementById('finishMarket')) document.getElementById('marketSuggestions').style.display = 'none';
            if (e.target !== document.getElementById('finishBuyer')) document.getElementById('buyerSuggestions').style.display = 'none';
            if (e.target !== document.getElementById('editHistoryMarket')) document.getElementById('editHistoryMarketSuggestions').style.display = 'none';
            if (e.target !== document.getElementById('editHistoryBuyer')) document.getElementById('editHistoryBuyerSuggestions').style.display = 'none';
        });

        document.getElementById('btnCancelEdit').onclick = () => {
            document.getElementById('modalEdit').style.display = 'none';
        };

        document.getElementById('btnSaveEdit').onclick = () => {
            const name = document.getElementById('editItemName').value;
            const type = document.getElementById('editType').value;
            const qtyRaw = document.getElementById('editQty').value;
            const price = Math.max(0, safeNumber(document.getElementById('editPrice').value, 0));
            
            updateItem(editingId, { name, type, qty: qtyRaw, price });
            document.getElementById('modalEdit').style.display = 'none';
        };

        document.getElementById('btnFinish').onclick = finishPurchase;
        
        document.getElementById('btnCancelFinish').onclick = () => {
            document.getElementById('modalFinishPurchase').style.display = 'none';
        };
        
        document.getElementById('btnConfirmFinish').onclick = confirmFinishPurchase;

        document.getElementById('btnCloseHistoryView').onclick = () => {
            document.getElementById('modalHistoryView').style.display = 'none';
        };

        document.getElementById('btnSaveHistory').onclick = () => {
            if (!currentEditingHistoryId) return;

            const marketInput = document.getElementById('editHistoryMarket').value.trim();
            const buyerInput = document.getElementById('editHistoryBuyer').value.trim();

            const market = marketInput ? capitalizeName(marketInput) : "Não Informado";
            const buyer = buyerInput ? capitalizeName(buyerInput) : "Não Informado";

            if (marketInput && !state.marketBank.includes(market)) {
                state.marketBank.push(market);
            }
            if (buyerInput && !state.buyerBank.includes(buyer)) {
                state.buyerBank.push(buyer);
            }

            const idx = state.history.findIndex(h => h.id === currentEditingHistoryId);
            if (idx !== -1) {
                state.history[idx].market = market;
                state.history[idx].buyer = buyer;
                save();
                render();
            }

            document.getElementById('modalHistoryView').style.display = 'none';
        };

        document.getElementById('btnDeleteHistory').onclick = () => {
            if (!currentEditingHistoryId) return;
            const confirmDel = confirm("Deseja realmente apagar este registro de compra?");
            if (confirmDel) {
                state.history = state.history.filter(h => h.id !== currentEditingHistoryId);
                save();
                render();
                document.getElementById('modalHistoryView').style.display = 'none';
            }
        };

        document.getElementById('btnBackup').onclick = () => {
            try {
                const dataStr = JSON.stringify(state, null, 2);
                const blob = new Blob([dataStr], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const fileName = `backup_compras_${dateStr}.txt`;

                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                alert(`Backup gerado com sucesso!\nArquivo:\n${fileName}`);
            } catch (e) {
                alert("Erro ao criar arquivo de backup.");
            }
        };

        document.getElementById('btnRestore').onclick = () => {
            const confirmRestore = confirm("Deseja realmente restaurar os dados deste arquivo? Isso substituirá a lista atual.");
            if (!confirmRestore) return;

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.txt';
            
            fileInput.onchange = e => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = event => {
                    try {
                        const decoded = JSON.parse(event.target.result);
                        if (!decoded || (!Array.isArray(decoded.items) && !Array.isArray(decoded.history))) {
                            throw new Error('Estrutura de backup inválida');
                        }
                        state = normalizeState(decoded);
                        if (!state.selectedMonthYear) {
                            const now = new Date();
                            state.selectedMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                        }
                        save();
                        render();
                        alert("Banco de dados sincronizado e restaurado com sucesso!");
                    } catch (err) {
                        alert("Arquivo de backup inválido ou corrompido.");
                    }
                };
                reader.readAsText(file);
            };
            fileInput.click();
        };

        document.getElementById('btnResetApp').onclick = () => {
            const confirm1 = confirm("ATENÇÃO: Isso apagará TODOS os seus itens, histórico e banco de preços permanentemente. Deseja continuar?");
            if (confirm1) {
                const confirm2 = confirm("TEM CERTEZA? Esta ação não pode ser desfeita.");
                if (confirm2) {
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem('smart_shopping_list_v1');
                    location.reload();
                }
            }
        };
    }

    init();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js?v=6', { updateViaCache: 'none' })
        .then(reg => console.log('SW registrado com sucesso!', reg))
        .catch(err => console.log('Erro ao registrar SW externo:', err));
    }
