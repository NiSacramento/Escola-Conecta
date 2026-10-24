using Microsoft.Data.SqlClient;
using System.Data;
using Microsoft.Extensions.Configuration;
using EscolaConecta.Models;

namespace EscolaConecta.Data;

/// <summary>
/// Camada de acesso a dados. Centraliza as consultas SQL usadas pela API.
/// </summary>
public sealed class EscolaConectaRepository
{
    private readonly string _connectionString;

    public EscolaConectaRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "A conexão DefaultConnection não foi configurada.");

        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            throw new InvalidOperationException(
                "A conexão DefaultConnection não foi configurada.");
        }
    }

    private SqlConnection CriarConexao() => new(_connectionString);

    public async Task<bool> EmailExisteAsync(string email, int? ignorarId = null)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        var sql = @"
            SELECT COUNT(*)
            FROM dbo.Alunos
            WHERE LOWER(LTRIM(RTRIM(Email))) = @Email";

        if (ignorarId.HasValue)
            sql += " AND Id <> @IgnorarId";

        await using var cmd = new SqlCommand(sql, con);
        cmd.Parameters.AddWithValue("@Email", email);
        if (ignorarId.HasValue)
            cmd.Parameters.AddWithValue("@IgnorarId", ignorarId.Value);

        return Convert.ToInt32(await cmd.ExecuteScalarAsync()) > 0;
    }

    public async Task CriarAlunoAsync(Aluno aluno, string emailNormalizado, string senhaHash)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        await using var cmd = new SqlCommand(@"
            INSERT INTO dbo.Alunos
            (Nome, Sobrenome, Apelido, DataNascimento, Email, Senha, Telefone,
             EmailRecuperacao, TelefoneRecuperacao)
            VALUES
            (@Nome, @Sobrenome, @Apelido, @DataNascimento, @Email, @Senha, @Telefone,
             @EmailRecuperacao, @TelefoneRecuperacao)
        ", con);

        cmd.Parameters.AddWithValue("@Nome", aluno.Nome.Trim());
        cmd.Parameters.AddWithValue("@Sobrenome", aluno.Sobrenome ?? "");
        cmd.Parameters.AddWithValue("@Apelido", string.IsNullOrWhiteSpace(aluno.Apelido)
            ? aluno.Nome.Trim()
            : aluno.Apelido.Trim());
        cmd.Parameters.AddWithValue("@DataNascimento", aluno.DataNascimento);
        cmd.Parameters.AddWithValue("@Email", emailNormalizado);
        cmd.Parameters.AddWithValue("@Senha", senhaHash);
        cmd.Parameters.AddWithValue("@Telefone", aluno.Telefone ?? "");
        cmd.Parameters.AddWithValue("@EmailRecuperacao", string.IsNullOrWhiteSpace(aluno.EmailRecuperacao)
            ? emailNormalizado
            : NormalizarEmail(aluno.EmailRecuperacao));
        cmd.Parameters.AddWithValue("@TelefoneRecuperacao", aluno.TelefoneRecuperacao ?? "");

        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<AlunoContaBanco?> ObterAlunoPorEmailAsync(string emailNormalizado)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        await using var cmd = new SqlCommand(@"
            SELECT Id, Nome, Sobrenome, Apelido, DataNascimento,
                   Email, Telefone, EmailRecuperacao, TelefoneRecuperacao,
                   Senha, Perfil
            FROM dbo.Alunos
            WHERE LOWER(LTRIM(RTRIM(Email))) = @Email
        ", con);
        cmd.Parameters.AddWithValue("@Email", emailNormalizado);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            return null;

        return new AlunoContaBanco(
            Id: reader.GetInt32(0),
            Nome: reader.IsDBNull(1) ? "" : reader.GetString(1),
            Sobrenome: reader.IsDBNull(2) ? "" : reader.GetString(2),
            Apelido: reader.IsDBNull(3) ? "" : reader.GetString(3),
            DataNascimento: reader.GetDateTime(4),
            Email: reader.IsDBNull(5) ? "" : reader.GetString(5),
            Telefone: reader.IsDBNull(6) ? "" : reader.GetString(6),
            EmailRecuperacao: reader.IsDBNull(7) ? "" : reader.GetString(7),
            TelefoneRecuperacao: reader.IsDBNull(8) ? "" : reader.GetString(8),
            SenhaArmazenada: reader.IsDBNull(9) ? "" : reader.GetString(9),
            Perfil: reader.IsDBNull(10) ? "Aluno" : reader.GetString(10)
        );
    }

    public async Task<bool> AtualizarHashSenhaAsync(int alunoId, string senhaAnterior, string novoHash)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        await using var cmd = new SqlCommand(@"
            UPDATE dbo.Alunos
            SET Senha = @NovaSenha
            WHERE Id = @Id AND Senha = @SenhaAnterior
        ", con);
        cmd.Parameters.Add("@NovaSenha", SqlDbType.VarChar, 255).Value = novoHash;
        cmd.Parameters.Add("@Id", SqlDbType.Int).Value = alunoId;
        cmd.Parameters.Add("@SenhaAnterior", SqlDbType.VarChar, 255).Value = senhaAnterior;
        return await cmd.ExecuteNonQueryAsync() > 0;
    }

    public async Task<string?> ObterEmailPorIdAsync(int alunoId)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        await using var cmd = new SqlCommand(
            "SELECT Email FROM dbo.Alunos WHERE Id = @Id", con);
        cmd.Parameters.AddWithValue("@Id", alunoId);

        var resultado = await cmd.ExecuteScalarAsync();
        return resultado is null || resultado == DBNull.Value
            ? null
            : Convert.ToString(resultado);
    }

    public async Task<bool> AtualizarDadosAsync(int alunoId, AtualizarDados dados, string novoEmail)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();
        await using var transacao = (SqlTransaction)await con.BeginTransactionAsync();

        try
        {
            string emailAntigo;
            await using (var emailCmd = new SqlCommand(
                "SELECT Email FROM dbo.Alunos WHERE Id = @Id", con, transacao))
            {
                emailCmd.Parameters.AddWithValue("@Id", alunoId);
                var resultado = await emailCmd.ExecuteScalarAsync();
                if (resultado is null || resultado == DBNull.Value)
                {
                    await transacao.RollbackAsync();
                    return false;
                }

                emailAntigo = Convert.ToString(resultado)!;
            }

            await using (var atualizar = new SqlCommand(@"
                UPDATE dbo.Alunos
                SET Nome = @Nome,
                    Sobrenome = @Sobrenome,
                    Apelido = @Apelido,
                    Email = @NovoEmail,
                    Telefone = @Telefone
                WHERE Id = @Id
            ", con, transacao))
            {
                atualizar.Parameters.AddWithValue("@Nome", dados.Nome.Trim());
                atualizar.Parameters.AddWithValue("@Sobrenome", dados.Sobrenome ?? "");
                atualizar.Parameters.AddWithValue("@Apelido", string.IsNullOrWhiteSpace(dados.Apelido)
                    ? dados.Nome.Trim()
                    : dados.Apelido.Trim());
                atualizar.Parameters.AddWithValue("@NovoEmail", novoEmail);
                atualizar.Parameters.AddWithValue("@Telefone", dados.Telefone ?? "");
                atualizar.Parameters.AddWithValue("@Id", alunoId);

                if (await atualizar.ExecuteNonQueryAsync() == 0)
                {
                    await transacao.RollbackAsync();
                    return false;
                }
            }

            if (!string.Equals(emailAntigo, novoEmail, StringComparison.OrdinalIgnoreCase))
            {
                await using var atualizarProgresso = new SqlCommand(@"
                    UPDATE dbo.Progresso
                    SET AlunoEmail = @NovoEmail
                    WHERE LOWER(LTRIM(RTRIM(AlunoEmail))) = @EmailAntigo
                ", con, transacao);
                atualizarProgresso.Parameters.AddWithValue("@NovoEmail", novoEmail);
                atualizarProgresso.Parameters.AddWithValue("@EmailAntigo", NormalizarEmail(emailAntigo));
                await atualizarProgresso.ExecuteNonQueryAsync();
            }

            await transacao.CommitAsync();
            return true;
        }
        catch
        {
            await transacao.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> AtualizarSegurancaAsync(
        int alunoId,
        string emailRecuperacao,
        string telefoneRecuperacao,
        string? novoHash)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        var sql = @"
            UPDATE dbo.Alunos
            SET EmailRecuperacao = @EmailRecuperacao,
                TelefoneRecuperacao = @TelefoneRecuperacao";

        if (novoHash is not null)
            sql += ", Senha = @NovaSenha";

        sql += " WHERE Id = @Id";

        await using var cmd = new SqlCommand(sql, con);
        cmd.Parameters.AddWithValue("@Id", alunoId);
        cmd.Parameters.AddWithValue("@EmailRecuperacao", emailRecuperacao);
        cmd.Parameters.AddWithValue("@TelefoneRecuperacao", telefoneRecuperacao);
        if (novoHash is not null)
            cmd.Parameters.AddWithValue("@NovaSenha", novoHash);

        return await cmd.ExecuteNonQueryAsync() > 0;
    }

    public async Task<bool> SalvarProgressoAsync(
        string alunoEmail,
        Progresso progresso)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        // O registro é criado pela stored procedure do banco, centralizando
        // a validação e mantendo a API integrada ao objeto solicitado no PIM.
        await using var cmd = new SqlCommand("dbo.usp_SalvarProgresso", con)
        {
            CommandType = CommandType.StoredProcedure
        };
        cmd.Parameters.AddWithValue("@AlunoEmail", alunoEmail);
        cmd.Parameters.AddWithValue("@Exercicio", progresso.Exercicio.Trim());
        cmd.Parameters.AddWithValue("@Porcentagem", progresso.Porcentagem);
        cmd.Parameters.AddWithValue("@Acertos", progresso.Acertos);
        cmd.Parameters.AddWithValue("@Erros", progresso.Erros);

        await cmd.ExecuteNonQueryAsync();
        return true;
    }

    public async Task<List<ProgressoResposta>> ListarProgressoAsync(string emailNormalizado)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        await using var cmd = new SqlCommand(@"
            SELECT Id, AlunoEmail, Exercicio, Porcentagem,
                   Acertos, Erros, DataRegistro
            FROM dbo.Progresso
            WHERE LOWER(LTRIM(RTRIM(AlunoEmail))) = @Email
            ORDER BY DataRegistro DESC
        ", con);
        cmd.Parameters.AddWithValue("@Email", emailNormalizado);

        await using var reader = await cmd.ExecuteReaderAsync();
        var historico = new List<ProgressoResposta>();

        while (await reader.ReadAsync())
        {
            historico.Add(new ProgressoResposta(
                Id: reader.GetInt32(0),
                AlunoEmail: reader.IsDBNull(1) ? "" : reader.GetString(1),
                Exercicio: reader.IsDBNull(2) ? "" : reader.GetString(2),
                Porcentagem: reader.GetInt32(3),
                Acertos: reader.GetInt32(4),
                Erros: reader.GetInt32(5),
                Data: reader.GetDateTime(6).ToString("dd/MM/yyyy HH:mm")
            ));
        }

        return historico;
    }

    public async Task<List<AlunoAdministracaoResposta>> ListarAlunosAdministracaoAsync()
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        await using var cmd = new SqlCommand(@"
            SELECT a.Id, a.Nome, a.Email, a.Perfil,
                   COUNT(p.Id) AS QuantidadeRegistrosProgresso,
                   MAX(p.DataRegistro) AS UltimaAtividade
            FROM dbo.Alunos AS a
            LEFT JOIN dbo.Progresso AS p
              ON LOWER(LTRIM(RTRIM(p.AlunoEmail))) = LOWER(LTRIM(RTRIM(a.Email)))
            GROUP BY a.Id, a.Nome, a.Email, a.Perfil
            ORDER BY a.Nome, a.Email
        ", con);

        await using var reader = await cmd.ExecuteReaderAsync();
        var alunos = new List<AlunoAdministracaoResposta>();

        while (await reader.ReadAsync())
        {
            alunos.Add(new AlunoAdministracaoResposta(
                Id: reader.GetInt32(0),
                Nome: reader.IsDBNull(1) ? "" : reader.GetString(1),
                Email: reader.IsDBNull(2) ? "" : reader.GetString(2),
                Perfil: reader.IsDBNull(3) ? "Aluno" : reader.GetString(3),
                QuantidadeRegistrosProgresso: reader.GetInt32(4),
                UltimaAtividade: reader.IsDBNull(5) ? null : reader.GetDateTime(5)
            ));
        }

        return alunos;
    }


    public async Task<List<ProgressoResposta>> ListarProgressoAdministracaoAsync(string emailNormalizado)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        await using var cmd = new SqlCommand(@"
            SELECT Id, AlunoEmail, Exercicio, Porcentagem, Acertos, Erros, DataRegistro
            FROM dbo.Progresso
            WHERE LOWER(LTRIM(RTRIM(AlunoEmail))) = @Email
            ORDER BY DataRegistro DESC, Id DESC
        ", con);
        cmd.Parameters.Add("@Email", SqlDbType.VarChar, 150).Value = NormalizarEmail(emailNormalizado);

        await using var reader = await cmd.ExecuteReaderAsync();
        var historico = new List<ProgressoResposta>();

        while (await reader.ReadAsync())
        {
            historico.Add(new ProgressoResposta(
                Id: reader.GetInt32(0),
                AlunoEmail: reader.IsDBNull(1) ? "" : reader.GetString(1),
                Exercicio: reader.IsDBNull(2) ? "" : reader.GetString(2),
                Porcentagem: reader.GetInt32(3),
                Acertos: reader.GetInt32(4),
                Erros: reader.GetInt32(5),
                Data: reader.GetDateTime(6).ToString("dd/MM/yyyy HH:mm")
            ));
        }

        return historico;
    }

    public async Task<bool> CriarCodigoRecuperacaoSenhaAsync(
        int alunoId,
        byte[] codigoHash,
        DateTime expiraEmUtc)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();
        await using var transacao = (SqlTransaction)await con.BeginTransactionAsync(IsolationLevel.Serializable);

        try
        {
            // Limita um envio por conta a cada 60 segundos.
            await using (var limite = new SqlCommand(@"
                SELECT CASE WHEN EXISTS (
                    SELECT 1
                    FROM dbo.RecuperacaoSenha WITH (UPDLOCK, HOLDLOCK)
                    WHERE AlunoId = @AlunoId
                      AND CriadoEmUtc >= DATEADD(SECOND, -60, SYSUTCDATETIME())
                ) THEN 1 ELSE 0 END
            ", con, transacao))
            {
                limite.Parameters.Add("@AlunoId", SqlDbType.Int).Value = alunoId;
                var recente = Convert.ToInt32(await limite.ExecuteScalarAsync()) == 1;
                if (recente)
                {
                    await transacao.CommitAsync();
                    return false;
                }
            }

            // Qualquer código anterior deixa de funcionar ao solicitar outro.
            await using (var invalidar = new SqlCommand(@"
                UPDATE dbo.RecuperacaoSenha
                SET UsadoEmUtc = SYSUTCDATETIME()
                WHERE AlunoId = @AlunoId AND UsadoEmUtc IS NULL
            ", con, transacao))
            {
                invalidar.Parameters.Add("@AlunoId", SqlDbType.Int).Value = alunoId;
                await invalidar.ExecuteNonQueryAsync();
            }

            await using (var inserir = new SqlCommand(@"
                INSERT INTO dbo.RecuperacaoSenha (AlunoId, CodigoHash, ExpiraEmUtc)
                VALUES (@AlunoId, @CodigoHash, @ExpiraEmUtc)
            ", con, transacao))
            {
                inserir.Parameters.Add("@AlunoId", SqlDbType.Int).Value = alunoId;
                inserir.Parameters.Add("@CodigoHash", SqlDbType.VarBinary, 32).Value = codigoHash;
                inserir.Parameters.Add("@ExpiraEmUtc", SqlDbType.DateTime2).Value = expiraEmUtc;
                await inserir.ExecuteNonQueryAsync();
            }

            await transacao.CommitAsync();
            return true;
        }
        catch
        {
            await transacao.RollbackAsync();
            throw;
        }
    }

    public async Task<CodigoRecuperacaoBanco?> ObterCodigoRecuperacaoAtivoAsync(string emailNormalizado)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        await using var cmd = new SqlCommand(@"
            SELECT TOP (1) r.Id, r.AlunoId, r.CodigoHash, r.ExpiraEmUtc, r.Tentativas
            FROM dbo.RecuperacaoSenha AS r
            INNER JOIN dbo.Alunos AS a ON a.Id = r.AlunoId
            WHERE LOWER(LTRIM(RTRIM(a.Email))) = @Email
              AND r.UsadoEmUtc IS NULL
              AND r.ExpiraEmUtc > SYSUTCDATETIME()
              AND r.Tentativas < 5
            ORDER BY r.Id DESC
        ", con);
        cmd.Parameters.Add("@Email", SqlDbType.VarChar, 150).Value = emailNormalizado;

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            return null;

        return new CodigoRecuperacaoBanco(
            Id: reader.GetInt64(0),
            AlunoId: reader.GetInt32(1),
            CodigoHash: (byte[])reader[2],
            ExpiraEmUtc: reader.GetDateTime(3),
            Tentativas: reader.GetInt32(4));
    }

    public async Task IncrementarTentativasCodigoRecuperacaoAsync(long codigoId)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        await using var cmd = new SqlCommand(@"
            UPDATE dbo.RecuperacaoSenha
            SET Tentativas = Tentativas + 1
            WHERE Id = @Id
              AND UsadoEmUtc IS NULL
              AND ExpiraEmUtc > SYSUTCDATETIME()
              AND Tentativas < 5
        ", con);
        cmd.Parameters.Add("@Id", SqlDbType.BigInt).Value = codigoId;
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task InvalidarCodigosRecuperacaoAsync(int alunoId)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();

        await using var cmd = new SqlCommand(@"
            UPDATE dbo.RecuperacaoSenha
            SET UsadoEmUtc = SYSUTCDATETIME()
            WHERE AlunoId = @AlunoId AND UsadoEmUtc IS NULL
        ", con);
        cmd.Parameters.Add("@AlunoId", SqlDbType.Int).Value = alunoId;
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<bool> ConsumirCodigoEAtualizarSenhaAsync(
        long codigoId,
        int alunoId,
        string novoHash)
    {
        await using var con = CriarConexao();
        await con.OpenAsync();
        await using var transacao = (SqlTransaction)await con.BeginTransactionAsync(IsolationLevel.ReadCommitted);

        try
        {
            await using (var consumir = new SqlCommand(@"
                UPDATE dbo.RecuperacaoSenha
                SET UsadoEmUtc = SYSUTCDATETIME()
                WHERE Id = @CodigoId
                  AND AlunoId = @AlunoId
                  AND UsadoEmUtc IS NULL
                  AND ExpiraEmUtc > SYSUTCDATETIME()
                  AND Tentativas < 5
            ", con, transacao))
            {
                consumir.Parameters.Add("@CodigoId", SqlDbType.BigInt).Value = codigoId;
                consumir.Parameters.Add("@AlunoId", SqlDbType.Int).Value = alunoId;
                if (await consumir.ExecuteNonQueryAsync() != 1)
                {
                    await transacao.RollbackAsync();
                    return false;
                }
            }

            await using (var atualizar = new SqlCommand(@"
                UPDATE dbo.Alunos SET Senha = @NovaSenha WHERE Id = @AlunoId
            ", con, transacao))
            {
                atualizar.Parameters.Add("@NovaSenha", SqlDbType.VarChar, 255).Value = novoHash;
                atualizar.Parameters.Add("@AlunoId", SqlDbType.Int).Value = alunoId;
                if (await atualizar.ExecuteNonQueryAsync() != 1)
                {
                    await transacao.RollbackAsync();
                    return false;
                }
            }

            await transacao.CommitAsync();
            return true;
        }
        catch
        {
            await transacao.RollbackAsync();
            throw;
        }
    }

    public static string NormalizarEmail(string email) => email.Trim().ToLowerInvariant();
}
