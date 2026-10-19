using Microsoft.AspNetCore.Http;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EscolaConecta.Data;
using EscolaConecta.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace EscolaConecta.Services;

/// <summary>Regras de cadastro, validação de senha e criação de token JWT.</summary>
public sealed class AutenticacaoService
{
    private const string PasswordHashContext = "EscolaConecta";
    private const string JwtIssuer = "EscolaConecta";
    private const string JwtAudience = "EscolaConecta";

    private readonly EscolaConectaRepository _repositorio;
    private readonly IPasswordHasher<string> _passwordHasher;
    private readonly IConfiguration _configuration;

    public AutenticacaoService(
        EscolaConectaRepository repositorio,
        IPasswordHasher<string> passwordHasher,
        IConfiguration configuration)
    {
        _repositorio = repositorio;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
    }

    public async Task<IResult> CadastrarAsync(Aluno aluno)
    {
        if (string.IsNullOrWhiteSpace(aluno.Nome) ||
            string.IsNullOrWhiteSpace(aluno.Email) ||
            string.IsNullOrWhiteSpace(aluno.Senha))
        {
            return Results.BadRequest(new
            {
                mensagem = "Nome, e-mail e senha são obrigatórios."
            });
        }

        if (aluno.Senha.Length < 8)
        {
            return Results.BadRequest(new
            {
                mensagem = "A senha deve ter pelo menos 8 caracteres."
            });
        }

        var email = EscolaConectaRepository.NormalizarEmail(aluno.Email);
        if (await _repositorio.EmailExisteAsync(email))
            return Results.BadRequest(new { mensagem = "E-mail já cadastrado." });

        var senhaHash = _passwordHasher.HashPassword(PasswordHashContext, aluno.Senha);
        await _repositorio.CriarAlunoAsync(aluno, email, senhaHash);

        return Results.Ok(new { mensagem = "Cadastro efetuado com sucesso!" });
    }

    public async Task<IResult> EntrarAsync(Login login)
    {
        if (string.IsNullOrWhiteSpace(login.Email) || string.IsNullOrEmpty(login.Senha))
            return Results.BadRequest(new { mensagem = "E-mail ou senha incorretos." });

        var email = EscolaConectaRepository.NormalizarEmail(login.Email);
        var aluno = await _repositorio.ObterAlunoPorEmailAsync(email);
        if (aluno is null)
            return Results.BadRequest(new { mensagem = "E-mail ou senha incorretos." });

        var pareceHash = aluno.SenhaArmazenada.StartsWith("AQAAAA", StringComparison.Ordinal);
        var senhaValida = false;
        var precisaRehash = false;

        if (pareceHash)
        {
            // Suporta hashes antigos gerados com diferentes valores de contexto.
            foreach (var contexto in new[]
                     { PasswordHashContext, aluno.Email, aluno.Id.ToString() }.Distinct())
            {
                var verificacao = _passwordHasher.VerifyHashedPassword(
                    contexto,
                    aluno.SenhaArmazenada,
                    login.Senha);

                if (verificacao == PasswordVerificationResult.Failed)
                    continue;

                senhaValida = true;
                precisaRehash =
                    verificacao == PasswordVerificationResult.SuccessRehashNeeded ||
                    contexto != PasswordHashContext;
                break;
            }
        }
        else
        {
            // Migração gradual apenas para contas legadas: após um login válido,
            // a senha legada é substituída por hash ASP.NET.
            senhaValida = string.Equals(
                aluno.SenhaArmazenada,
                login.Senha,
                StringComparison.Ordinal);
            precisaRehash = senhaValida;
        }

        if (!senhaValida)
            return Results.BadRequest(new { mensagem = "E-mail ou senha incorretos." });

        if (precisaRehash)
        {
            var novoHash = _passwordHasher.HashPassword(PasswordHashContext, login.Senha);
            await _repositorio.AtualizarHashSenhaAsync(
                aluno.Id,
                aluno.SenhaArmazenada,
                novoHash);
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, aluno.Id.ToString()),
            new Claim(ClaimTypes.Email, aluno.Email),
            new Claim(ClaimTypes.Role, aluno.Perfil)
        };

        var jwtKey = _configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
        {
            return Results.Problem(
                "A configuração Jwt:Key não está disponível ou é inválida.",
                statusCode: StatusCodes.Status500InternalServerError);
        }

        var chave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credenciais = new SigningCredentials(chave, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: JwtIssuer,
            audience: JwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(2),
            signingCredentials: credenciais);
        var tokenTexto = new JwtSecurityTokenHandler().WriteToken(token);

        var respostaAluno = new AlunoResposta(
            Id: aluno.Id,
            Nome: aluno.Nome,
            Sobrenome: aluno.Sobrenome,
            Apelido: aluno.Apelido,
            DataNascimento: aluno.DataNascimento.ToString("yyyy-MM-dd"),
            Email: aluno.Email,
            Perfil: aluno.Perfil,
            Telefone: aluno.Telefone,
            EmailRecuperacao: aluno.EmailRecuperacao,
            TelefoneRecuperacao: aluno.TelefoneRecuperacao);

        return Results.Ok(new
        {
            mensagem = "Login realizado com sucesso!",
            aluno = respostaAluno,
            token = tokenTexto
        });
    }
}
