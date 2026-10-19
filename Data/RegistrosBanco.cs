namespace EscolaConecta.Data;

// Representa os campos internos lidos da tabela dbo.Alunos.
// A senha armazenada nunca é enviada ao frontend.
public sealed record AlunoContaBanco(
    int Id,
    string Nome,
    string Sobrenome,
    string Apelido,
    DateTime DataNascimento,
    string Email,
    string Telefone,
    string EmailRecuperacao,
    string TelefoneRecuperacao,
    string SenhaArmazenada,
    string Perfil
);


// Registro interno de um código de recuperação ativo. Não é enviado ao frontend.
public sealed record CodigoRecuperacaoBanco(
    long Id,
    int AlunoId,
    byte[] CodigoHash,
    DateTime ExpiraEmUtc,
    int Tentativas
);
