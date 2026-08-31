// ==========================================
// INICIALIZAÇÃO DE DADOS E LOCALSTORAGE
// ==========================================
if (!localStorage.getItem("pdv_sessoes_v1")) {
    localStorage.setItem("pdv_sessoes_v1", JSON.stringify(["Jardim", "Tintas", "Piso e Laminados", "Organização", "Madeira", "Materiais"]));
}
let SESSOES = JSON.parse(localStorage.getItem("pdv_sessoes_v1"));

// Permissões padrão do sistema (Telas + Ações sensíveis)
const permissoesPadrao = [
    { id: "dashboard", nome: "Visualizar Dashboard", tipo: "tela" },
    { id: "atividades", nome: "Registrar Atividades", tipo: "tela" },
    { id: "historico", nome: "Visualizar Histórico", tipo: "tela" },
    { id: "equipe", nome: "Visualizar Equipe", tipo: "tela" },
    { id: "sessoes", nome: "Visualizar Sessões", tipo: "tela" },
    { id: "criar_colaborador", nome: "Criar Colaborador", tipo: "acao" },
    { id: "editar_colaborador", nome: "Editar Colaborador", tipo: "acao" },
    { id: "excluir_colaborador", nome: "Excluir Colaborador", tipo: "acao" },
    { id: "criar_sessao", nome: "Criar Sessão", tipo: "acao" },
    { id: "editar_sessao", nome: "Editar Sessão", tipo: "acao" },
    { id: "excluir_sessao", nome: "Excluir Sessão", tipo: "acao" }
];
if (!localStorage.getItem("pdv_permissoes_v1")) {
    localStorage.setItem("pdv_permissoes_v1", JSON.stringify(permissoesPadrao));
}
let PERMISSOES = JSON.parse(localStorage.getItem("pdv_permissoes_v1"));

// Cargos padrão e suas permissões
const cargosPadrao = {
    "Administrador": {
        permissoes: permissoesPadrao.map(p => p.id),
        descricao: "Acesso total ao sistema"
    },
    "Operador": {
        permissoes: ["dashboard", "atividades", "historico"],
        descricao: "Apenas registro de atividades e visualização básica"
    }
};
if (!localStorage.getItem("pdv_cargos_v1")) {
    localStorage.setItem("pdv_cargos_v1", JSON.stringify(cargosPadrao));
}
let dbCargos = JSON.parse(localStorage.getItem("pdv_cargos_v1"));

// Usuários padrão
const defaultUsers = { 
    "vitin": { 
        senha: "316147", 
        cargo: "Administrador", 
        sessao: "Jardim",
        admissao: "2026-01-01", 
        ativo: true 
    }, 
    "Victor Santos": { 
        senha: "1234", 
        cargo: "Administrador", 
        sessao: "Tintas",
        admissao: "2025-06-15", 
        ativo: true 
    },
    "Maria Silva": { 
        senha: "5678", 
        cargo: "Operador", 
        sessao: "Madeira",
        admissao: "2026-03-10", 
        ativo: true 
    }
};
let dbUsers = JSON.parse(localStorage.getItem("pdv_users")) || defaultUsers;

let usuarioLogado = localStorage.getItem("pdv_user") || null;
let dbHistorico = JSON.parse(localStorage.getItem("pdv_historico")) || [];
let fluxoTemp = []; 

window.onload = function() {
    preencherFiltros();
    if (usuarioLogado && dbUsers[usuarioLogado]) {
        entrarNoApp();
    } else {
        fazerLogout();
    }
}

// ==========================================
// CONTROLE DE PERMISSÕES DO USUÁRIO LOGADO
// ==========================================
function temPermissao(permissaoId) {
    if (!usuarioLogado || !dbUsers[usuarioLogado]) return false;
    const user = dbUsers[usuarioLogado];
    if (user.cargo === "Administrador") return true; // Admin sempre tem acesso total
    const cargoData = dbCargos[user.cargo];
    if (!cargoData || !cargoData.permissoes) return false;
    return cargoData.permissoes.includes(permissaoId);
}

// ==========================================
// AUTENTICAÇÃO E PERFIL
// ==========================================
function fazerLogin(event) {
    event.preventDefault();
    const user = document.getElementById("usuario").value.trim();
    const pass = document.getElementById("senha").value.trim();

    let userKey = Object.keys(dbUsers).find(u => u.toLowerCase() === user.toLowerCase());

    if (userKey && dbUsers[userKey].senha === pass) {
        if (dbUsers[userKey].ativo === false) {
            return alert("❌ Este usuário está inativo.");
        }
        usuarioLogado = userKey;
        localStorage.setItem("pdv_user", usuarioLogado);
        entrarNoApp();
    } else {
        alert("❌ Usuário ou senha incorretos!");
    }
}

function entrarNoApp() {
    const dadosUser = dbUsers[usuarioLogado];
    
    document.getElementById("login-screen").classList.remove("active");
    document.getElementById("app-screen").classList.add("active");
    
    document.getElementById("user-display").innerText = usuarioLogado;
    document.getElementById("user-role").innerText = dadosUser.cargo;
    
    const inicial = usuarioLogado.charAt(0).toUpperCase();
    if(document.getElementById("sidebar-avatar")) document.getElementById("sidebar-avatar").innerText = inicial;
    if(document.getElementById("dropdown-avatar")) document.getElementById("dropdown-avatar").innerText = inicial;
    if(document.getElementById("dropdown-nome")) document.getElementById("dropdown-nome").innerText = usuarioLogado;
    if(document.getElementById("dropdown-email")) document.getElementById("dropdown-email").innerText = `Sessão: ${dadosUser.sessao || 'Geral'}`;

    aplicarPermissoesMenu();

    // Se a aba atual do usuário não for permitida, força ir para a primeira permitida
    const abasPermitidas = getAbasPermitidas();
    const abaAtivaEl = document.querySelector('.tab-content.active');
    const abaAtualId = abaAtivaEl ? abaAtivaEl.id.replace('tab-', '') : '';
    if (!abasPermitidas.includes(abaAtualId) && abasPermitidas.length > 0) {
        mudarAba(abasPermitidas[0]);
    } else {
        carregarHistorico();
        atualizarDashboard();
        carregarEquipe();
        carregarSessoes();
        carregarCargos();
        carregarPermissoesTela();
        carregarPerfil();
    }
}

function getAbasPermitidas() {
    let abas = [];
    if (temPermissao('dashboard')) abas.push('dashboard');
    if (temPermissao('atividades')) abas.push('atividades');
    if (temPermissao('historico')) abas.push('historico');
    if (temPermissao('equipe')) abas.push('equipe');
    if (temPermissao('sessoes')) abas.push('sessoes');
    if (temPermissao('cargos')) abas.push('cargos');
    if (temPermissao('permissoes')) abas.push('permissoes');
    abas.push('perfil'); // Perfil sempre disponível
    return abas;
}

function aplicarPermissoesMenu() {
    const botoesMenu = {
        'btn-tab-dashboard': 'dashboard',
        'btn-tab-atividades': 'atividades',
        'btn-tab-historico': 'historico',
        'btn-tab-equipe': 'equipe',
        'btn-tab-sessoes': 'sessoes',
        'btn-tab-cargos': 'cargos',
        'btn-tab-permissoes': 'permissoes'
    };

    for (let [btnId, permId] of Object.entries(botoesMenu)) {
        const btn = document.getElementById(btnId);
        if (btn) {
            if (dbUsers[usuarioLogado].cargo === 'Administrador' || temPermissao(permId)) {
                btn.style.display = 'block';
            } else {
                btn.style.display = 'none';
            }
        }
    }
}

function toggleMenuPerfil() {
    const dropdown = document.getElementById("profile-dropdown");
    if(dropdown) {
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    }
}

window.onclick = function(event) {
    if (!event.target.closest('.user-profile-wrapper')) {
        const dropdown = document.getElementById("profile-dropdown");
        if(dropdown) dropdown.style.display = "none";
    }
}

function fazerLogout() {
    localStorage.removeItem("pdv_user");
    usuarioLogado = null;
    document.getElementById("app-screen").classList.remove("active");
    document.getElementById("login-screen").classList.add("active");
    document.getElementById("senha").value = "";
}

function carregarPerfil() {
    const u = dbUsers[usuarioLogado];
    if(document.getElementById("perfil-avatar")) document.getElementById("perfil-avatar").innerText = usuarioLogado.charAt(0).toUpperCase();
    if(document.getElementById("perfil-nome-display")) document.getElementById("perfil-nome-display").innerText = usuarioLogado;
    if(document.getElementById("perfil-cargo-display")) document.getElementById("perfil-cargo-display").innerText = u.cargo;
}

function alterarMinhaSenha() {
    const novaSenha = document.getElementById("nova-senha-perfil").value.trim();
    if(novaSenha.length < 4) return alert("❌ A senha deve ter pelo menos 4 caracteres.");
    
    dbUsers[usuarioLogado].senha = novaSenha;
    salvarUsuariosDb();
    alert("✅ Senha atualizada com sucesso!");
    document.getElementById("nova-senha-perfil").value = "";
}

// ==========================================
// NAVEGAÇÃO
// ==========================================
function mudarAba(aba) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    const tabEl = document.getElementById(`tab-${aba}`);
    const btnEl = document.getElementById(`btn-tab-${aba}`);

    if (tabEl) tabEl.classList.add('active');
    if (btnEl) btnEl.classList.add('active');

    if (aba === 'historico') carregarHistorico();
    if (aba === 'dashboard') atualizarDashboard();
    if (aba === 'equipe') carregarEquipe();
    if (aba === 'sessoes') carregarSessoes();
    if (aba === 'cargos') carregarCargos();
    if (aba === 'permissoes') carregarPermissoesTela();
    
    if(window.innerWidth <= 768) toggleSidebar();
}
function toggleSidebar() { document.getElementById("sidebar").classList.toggle("show"); }

// ==========================================
// GERENCIAMENTO DE PERMISSÕES (TELA)
// ==========================================
function carregarPermissoesTela() {
    const container = document.getElementById("lista-permissoes");
    if(!container) return;

    const isAdmin = dbUsers[usuarioLogado].cargo === "Administrador";

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
            <p style="color: #666; font-size: 14px;">Permissões ativas no sistema (vinculadas a telas e ações).</p>
            ${isAdmin ? `<button class="btn-primary" onclick="abrirModalPermissao()" style="width: auto; padding: 10px 18px; border-radius: 6px;">+ Nova Permissão</button>` : ''}
        </div>
        <div class="tabela-container">
            <table class="tabela-equipe">
                <thead>
                    <tr>
                        <th>ID da Permissão</th>
                        <th>Nome Descritivo</th>
                        <th>Tipo</th>
                        ${isAdmin ? `<th style="text-align: center; width: 120px;">Ações</th>` : ''}
                    </tr>
                </thead>
                <tbody>
                    ${PERMISSOES.map((p, index) => `
                        <tr>
                            <td style="font-family: monospace; font-weight: bold; color: var(--primary-color);">${p.id}</td>
                            <td>${p.nome}</td>
                            <td><span class="badge-role" style="background: ${p.tipo === 'tela' ? '#e3f2fd' : '#fff3e0'}; color: ${p.tipo === 'tela' ? '#0d47a1' : '#e65100'}; padding: 3px 8px; border-radius: 4px; font-size: 12px;">${p.tipo.toUpperCase()}</span></td>
                            ${isAdmin ? `
                            <td style="text-align: center;">
                                <button onclick="excluirPermissao(${index})" style="background: #ffebee; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="Excluir">🗑️</button>
                            </td>` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function abrirModalPermissao() {
    const modal = document.getElementById("modal-geral");
    const modalBody = document.getElementById("modal-body");

    modalBody.innerHTML = `
        <h3>Nova Permissão</h3>
        <div class="input-group" style="margin-top:15px;">
            <label>ID Único (ex: relatorios, exportar_pdf) *</label>
            <input type="text" id="form-perm-id" placeholder="Ex: relatorios">
        </div>
        <div class="input-group">
            <label>Nome Descritivo *</label>
            <input type="text" id="form-perm-nome" placeholder="Ex: Acessar Relatórios">
        </div>
        <div class="input-group">
            <label>Tipo</label>
            <select id="form-perm-tipo">
                <option value="tela">Tela</option>
                <option value="acao">Ação / Botão</option>
            </select>
        </div>
        <button class="btn-primary" onclick="salvarFormPermissao()" style="margin-top: 15px;">Salvar Permissão</button>
    `;
    modal.style.display = "flex";
}

function salvarFormPermissao() {
    const id = document.getElementById("form-perm-id").value.trim().toLowerCase().replace(/\s+/g, '_');
    const nome = document.getElementById("form-perm-nome").value.trim();
    const tipo = document.getElementById("form-perm-tipo").value;

    if(!id || !nome) return alert("❌ Preencha todos os campos.");
    if(PERMISSOES.some(p => p.id === id)) return alert("❌ Já existe uma permissão com este ID.");

    PERMISSOES.push({ id, nome, tipo });
    localStorage.setItem("pdv_permissoes_v1", JSON.stringify(PERMISSOES));
    carregarPermissoesTela();
    fecharModal();
    alert("✅ Permissão criada com sucesso!");
}

function excluirPermissao(index) {
    const p = PERMISSOES[index];
    if(confirm(`Excluir permissão "${p.nome}"?`)) {
        PERMISSOES.splice(index, 1);
        localStorage.setItem("pdv_permissoes_v1", JSON.stringify(PERMISSOES));
        carregarPermissoesTela();
    }
}

// ==========================================
// GERENCIAMENTO DE CARGOS
// ==========================================
function carregarCargos() {
    const container = document.getElementById("lista-cargos");
    if(!container) return;

    const isAdmin = dbUsers[usuarioLogado].cargo === "Administrador";

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
            <p style="color: #666; font-size: 14px;">Defina os cargos da loja e quais permissões cada um possui.</p>
            ${isAdmin ? `<button class="btn-primary" onclick="abrirModalCargo()" style="width: auto; padding: 10px 18px; border-radius: 6px;">+ Novo Cargo</button>` : ''}
        </div>
        <div class="tabela-container">
            <table class="tabela-equipe">
                <thead>
                    <tr>
                        <th>Cargo</th>
                        <th>Descrição</th>
                        <th>Permissões Vinculadas</th>
                        ${isAdmin ? `<th style="text-align: center; width: 140px;">Ações</th>` : ''}
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(dbCargos).map(cargoNome => {
                        const cData = dbCargos[cargoNome];
                        const qtdPerms = cData.permissoes.length;
                        return `
                        <tr>
                            <td style="font-weight: bold; color: var(--primary-color);">${cargoNome}</td>
                            <td>${cData.descricao || '-'}</td>
                            <td><span style="background: #e8f5e9; color: #2e7d32; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px;">${qtdPerms} permissão(ões)</span></td>
                            ${isAdmin ? `
                            <td style="text-align: center;">
                                <button onclick="abrirModalCargo('${cargoNome}')" style="background: #f0f0f0; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Editar">✏️</button>
                                ${cargoNome !== 'Administrador' && cargoNome !== 'Operador' ? `<button onclick="excluirCargo('${cargoNome}')" style="background: #ffebee; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="Excluir">🗑️</button>` : ''}
                            </td>` : ''}
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function abrirModalCargo(cargoEdicao = null) {
    const modal = document.getElementById("modal-geral");
    const modalBody = document.getElementById("modal-body");

    let isEdit = cargoEdicao !== null;
    let cData = isEdit ? dbCargos[cargoEdicao] : { descricao: "", permissoes: [] };

    modalBody.innerHTML = `
        <h3>${isEdit ? 'Editar Cargo' : 'Novo Cargo'}</h3>
        <div class="input-group" style="margin-top:15px;">
            <label>Nome do Cargo *</label>
            <input type="text" id="form-cargo-nome" value="${isEdit ? cargoEdicao : ''}" ${isEdit && (cargoEdicao === 'Administrador' || cargoEdicao === 'Operador') ? 'disabled' : ''} placeholder="Ex: Supervisor de Loja">
        </div>
        <div class="input-group">
            <label>Descrição</label>
            <input type="text" id="form-cargo-desc" value="${cData.descricao || ''}" placeholder="Breve descrição do cargo">
        </div>
        <div class="input-group">
            <label>Selecione as Permissões:</label>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; border-radius: 6px; background: #fafafa;">
                ${PERMISSOES.map(p => `
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; font-weight: normal; cursor: pointer;">
                        <input type="checkbox" class="check-permissao-item" value="${p.id}" ${cData.permissoes.includes(p.id) ? 'checked' : ''}>
                        <span>${p.nome} <strong style="color: #666; font-size: 11px;">(${p.id})</strong></span>
                    </label>
                `).join('')}
            </div>
        </div>
        <button class="btn-primary" onclick="salvarFormCargo('${cargoEdicao || 'null'}')" style="margin-top: 15px;">Salvar Cargo</button>
    `;
    modal.style.display = "flex";
}

function salvarFormCargo(cargoOriginal) {
    const nome = document.getElementById("form-cargo-nome").value.trim();
    const descricao = document.getElementById("form-cargo-desc").value.trim();
    
    const checkboxes = document.querySelectorAll(".check-permissao-item:checked");
    let permissoesSelecionadas = Array.from(checkboxes).map(cb => cb.value);

    if(!nome) return alert("❌ Informe o nome do cargo.");
    if(cargoOriginal === "null" && dbCargos[nome]) return alert("❌ Já existe um cargo com este nome.");

    if (cargoOriginal !== "null" && cargoOriginal !== nome) {
        delete dbCargos[cargoOriginal];
    }

    dbCargos[nome] = {
        descricao,
        permissoes: permissoesSelecionadas
    };

    localStorage.setItem("pdv_cargos_v1", JSON.stringify(dbCargos));
    carregarCargos();
    fecharModal();
    alert("✅ Cargo salvo com sucesso!");
}

function excluirCargo(cargoNome) {
    if (cargoNome === 'Administrador' || cargoNome === 'Operador') {
        return alert("❌ Não é possível excluir os cargos padrão do sistema.");
    }
    if (confirm(`Tem certeza que deseja excluir o cargo "${cargoNome}"?`)) {
        delete dbCargos[cargoNome];
        localStorage.setItem("pdv_cargos_v1", JSON.stringify(dbCargos));
        carregarCargos();
    }
}

// ==========================================
// GERENCIAMENTO DE SESSÕES
// ==========================================
function salvarSessoesDb() {
    localStorage.setItem("pdv_sessoes_v1", JSON.stringify(SESSOES));
    preencherFiltros();
}

function carregarSessoes() {
    const container = document.getElementById("lista-sessoes");
    if(!container) return;

    const isAdmin = dbUsers[usuarioLogado].cargo === "Administrador";
    const podeCriarSessao = isAdmin || temPermissao('criar_sessao');
    const podeEditarSessao = isAdmin || temPermissao('editar_sessao');
    const podeExcluirSessao = isAdmin || temPermissao('excluir_sessao');

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
            <p style="color: #666; font-size: 14px;">Gerencie as sessões ativas da loja que aparecem nos fluxos e cadastros.</p>
            ${podeCriarSessao ? `<button class="btn-primary" onclick="abrirModalSessao()" style="width: auto; padding: 10px 18px; border-radius: 6px;">+ Nova Sessão</button>` : ''}
        </div>
        <div class="tabela-container">
            <table class="tabela-equipe">
                <thead>
                    <tr>
                        <th>Nome da Sessão</th>
                        ${(podeEditarSessao || podeExcluirSessao) ? `<th style="text-align: center; width: 150px;">Ações</th>` : ''}
                    </tr>
                </thead>
                <tbody>
                    ${SESSOES.map((sessao, index) => `
                        <tr>
                            <td style="font-weight: 500;">${sessao}</td>
                            ${(podeEditarSessao || podeExcluirSessao) ? `
                            <td style="text-align: center;">
                                ${podeEditarSessao ? `<button onclick="abrirModalSessao(${index})" style="background: #f0f0f0; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Editar">✏️</button>` : ''}
                                ${podeExcluirSessao ? `<button onclick="excluirSessao(${index})" style="background: #ffebee; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="Excluir">🗑️</button>` : ''}
                            </td>` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function abrirModalSessao(indexEdicao = null) {
    const modal = document.getElementById("modal-geral");
    const modalBody = document.getElementById("modal-body");
    
    let isEdit = indexEdicao !== null;
    let nomeAtual = isEdit ? SESSOES[indexEdicao] : "";

    modalBody.innerHTML = `
        <h3>${isEdit ? 'Editar Sessão' : 'Nova Sessão'}</h3>
        <div class="input-group" style="margin-top:15px;">
            <label>Nome da Sessão *</label>
            <input type="text" id="form-sessao-nome" value="${nomeAtual}" placeholder="Ex: Jardinagem">
        </div>
        <button class="btn-primary" onclick="salvarFormSessao(${isEdit ? indexEdicao : 'null'})" style="margin-top: 15px;">Salvar Sessão</button>
    `;
    modal.style.display = "flex";
}

function salvarFormSessao(indexEdicao) {
    const nome = document.getElementById("form-sessao-nome").value.trim();
    if(!nome) return alert("❌ Informe o nome da sessão.");

    if (SESSOES.map(s => s.toLowerCase()).includes(nome.toLowerCase()) && indexEdicao === null) {
        return alert("❌ Esta sessão já está cadastrada.");
    }

    if (indexEdicao !== null) {
        SESSOES[indexEdicao] = nome;
    } else {
        SESSOES.push(nome);
    }

    salvarSessoesDb();
    carregarSessoes();
    fecharModal();
    alert("✅ Sessão salva com sucesso!");
}

function excluirSessao(index) {
    const nomeSessao = SESSOES[index];
    if(confirm(`Tem certeza que deseja excluir a sessão "${nomeSessao}"?`)) {
        SESSOES.splice(index, 1);
        salvarSessoesDb();
        carregarSessoes();
    }
}

// ==========================================
// GERENCIAMENTO DE USUÁRIOS (EQUIPE)
// ==========================================
function salvarUsuariosDb() {
    localStorage.setItem("pdv_users", JSON.stringify(dbUsers));
    preencherFiltros(); 
}

function carregarEquipe() {
    const container = document.getElementById("lista-equipe");
    if(!container) return;
    
    const isAdmin = dbUsers[usuarioLogado].cargo === "Administrador";
    const podeCriarColab = isAdmin || temPermissao('criar_colaborador');
    const podeEditarColab = isAdmin || temPermissao('editar_colaborador');
    const podeExcluirColab = isAdmin || temPermissao('excluir_colaborador');

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
            <input type="text" id="filtro-colab-input" placeholder="Pesquise nome..." onkeyup="filtrarTabelaEquipe()" style="padding: 10px 14px; width: 280px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px;">
            ${podeCriarColab ? `<button class="btn-primary" onclick="abrirModalUsuario()" style="width: auto; padding: 10px 18px; border-radius: 6px;">+ Novo colaborador</button>` : ''}
        </div>
        <div class="tabela-container">
            <table class="tabela-equipe">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Cargo</th>
                        <th>Sessão</th>
                        <th>Admissão</th>
                        <th>Ativo</th>
                        ${(podeEditarColab || podeExcluirColab) ? `<th style="text-align: center;">Ações</th>` : ''}
                    </tr>
                </thead>
                <tbody id="tabela-equipe-body">
                    ${Object.keys(dbUsers).map(nome => {
                        const u = dbUsers[nome];
                        const dataFormatada = u.admissao ? u.admissao.split('-').reverse().join('/') : '-';
                        return `
                        <tr>
                            <td style="font-weight: 500;">${nome}</td>
                            <td><span style="font-weight: 600; color: var(--primary-color);">${u.cargo}</span></td>
                            <td>${u.sessao || '-'}</td>
                            <td>${dataFormatada}</td>
                            <td><span style="color: ${u.ativo !== false ? '#2e7d32' : '#c62828'}; font-weight: bold;">${u.ativo !== false ? 'Sim' : 'Não'}</span></td>
                            ${(podeEditarColab || podeExcluirColab) ? `
                            <td style="text-align: center;">
                                ${podeEditarColab ? `<button onclick="abrirModalUsuario('${nome}')" style="background: #f0f0f0; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Editar">✏️</button>` : ''}
                                ${podeExcluirColab && nome !== usuarioLogado ? `<button onclick="excluirUsuario('${nome}')" style="background: #ffebee; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="Excluir">🗑️</button>` : ''}
                            </td>` : ''}
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function filtrarTabelaEquipe() {
    const termo = document.getElementById("filtro-colab-input").value.toLowerCase();
    const linhas = document.querySelectorAll("#tabela-equipe-body tr");
    linhas.forEach(linha => {
        const nome = linha.cells[0].innerText.toLowerCase();
        linha.style.display = nome.includes(termo) ? "" : "none";
    });
}

function abrirModalUsuario(nomeEdicao = null) {
    const modal = document.getElementById("modal-geral");
    const modalBody = document.getElementById("modal-body");
    
    let isEdit = nomeEdicao !== null;
    let u = isEdit ? dbUsers[nomeEdicao] : { cargo: Object.keys(dbCargos)[0] || "Operador", sessao: SESSOES[0] || "", admissao: new Date().toISOString().split('T')[0], ativo: true, senha: gerarSenhaAleatoria() };

    modalBody.innerHTML = `
        <h3>${isEdit ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
        <div class="input-group" style="margin-top:15px;">
            <label>Nome Completo *</label>
            <input type="text" id="form-user-nome" value="${isEdit ? nomeEdicao : ''}" ${isEdit ? 'disabled' : ''} placeholder="Ex: Aline Barros Santos">
        </div>
        <div style="display: flex; gap: 15px;">
            <div class="input-group" style="flex: 1;">
                <label>Cargo (Define as Permissões)</label>
                <select id="form-user-cargo">
                    ${Object.keys(dbCargos).map(cName => `<option value="${cName}" ${u.cargo === cName ? 'selected' : ''}>${cName}</option>`).join('')}
                </select>
            </div>
            <div class="input-group" style="flex: 1;">
                <label>Sessão</label>
                <select id="form-user-sessao">
                    ${SESSOES.map(s => `<option value="${s}" ${u.sessao === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
        </div>
        <div style="display: flex; gap: 15px;">
            <div class="input-group" style="flex: 1;">
                <label>Data de Admissão</label>
                <input type="date" id="form-user-admissao" value="${u.admissao || ''}">
            </div>
            <div class="input-group" style="flex: 1;">
                <label>Ativo no Sistema?</label>
                <select id="form-user-ativo">
                    <option value="true" ${u.ativo !== false ? 'selected' : ''}>Sim</option>
                    <option value="false" ${u.ativo === false ? 'selected' : ''}>Não</option>
                </select>
            </div>
        </div>
        <div class="input-group">
            <label>Senha de Acesso</label>
            <div style="display: flex; gap: 10px;">
                <input type="text" id="form-user-senha" value="${u.senha}" placeholder="Senha">
                <button class="btn-secondary" onclick="document.getElementById('form-user-senha').value = gerarSenhaAleatoria()" style="width: auto; padding: 0 10px; font-size: 12px;">Gerar</button>
            </div>
        </div>
        <button class="btn-primary" onclick="salvarFormUsuario('${nomeEdicao || 'null'}')" style="margin-top: 15px;">Salvar Colaborador</button>
    `;
    modal.style.display = "flex";
}

function gerarSenhaAleatoria() {
    return Math.floor(100000 + Math.random() * 900000).toString(); 
}

function salvarFormUsuario(nomeOriginal) {
    const nome = document.getElementById("form-user-nome").value.trim();
    const cargo = document.getElementById("form-user-cargo").value;
    const sessao = document.getElementById("form-user-sessao").value;
    const admissao = document.getElementById("form-user-admissao").value;
    const senha = document.getElementById("form-user-senha").value.trim();
    const ativo = document.getElementById("form-user-ativo").value === "true";

    if(!nome) return alert("❌ Informe o nome do colaborador.");
    if(!senha) return alert("❌ Informe ou gere uma senha.");

    if (nomeOriginal === "null" && dbUsers[nome]) {
        return alert("❌ Já existe um colaborador com esse nome.");
    }

    let senhaFinal = senha;
    if (nomeOriginal !== "null" && dbUsers[nomeOriginal] && !senha) {
        senhaFinal = dbUsers[nomeOriginal].senha;
    }

    if (nomeOriginal !== "null") {
        dbUsers[nomeOriginal].cargo = cargo;
        dbUsers[nomeOriginal].sessao = sessao;
        dbUsers[nomeOriginal].admissao = admissao;
        dbUsers[nomeOriginal].senha = senhaFinal;
        dbUsers[nomeOriginal].ativo = ativo;
    } else {
        dbUsers[nome] = { senha: senhaFinal, cargo, sessao, admissao, ativo };
    }

    salvarUsuariosDb();
    carregarEquipe();
    fecharModal();
    alert(`✅ Colaborador salvo com sucesso!`);
}

function excluirUsuario(nome) {
    if(confirm(`Tem certeza que deseja excluir o acesso de ${nome}? O histórico dele será mantido.`)) {
        delete dbUsers[nome];
        salvarUsuariosDb();
        carregarEquipe();
    }
}

// ==========================================
// CORE MODAL & FLUXOS (ATIVIDADES)
// ==========================================
const modal = document.getElementById("modal-geral");
const modalBody = document.getElementById("modal-body");

function fecharModal() {
    modal.style.display = "none";
    fluxoTemp = []; 
}

function iniciarFluxo(atividade) {
    modal.style.display = "flex";
    fluxoTemp = [];
    
    if (atividade === "IRC" || atividade === "Moki") renderFormSessaoCheck(atividade);
    else if (atividade === "Ruptura") renderFezAtividade(atividade);
    else if (atividade === "Abastecimento") renderFormAbastecimento();
    else if (atividade === "Reapro") renderFormReapro();
    else if (atividade === "Auditoria") renderFormAuditoria();
}

function getOptionsSessoes() { return SESSOES.map(s => `<option value="${s}">${s}</option>`).join(''); }

function perguntarMaisSessao(atividade) {
    modalBody.innerHTML = `
        <h3>${atividade}</h3>
        <p style="margin: 15px 0; color: #666;">Você realizou ${atividade} em mais alguma sessão?</p>
        <p style="margin-bottom: 20px; font-size: 13px; font-weight: 600;">Registros na fila: ${fluxoTemp.length}</p>
        <div class="btn-group">
            <button class="btn-secondary" onclick="continuarOutraSessao('${atividade}')">Sim</button>
            <button class="btn-primary" onclick="finalizarFluxoAtual()">Não (Concluído)</button>
        </div>
    `;
}

function continuarOutraSessao(atividade) {
    if (atividade === "IRC" || atividade === "Moki") renderFormSessaoCheck(atividade);
    else if (atividade === "Ruptura") renderSessaoSimples(atividade);
    else if (atividade === "Abastecimento") renderFormAbastecimento();
    else if (atividade === "Reapro") renderFormReapro();
    else if (atividade === "Auditoria") renderFormAuditoria();
}

function renderFormSessaoCheck(atividade) {
    modalBody.innerHTML = `
        <h3>${atividade}</h3>
        <div class="input-group" style="margin-top: 15px;">
            <label>Qual sessão?</label>
            <select id="check-sessao">${getOptionsSessoes()}</select>
        </div>
        <div class="input-group">
            <label>Você realizou ${atividade} nesta sessão?</label>
            <select id="check-realizou">
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
            </select>
        </div>
        <button class="btn-primary" onclick="salvarTempSessaoCheck('${atividade}')">Avançar</button>
    `;
}

function salvarTempSessaoCheck(atividade) {
    const sessao = document.getElementById("check-sessao").value;
    const realizou = document.getElementById("check-realizou").value === 'sim';

    fluxoTemp.push({ atividade, sessao, realizou });
    perguntarMaisSessao(atividade);
}

function renderFezAtividade(atividade) {
    modalBody.innerHTML = `
        <h3>Registro de ${atividade}</h3>
        <p style="margin: 15px 0;">Você realizou ${atividade}?</p>
        <div class="btn-group">
            <button class="btn-primary" onclick="renderSessaoSimples('${atividade}')">Sim</button>
            <button class="btn-secondary" onclick="registrarNaoFez('${atividade}')">Não</button>
        </div>`;
}

function registrarNaoFez(atividade) {
    salvarRegistroUnico({ atividade: atividade, realizou: false, sessao: "N/A" });
    alert(`Registrado que você não realizou ${atividade}.`);
    fecharModal();
}

function renderSessaoSimples(atividade) {
    modalBody.innerHTML = `
        <h3>Qual sessão? (${atividade})</h3>
        <div class="input-group" style="margin-top: 15px;"><select id="simples-sessao">${getOptionsSessoes()}</select></div>
        <button class="btn-primary" onclick="salvarTempSimples('${atividade}')">Avançar</button>`;
}

function salvarTempSimples(atividade) {
    const sessao = document.getElementById("simples-sessao").value;
    fluxoTemp.push({ atividade, sessao, realizou: true });
    perguntarMaisSessao(atividade);
}

function renderFormAbastecimento() {
    modalBody.innerHTML = `
        <h3>Qual sessão você realizou o abastecimento?</h3>
        <div class="input-group"><select id="abast-sessao">${getOptionsSessoes()}</select></div>
        <div class="input-group"><label>Quantos pallets você abasteceu?</label><input type="number" id="abast-qtd" min="0" value="0"></div>
        <div class="input-group">
            <label>Algum pallet retornou?</label>
            <select id="abast-ret-bool" onchange="document.getElementById('div-retorno').style.display = this.value === 'sim' ? 'block' : 'none'">
                <option value="nao">Não</option><option value="sim">Sim</option>
            </select>
        </div>
        <div id="div-retorno" style="display:none;">
            <div class="input-group"><label>Quantos retornaram?</label><input type="number" id="abast-ret-qtd" min="0" value="0"></div>
            <div class="input-group"><label>Motivo do retorno (Opcional):</label><input type="text" id="abast-motivo" placeholder="Ex: Avariado"></div>
        </div>
        <button class="btn-primary" onclick="salvarTempAbastecimento()">Avançar</button>`;
}

function salvarTempAbastecimento() {
    const sessao = document.getElementById("abast-sessao").value;
    const abastecidos = parseInt(document.getElementById("abast-qtd").value) || 0;
    const teveRetorno = document.getElementById("abast-ret-bool").value === 'sim';
    const retornados = teveRetorno ? (parseInt(document.getElementById("abast-ret-qtd").value) || 0) : 0;
    const efetivos = abastecidos - retornados;

    fluxoTemp.push({ atividade: "Abastecimento", sessao, pallets_abastecidos: abastecidos, pallets_retornados: retornados, pallets_efetivos: efetivos, motivo_retorno: teveRetorno ? document.getElementById("abast-motivo").value : null });
    
    modalBody.innerHTML = `
        <h3>Resumo</h3>
        <div class="modal-resumo-box">Pallets efetivamente abastecidos: ${efetivos}</div>
        <h3>Você realizou abastecimento em outra sessão?</h3>
        <div class="btn-group">
            <button class="btn-secondary" onclick="renderFormAbastecimento()">Sim</button>
            <button class="btn-primary" onclick="finalizarFluxoAtual()">Não (Concluído)</button>
        </div>`;
}

function renderFormReapro() {
    modalBody.innerHTML = `
        <h3>Reapro</h3>
        <div class="input-group" style="margin-top: 15px;">
            <label>Qual sessão?</label>
            <select id="reapro-sessao">${getOptionsSessoes()}</select>
        </div>
        <div class="input-group">
            <label>O reapro foi completo ou faltou algum item?</label>
            <select id="reapro-status" onchange="document.getElementById('div-reapro-faltam').style.display = this.value === 'faltou' ? 'block' : 'none'">
                <option value="completo">Completo</option>
                <option value="faltou">Faltou item</option>
            </select>
        </div>
        <div class="input-group" id="div-reapro-faltam" style="display:none;">
            <label>Se faltou, quantos itens faltaram?</label>
            <input type="number" id="reapro-qtd-faltando" min="1" value="1">
        </div>
        <button class="btn-primary" onclick="salvarTempReapro()">Avançar</button>
    `;
}

function salvarTempReapro() {
    const sessao = document.getElementById("reapro-sessao").value;
    const status = document.getElementById("reapro-status").value;
    const qtdFaltando = status === 'faltou' ? (parseInt(document.getElementById("reapro-qtd-faltando").value) || 1) : 0;

    fluxoTemp.push({ atividade: "Reapro", sessao, status, qtd_faltando: qtdFaltando });
    perguntarMaisSessao("Reapro");
}

function renderFormAuditoria() {
    modalBody.innerHTML = `
        <h3>Auditoria de Estoque</h3>
        <div class="input-group"><label>Sessão</label><select id="aud-sessao">${getOptionsSessoes()}</select></div>
        <div class="input-group">
            <label>UD (Sequência de 10 números)</label>
            <input type="text" id="aud-ud" maxlength="10" placeholder="Ex: 1234567890">
        </div>
        <div class="input-group">
            <label>Posição (7 caracteres - números ou letras)</label>
            <input type="text" id="aud-posicao" maxlength="7" placeholder="Ex: A1B2C3D">
        </div>
        <div class="input-group">
            <label>Resultado da auditoria?</label>
            <select id="aud-resultado" onchange="document.getElementById('div-divergencia').style.display = this.value === 'Com divergência' ? 'block' : 'none'">
                <option value="Conforme">Conforme</option>
                <option value="Com divergência">Com divergência</option>
            </select>
        </div>
        <div class="input-group" id="div-divergencia" style="display:none;">
            <label>Descreva a divergência</label><textarea id="aud-obs" rows="3" placeholder="Detalhe o problema encontrado..."></textarea>
        </div>
        <button class="btn-primary" onclick="salvarTempAuditoria()">Avançar</button>`;
}

function salvarTempAuditoria() {
    const sessao = document.getElementById("aud-sessao").value;
    const ud = document.getElementById("aud-ud").value.trim();
    const posicao = document.getElementById("aud-posicao").value.trim();
    const resultado = document.getElementById("aud-resultado").value;
    const observacao = resultado === 'Com divergência' ? document.getElementById("aud-obs").value.trim() : null;

    if (!/^\d{10}$/.test(ud)) return alert("❌ A UD deve conter exatamente 10 números!");
    if (posicao.length !== 7) return alert("❌ A posição deve conter exatamente 7 caracteres!");
    if (resultado === 'Com divergência' && !observacao) return alert("❌ Por favor, descreva a divergência.");

    fluxoTemp.push({ atividade: "Auditoria", sessao, ud, posicao, resultado, observacao });
    perguntarMaisSessao("Auditoria");
}

function finalizarFluxoAtual() {
    if (fluxoTemp.length > 0) {
        const t = obterTimestamp();
        fluxoTemp.forEach(reg => dbHistorico.unshift({ colaborador: usuarioLogado, data: t.data, dataISO: t.dataISO, horario: t.horario, ...reg }));
        localStorage.setItem("pdv_historico", JSON.stringify(dbHistorico));
        alert(`✅ ${fluxoTemp.length} registro(s) salvos com sucesso!`);
    }
    fecharModal(); carregarHistorico(); atualizarDashboard();
}

function salvarRegistroUnico(dadosObj) {
    const t = obterTimestamp();
    dbHistorico.unshift({ colaborador: usuarioLogado, data: t.data, dataISO: t.dataISO, horario: t.horario, ...dadosObj });
    localStorage.setItem("pdv_historico", JSON.stringify(dbHistorico));
    carregarHistorico(); atualizarDashboard();
}

function obterTimestamp() {
    const agora = new Date();
    return { data: agora.toLocaleDateString('pt-BR'), dataISO: agora.toISOString().split('T')[0], horario: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
}

// ==========================================
// HISTÓRICO E FILTROS DE PESQUISA
// ==========================================
function carregarHistorico() {
    renderizarListaHistorico(dbHistorico);
}

function renderizarListaHistorico(dados) {
    const container = document.getElementById("lista-historico");
    if(!container) return;
    
    if (dados.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px; color: #666;">Nenhuma atividade encontrada.</p>`;
        return;
    }

    container.innerHTML = dados.map(reg => `
        <div class="historico-item">
            <div class="historico-info">
                <h4>${reg.atividade} — ${reg.sessao !== 'N/A' ? reg.sessao : 'Geral'}</h4>
                <p><strong>Colab:</strong> ${reg.colaborador}</p>
                ${reg.atividade === 'Abastecimento' ? `<p>${reg.pallets_abastecidos} abast. | ${reg.pallets_retornados} retor.</p>` : ''}
                ${reg.atividade === 'Reapro' ? `<p>Status: <strong>${reg.status}</strong> ${reg.status === 'faltou' ? '(Faltaram ' + reg.qtd_faltando + ' itens)' : ''}</p>` : ''}
                ${reg.atividade === 'Auditoria' ? `<p>UD: ${reg.ud} | Pos: ${reg.posicao} | <strong>${reg.resultado}</strong> ${reg.observacao ? '- ' + reg.observacao : ''}</p>` : ''}
                ${reg.realizou === false ? `<p style="color:var(--danger);">Não realizou</p>` : ''}
                ${(reg.atividade === 'IRC' || reg.atividade === 'Moki') && reg.realizou === true ? `<p style="color:#2e7d32; font-weight:500;">Realizado</p>` : ''}
            </div>
            <div class="historico-time"><span>${reg.data}</span><br><span>${reg.horario}</span></div>
        </div>
    `).join('');
}

function filtrarHistorico() {
    const termoNome = document.getElementById("filtro-hist-nome").value.toLowerCase();
    const dataSelecionada = document.getElementById("filtro-hist-data").value;

    let dadosFiltrados = dbHistorico.filter(reg => {
        const matchNome = reg.colaborador.toLowerCase().includes(termoNome);
        
        let matchData = true;
        if (dataSelecionada) {
            matchData = reg.dataISO === dataSelecionada;
        }

        return matchNome && matchData;
    });

    renderizarListaHistorico(dadosFiltrados);
}

function limparFiltroHistorico() {
    document.getElementById("filtro-hist-nome").value = "";
    document.getElementById("filtro-hist-data").value = "";
    carregarHistorico();
}

// ==========================================
// DASHBOARD E FILTROS GERAIS
// ==========================================
function preencherFiltros() {
    const sessaoSelect = document.getElementById("filtro-sessao");
    if(sessaoSelect) sessaoSelect.innerHTML = `<option value="todas">Todas</option>` + SESSOES.map(s => `<option value="${s}">${s}</option>`).join('');
    
    const colabSelect = document.getElementById("filtro-colaborador");
    if(colabSelect) colabSelect.innerHTML = `<option value="todos">Todos</option>` + Object.keys(dbUsers).map(u => `<option value="${u}">${u}</option>`).join('');
}

function toggleFiltroPersonalizado() { 
    const el = document.getElementById("filtro-datas");
    if(el) el.style.display = document.getElementById("filtro-periodo").value === 'personalizado' ? 'flex' : 'none'; 
}

function atualizarDashboard() {
    const pEl = document.getElementById("filtro-periodo");
    if(!pEl) return;
    const p = pEl.value, di = document.getElementById("filtro-data-inicio").value, df = document.getElementById("filtro-data-fim").value, s = document.getElementById("filtro-sessao").value, c = document.getElementById("filtro-colaborador").value;
    const hj = new Date().toISOString().split('T')[0], dt = new Date(), pS = new Date(dt.setDate(dt.getDate() - dt.getDay())).toISOString().split('T')[0], pM = new Date(dt.getFullYear(), dt.getMonth(), 1).toISOString().split('T')[0];

    let df_f = dbHistorico.filter(r => {
        if (c !== 'todos' && r.colaborador !== c) return false;
        if (s !== 'todas' && r.sessao !== s) return false;
        if (!r.dataISO) return true;
        if (p === 'hoje' && r.dataISO !== hj) return false;
        if (p === 'semana' && r.dataISO < pS) return false;
        if (p === 'mes' && r.dataISO < pM) return false;
        if (p === 'personalizado' && ((di && r.dataISO < di) || (df && r.dataISO > df))) return false;
        return true;
    });

    const cnt = (n) => df_f.filter(r => r.atividade === n && r.realizou !== false).length;
    document.getElementById("kpi-irc").innerText = cnt('IRC'); document.getElementById("kpi-moki").innerText = cnt('Moki');
    document.getElementById("kpi-ruptura").innerText = cnt('Ruptura'); document.getElementById("kpi-reapro").innerText = cnt('Reapro');
    document.getElementById("kpi-auditoria").innerText = cnt('Auditoria');

    const abast = df_f.filter(r => r.atividade === 'Abastecimento');
    document.getElementById("kpi-abast").innerText = abast.reduce((a, r) => a + (r.pallets_abastecidos || 0), 0);
    document.getElementById("kpi-ret").innerText = abast.reduce((a, r) => a + (r.pallets_retornados || 0), 0);
}