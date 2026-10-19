namespace EscolaConecta.Models;

// Modelos recebidos pela API.
public record Aluno(
    string Nome,
    string? Sobrenome,
    string? Apelido,
    DateTime DataNascimento,
    string Email,
    string Senha,
    string? Telefone,
    string? EmailRecuperacao,
    string? TelefoneRecuperacao
);

public record Login(string Email, string Senha);

// Recuperação direta habilitada somente no ambiente local de demonstração.
public record RecuperarSenha(string Email, string NovaSenha, string ConfirmarSenha);

public record AtualizarDados(
    string EmailAtual,
    string Nome,
    string? Sobrenome,
    string? Apelido,
    string NovoEmail,
    string? Telefone
);

public record AtualizarSeguranca(
    string Email,
    string? NovaSenha,
    string? ConfirmarSenha,
    string? EmailRecuperacao,
    string? TelefoneRecuperacao
);

public record Progresso(
    string AlunoEmail,
    string Exercicio,
    int Porcentagem,
    int Acertos,
    int Erros
);

// Respostas enviadas ao frontend. Os nomes das propriedades são serializados
// em camelCase pelo ASP.NET Core, mantendo o formato usado pela interface atual.
public record AlunoResposta(
    int Id,
    string Nome,
    string Sobrenome,
    string Apelido,
    string DataNascimento,
    string Email,
    string Perfil,
    string Telefone,
    string EmailRecuperacao,
    string TelefoneRecuperacao
);

public record ProgressoResposta(
    int Id,
    string AlunoEmail,
    string Exercicio,
    int Porcentagem,
    int Acertos,
    int Erros,
    string Data
);

public record AlunoAdministracaoResposta(
    int Id,
    string Nome,
    string Email,
    string Perfil,
    int QuantidadeRegistrosProgresso,
    DateTime? UltimaAtividade
);
