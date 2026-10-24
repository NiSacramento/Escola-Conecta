let model, webcam;
let usuarioLogado = null;
let tokenAcesso = localStorage.getItem("tokenAcesso");

let letras = [];
let palavraAtual = "";
let index = 0;
let rodando = false;
let contador = 5;
let intervaloContador = null;
let ultimaPredicao = null;
let totalTentativas = 0;
let totalErros = 0;

/**
 * Alterna a visibilidade de um campo de senha sem alterar seu valor.
 */
function alternarVisibilidadeSenha(campoId, botao) {
  const campo = document.getElementById(campoId);
  if (!campo || !botao) return;

  const mostrar = campo.type === "password";
  campo.type = mostrar ? "text" : "password";
  botao.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
  botao.setAttribute("aria-pressed", String(mostrar));
  botao.textContent = mostrar ? "◉" : "◎";
  botao.title = mostrar ? "Ocultar senha" : "Mostrar senha";
}



const API_URL = (() => {
  // No Azure, a API e o site usam a mesma origem.
  // Localmente, o Live Server (5500/5501) chama a API ASP.NET na porta 5161.
  const porta = window.location.port;
  if (porta === "5500" || porta === "5501") {
    return `${window.location.protocol}//${window.location.hostname}:5161`;
  }
  return window.location.origin;
})();
const confiancaMinima = 0.60;

// Mantém o histórico local separado por usuário para não misturar dados entre contas.
function chaveHistoricoAtual() {
  const email = usuarioLogado && usuarioLogado.email
    ? usuarioLogado.email.trim().toLowerCase()
    : "visitante";
  return `historicoProgresso_${email}`;
}

// Esta checagem melhora a experiência do usuário; a validação real do token
// continua sendo feita pelo backend em cada requisição protegida.
function tokenAindaValido() {
  if (!tokenAcesso) return false;

  try {
    const partes = tokenAcesso.split(".");
    if (partes.length !== 3) return false;

    const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const preenchido = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
    const payload = JSON.parse(atob(preenchido));

    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

const letrasCards = ["B", "I", "L", "N", "O", "P", "U"];

let tipoCardAtual = "";
let perguntaAtualCard = 0;
let totalPerguntasCards = 5;
let pontuacaoCard = 0;
let errosCards = 0;
let respostaCorretaCard = "";

async function lerResposta(response) {
  try {
    return await response.json();
  } catch {
    return { mensagem: "Erro interno no servidor." };
  }
}

const itensPesquisa = [
  { nome: "Aulas", tela: "aulas" },
  { nome: "Aula em vídeo", tela: "aulas" },
  { nome: "Aula teórica", tela: "aulas" },
  { nome: "Exercícios", tela: "exercicios" },
  { nome: "Exercícios com webcam", tela: "webcamMenu" },
  { nome: "Soletrar UNIP", tela: "webcamMenu" },
  { nome: "Soletrar ALUNO", tela: "webcamMenu" },
  { nome: "Exercícios com cards", tela: "cardsMenu" },
  { nome: "Identificar letra pelo gesto", tela: "cardsMenu" },
  { nome: "Identificar gesto pela letra", tela: "cardsMenu" },
  { nome: "Progresso", tela: "progresso" },
  { nome: "Configurações", tela: "configuracoes" },
  { nome: "Dados da conta", tela: "configuracoes" },
  { nome: "Segurança", tela: "configuracoes" },
  { nome: "Alterar senha", tela: "configuracoes" }
];

function mostrarAuth(id) {
  document.querySelectorAll(".auth-card").forEach(card => {
    card.classList.add("hidden");
  });

  const tela = document.getElementById(id);
  if (tela) tela.classList.remove("hidden");

  ["loginMsg", "cadastroMsg", "recMsg"].forEach(msgId => {
    const el = document.getElementById(msgId);
    if (el) el.innerText = "";
  });

  // Limpa os campos temporários ao sair da recuperação de senha.
  if (id !== "esqueciTela") {
    ["recSenha", "recConfirmaSenha"].forEach(campoId => {
      const campo = document.getElementById(campoId);
      if (campo) campo.value = "";
    });
    const email = document.getElementById("recEmail");
    if (email) email.disabled = false;
  }
}

async function cadastrar() {
  const nome = document.getElementById("cadNome").value.trim();
  const nascimento = document.getElementById("cadNascimento").value;
  const email = document.getElementById("cadEmail").value.trim().toLowerCase();
  const confirmaEmail = document.getElementById("cadConfirmaEmail").value.trim().toLowerCase();
  const senha = document.getElementById("cadSenha").value;
  const confirmaSenha = document.getElementById("cadConfirmaSenha").value;
  const msg = document.getElementById("cadastroMsg");

  if (!nome || !nascimento || !email || !confirmaEmail || !senha || !confirmaSenha) {
    msg.innerText = "Preencha todos os campos.";
    msg.style.color = "red";
    return;
  }

  if (email !== confirmaEmail) {
    msg.innerText = "Os emails não conferem.";
    msg.style.color = "red";
    return;
  }

  if (senha !== confirmaSenha) {
    msg.innerText = "As senhas não conferem.";
    msg.style.color = "red";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/cadastro`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nome,
        sobrenome: "",
        apelido: nome,
        dataNascimento: nascimento,
        email,
        senha,
        telefone: "",
        emailRecuperacao: email,
        telefoneRecuperacao: ""
      })
    });

    const data = await lerResposta(response);

    if (!response.ok) {
      msg.innerText = data.mensagem || "Erro ao cadastrar.";
      msg.style.color = "red";
      return;
    }

    msg.innerText = data.mensagem || "Cadastro efetuado com sucesso!";
    msg.style.color = "green";

    setTimeout(() => {
      mostrarAuth("loginTela");
    }, 1200);

  }
    catch (erro) {
    msg.innerText = "Erro ao conectar com o servidor.";
    msg.style.color = "red";
    console.error(erro);
  }
}

async function entrar() {
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const senha = document.getElementById("loginSenha").value;
  const msg = document.getElementById("loginMsg");

  if (!email || !senha) {
    msg.innerText = "Digite email e senha.";
    msg.style.color = "red";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, senha })
    });

    const data = await lerResposta(response);

    if (!response.ok) {
      msg.innerText = data.mensagem || "Email ou senha incorretos.";
      msg.style.color = "red";
      return;
    }

    if (!data.token) {
    msg.innerText = "A API ainda não está configurada para fornecer o token de acesso.";
    msg.style.color = "red";
    return;
}

tokenAcesso = data.token;

localStorage.setItem("tokenAcesso", tokenAcesso);

usuarioLogado = data.aluno;

localStorage.setItem("usuarioLogado", JSON.stringify(usuarioLogado));

    const authArea = document.getElementById("authArea");
    const sistemaArea = document.getElementById("sistemaArea");

    if (authArea) authArea.classList.add("hidden");
    if (sistemaArea) sistemaArea.classList.remove("hidden");

    mostrarTela("inicio");
    carregarUsuarioNaTela();
    carregarProgresso();

  } catch (erro) {
    msg.innerText = "Erro ao conectar com o servidor.";
    msg.style.color = "red";
    console.error("Erro no login:", erro);
  }
}

async function trocarSenha() {
  const campoEmail = document.getElementById("recEmail");
  const email = campoEmail.value.trim().toLowerCase();
  const senha = document.getElementById("recSenha").value;
  const confirmaSenha = document.getElementById("recConfirmaSenha").value;
  const msg = document.getElementById("recMsg");

  if (!email || !campoEmail.checkValidity() || !senha || !confirmaSenha) {
    msg.innerText = "Informe um e-mail válido e preencha os dois campos de senha.";
    msg.style.color = "red";
    return;
  }

  if (senha.length < 8) {
    msg.innerText = "A nova senha deve ter pelo menos 8 caracteres.";
    msg.style.color = "red";
    return;
  }

  if (senha.length > 128) {
    msg.innerText = "A nova senha deve ter no máximo 128 caracteres.";
    msg.style.color = "red";
    return;
  }

  if (senha !== confirmaSenha) {
    msg.innerText = "As senhas não conferem.";
    msg.style.color = "red";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/recuperar-senha`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, novaSenha: senha, confirmarSenha: confirmaSenha })
    });
    const data = await lerResposta(response);

    if (!response.ok) {
      msg.innerText = data.mensagem || "Não foi possível alterar a senha.";
      msg.style.color = "red";
      return;
    }

    msg.innerText = data.mensagem || "Senha alterada. Entre com a nova senha.";
    msg.style.color = "green";
    document.getElementById("recSenha").value = "";
    document.getElementById("recConfirmaSenha").value = "";

    setTimeout(() => mostrarAuth("loginTela"), 1800);
  } catch (erro) {
    msg.innerText = "Erro ao conectar com o servidor.";
    msg.style.color = "red";
    console.error("Erro ao alterar senha:", erro);
  }
}

function sair() {
  usuarioLogado = null;
  tokenAcesso = null;

  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("tokenAcesso");

  document.getElementById("sistemaArea").classList.add("hidden");
  document.getElementById("authArea").classList.remove("hidden");

  mostrarAuth("loginTela");
}

function usuarioEhAdministrador() {
  return String(usuarioLogado?.perfil || "").toLowerCase() === "administrador";
}

function escaparHtmlAdmin(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caractere]);
}

function formatarDataAdmin(valor) {
  if (!valor) return "Sem atividade";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? String(valor) : data.toLocaleString("pt-BR");
}

function carregarUsuarioNaTela() {
  if (!usuarioLogado) return;

  const botaoAdmin = document.getElementById("navAdmin");
  if (botaoAdmin) {
    botaoAdmin.classList.toggle("hidden", !usuarioEhAdministrador());
  }

  const nomeExibido = usuarioLogado.apelido || usuarioLogado.nome || "Aluno";
  const inicial = nomeExibido.charAt(0).toUpperCase();

  document.getElementById("nomePerfil").innerText = nomeExibido;
  document.getElementById("avatarPerfil").innerText = inicial;
  document.getElementById("boasVindas").innerText = "Bem-vindo, " + nomeExibido + "!";

  const avatarImg = document.getElementById("avatarImg");
  const avatarTexto = document.getElementById("avatarPerfil");

  if (avatarImg && avatarTexto) {
    if (usuarioLogado.fotoPerfil) {
      avatarImg.src = usuarioLogado.fotoPerfil;
      avatarImg.classList.remove("hidden");
      avatarTexto.classList.add("hidden");
    } else {
      avatarImg.classList.add("hidden");
      avatarTexto.classList.remove("hidden");
    }
  }

  document.getElementById("nomeConfig").value = usuarioLogado.nome || "";
  document.getElementById("sobrenomeConfig").value = usuarioLogado.sobrenome || "";
  document.getElementById("apelidoConfig").value = usuarioLogado.apelido || "";
  document.getElementById("emailConfig").value = usuarioLogado.email || "";
  document.getElementById("telefoneConfig").value = usuarioLogado.telefone || "";
  document.getElementById("emailRecConfig").value = usuarioLogado.emailRecuperacao || "";
  document.getElementById("telefoneRecConfig").value = usuarioLogado.telefoneRecuperacao || "";
}

async function salvarDadosConta() {
  const nome = document.getElementById("nomeConfig").value.trim();
  const sobrenome = document.getElementById("sobrenomeConfig").value.trim();
  const apelido = document.getElementById("apelidoConfig").value.trim();
  const novoEmail = document.getElementById("emailConfig").value.trim().toLowerCase();
  const telefone = document.getElementById("telefoneConfig").value.trim();
  const msg = document.getElementById("dadosMsg");

  if (!nome || !novoEmail) {
    msg.innerText = "Nome e email são obrigatórios.";
    msg.style.color = "red";
    return;
  }

  if (!tokenAcesso) {
    msg.innerText = "Sua sessão expirou. Entre novamente.";
    msg.style.color = "red";
    sair();
    return;
  }

  try {
    const response = await fetch(`${API_URL}/configuracoes/dados`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenAcesso}`
      },
      body: JSON.stringify({
        emailAtual: usuarioLogado.email,
        nome,
        sobrenome,
        apelido: apelido || nome,
        novoEmail,
        telefone
      })
    });

    const data = await lerResposta(response);

    if (!response.ok) {
      msg.innerText = data.mensagem || "Erro ao alterar dados.";
      msg.style.color = "red";
      return;
    }

    usuarioLogado = {
      ...usuarioLogado,
      nome,
      sobrenome,
      apelido: apelido || nome,
      email: novoEmail,
      telefone
    };

    localStorage.setItem("usuarioLogado", JSON.stringify(usuarioLogado));
    carregarUsuarioNaTela();

    msg.innerText = data.mensagem || "Dados alterados com sucesso!";
    msg.style.color = "green";

  } catch (erro) {
    msg.innerText = "Erro ao conectar com o servidor.";
    msg.style.color = "red";
    console.error(erro);
  }
}
async function salvarSeguranca() {
  const senha = document.getElementById("senhaConfig").value;
  const confirmaSenha = document.getElementById("confirmaSenhaConfig").value;
  const emailRecuperacao = document.getElementById("emailRecConfig").value.trim().toLowerCase();
  const telefoneRecuperacao = document.getElementById("telefoneRecConfig").value.trim();
  const msg = document.getElementById("segMsg");

  if (senha || confirmaSenha) {
    if (senha !== confirmaSenha) {
      msg.innerText = "As senhas não conferem.";
      msg.style.color = "red";
      return;
    }
  }

  if (!tokenAcesso) {
    msg.innerText = "Sua sessão expirou. Entre novamente.";
    msg.style.color = "red";
    sair();
    return;
  }

  try {
    const response = await fetch(`${API_URL}/configuracoes/seguranca`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenAcesso}`
      },
      body: JSON.stringify({
        email: usuarioLogado.email,
        novaSenha: senha,
        confirmarSenha: confirmaSenha,
        emailRecuperacao,
        telefoneRecuperacao
      })
    });

    const data = await lerResposta(response);

    if (!response.ok) {
      msg.innerText = data.mensagem || "Erro ao alterar segurança.";
      msg.style.color = "red";
      return;
    }

    usuarioLogado = {
      ...usuarioLogado,
      emailRecuperacao,
      telefoneRecuperacao
    };

    localStorage.setItem("usuarioLogado", JSON.stringify(usuarioLogado));

    document.getElementById("senhaConfig").value = "";
    document.getElementById("confirmaSenhaConfig").value = "";

    msg.innerText = data.mensagem || "Segurança alterada com sucesso!";
    msg.style.color = "green";

  } catch (erro) {
    msg.innerText = "Erro ao conectar com o servidor.";
    msg.style.color = "red";
    console.error(erro);
  }
}

function mostrarTela(id) {
  // A validação abaixo evita abrir a tela pela interface; o backend também
  // exige a função Administrador para entregar os dados.
  if (id === "adminAlunos" && !usuarioEhAdministrador()) {
    mostrarTela("inicio");
    return;
  }

  document.querySelectorAll(".tela").forEach(tela => {
    tela.classList.remove("ativa");
  });

  const tela = document.getElementById(id);

  if (tela) {
    tela.classList.add("ativa");
  }

  fecharMenuPerfil();

  if (typeof fecharMenuMobile === "function") {
    fecharMenuMobile();
  }

  if (id === "progresso") {
    carregarProgresso();
  }

  if (id === "adminAlunos") {
    carregarAlunosAdmin();
  }
}

async function carregarAlunosAdmin() {
  const mensagem = document.getElementById("adminMsg");
  const corpo = document.getElementById("adminAlunosTbody");
  if (!mensagem || !corpo) return;

  if (!usuarioEhAdministrador() || !tokenAcesso) {
    mensagem.innerText = "Acesso restrito ao administrador.";
    mensagem.style.color = "red";
    return;
  }

  mensagem.innerText = "Carregando alunos...";
  mensagem.style.color = "var(--muted)";
  corpo.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

  try {
    const resposta = await fetch(`${API_URL}/admin/alunos`, {
      headers: { "Authorization": `Bearer ${tokenAcesso}` }
    });

    const dados = await lerResposta(resposta);
    if (!resposta.ok) {
      corpo.innerHTML = '<tr><td colspan="5">Não foi possível carregar a lista.</td></tr>';
      mensagem.innerText = resposta.status === 403
        ? "Seu perfil não tem permissão para acessar esta área."
        : resposta.status === 401
          ? "Sessão inválida ou expirada. Entre novamente."
          : (dados.mensagem || "Erro ao consultar os alunos.");
      mensagem.style.color = "red";
      return;
    }

    if (!Array.isArray(dados)) {
      throw new Error("Formato de resposta inesperado.");
    }

    if (dados.length === 0) {
      corpo.innerHTML = '<tr><td colspan="5">Nenhum aluno cadastrado.</td></tr>';
    } else {
      corpo.innerHTML = dados.map(aluno => `
        <tr>
          <td><button type="button" class="admin-aluno-link" data-email="${escaparHtmlAdmin(aluno.email)}" data-nome="${escaparHtmlAdmin(aluno.nome)}" onclick="abrirProgressoAluno(this.dataset.email, this.dataset.nome)" aria-label="Ver progresso de ${escaparHtmlAdmin(aluno.nome)}">${escaparHtmlAdmin(aluno.nome)}</button></td>
          <td>${escaparHtmlAdmin(aluno.email)}</td>
          <td>${escaparHtmlAdmin(aluno.perfil || "Aluno")}</td>
          <td>${Number.isFinite(Number(aluno.quantidadeRegistrosProgresso)) ? Number(aluno.quantidadeRegistrosProgresso) : 0}</td>
          <td>${escaparHtmlAdmin(formatarDataAdmin(aluno.ultimaAtividade))}</td>
        </tr>
      `).join("");
    }

    mensagem.innerText = `Alunos encontrados: ${dados.length}.`;
    mensagem.style.color = "green";
  } catch (erro) {
    console.error("Erro ao carregar a área administrativa:", erro);
    corpo.innerHTML = '<tr><td colspan="5">Falha na conexão com o servidor.</td></tr>';
    mensagem.innerText = "Não foi possível conectar à API administrativa.";
    mensagem.style.color = "red";
  }
}

async function abrirProgressoAluno(email, nome) {
  const mensagem = document.getElementById("adminDetalhesMsg");
  const subtitulo = document.getElementById("adminDetalhesSubtitulo");
  const corpo = document.getElementById("adminProgressoTbody");

  if (!usuarioEhAdministrador() || !tokenAcesso) {
    if (mensagem) {
      mensagem.innerText = "Acesso restrito ao administrador.";
      mensagem.style.color = "red";
    }
    return;
  }

  if (subtitulo) subtitulo.innerText = `Histórico de exercícios de ${nome} (${email})`;
  if (mensagem) {
    mensagem.innerText = "Carregando histórico...";
    mensagem.style.color = "var(--muted)";
  }
  if (corpo) corpo.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
  mostrarTela("adminAlunoDetalhes");

  try {
    const resposta = await fetch(
      `${API_URL}/admin/alunos/${encodeURIComponent(email)}/progresso`,
      { headers: { "Authorization": `Bearer ${tokenAcesso}` } }
    );
    const dados = await lerResposta(resposta);

    if (!resposta.ok) {
      if (corpo) corpo.innerHTML = '<tr><td colspan="5">Não foi possível carregar o histórico.</td></tr>';
      if (mensagem) {
        mensagem.innerText = resposta.status === 403
          ? "Seu perfil não tem permissão para consultar esse histórico."
          : resposta.status === 401
            ? "Sessão inválida ou expirada. Entre novamente."
            : (dados.mensagem || "Erro ao consultar o progresso.");
        mensagem.style.color = "red";
      }
      return;
    }

    const historico = Array.isArray(dados.historico) ? dados.historico : [];
    if (!corpo) return;

    if (historico.length === 0) {
      corpo.innerHTML = '<tr><td colspan="5">Este aluno ainda não possui exercícios registrados.</td></tr>';
      if (mensagem) {
        mensagem.innerText = "Nenhum exercício encontrado.";
        mensagem.style.color = "var(--muted)";
      }
      return;
    }

    corpo.innerHTML = historico.map(item => {
      const nota = Number(item.porcentagem);
      return `
        <tr>
          <td>${escaparHtmlAdmin(item.exercicio || "Exercício")}</td>
          <td><span class="admin-nota">${Number.isFinite(nota) ? `${nota}%` : "—"}</span></td>
          <td>${Number.isFinite(Number(item.acertos)) ? Number(item.acertos) : 0}</td>
          <td>${Number.isFinite(Number(item.erros)) ? Number(item.erros) : 0}</td>
          <td>${escaparHtmlAdmin(item.data || "Sem data")}</td>
        </tr>`;
    }).join("");

    if (mensagem) {
      mensagem.innerText = `${historico.length} registro(s) de exercício encontrado(s).`;
      mensagem.style.color = "green";
    }
  } catch (erro) {
    console.error("Erro ao carregar progresso do aluno:", erro);
    if (corpo) corpo.innerHTML = '<tr><td colspan="5">Falha na conexão com o servidor.</td></tr>';
    if (mensagem) {
      mensagem.innerText = "Não foi possível conectar à API para consultar o progresso.";
      mensagem.style.color = "red";
    }
  }
}

function fecharMenuPerfil() {
  const menu = document.getElementById("menuPerfil");
  if (menu) menu.classList.add("hidden");
}

function pesquisarSistema() {
  const termo = document.getElementById("campoPesquisa").value.toLowerCase().trim();
  const box = document.getElementById("resultadoPesquisa");

  if (!termo) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  const resultados = itensPesquisa.filter(item =>
    item.nome.toLowerCase().includes(termo)
  );

  box.innerHTML = resultados.length
    ? resultados.map(item => `<p onclick="mostrarTela('${item.tela}'); limparPesquisa()">${item.nome}</p>`).join("")
    : "<p>Nenhum resultado encontrado.</p>";

  box.classList.remove("hidden");
}

function limparPesquisa() {
  document.getElementById("campoPesquisa").value = "";
  document.getElementById("resultadoPesquisa").classList.add("hidden");
}

function normalizarClasse(nome) {
  return nome
    .toUpperCase()
    .replace("LETRA", "")
    .replace("GESTO", "")
    .replace("_", "")
    .replace("-", "")
    .trim();
}

async function iniciarExercicio(palavra) {
  palavraAtual = palavra;
  letras = palavra.split("");

  totalTentativas = 0;
  totalErros = 0;

  iniciarWebcam();
}

async function iniciarWebcam() {
  mostrarTela("webcamLicao");

  try {
   const URL = "./ia-model/";

    model = await tmImage.load(URL + "model.json", URL + "metadata.json");

    webcam = new tmImage.Webcam(340, 340, true);
    await webcam.setup();
    await webcam.play();

    document.getElementById("webcam-container").innerHTML = "";
    document.getElementById("webcam-container").appendChild(webcam.canvas);

    index = 0;
    rodando = true;
    ultimaPredicao = null;

    document.getElementById("tituloExercicio").innerText = "Soletrar " + palavraAtual;

    const letraBox = document.querySelector(".letra-box");
    const contadorBox = document.querySelector(".contador-box");

    if (letraBox) letraBox.style.display = "flex";
    if (contadorBox) contadorBox.style.display = "block";

    document.getElementById("resultado").innerText = "Aguardando gesto...";
    const indicadorInicialIA = document.getElementById("debugIA");
    if (indicadorInicialIA) {
      indicadorInicialIA.innerText = "Detectando...";
      indicadorInicialIA.style.display = "block";
      indicadorInicialIA.style.visibility = "visible";
      indicadorInicialIA.style.opacity = "1";
    }
    document.getElementById("progressoLetras").innerText = "";

    atualizarLetra();
    iniciarContagem();

    window.requestAnimationFrame(loop);

  } catch (erro) {
    alert("Erro ao iniciar webcam: " + erro);
    console.error(erro);
  }
}

async function loop() {
  if (!rodando) return;

  webcam.update();

  const prediction = await model.predict(webcam.canvas);

  let maior = prediction[0];

  for (let i = 1; i < prediction.length; i++) {
    if (prediction[i].probability > maior.probability) {
      maior = prediction[i];
    }
  }

  ultimaPredicao = maior;

  const classe = normalizarClasse(maior.className);
  const porcentagem = (maior.probability * 100).toFixed(1);

  // Exibe novamente a confiança da IA durante a detecção, inclusive em telas móveis.
  let indicadorIA = document.getElementById("debugIA");
  if (!indicadorIA) {
    indicadorIA = document.createElement("p");
    indicadorIA.id = "debugIA";
    const areaCamera = document.getElementById("webcam-container");
    if (areaCamera && areaCamera.parentElement) {
      areaCamera.insertAdjacentElement("afterend", indicadorIA);
    }
  }

  if (indicadorIA) {
    indicadorIA.textContent = `Detectando: ${classe} - ${porcentagem}%`;
    indicadorIA.style.display = "block";
    indicadorIA.style.visibility = "visible";
    indicadorIA.style.opacity = "1";
    indicadorIA.style.marginTop = "10px";
    indicadorIA.style.fontSize = "14px";
    indicadorIA.style.fontWeight = "600";
    indicadorIA.style.color = "#526078";
  }

  window.requestAnimationFrame(loop);
}

function iniciarContagem() {
  clearInterval(intervaloContador);

  contador = 5;
  ultimaPredicao = null;

  document.getElementById("contador").innerText = contador;
  document.getElementById("resultado").innerText = "Prepare o gesto...";
  document.getElementById("resultado").style.color = "#15223b";

  intervaloContador = setInterval(() => {
    contador--;
    document.getElementById("contador").innerText = contador;

    if (contador <= 0) {
      clearInterval(intervaloContador);
      validarAoFinal();
    }
  }, 1000);
}

function validarAoFinal() {
  const letraEsperada = letras[index];
  totalTentativas++;

  if (!ultimaPredicao) {
    totalErros++;
    erro();
    return;
  }

  const letraDetectada = normalizarClasse(ultimaPredicao.className);
  const confianca = ultimaPredicao.probability;

  if (letraDetectada === letraEsperada && confianca >= confiancaMinima) {
    acerto();
  } else {
    totalErros++;
    erro();
  }
}

function acerto() {
  const resultado = document.getElementById("resultado");

  resultado.innerText = "✔ Correto!";
  resultado.style.color = "green";
  resultado.classList.add("pulse");

  setTimeout(() => {
    resultado.classList.remove("pulse");

    index++;

    if (index < letras.length) {
      atualizarLetra();
      iniciarContagem();
    } else {
      finalizarExercicio();
    }
  }, 800);
}

function erro() {
  const resultado = document.getElementById("resultado");

  resultado.innerText = "❌ Gesto errado, tente novamente.";
  resultado.style.color = "red";
  resultado.classList.add("pulse");

  setTimeout(() => {
    resultado.classList.remove("pulse");

    if (rodando) iniciarContagem();
  }, 1500);
}

function atualizarLetra() {
  const letraAtual = letras[index];

  document.getElementById("letra").innerText = letraAtual;

  const imgGesto = document.getElementById("imgGesto");

  if (imgGesto) {
   imgGesto.src = `./img-gestos/${letraAtual}.png`;
    imgGesto.alt = `Gesto da letra ${letraAtual}`;

    imgGesto.onerror = () => {
      console.log("Imagem não encontrada:", imgGesto.src);
    };
  }

  document.getElementById("resultado").innerText = "Aguardando gesto...";
  document.getElementById("resultado").style.color = "#15223b";

  document.getElementById("debugIA").innerText = "Detectando...";

  // Caracteres simples para evitar símbolos corrompidos em alguns celulares.
  document.getElementById("progressoLetras").innerText =
    letras.map((letra, i) => {
      if (i < index) return "[OK] " + letra;
      if (i === index) return "[>] " + letra;
      return letra;
    }).join(" - ");
}

function finalizarExercicio() {
  rodando = false;
  clearInterval(intervaloContador);

  if (webcam) {
    webcam.stop();
  }

  const acertos = letras.length;
  const penalidade = totalErros * 10;
  let porcentagem = Math.max(0, 100 - penalidade);

  salvarProgresso(palavraAtual, porcentagem, acertos, totalErros);

  document.getElementById("tituloExercicio").innerText = "Exercício finalizado!";

  const letraBox = document.querySelector(".letra-box");
  const contadorBox = document.querySelector(".contador-box");

  if (letraBox) letraBox.style.display = "none";
  if (contadorBox) contadorBox.style.display = "none";

  document.getElementById("webcam-container").innerHTML = "";

  document.getElementById("resultado").innerHTML = `
    <div class="resultado-final-card">
      <h2>${porcentagem}%</h2>
      <p>Você concluiu ${palavraAtual} com ${totalErros} erro(s).</p>
    </div>
<button class="btn-voltar-final" onclick="mostrarTela('inicio')">
  Voltar ao início
</button>
  `;

  document.getElementById("debugIA").innerText =
    "Seu progresso foi salvo automaticamente.";

  document.getElementById("progressoLetras").innerText = "";
}
/* EXERCÍCIOS COM CARDS */

function embaralhar(lista) {
  return [...lista].sort(() => Math.random() - 0.5);
}

function sortearLetra() {
  return letrasCards[Math.floor(Math.random() * letrasCards.length)];
}

function gerarAlternativas(correta) {
  let alternativas = [correta];

  while (alternativas.length < 5) {
    const letra = sortearLetra();

    if (!alternativas.includes(letra)) {
      alternativas.push(letra);
    }
  }

  return embaralhar(alternativas);
}

function iniciarCardLetraPeloGesto() {
  tipoCardAtual = "letra-pelo-gesto";
  perguntaAtualCard = 1;
  pontuacaoCard = 0;
  errosCards = 0;

  mostrarTela("cardLicao");
  document.getElementById("tituloCardExercicio").innerText =
    "Identificar letra pelo gesto";

  gerarPerguntaLetraPeloGesto();
}

function iniciarCardGestoPelaLetra() {
  tipoCardAtual = "gesto-pela-letra";
  perguntaAtualCard = 1;
  pontuacaoCard = 0;
  errosCards = 0;

  mostrarTela("cardLicao");
  document.getElementById("tituloCardExercicio").innerText =
    "Identificar gesto pela letra";

  gerarPerguntaGestoPelaLetra();
}

function atualizarStatusCards() {
  document.getElementById("pontuacaoCards").innerText =
    "Pontuação: " + pontuacaoCard;

  document.getElementById("perguntaCards").innerText =
    "Pergunta: " + perguntaAtualCard + " / " + totalPerguntasCards;
}

function gerarPerguntaLetraPeloGesto() {
  respostaCorretaCard = sortearLetra();
  const alternativas = gerarAlternativas(respostaCorretaCard);

  atualizarStatusCards();

  document.getElementById("perguntaCardTexto").innerText =
    "Qual letra este gesto representa?";

  document.getElementById("areaPerguntaCard").innerHTML = `
    <div class="card-imagem-pergunta">
      <img src="./img-gestos/${respostaCorretaCard}.png" alt="Gesto da letra ${respostaCorretaCard}">
    </div>
  `;

  document.getElementById("alternativasCards").innerHTML = alternativas.map((letra, i) => `
    <button class="alternativa-letra" onclick="responderCard('${letra}')">
      <span>${String.fromCharCode(65 + i)}</span>
      <strong>${letra}</strong>
    </button>
  `).join("");

  document.getElementById("feedbackCards").innerText =
    "Selecione a alternativa correta.";

  document.getElementById("feedbackCards").style.color = "#15223b";
}

function gerarPerguntaGestoPelaLetra() {
  respostaCorretaCard = sortearLetra();
  const alternativas = gerarAlternativas(respostaCorretaCard);

  atualizarStatusCards();

  document.getElementById("perguntaCardTexto").innerText =
    "Qual gesto corresponde à letra abaixo?";

  document.getElementById("areaPerguntaCard").innerHTML = `
    <div class="letra-pergunta-card">${respostaCorretaCard}</div>
  `;

  document.getElementById("alternativasCards").innerHTML = alternativas.map((letra) => `
    <button class="alternativa-gesto" onclick="responderCard('${letra}')">
      <img src="./img-gestos/${letra}.png" alt="Gesto da letra ${letra}">
    </button>
  `).join("");

  document.getElementById("feedbackCards").innerText =
    "Selecione o gesto correto.";

  document.getElementById("feedbackCards").style.color = "#15223b";
}

function responderCard(resposta) {
  const botoes = document.querySelectorAll("#alternativasCards button");

  botoes.forEach(btn => {
    btn.disabled = true;
  });

  if (resposta === respostaCorretaCard) {
    pontuacaoCard += 10;

    document.getElementById("feedbackCards").innerText = "✔ Correto!";
    document.getElementById("feedbackCards").style.color = "green";
  } else {
    errosCards++;

    document.getElementById("feedbackCards").innerText =
      "❌ Resposta errada, tente prestar atenção no próximo gesto.";

    document.getElementById("feedbackCards").style.color = "red";
  }

  setTimeout(() => {
    perguntaAtualCard++;

    if (perguntaAtualCard > totalPerguntasCards) {
      finalizarCards();
      return;
    }

    if (tipoCardAtual === "letra-pelo-gesto") {
      gerarPerguntaLetraPeloGesto();
    } else {
      gerarPerguntaGestoPelaLetra();
    }
  }, 1000);
}

function finalizarCards() {
  const acertos = pontuacaoCard / 10;
  const porcentagem = Math.round((acertos / totalPerguntasCards) * 100);

  const nomeExercicio =
    tipoCardAtual === "letra-pelo-gesto"
      ? "Cards - Identificar letra pelo gesto"
      : "Cards - Identificar gesto pela letra";

  salvarProgresso(nomeExercicio, porcentagem, acertos, errosCards);

  document.getElementById("perguntaCardTexto").innerText =
    "Exercício finalizado!";

  document.getElementById("areaPerguntaCard").innerHTML = `
    <div class="resultado-final-card">
      <h2>${porcentagem}%</h2>
      <p>Você fez ${acertos} acertos de ${totalPerguntasCards} perguntas.</p>
    </div>
  `;

document.getElementById("alternativasCards").innerHTML = `
    <button class="btn-voltar-final" onclick="mostrarTela('inicio')">
      Voltar ao início
    </button>
  `;

  document.getElementById("feedbackCards").innerText =
    "Seu progresso foi salvo automaticamente.";

  document.getElementById("feedbackCards").style.color = "#15223b";
}



async function carregarProgresso() {
  const titulo = document.getElementById("progressoTitulo");
  const barra = document.getElementById("barraProgresso");
  const texto = document.getElementById("progressoTexto");

  if (!titulo || !barra || !texto) return;

  // Mantém o histórico local separado por usuário como alternativa.
  const chaveHistorico = chaveHistoricoAtual();
  let historico =
    JSON.parse(localStorage.getItem(chaveHistorico)) || [];

  // Busca o histórico do aluno no banco de dados
  if (usuarioLogado && usuarioLogado.email && tokenAcesso) {
    try {
      const email = encodeURIComponent(usuarioLogado.email);

      const resposta = await fetch(
        `${API_URL}/progresso/${email}`,
        {
          headers: {
            "Authorization": `Bearer ${tokenAcesso}`
          }
        }
      );

      if (!resposta.ok) {
        throw new Error(`Erro HTTP ${resposta.status}`);
      }

      const dadosBanco = await resposta.json();

      // Converte os dados da API para o formato usado na tela
      historico = dadosBanco.map(item => ({
        exercicio: item.exercicio,
        porcentagem: item.porcentagem,
        acertos: item.acertos,
        erros: item.erros,
        data: item.data
      }));

      // Atualiza o histórico local com os dados do banco
      localStorage.setItem(
        chaveHistorico,
        JSON.stringify(historico)
      );

      console.log(
        "Histórico carregado do banco:",
        historico.length,
        "registro(s)."
      );

    } catch (erro) {
      console.error(
        "Erro ao carregar histórico do banco:",
        erro
      );

      // Se a API falhar, mantém o histórico local disponível
    }
  }

  if (historico.length === 0) {
    titulo.innerText = "Nenhum exercício realizado ainda.";
    barra.style.width = "0%";
    texto.innerHTML =
      "Seu histórico aparecerá aqui após concluir um exercício.";
    return;
  }

  const ultimo = historico[0];

  titulo.innerText = "Último exercício: " + ultimo.exercicio;
  barra.style.width =
    Math.max(0, Math.min(100, ultimo.porcentagem)) + "%";

  texto.innerHTML = `
    <strong>Último desempenho:</strong><br>
    ${ultimo.porcentagem}% |
    Acertos: ${ultimo.acertos} |
    Erros: ${ultimo.erros} |
    ${ultimo.data || ""}

    <br><br>
    <strong>Histórico completo:</strong><br><br>

    ${historico.map((item, index) => `
      <div style="margin-bottom: 12px;">
        <strong>${index + 1}. ${item.exercicio}</strong><br>
        Desempenho: ${item.porcentagem}% |
        Acertos: ${item.acertos} |
        Erros: ${item.erros}<br>
        <small>${item.data || ""}</small>
      </div>
    `).join("")}
  `;
}

/* PROGRESSO COM HISTÓRICO COMPLETO */

async function salvarProgresso(exercicio, porcentagem, acertos, erros) {
  const novoProgresso = {
    exercicio,
    porcentagem,
    acertos,
    erros,
    data: new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo"
    })
  };

  const chaveHistorico = chaveHistoricoAtual();
  let historico = JSON.parse(localStorage.getItem(chaveHistorico)) || [];

  historico.unshift(novoProgresso);

  localStorage.setItem(chaveHistorico, JSON.stringify(historico));
  localStorage.setItem("progressoAtual", JSON.stringify(novoProgresso));

  if (!usuarioLogado || !usuarioLogado.email || !tokenAcesso) {
    await carregarProgresso();
    return;
  }

  try {
    const resposta = await fetch(`${API_URL}/progresso`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenAcesso}`
      },
      body: JSON.stringify({
        alunoEmail: usuarioLogado.email,
        exercicio,
        porcentagem,
        acertos,
        erros
      })
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      throw new Error(
        `Falha ao salvar progresso (${resposta.status}): ${detalhe}`
      );
    }

    console.log("Progresso salvo no banco com sucesso.");
  } catch (erro) {
    console.error("Erro ao salvar progresso no banco:", erro);
  } finally {
    await carregarProgresso();
  }
}

function fecharWebcam() {
  rodando = false;
  clearInterval(intervaloContador);

  if (webcam) {
    webcam.stop();
  }

  carregarProgresso();
  mostrarTela("webcamMenu");
}

window.onload = function () {
  let usuarioSalvo = null;

  try {
    usuarioSalvo = JSON.parse(localStorage.getItem("usuarioLogado"));
  } catch {
    usuarioSalvo = null;
  }

  tokenAcesso = localStorage.getItem("tokenAcesso");

  if (usuarioSalvo && tokenAindaValido()) {
    usuarioLogado = usuarioSalvo;

    document.getElementById("authArea").classList.add("hidden");
    document.getElementById("sistemaArea").classList.remove("hidden");

    carregarUsuarioNaTela();
    carregarProgresso();
  } else {
    usuarioLogado = null;
    tokenAcesso = null;
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("tokenAcesso");

    const authArea = document.getElementById("authArea");
    const sistemaArea = document.getElementById("sistemaArea");

    if (sistemaArea) sistemaArea.classList.add("hidden");
    if (authArea) authArea.classList.remove("hidden");
  }
};

function abrirMenuMobile() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("overlayMenu");
  const topbar = document.querySelector(".topbar");
  const botaoMenu = document.querySelector(".btn-menu-mobile");

  if (sidebar) sidebar.classList.add("sidebar-aberta");
  if (overlay) overlay.classList.add("ativo");

  if (topbar) topbar.style.display = "none";
  if (botaoMenu) botaoMenu.style.display = "none";

  document.body.classList.add("menu-aberto");
  document.body.classList.remove("busca-aberta");
}

function fecharMenuMobile() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("overlayMenu");
  const topbar = document.querySelector(".topbar");
  const botaoMenu = document.querySelector(".btn-menu-mobile");

  if (sidebar) sidebar.classList.remove("sidebar-aberta");
  if (overlay) overlay.classList.remove("ativo");

  if (topbar) topbar.style.display = "";
  if (botaoMenu) botaoMenu.style.display = "";

  document.body.classList.remove("menu-aberto");
  document.body.classList.remove("busca-aberta");
}
function alternarBuscaMobile() {
  document.body.classList.toggle("busca-aberta");

  const campo = document.getElementById("campoPesquisa");

  if (document.body.classList.contains("busca-aberta") && campo) {
    setTimeout(() => {
      campo.focus();
    }, 100);
  }
}

function abrirMenuPerfil() {
  const menu = document.getElementById("menuPerfil");

  if (menu) {
    menu.classList.toggle("hidden");
  }
}

function fecharMenuPerfil() {
  const menu = document.getElementById("menuPerfil");

  if (menu) {
    menu.classList.add("hidden");
  }
}

document.addEventListener("keydown", function (event) {
  const loginTela = document.getElementById("loginTela");

  if (
    event.key === "Enter" &&
    loginTela &&
    !loginTela.classList.contains("hidden")
  ) {
    entrar();
  }
});

function carregarFotoPerfil(event) {
  const arquivo = event.target.files[0];

  if (!arquivo) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    const imagemBase64 = e.target.result;

    usuarioLogado.fotoPerfil = imagemBase64;

    localStorage.setItem("usuarioLogado", JSON.stringify(usuarioLogado));

    const avatarImg = document.getElementById("avatarImg");
    const avatarTexto = document.getElementById("avatarPerfil");

    avatarImg.src = imagemBase64;
    avatarImg.classList.remove("hidden");
    avatarTexto.classList.add("hidden");
  };

  reader.readAsDataURL(arquivo);
}
function removerFotoPerfil() {
  if (!usuarioLogado) return;

  delete usuarioLogado.fotoPerfil;

  localStorage.setItem(
    "usuarioLogado",
    JSON.stringify(usuarioLogado)
  );

  const avatarImg = document.getElementById("avatarImg");
  const avatarTexto = document.getElementById("avatarPerfil");

  avatarImg.src = "";
  avatarImg.classList.add("hidden");

  avatarTexto.classList.remove("hidden");

  const nomeExibido =
    usuarioLogado.apelido ||
    usuarioLogado.nome ||
    "Aluno";

  avatarTexto.innerText =
    nomeExibido.charAt(0).toUpperCase();
}
