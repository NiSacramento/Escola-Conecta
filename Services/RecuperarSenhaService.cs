using EscolaConecta.Data;
using EscolaConecta.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace EscolaConecta.Services;

/// <summary>
/// Redefinição direta de senha usada somente em demonstração.
/// Não exige confirmação por e-mail; habilite em produção apenas para testes controlados.
/// </summary>
public sealed class RecuperarSenhaService
{
    private const string PasswordHashContext = "EscolaConecta";

    private readonly EscolaConectaRepository _repositorio;
    private readonly IPasswordHasher<string> _passwordHasher;
    private readonly IWebHostEnvironment _environment;
    private readonly IConfiguration _configuration;

    public RecuperarSenhaService(
        EscolaConectaRepository repositorio,
        IPasswordHasher<string> passwordHasher,
        IWebHostEnvironment environment,
        IConfiguration configuration)
    {
        _repositorio = repositorio;
        _passwordHasher = passwordHasher;
        _environment = environment;
        _configuration = configuration;
    }

    public async Task<IResult> RedefinirAsync(RecuperarSenha solicitacao)
    {
        // Por padrão, só permite redefinição direta localmente.
        // No Azure, exige habilitação explícita por variável de configuração.
        if (!_environment.IsDevelopment() &&
            !_configuration.GetValue<bool>("RecuperacaoSenha:PermitirRedefinicaoDireta"))
        {
            return Results.Json(new
            {
                mensagem = "A redefinição direta está desabilitada neste ambiente."
            }, statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        if (string.IsNullOrWhiteSpace(solicitacao.Email) || solicitacao.Email.Length > 150 ||
            !solicitacao.Email.Contains('@'))
        {
            return Results.BadRequest(new { mensagem = "Informe um e-mail válido." });
        }

        if (string.IsNullOrWhiteSpace(solicitacao.NovaSenha) || solicitacao.NovaSenha.Length < 8)
        {
            return Results.BadRequest(new { mensagem = "A nova senha deve ter pelo menos 8 caracteres." });
        }

        if (solicitacao.NovaSenha.Length > 128)
            return Results.BadRequest(new { mensagem = "A nova senha deve ter no máximo 128 caracteres." });

        if (solicitacao.NovaSenha != solicitacao.ConfirmarSenha)
            return Results.BadRequest(new { mensagem = "As senhas não conferem." });

        var email = EscolaConectaRepository.NormalizarEmail(solicitacao.Email);
        var aluno = await _repositorio.ObterAlunoPorEmailAsync(email);
        if (aluno is null)
            return Results.BadRequest(new { mensagem = "Não existe uma conta cadastrada com esse e-mail." });

        var novoHash = _passwordHasher.HashPassword(PasswordHashContext, solicitacao.NovaSenha);
        var atualizada = await _repositorio.AtualizarHashSenhaAsync(
            aluno.Id,
            aluno.SenhaArmazenada,
            novoHash);

        if (!atualizada)
            return Results.Conflict(new { mensagem = "A senha foi alterada recentemente. Tente novamente." });

        return Results.Ok(new
        {
            mensagem = "Senha alterada com sucesso. Agora você pode entrar com a nova senha."
        });
    }
}
