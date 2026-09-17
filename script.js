// ==========================================
// INICIALIZAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = window.ENV ? window.ENV.SUPABASE_URL : "";
const SUPABASE_ANON_KEY = window.ENV ? window.ENV.SUPABASE_ANON_KEY : "";

let _supabase = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.warn("⚠️ Supabase não inicializado.");
}

// ==========================================
// DADOS LOCAIS E ESTRUTURA
// ==========================================
let SESSOES = ["Jardim", "Tintas", "Piso e Laminados", "Organização", "Madeira", "Materiais"];

let PERMISSOES = [
    { id: "dashboard", nome: "Visualizar Dashboard", tipo: "tela" },
    { id: "atividades", nome: "Registrar Atividades", tipo: "tela" },
    { id: "historico", nome: "Visualizar Histórico", tipo: "tela" },
    { id: "equipe", nome: "Visualizar Equipe", tipo: "tela" },
    { id: "sessoes", nome: "Visualizar Sessões", tipo: "tela" },
    { id: "cargos", nome: "Visualizar Cargos", tipo: "tela" },
    { id: "permissoes", nome: "Visualizar Permissões", tipo: "tela" }
];

let dbCargos = {
    "Administrador": { id: null, permissoes: PERMISSOES.map(p => p.id), descricao: "Acesso total ao sistema" },
    "Operador": { id: null, permissoes: ["dashboard", "atividades", "historico"], descricao: "Acesso operacional" }
};

let dbUsers = {};
let usuarioLogado = localStorage.getItem("pdv_user") || localStorage.getItem("pdv_user_email") || null;
let dbHistorico = [];
let sessoesSelecionadasMultiplas = [];

window.onload = async function() {
    if (usuarioLogado && _supabase) {
        await sincronizarDadosComSupabase();
        entrarNoApp();
    } else {
        fazerLogout();
    }
}

// ==========================================
// SINCRONIZAÇÃO E DESEMPENHO OTIMIZADO
// ==========================================
async function sincronizarDadosComSupabase() {
    if (!_supabase) return;

    try {
        const { data: cargosData } = await _supabase.from('cargos').select('*');
        if (cargosData && cargosData.length > 0) {
            cargosData.forEach(c => {
                let perms = Array.isArray(c.permissoes) ? c.permissoes : (typeof c.permissoes === 'string' ? JSON.parse(c.permissoes) : []);
                dbCargos[c.nome] = { id: c.id || null, descricao: c.descricao, permissoes: perms };
            });
        }

        const { data: usersData } = await _supabase.from('usuarios').select('*');
        if (usersData && usersData.length > 0) {
            dbUsers = {};
            usersData.forEach(u => {
                let nomeCargo = u.cargo;
                if (!nomeCargo && u.cargo_id) {
                    const cargoEncontrado = Object.keys(dbCargos).find(k => dbCargos[k].id === u.cargo_id);
                    if (cargoEncontrado) nomeCargo = cargoEncontrado;
                }
                dbUsers[u.nome] = { 
                    email: u.email, 
                    cargo: nomeCargo || "Operador", 
                    cargo_id: u.cargo_id || null,
                    sessao: u.sessao, 
                    ativo: u.ativo !== false 
                };
            });
        }

        const { data: sessoesData } = await _supabase.from('sessoes').select('*');
        if (sessoesData && sessoesData.length > 0) {
            SESSOES = sessoesData.map(s => s.nome);
        }

        const { data: permsData } = await _supabase.from('permissoes').select('*');
        if (permsData && permsData.length > 0) {
            PERMISSOES = permsData;
        }

        await buscarHistoricoDoBanco();
    } catch (e) {
        console.error("Erro na sincronização:", e);
    }
}

async function buscarHistoricoDoBanco() {
    if (!_supabase) return;
    try {
        const { data: histData, error } = await _supabase
            .from('historico')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

        if (!error && histData) {
            dbHistorico = histData;
        }
    } catch(err) {
        console.error("Erro ao buscar histórico:", err);
    }
}

// ==========================================
// AUTENTICAÇÃO E NAVEGAÇÃO
// ==========================================
function temPermissao(permissaoId) {
    if (!usuarioLogado || !dbUsers[usuarioLogado]) return false;
    const user = dbUsers[usuarioLogado];
    if (user.cargo === "Administrador") return true; 
    const cargoData = dbCargos[user.cargo];
    return cargoData && cargoData.permissoes ? cargoData.permissoes.includes(permissaoId) : false;
}

async function fazerLogin(event) {
    event.preventDefault();
    const identificador = document.getElementById("usuario").value.trim();
    const passInput = document.getElementById("senha").value.trim();

    if (!_supabase) return alert("❌ Supabase não configurado.");

    try {
        let emailInput = identificador;

        // O Auth do Supabase autentica por e-mail, mas a tela também aceita o nome cadastrado.
        if (!identificador.includes('@')) {
            const { data: usuarioPorNome } = await _supabase
                .from('usuarios')
                .select('email')
                .ilike('nome', identificador)
                .maybeSingle();

            if (usuarioPorNome?.email) emailInput = usuarioPorNome.email;
        }

        const { data, error } = await _supabase.auth.signInWithPassword({ 
            email: emailInput, 
            password: passInput 
        });

        if (error) {
            if (String(error.message || '').toLowerCase().includes('invalid login credentials')) {
                return alert("❌ E-mail/nome ou senha inválidos. Use o e-mail ou nome cadastrado e a senha definida no Supabase Auth.");
            }
            return alert("❌ Falha no Login: " + error.message);
        }

        await sincronizarDadosComSupabase();
        
        let usuarioEncontrado = Object.keys(dbUsers).find(nome => dbUsers[nome].email && dbUsers[nome].email.toLowerCase() === emailInput.toLowerCase());
        
        if (!usuarioEncontrado) {
            usuarioEncontrado = emailInput.split('@')[0]; 
            dbUsers[usuarioEncontrado] = { email: emailInput, cargo: "Administrador", sessao: "Geral", ativo: true };
            await _supabase.from('usuarios').upsert([{ nome: usuarioEncontrado, email: emailInput, cargo: "Administrador", sessao: "Geral", ativo: true, senha_hash: passInput }]);
        }

        usuarioLogado = usuarioEncontrado;
        localStorage.setItem("pdv_user_email", emailInput);
        localStorage.setItem("pdv_user", usuarioLogado);

        entrarNoApp();
    } catch (err) {
        alert("Erro ao realizar login: " + err.message);
    }
}

function entrarNoApp() {
    if (!dbUsers[usuarioLogado]) dbUsers[usuarioLogado] = { cargo: "Administrador", sessao: "Geral", ativo: true };
    
    document.getElementById("login-screen").classList.remove("active");
    document.getElementById("app-screen").classList.add("active");
    
    atualizarCabecalhoEPerfil();
    aplicarPermissoesMenu();
    mudarAba('dashboard');
}

function atualizarCabecalhoEPerfil() {
    const nome = usuarioLogado || "Usuário";
    const cargo = dbUsers[nome]?.cargo || "Usuário";
    const inicial = nome.charAt(0).toUpperCase();

    if(document.getElementById("user-display")) document.getElementById("user-display").innerText = nome;
    if(document.getElementById("user-role")) document.getElementById("user-role").innerText = cargo;
    if(document.getElementById("sidebar-avatar")) document.getElementById("sidebar-avatar").innerText = inicial;

    if(document.getElementById("dropdown-avatar")) document.getElementById("dropdown-avatar").innerText = inicial;
    if(document.getElementById("dropdown-nome")) document.getElementById("dropdown-nome").innerText = nome;
    if(document.getElementById("dropdown-nome-card")) document.getElementById("dropdown-nome-card").innerText = nome;
    if(document.getElementById("dropdown-email")) document.getElementById("dropdown-email").innerText = dbUsers[nome]?.email || (`Sessão: ${dbUsers[nome]?.sessao || 'Geral'}`);
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
        if (btn) btn.style.display = (dbUsers[usuarioLogado]?.cargo === 'Administrador' || temPermissao(permId)) ? 'block' : 'none';
    }
}

function fazerLogout() {
    if (_supabase) _supabase.auth.signOut();
    localStorage.removeItem("pdv_user");
    localStorage.removeItem("pdv_user_email");
    usuarioLogado = null;
    document.getElementById("app-screen").classList.remove("active");
    document.getElementById("login-screen").classList.add("active");
}

function mudarAba(aba) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    fecharSidebar();

    const tabEl = document.getElementById(`tab-${aba}`);
    const btnEl = document.getElementById(`btn-tab-${aba}`);

    if (tabEl) tabEl.classList.add('active');
    if (btnEl) btnEl.classList.add('active');

    if (aba === 'atividades') carregarTelaAtividades();
    if (aba === 'historico') carregarHistorico();
    if (aba === 'dashboard') atualizarDashboard();
    if (aba === 'equipe') carregarEquipe();
    if (aba === 'sessoes') carregarSessoes();
    if (aba === 'cargos') carregarCargos();
    if (aba === 'permissoes') carregarPermissoesTela();
    if (aba === 'perfil') carregarPerfil();
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (!sidebar) return;

    const isOpen = sidebar.classList.toggle("active");
    if (overlay) overlay.classList.toggle("active", isOpen);
}

function fecharSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (sidebar) sidebar.classList.remove("active");
    if (overlay) overlay.classList.remove("active");
}

function toggleMenuPerfil() {
    const dropdown = document.getElementById("profile-dropdown");
    if (dropdown) {
        dropdown.style.display = (dropdown.style.display === "none" || !dropdown.style.display) ? "block" : "none";
    }
}

function toggleFiltroPersonalizado() {
    const select = document.getElementById("filtro-periodo");
    const datas = document.getElementById("filtro-datas");
    if (select && datas) {
        datas.style.display = select.value === "personalizado" ? "flex" : "none";
    }
}

// ==========================================
// TELA DE DASHBOARD
// ==========================================
async function atualizarDashboard() {
    await buscarHistoricoDoBanco();

    const container = document.getElementById("tab-dashboard") || document.getElementById("conteudo-dashboard");
    if (!container) return;

    const selPeriodoVal = document.getElementById("dash-filtro-periodo")?.value || "Hoje";
    const selSessaoVal = document.getElementById("dash-filtro-sessao")?.value || "Todas";
    const selColabVal = document.getElementById("dash-filtro-colaborador")?.value || "Todos";

    container.innerHTML = `
        <div style="padding: 20px;">
            <div style="background: #fff; padding: 15px 20px; border-radius: 8px; border: 1px solid #e0e0e0; margin-bottom: 20px; display: flex; gap: 20px; flex-wrap: wrap; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="font-weight: 700; font-size: 13px; color: #333;">Período</label>
                    <select id="dash-filtro-periodo" onchange="calcularKPIsDashboard()" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; min-width: 140px; font-size: 14px;">
                        <option value="Hoje" ${selPeriodoVal === 'Hoje' ? 'selected' : ''}>Hoje</option>
                        <option value="Ontem" ${selPeriodoVal === 'Ontem' ? 'selected' : ''}>Ontem</option>
                        <option value="Ultimos7" ${selPeriodoVal === 'Ultimos7' ? 'selected' : ''}>Últimos 7 dias</option>
                        <option value="Todos" ${selPeriodoVal === 'Todos' ? 'selected' : ''}>Todos</option>
                    </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="font-weight: 700; font-size: 13px; color: #333;">Sessão</label>
                    <select id="dash-filtro-sessao" onchange="calcularKPIsDashboard()" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; min-width: 140px; font-size: 14px;">
                        <option value="Todas" ${selSessaoVal === 'Todas' ? 'selected' : ''}>Todas</option>
                        ${SESSOES.map(s => `<option value="${s}" ${selSessaoVal === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="font-weight: 700; font-size: 13px; color: #333;">Colaborador</label>
                    <select id="dash-filtro-colaborador" onchange="calcularKPIsDashboard()" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; min-width: 140px; font-size: 14px;">
                        <option value="Todos" ${selColabVal === 'Todos' ? 'selected' : ''}>Todos</option>
                        ${Object.keys(dbUsers).map(u => `<option value="${u}" ${selColabVal === u ? 'selected' : ''}>${u}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px;">
                <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; font-weight: 800; color: #444; text-transform: uppercase; margin-bottom: 10px;">IRC</div>
                    <div id="kpi-irc" style="font-size: 32px; font-weight: 800; color: #005c45;">0</div>
                </div>
                <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; font-weight: 800; color: #444; text-transform: uppercase; margin-bottom: 10px;">MOKI</div>
                    <div id="kpi-moki" style="font-size: 32px; font-weight: 800; color: #005c45;">0</div>
                </div>
                <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; font-weight: 800; color: #444; text-transform: uppercase; margin-bottom: 10px;">RUPTURA</div>
                    <div id="kpi-ruptura" style="font-size: 32px; font-weight: 800; color: #005c45;">0</div>
                </div>
                <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; font-weight: 800; color: #444; text-transform: uppercase; margin-bottom: 10px;">REAPRO</div>
                    <div id="kpi-reapro" style="font-size: 32px; font-weight: 800; color: #005c45;">0</div>
                </div>
                <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; font-weight: 800; color: #444; text-transform: uppercase; margin-bottom: 10px;">AUDITORIA</div>
                    <div id="kpi-auditoria" style="font-size: 32px; font-weight: 800; color: #005c45;">0</div>
                </div>
                <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; font-weight: 800; color: #444; text-transform: uppercase; margin-bottom: 10px;">PALLETS ABAST.</div>
                    <div id="kpi-pallets-abast" style="font-size: 32px; font-weight: 800; color: #005c45;">0</div>
                </div>
                <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; font-weight: 800; color: #444; text-transform: uppercase; margin-bottom: 10px;">PALLETS RETORNADOS</div>
                    <div id="kpi-pallets-ret" style="font-size: 32px; font-weight: 800; color: #005c45;">0</div>
                </div>
            </div>
        </div>
    `;

    calcularKPIsDashboard();
}

function calcularKPIsDashboard() {
    const pVal = document.getElementById("dash-filtro-periodo")?.value || "Hoje";
    const sVal = document.getElementById("dash-filtro-sessao")?.value || "Todas";
    const cVal = document.getElementById("dash-filtro-colaborador")?.value || "Todos";

    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
    const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);

    const inicioOntem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 0, 0, 0);
    const fimOntem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 23, 59, 59, 999);

    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

    const filtrados = dbHistorico.filter(h => {
        if (pVal !== "Todos" && h.created_at) {
            const dt = new Date(h.created_at);
            if (pVal === "Hoje" && (dt < inicioHoje || dt > fimHoje)) return false;
            if (pVal === "Ontem" && (dt < inicioOntem || dt > fimOntem)) return false;
            if (pVal === "Ultimos7" && dt < seteDiasAtras) return false;
        }

        if (sVal !== "Todas" && h.sessao !== sVal) return false;
        if (cVal !== "Todos" && h.usuario !== cVal) return false;

        return true;
    });

    let countIRC = 0;
    let countMoki = 0;
    let countRuptura = 0;
    let countReapro = 0;
    let countAuditoria = 0;
    let palletsAbast = 0;
    let palletsRet = 0;

    filtrados.forEach(h => {
        const acao = String(h.acao || '').trim();
        const detalhes = String(h.detalhes || '');
        const isNao = detalhes.includes('NÃO REALIZADO');

        if (isNao) return;

        if (acao === 'IRC') countIRC++;
        else if (acao === 'Moki') countMoki++;
        else if (acao === 'Ruptura') countRuptura++;
        else if (acao === 'Reapro') countReapro++;
        else if (acao === 'Auditoria de Estoque') countAuditoria++;
        else if (acao === 'Abastecimento') {
            const mAbast = detalhes.match(/Abastecidos:\s*(\d+)/i);
            const mRet = detalhes.match(/Retornados:\s*(\d+)/i);
            if (mAbast) palletsAbast += parseInt(mAbast[1], 10) || 0;
            if (mRet) palletsRet += parseInt(mRet[1], 10) || 0;
        }
    });

    if (document.getElementById("kpi-irc")) document.getElementById("kpi-irc").innerText = countIRC;
    if (document.getElementById("kpi-moki")) document.getElementById("kpi-moki").innerText = countMoki;
    if (document.getElementById("kpi-ruptura")) document.getElementById("kpi-ruptura").innerText = countRuptura;
    if (document.getElementById("kpi-reapro")) document.getElementById("kpi-reapro").innerText = countReapro;
    if (document.getElementById("kpi-auditoria")) document.getElementById("kpi-auditoria").innerText = countAuditoria;
    if (document.getElementById("kpi-pallets-abast")) document.getElementById("kpi-pallets-abast").innerText = palletsAbast;
    if (document.getElementById("kpi-pallets-ret")) document.getElementById("kpi-pallets-ret").innerText = palletsRet;
}

// ==========================================
// TELA DE ATIVIDADES
// ==========================================
function carregarTelaAtividades() {
    const container = document.getElementById("conteudo-atividades") || document.getElementById("tab-atividades");
    if (!container) return;

    const atividades = ["IRC", "Moki", "Ruptura", "Abastecimento", "Reapro", "Auditoria de Estoque"];

    container.innerHTML = `
        <div style="padding: 20px 10px;">
            <h3 style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 20px;">Escolha a Atividade para Registrar</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 15px;">
                ${atividades.map(act => `
                    <div onclick="abrirModalAtividadeEspecfica('${act}')" 
                         style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 25px 15px; cursor: pointer; text-align: center; font-weight: 700; color: #005c45; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        ${act}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function iniciarFluxo(nomeAtividade) {
    abrirModalAtividadeEspecfica(nomeAtividade);
}

function abrirModalAtividadeEspecfica(nomeAtividade) {
    const modal = document.getElementById("modal-geral");
    const modalBody = document.getElementById("modal-body");
    sessoesSelecionadasMultiplas = [];

    modalBody.innerHTML = `
        <h3 style="color:#005c45; margin-bottom:15px;">Registrar: ${nomeAtividade}</h3>
        <div id="etapa-pergunta-sim-nao">
            <p style="font-size: 15px; font-weight: 600; color: #333; margin-bottom: 15px;">Você realizou esta atividade?</p>
            <div style="display:flex; gap:12px;">
                <button class="btn-primary" style="flex:1; background:#005c45;" onclick="respostaAtividadeRealizada('${nomeAtividade}', true)">Sim</button>
                <button class="btn-primary" style="flex:1; background:#d32f2f;" onclick="respostaAtividadeRealizada('${nomeAtividade}', false)">Não</button>
            </div>
        </div>
        <div id="container-detalhes-atividade" style="margin-top:15px;"></div>
    `;

    modal.style.display = "flex";
}

function respostaAtividadeRealizada(nomeAtividade, realizou) {
    const divPergunta = document.getElementById("etapa-pergunta-sim-nao");
    if (divPergunta) divPergunta.style.display = "none";

    const container = document.getElementById("container-detalhes-atividade");
    const sessaoPadrao = dbUsers[usuarioLogado]?.sessao || SESSOES[0];

    let tagStatus = realizou
        ? `<div style="background:#e8f5e9; color:#2e7d32; padding:10px 12px; border-radius:6px; font-weight:700; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <span>✓ Atividade Realizada</span>
            <button type="button" onclick="abrirModalAtividadeEspecfica('${nomeAtividade}')" style="background:none; border:none; color:#2e7d32; text-decoration:underline; cursor:pointer; font-size:12px;">Alterar</button>
           </div>`
        : `<div style="background:#ffebee; color:#c62828; padding:10px 12px; border-radius:6px; font-weight:700; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <span>✕ Atividade NÃO Realizada</span>
            <button type="button" onclick="abrirModalAtividadeEspecfica('${nomeAtividade}')" style="background:none; border:none; color:#c62828; text-decoration:underline; cursor:pointer; font-size:12px;">Alterar</button>
           </div>`;

    if (!realizou) {
        container.innerHTML = `
            ${tagStatus}
            <div class="input-group">
                <label>Sessão / Setor *</label>
                <select id="nao-sessao">${SESSOES.map(s => `<option value="${s}" ${s === sessaoPadrao ? 'selected' : ''}>${s}</option>`).join('')}</select>
            </div>
            <div class="input-group">
                <label>Por que não houve a realização? *</label>
                <input type="text" id="nao-motivo" placeholder="Informe o motivo...">
            </div>
            <button class="btn-primary" onclick="salvarAtividadeNaoRealizada('${nomeAtividade}')">Confirmar Registro</button>
        `;
        return;
    }

    if (nomeAtividade === "Moki") {
        container.innerHTML = `
            ${tagStatus}
            <div class="input-group">
                <label>Sessão / Setor *</label>
                <select id="moki-sessao">${SESSOES.map(s => `<option value="${s}" ${s === sessaoPadrao ? 'selected' : ''}>${s}</option>`).join('')}</select>
            </div>
            <button class="btn-primary" onclick="salvarMokiSim()">Confirmar e Salvar Moki</button>
        `;
    } else if (["IRC", "Ruptura"].includes(nomeAtividade)) {
        container.innerHTML = `
            ${tagStatus}
            <div class="input-group">
                <label>Adicionar Sessão Realizada</label>
                <div style="display:flex; gap:10px;">
                    <select id="select-sessao-multipla">
                        ${SESSOES.map(s => `<option value="${s}" ${s === sessaoPadrao ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <button type="button" class="btn-primary" style="width:auto;" onclick="adicionarSessaoMultipla()">+ Adicionar</button>
                </div>
            </div>
            <div id="lista-sessoes-adicionadas" style="margin: 10px 0; font-size:13px; font-weight:600; color:#005c45;"></div>
            <button class="btn-primary" onclick="salvarMultiplasSessoes('${nomeAtividade}')">Finalizar Registro</button>
        `;
    } else if (nomeAtividade === "Abastecimento") {
        container.innerHTML = `
            ${tagStatus}
            <div class="input-group">
                <label>Sessão *</label>
                <select id="abs-sessao">${SESSOES.map(s => `<option value="${s}" ${s === sessaoPadrao ? 'selected' : ''}>${s}</option>`).join('')}</select>
            </div>
            <div class="input-group">
                <label>Pallets Abastecidos *</label>
                <input type="number" id="abs-abastecidos" value="0" min="0">
            </div>
            <div class="input-group">
                <label>Pallets Retornados *</label>
                <input type="number" id="abs-retornados" value="0" min="0">
            </div>
            <div class="input-group">
                <label>Motivo / Observações (Opcional)</label>
                <input type="text" id="abs-motivo" placeholder="Ex: Sobra de pátio">
            </div>
            <button class="btn-primary" onclick="salvarAbastecimento()">Salvar Abastecimento</button>
        `;
    } else if (nomeAtividade === "Reapro") {
        container.innerHTML = `
            ${tagStatus}
            <div class="input-group">
                <label>Sessão *</label>
                <select id="reapro-sessao">${SESSOES.map(s => `<option value="${s}" ${s === sessaoPadrao ? 'selected' : ''}>${s}</option>`).join('')}</select>
            </div>
            <div class="input-group">
                <label>Status *</label>
                <select id="reapro-status">
                    <option value="Completo">Completo</option>
                    <option value="Itens Faltando">Itens Faltando</option>
                </select>
            </div>
            <button class="btn-primary" onclick="salvarReapro()">Salvar Reapro</button>
        `;
    } else if (nomeAtividade === "Auditoria de Estoque") {
        container.innerHTML = `
            ${tagStatus}
            <div class="input-group">
                <label>Sessão *</label>
                <select id="aud-sessao">${SESSOES.map(s => `<option value="${s}" ${s === sessaoPadrao ? 'selected' : ''}>${s}</option>`).join('')}</select>
            </div>
            <div class="input-group">
                <label>UD (10 Dígitos) *</label>
                <input type="text" id="aud-ud" maxlength="10" placeholder="0000000000">
            </div>
            <div class="input-group">
                <label>Posição (7 Caracteres) *</label>
                <input type="text" id="aud-posicao" maxlength="7" placeholder="Ex: A01B02C">
            </div>
            <div class="input-group">
                <label>Resultado *</label>
                <select id="aud-resultado">
                    <option value="Conforme">Conforme</option>
                    <option value="Divergente">Divergente</option>
                </select>
            </div>
            <button class="btn-primary" onclick="salvarAuditoria()">Salvar Auditoria</button>
        `;
    }
}

async function salvarAtividadeNaoRealizada(nomeAtividade) {
    const sessao = document.getElementById("nao-sessao").value;
    const motivo = document.getElementById("nao-motivo").value.trim();

    if (!motivo) return alert("❌ Por favor, informe o motivo.");

    await registrarAtividade(nomeAtividade, `NÃO REALIZADO | Motivo: ${motivo}`, sessao);
    fecharModal();
}

async function salvarMokiSim() {
    const sessao = document.getElementById("moki-sessao").value;
    await registrarAtividade("Moki", "Realizado", sessao);
    fecharModal();
}

function adicionarSessaoMultipla() {
    const sel = document.getElementById("select-sessao-multipla").value;
    if (!sessoesSelecionadasMultiplas.includes(sel)) {
        sessoesSelecionadasMultiplas.push(sel);
    }
    document.getElementById("lista-sessoes-adicionadas").innerText = "Sessões selecionadas: " + sessoesSelecionadasMultiplas.join(", ");
}

async function salvarMultiplasSessoes(nomeAtividade) {
    if (sessoesSelecionadasMultiplas.length === 0) {
        sessoesSelecionadasMultiplas.push(document.getElementById("select-sessao-multipla").value);
    }

    for (let sessao of sessoesSelecionadasMultiplas) {
        await registrarAtividade(nomeAtividade, "Realizado", sessao);
    }

    fecharModal();
}

async function salvarAbastecimento() {
    const sessao = document.getElementById("abs-sessao").value;
    const abs = document.getElementById("abs-abastecidos").value || 0;
    const ret = document.getElementById("abs-retornados").value || 0;
    const mot = document.getElementById("abs-motivo").value.trim();

    const detalhes = `Abastecidos: ${abs} | Retornados: ${ret}${mot ? ' | Motivo: ' + mot : ''}`;
    await registrarAtividade("Abastecimento", detalhes, sessao);
    fecharModal();
}

async function salvarReapro() {
    const sessao = document.getElementById("reapro-sessao").value;
    const status = document.getElementById("reapro-status").value;

    await registrarAtividade("Reapro", `Status: ${status}`, sessao);
    fecharModal();
}

async function salvarAuditoria() {
    const sessao = document.getElementById("aud-sessao").value;
    const ud = document.getElementById("aud-ud").value.trim();
    const pos = document.getElementById("aud-posicao").value.trim();
    const res = document.getElementById("aud-resultado").value;

    if (ud.length !== 10) return alert("❌ A UD precisa ter exatamente 10 dígitos.");
    if (pos.length !== 7) return alert("❌ A Posição precisa ter exatamente 7 caracteres.");

    const detalhes = `UD: ${ud} | Posição: ${pos} | Resultado: ${res}`;
    await registrarAtividade("Auditoria de Estoque", detalhes, sessao);
    fecharModal();
}

async function registrarAtividade(acao, detalhes = "", sessaoForcada = null) {
    const novaAtividade = {
        usuario: usuarioLogado,
        acao: acao,
        sessao: sessaoForcada || dbUsers[usuarioLogado]?.sessao || "Geral",
        detalhes: detalhes
    };

    if (_supabase) {
        const { error } = await _supabase.from('historico').insert([novaAtividade]);
        if (error) return alert("❌ Erro ao gravar atividade no Supabase: " + error.message);
    }

    alert(`✅ Atividade "${acao}" registrada!`);
    await atualizarDashboard();
}

// ==========================================
// TELA DE HISTÓRICO
// ==========================================
async function carregarHistorico() {
    await buscarHistoricoDoBanco();

    const container = document.getElementById("tab-historico") || document.getElementById("conteudo-historico");
    if (!container) return;

    container.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                <input type="text" id="filtro-colab-hist" placeholder="Filtrar por colaborador..." onkeyup="filtrarHistoricoTabela()" style="flex: 1; min-width: 200px; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
                <input type="date" id="filtro-data-hist" onchange="filtrarHistoricoTabela()" style="padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
                <button class="btn-primary" onclick="limparFiltrosHistorico()" style="width: auto; padding: 10px 15px;">Limpar Filtros</button>
            </div>
            <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #e0e0e0; color: #444;">
                            <th style="padding: 12px 15px;">Data / Hora</th>
                            <th style="padding: 12px 15px;">Colaborador</th>
                            <th style="padding: 12px 15px;">Atividade</th>
                            <th style="padding: 12px 15px;">Sessão</th>
                            <th style="padding: 12px 15px;">Detalhes</th>
                        </tr>
                    </thead>
                    <tbody id="tabela-historico-body">
                        ${renderLinhasHistorico(dbHistorico)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderLinhasHistorico(lista) {
    if (!lista || lista.length === 0) {
        return `<tr><td colspan="5" style="text-align:center; padding: 25px; color: #777;">Nenhum registro encontrado.</td></tr>`;
    }

    return lista.map(h => {
        const dataFmt = new Date(h.created_at || Date.now()).toLocaleString('pt-BR');
        const isNao = String(h.detalhes || '').includes('NÃO REALIZADO');
        const badgeStyle = isNao 
            ? 'background: #ffebee; color: #c62828;' 
            : 'background: #e8f5e9; color: #2e7d32;';

        return `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px 15px; white-space: nowrap; font-size: 13px;">${dataFmt}</td>
                <td style="padding: 12px 15px;"><strong>${h.usuario || '-'}</strong></td>
                <td style="padding: 12px 15px;">${h.acao || '-'}</td>
                <td style="padding: 12px 15px;"><span style="${badgeStyle} padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 12px;">${h.sessao || 'Geral'}</span></td>
                <td style="padding: 12px 15px; color: #555;">${h.detalhes || '-'}</td>
            </tr>
        `;
    }).join('');
}

function filtrarHistoricoTabela() {
    const colabElem = document.getElementById("filtro-colab-hist") || document.getElementById("filtro-hist-nome");
    const dataElem = document.getElementById("filtro-data-hist") || document.getElementById("filtro-hist-data");

    const nomeFiltro = colabElem ? colabElem.value.toLowerCase() : "";
    const dataFiltro = dataElem ? dataElem.value : "";

    const filtrados = dbHistorico.filter(h => {
        const matchNome = (h.usuario || '').toLowerCase().includes(nomeFiltro);
        let matchData = true;
        if (dataFiltro && h.created_at) {
            matchData = h.created_at.startsWith(dataFiltro);
        }
        return matchNome && matchData;
    });

    const body = document.getElementById("tabela-historico-body") || document.getElementById("lista-historico");
    if (body) {
        if (body.tagName === "TBODY") {
            body.innerHTML = renderLinhasHistorico(filtrados);
        } else {
            body.innerHTML = renderLinhasHistorico(filtrados);
        }
    }
}

function limparFiltrosHistorico() {
    if(document.getElementById("filtro-colab-hist")) document.getElementById("filtro-colab-hist").value = "";
    if(document.getElementById("filtro-hist-nome")) document.getElementById("filtro-hist-nome").value = "";
    if(document.getElementById("filtro-data-hist")) document.getElementById("filtro-data-hist").value = "";
    if(document.getElementById("filtro-hist-data")) document.getElementById("filtro-hist-data").value = "";
    
    const body = document.getElementById("tabela-historico-body");
    if (body) body.innerHTML = renderLinhasHistorico(dbHistorico);
}

// ==========================================
// TELA DE EQUIPE
// ==========================================
function carregarEquipe() {
    const container = document.getElementById("lista-equipe");
    if (!container) return;

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <input type="text" id="filtro-colab-input" placeholder="Pesquise nome..." onkeyup="filtrarTabelaEquipe()" style="padding: 10px; width: 280px; border: 1px solid #ccc; border-radius: 6px;">
            <button class="btn-primary" onclick="abrirModalUsuario()" style="width: auto; padding: 10px 18px;">+ Novo colaborador</button>
        </div>
        <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                <thead>
                    <tr style="background: #f8f9fa; border-bottom: 2px solid #e0e0e0;">
                        <th style="padding: 12px 15px;">Nome</th>
                        <th style="padding: 12px 15px;">E-mail</th>
                        <th style="padding: 12px 15px;">Cargo</th>
                        <th style="padding: 12px 15px;">Sessão</th>
                        <th style="padding: 12px 15px; width: 100px;">Ações</th>
                    </tr>
                </thead>
                <tbody id="tabela-equipe-body">
                    ${Object.keys(dbUsers).map(nome => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px 15px;"><strong>${nome}</strong></td>
                            <td style="padding: 12px 15px;">${dbUsers[nome].email || '-'}</td>
                            <td style="padding: 12px 15px;">${dbUsers[nome].cargo || 'Operador'}</td>
                            <td style="padding: 12px 15px;">${dbUsers[nome].sessao || '-'}</td>
                            <td style="padding: 12px 15px;">
                                <button onclick="abrirModalUsuario('${nome}')" style="border:none; background:none; cursor:pointer;" title="Editar">✏️</button>
                                ${nome !== usuarioLogado ? `<button onclick="excluirUsuario('${nome}')" style="border:none; background:none; cursor:pointer;" title="Excluir">🗑️</button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function abrirModalUsuario(nomeEdicao = null) {
    const modal = document.getElementById("modal-geral");
    const modalBody = document.getElementById("modal-body");
    let isEdit = nomeEdicao !== null;
    let u = isEdit ? dbUsers[nomeEdicao] : { cargo: Object.keys(dbCargos)[0] || "Operador", sessao: SESSOES[0] || "", email: "" };

    modalBody.innerHTML = `
        <h3 style="color:#005c45;">${isEdit ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
        <div class="input-group" style="margin-top:15px;"><label>Nome *</label><input type="text" id="form-user-nome" value="${isEdit ? nomeEdicao : ''}" ${isEdit ? 'disabled' : ''}></div>
        <div class="input-group"><label>E-mail *</label><input type="email" id="form-user-email" value="${u.email || ''}"></div>
        ${!isEdit ? `
            <div class="input-group">
                <label>Senha * (Mínimo 6 caracteres)</label>
                <div style="display:flex; gap:8px;">
                    <input type="text" id="form-user-senha" placeholder="Digite ou gere uma senha">
                    <button type="button" class="btn-primary" style="width:auto; white-space:nowrap; background:#555;" onclick="gerarSenhaAleatoria()">Gerar Senha</button>
                </div>
            </div>
        ` : ''}
        <div class="input-group"><label>Cargo</label><select id="form-user-cargo">${Object.keys(dbCargos).map(c => `<option value="${c}" ${u.cargo === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="input-group"><label>Sessão</label><select id="form-user-sessao">${SESSOES.map(s => `<option value="${s}" ${u.sessao === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <button class="btn-primary" onclick="salvarFormUsuario('${isEdit ? nomeEdicao : ''}')">Salvar Colaborador</button>
    `;
    modal.style.display = "flex";
}

function gerarSenhaAleatoria() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    let pass = "";
    for (let i = 0; i < 10; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById("form-user-senha");
    if (input) input.value = pass;
}

async function salvarFormUsuario(nomeOriginal) {
    const nome = document.getElementById("form-user-nome").value.trim();
    const email = document.getElementById("form-user-email").value.trim();
    const cargo = document.getElementById("form-user-cargo").value;
    const sessao = document.getElementById("form-user-sessao").value;
    const senhaEl = document.getElementById("form-user-senha");
    const senha = senhaEl ? senhaEl.value.trim() : null;
    let contaAuthJaExistia = false;

    if (!nome || !email) return alert("❌ Preencha os campos obrigatórios.");

    if (!nomeOriginal) {
        if (!senha || senha.length < 6) {
            return alert("❌ A senha precisa ter pelo menos 6 caracteres.");
        }

        if (_supabase) {
            const { data: authData, error: authErr } = await _supabase.auth.signUp({
                email: email,
                password: senha
            });

            if (authErr) {
                const mensagemAuth = String(authErr.message || '').toLowerCase();
                if (mensagemAuth.includes('user already registered')) {
                    contaAuthJaExistia = true;
                } else {
                    return alert("❌ Erro ao criar conta de autenticação no Supabase: " + authErr.message);
                }
            }
        }
    }

    const chave = nomeOriginal || nome;
    const cargoObj = dbCargos[cargo];
    const cargoId = cargoObj && cargoObj.id ? cargoObj.id : null;

    dbUsers[chave] = { email, cargo, cargo_id: cargoId, sessao, ativo: true };

    if (_supabase) {
        const payload = {
            nome: chave,
            email: email,
            cargo: cargo,
            cargo_id: cargoId,
            sessao: sessao,
            ativo: true
        };

        // A senha da conta Auth existente não pode ser alterada pelo cliente.
        if (!contaAuthJaExistia) payload.senha_hash = senha || "123456";

        const { error: dbErr } = await _supabase.from('usuarios').upsert([payload], { onConflict: 'nome' });
        if (dbErr) return alert("❌ Erro ao salvar colaborador na tabela de dados: " + dbErr.message);
    }

    if (!nomeOriginal && contaAuthJaExistia) {
        alert("⚠️ A conta de autenticação já existia. O colaborador foi cadastrado, mas a senha continua sendo a senha original dessa conta.");
    } else if (!nomeOriginal) {
        alert(`✅ Colaborador cadastrado com sucesso!\n\nE-mail: ${email}\nSenha: ${senha}\n\nGuarde esta senha para realizar o login.`);
    } else {
        alert("✅ Colaborador atualizado com sucesso!");
    }

    carregarEquipe();
    fecharModal();
}

function filtrarTabelaEquipe() {
    const termo = document.getElementById("filtro-colab-input").value.toLowerCase();
    document.querySelectorAll("#tabela-equipe-body tr").forEach(linha => {
        linha.style.display = linha.cells[0].innerText.toLowerCase().includes(termo) ? "" : "none";
    });
}

async function excluirUsuario(nome) {
    if (confirm(`Excluir colaborador "${nome}"?`)) {
        delete dbUsers[nome];
        if (_supabase) await _supabase.from('usuarios').delete().eq('nome', nome);
        carregarEquipe();
    }
}

// ==========================================
// TELA DE SESSÕES
// ==========================================
function carregarSessoes() {
    const container = document.getElementById("lista-sessoes") || document.getElementById("tab-sessoes");
    if (!container) return;

    container.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #333;">Sessões Cadastradas</h3>
                <button class="btn-primary" onclick="abrirModalSessao()" style="width: auto;">+ Nova Sessão</button>
            </div>
            <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #e0e0e0;">
                            <th style="padding: 12px 15px;">Nome da Sessão</th>
                            <th style="padding: 12px 15px; width: 120px;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${SESSOES.map((s, i) => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 12px 15px; font-weight: 600;">${s}</td>
                                <td style="padding: 12px 15px;">
                                    <button onclick="abrirModalSessao(${i})" style="border:none; background:none; cursor:pointer;" title="Editar">✏️</button>
                                    <button onclick="excluirSessao(${i})" style="border:none; background:none; cursor:pointer;" title="Excluir">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function abrirModalSessao(indexEdicao = null) {
    const modal = document.getElementById("modal-geral");
    let isEdit = indexEdicao !== null;
    let nomeAtual = isEdit ? SESSOES[indexEdicao] : "";

    document.getElementById("modal-body").innerHTML = `
        <h3 style="color:#005c45;">${isEdit ? 'Editar Sessão' : 'Nova Sessão'}</h3>
        <div class="input-group" style="margin-top:15px;">
            <label>Nome da Sessão *</label>
            <input type="text" id="form-sessao-nome" value="${nomeAtual}" placeholder="Ex: Jardinagem">
        </div>
        <button class="btn-primary" onclick="salvarFormSessao(${indexEdicao})">Salvar Sessão</button>
    `;
    modal.style.display = "flex";
}

async function salvarFormSessao(indexEdicao) {
    const nome = document.getElementById("form-sessao-nome").value.trim();
    if (!nome) return alert("❌ Digite o nome da sessão.");

    if (indexEdicao !== null && indexEdicao !== undefined && indexEdicao !== 'null') {
        const antigo = SESSOES[indexEdicao];
        if (_supabase) await _supabase.from('sessoes').update({ nome }).eq('nome', antigo);
        SESSOES[indexEdicao] = nome;
    } else {
        if (_supabase) await _supabase.from('sessoes').upsert([{ nome }], { onConflict: 'nome' });
        SESSOES.push(nome);
    }

    carregarSessoes();
    fecharModal();
}

async function excluirSessao(i) {
    const s = SESSOES[i];
    if (confirm(`Excluir a sessão "${s}"?`)) {
        if (_supabase) await _supabase.from('sessoes').delete().eq('nome', s);
        SESSOES.splice(i, 1);
        carregarSessoes();
    }
}

// ==========================================
// TELA DE CARGOS
// ==========================================
function carregarCargos() {
    const container = document.getElementById("lista-cargos") || document.getElementById("tab-cargos");
    if (!container) return;

    container.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #333;">Cargos e Funções</h3>
                <button class="btn-primary" onclick="abrirModalCargo()" style="width: auto;">+ Novo Cargo</button>
            </div>
            <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #e0e0e0;">
                            <th style="padding: 12px 15px;">Cargo</th>
                            <th style="padding: 12px 15px;">Descrição</th>
                            <th style="padding: 12px 15px;">Permissões Associadas</th>
                            <th style="padding: 12px 15px; width: 120px;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.keys(dbCargos).map(c => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 12px 15px; font-weight: 600;">${c}</td>
                                <td style="padding: 12px 15px; color: #555;">${dbCargos[c].descricao || '-'}</td>
                                <td style="padding: 12px 15px;">
                                    <span style="font-size:12px; background:#f0f0f0; padding:4px 8px; border-radius:4px;">
                                        ${(dbCargos[c].permissoes || []).length} permissão(ões)
                                    </span>
                                </td>
                                <td style="padding: 12px 15px;">
                                    <button onclick="abrirModalCargo('${c}')" style="border:none; background:none; cursor:pointer;" title="Editar">✏️</button>
                                    ${c !== 'Administrador' ? `<button onclick="excluirCargo('${c}')" style="border:none; background:none; cursor:pointer;" title="Excluir">🗑️</button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function abrirModalCargo(nomeEdicao = null) {
    const modal = document.getElementById("modal-geral");
    let isEdit = nomeEdicao !== null && nomeEdicao !== undefined;
    let c = isEdit ? dbCargos[nomeEdicao] : { descricao: "", permissoes: [] };
    let permsChecked = c ? (c.permissoes || []) : [];

    document.getElementById("modal-body").innerHTML = `
        <h3 style="color:#005c45;">${isEdit ? 'Editar Cargo' : 'Novo Cargo'}</h3>
        <div class="input-group" style="margin-top:15px;">
            <label>Nome do Cargo *</label>
            <input type="text" id="form-cargo-nome" value="${isEdit ? nomeEdicao : ''}" ${isEdit ? 'disabled' : ''} placeholder="Ex: Encarregado">
        </div>
        <div class="input-group">
            <label>Descrição</label>
            <input type="text" id="form-cargo-desc" value="${c ? (c.descricao || '') : ''}" placeholder="Descrição das responsabilidades">
        </div>
        <div class="input-group">
            <label style="font-weight:700; margin-bottom:8px; display:block;">Selecione as Permissões do Cargo:</label>
            <div style="max-height: 160px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; border-radius: 6px; background:#fafafa;">
                ${PERMISSOES.map(p => `
                    <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer; font-size:13px;">
                        <input type="checkbox" class="chk-cargo-perm" value="${p.id}" ${permsChecked.includes(p.id) ? 'checked' : ''}>
                        <span><strong>${p.nome}</strong> <small style="color:#777;">(${p.id})</small></span>
                    </label>
                `).join('')}
            </div>
        </div>
        <button class="btn-primary" onclick="salvarFormCargo('${isEdit ? nomeEdicao : ''}')">Salvar Cargo</button>
    `;
    modal.style.display = "flex";
}

async function salvarFormCargo(nomeOriginal) {
    const nomeInput = document.getElementById("form-cargo-nome").value.trim();
    const desc = document.getElementById("form-cargo-desc").value.trim();
    const chave = (nomeOriginal && nomeOriginal !== 'null') ? nomeOriginal : nomeInput;

    if (!chave) return alert("❌ Digite o nome do cargo.");

    const selecionadas = Array.from(document.querySelectorAll('.chk-cargo-perm:checked')).map(el => el.value);

    dbCargos[chave] = { ...dbCargos[chave], descricao: desc, permissoes: selecionadas };

    if (_supabase) {
        await _supabase.from('cargos').upsert([{ nome: chave, descricao: desc, permissoes: selecionadas }], { onConflict: 'nome' });
        await sincronizarDadosComSupabase();
    }

    alert("✅ Cargo salvo com sucesso!");
    carregarCargos();
    fecharModal();
}

async function excluirCargo(nome) {
    if (confirm(`Excluir o cargo "${nome}"?`)) {
        delete dbCargos[nome];
        if (_supabase) await _supabase.from('cargos').delete().eq('nome', nome);
        carregarCargos();
    }
}

// ==========================================
// TELA DE PERMISSÕES
// ==========================================
function carregarPermissoesTela() {
    const container = document.getElementById("lista-permissoes") || document.getElementById("tab-permissoes");
    if (!container) return;

    container.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #333;">Permissões do Sistema</h3>
                <button class="btn-primary" onclick="abrirModalPermissao()" style="width: auto;">+ Nova Permissão</button>
            </div>
            <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #e0e0e0;">
                            <th style="padding: 12px 15px;">Código / ID</th>
                            <th style="padding: 12px 15px;">Nome da Permissão</th>
                            <th style="padding: 12px 15px;">Tipo</th>
                            <th style="padding: 12px 15px; width: 120px;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${PERMISSOES.map((p, index) => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 12px 15px;"><code style="background:#f0f0f0; color:#005c45; padding:3px 8px; border-radius:4px; font-weight:600;">${p.id}</code></td>
                                <td style="padding: 12px 15px; font-weight: 600;">${p.nome}</td>
                                <td style="padding: 12px 15px; text-transform:capitalize; color:#666;">${p.tipo || 'tela'}</td>
                                <td style="padding: 12px 15px;">
                                    <button onclick="abrirModalPermissao(${index})" style="border:none; background:none; cursor:pointer;" title="Editar">✏️</button>
                                    <button onclick="excluirPermissao(${index})" style="border:none; background:none; cursor:pointer;" title="Excluir">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function abrirModalPermissao(indexEdicao = null) {
    const modal = document.getElementById("modal-geral");
    let isEdit = indexEdicao !== null && indexEdicao !== undefined;
    let p = isEdit ? PERMISSOES[indexEdicao] : { id: "", nome: "", tipo: "tela" };

    document.getElementById("modal-body").innerHTML = `
        <h3 style="color:#005c45;">${isEdit ? 'Editar Permissão' : 'Nova Permissão'}</h3>
        <div class="input-group" style="margin-top:15px;">
            <label>Código da Permissão (ID sem espaços) *</label>
            <input type="text" id="form-perm-id" value="${p.id}" ${isEdit ? 'disabled' : ''} placeholder="Ex: relatorios">
        </div>
        <div class="input-group">
            <label>Nome Amigável *</label>
            <input type="text" id="form-perm-nome" value="${p.nome}" placeholder="Ex: Visualizar Relatórios">
        </div>
        <div class="input-group">
            <label>Tipo *</label>
            <select id="form-perm-tipo">
                <option value="tela" ${p.tipo === 'tela' ? 'selected' : ''}>Tela</option>
                <option value="acao" ${p.tipo === 'acao' ? 'selected' : ''}>Ação / Botão</option>
            </select>
        </div>
        <button class="btn-primary" onclick="salvarFormPermissao(${indexEdicao})">Salvar Permissão</button>
    `;
    modal.style.display = "flex";
}

async function salvarFormPermissao(indexEdicao) {
    const id = document.getElementById("form-perm-id").value.trim().toLowerCase().replace(/\s+/g, '_');
    const nome = document.getElementById("form-perm-nome").value.trim();
    const tipo = document.getElementById("form-perm-tipo").value;

    if (!id || !nome) return alert("❌ Preencha todos os campos obrigatórios.");

    const objetoPerm = { id, nome, tipo };

    if (_supabase) {
        const { error } = await _supabase.from('permissoes').upsert([objetoPerm], { onConflict: 'id' }).select();
        if (error) {
            console.error("Erro no Supabase (permissoes):", error);
            return alert("❌ Erro ao salvar permissão no banco: " + error.message);
        }
    }

    if (indexEdicao !== null && indexEdicao !== undefined && indexEdicao !== 'null') {
        PERMISSOES[indexEdicao] = objetoPerm;
    } else {
        if (PERMISSOES.some(item => item.id === id)) return alert("❌ Já existe uma permissão com este Código/ID.");
        PERMISSOES.push(objetoPerm);
    }

    alert("✅ Permissão salva!");
    carregarPermissoesTela();
    fecharModal();
}

async function excluirPermissao(index) {
    const p = PERMISSOES[index];
    if (confirm(`Excluir a permissão "${p.nome}" (${p.id})?`)) {
        if (_supabase) await _supabase.from('permissoes').delete().eq('id', p.id);
        PERMISSOES.splice(index, 1);
        carregarPermissoesTela();
    }
}

// ==========================================
// TELA DE PERFIL E ALTERAÇÃO DE SENHA
// ==========================================
function carregarPerfil() {
    const nome = usuarioLogado || 'Usuário';
    const user = dbUsers[nome];
    const cargo = user ? (user.cargo || 'Cargo') : 'Cargo';
    const inicial = nome.charAt(0).toUpperCase();

    if (document.getElementById("perfil-nome-display")) document.getElementById("perfil-nome-display").innerText = nome;
    if (document.getElementById("perfil-cargo-display")) document.getElementById("perfil-cargo-display").innerText = cargo;
    if (document.getElementById("perfil-avatar")) document.getElementById("perfil-avatar").innerText = inicial;
    
    const inputSenha = document.getElementById("nova-senha-perfil");
    if (inputSenha) inputSenha.value = "";
}

async function alterarMinhaSenha() {
    const inputSenha = document.getElementById("nova-senha-perfil");
    const novaSenha = inputSenha ? inputSenha.value.trim() : "";

    if (!novaSenha) {
        return alert("❌ Por favor, digite a nova senha.");
    }

    if (novaSenha.length < 6) {
        return alert("❌ A nova senha precisa ter pelo menos 6 caracteres.");
    }

    if (!_supabase) {
        return alert("❌ Supabase não configurado.");
    }

    try {
        const { error } = await _supabase.auth.updateUser({ password: novaSenha });

        if (error) {
            return alert("❌ Erro ao atualizar senha no Supabase: " + error.message);
        }

        if (usuarioLogado) {
            await _supabase.from('usuarios').update({ senha_hash: novaSenha }).eq('nome', usuarioLogado);
        }

        alert("✅ Senha alterada com sucesso!");
        if (inputSenha) inputSenha.value = "";
    } catch (err) {
        alert("❌ Erro inesperado ao alterar senha: " + err.message);
    }
}

// ==========================================
// AUXILIARES
// ==========================================
function fecharModal() {
    const modal = document.getElementById("modal-geral");
    if (modal) modal.style.display = "none";
}