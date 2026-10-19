using EscolaConecta.Data;
using EscolaConecta.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Hosting;

namespace EscolaConecta.Services;

/// <summary>
/// Redefinição direta de senha usada somente em demonstração local.
/// Não exige confirmação por e-mail, portanto não deve ser habilitada em produção.
/// </summary>
public sealed class RecuperarSenhaService
{
    private const string PasswordHashContext = "EscolaConecta";

    private readonly EscolaConectaRepository _repositorio;
    private readonly IPasswordHasher<string> _passwordHasher;
    private readonly IWebHostEnvironment _environment;

    public RecuperarSenhaService(
        EscolaConectaRepository repositorio,
        IPasswordHasher<string> passwordHasher,
        IWebHostEnvironment environment)
    {
        _repositorio = repositorio;
        _passwordHasher = passwordHasher;
        _environment = environment;
    }

    public async Task<IResult> RedefinirAsync(RecuperarSenha solicitacao)
    {
        // Protege contra uso remoto: o fluxo sem validação só opera localmente em Development.
        if (!_environment.IsDevelopment())
        {
            return Results.Json(new
            {
                mensagem = "A redefinição direta está disponível apenas no modo de demonstração local."
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
