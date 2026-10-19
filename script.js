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


const API_URL = "https://escola-conecta-api-ayawbtb5gyhjcqdf.brazilsouth-01.azurewebsites.net";
const confiancaMinima = 0.60;

const letrasCards = ["B", "I", "L", "N", "O", "P", "U"];

let tipoCardAtual = "";
let perguntaAtualCard = 0;
let totalPerguntasCards = 10;
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

  } catch (erro) {
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
  const email = document.getElementById("recEmail").value.trim().toLowerCase();
  const senha = document.getElementById("recSenha").value;
  const confirmaSenha = document.getElementById("recConfirmaSenha").value;
  const msg = document.getElementById("recMsg");

  if (!email || !senha || !confirmaSenha) {
    msg.innerText = "Preencha todos os campos.";
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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        novaSenha: senha,
        confirmarSenha: confirmaSenha
      })
    });

    const data = await lerResposta(response);

    if (!response.ok) {
      msg.innerText = data.mensagem || "Erro ao alterar senha.";
      msg.style.color = "red";
      return;
    }

    msg.innerText = data.mensagem || "Senha trocada com sucesso!";
    msg.style.color = "green";

    setTimeout(() => {
      mostrarAuth("loginTela");
    }, 1200);

  } catch (erro) {
    msg.innerText = "Erro ao conectar com o servidor.";
    msg.style.color = "red";
    console.error(erro);
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

function carregarUsuarioNaTela() {
  if (!usuarioLogado) return;

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

  try {
    const response = await fetch(`${API_URL}/configuracoes/dados`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
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

  try {
    const response = await fetch(`${API_URL}/configuracoes/seguranca`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
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
    document.getElementById("debugIA").innerText = "Detectando...";
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

  document.getElementById("debugIA").innerText =
    "Detectando: " + classe + " - " + porcentagem + "%";

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

  document.getElementById("progressoLetras").innerText =
    letras.map((letra, i) => {
      if (i < index) return "✔ " + letra;
      if (i === index) return "👉 " + letra;
      return letra;
    }).join("  •  ");
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

  // Mantém o histórico local como alternativa
  let historico =
    JSON.parse(localStorage.getItem("historicoProgresso")) || [];

  // Busca o histórico do aluno no banco de dados
  if (usuarioLogado && usuarioLogado.email) {
    try {
      const email = encodeURIComponent(usuarioLogado.email);

      const resposta = await fetch(
        `${API_URL}/progresso/${email}`
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
        "historicoProgresso",
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
    data: new Date().toLocaleString()
  };

  let historico = JSON.parse(localStorage.getItem("historicoProgresso")) || [];

  historico.unshift(novoProgresso);

  localStorage.setItem("historicoProgresso", JSON.stringify(historico));
  localStorage.setItem("progressoAtual", JSON.stringify(novoProgresso));

  carregarProgresso();

  if (!usuarioLogado || !usuarioLogado.email) return;


try {
  const resposta = await fetch(`${API_URL}/progresso`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
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
  const usuarioSalvo = JSON.parse(localStorage.getItem("usuarioLogado"));

  if (usuarioSalvo) {
    usuarioLogado = usuarioSalvo;

    document.getElementById("authArea").classList.add("hidden");
    document.getElementById("sistemaArea").classList.remove("hidden");

    carregarUsuarioNaTela();
    carregarProgresso();
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
