using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using EscolaConecta.Data;
using EscolaConecta.Models;
using Microsoft.AspNetCore.Identity;

namespace EscolaConecta.Services;

/// <summary>Regras para atualizar os dados pessoais e as opções de segurança.</summary>
public sealed class ContaService
{
    private const string PasswordHashContext = "EscolaConecta";

    private readonly EscolaConectaRepository _repositorio;
    private readonly IPasswordHasher<string> _passwordHasher;

    public ContaService(
        EscolaConectaRepository repositorio,
        IPasswordHasher<string> passwordHasher)
    {
        _repositorio = repositorio;
        _passwordHasher = passwordHasher;
    }

    public async Task<IResult> AtualizarDadosAsync(AtualizarDados dados, ClaimsPrincipal usuario)
    {
        if (!TentarObterId(usuario, out var alunoId))
            return Results.Unauthorized();

        if (string.IsNullOrWhiteSpace(dados.Nome) ||
            string.IsNullOrWhiteSpace(dados.NovoEmail))
        {
            return Results.BadRequest(new
            {
                mensagem = "Nome e e-mail são obrigatórios."
            });
        }

        var novoEmail = EscolaConectaRepository.NormalizarEmail(dados.NovoEmail);
        if (await _repositorio.EmailExisteAsync(novoEmail, alunoId))
        {
            return Results.BadRequest(new
            {
                mensagem = "Este e-mail já está cadastrado."
            });
        }

        var atualizado = await _repositorio.AtualizarDadosAsync(alunoId, dados, novoEmail);
        if (!atualizado)
            return Results.NotFound(new { mensagem = "Usuário não encontrado." });

        return Results.Ok(new { mensagem = "Dados alterados com sucesso!", novoEmail });
    }

    public async Task<IResult> AtualizarSegurancaAsync(
        AtualizarSeguranca dados,
        ClaimsPrincipal usuario)
    {
        if (!TentarObterId(usuario, out var alunoId))
            return Results.Unauthorized();

        if (!string.IsNullOrWhiteSpace(dados.NovaSenha) &&
            dados.NovaSenha != dados.ConfirmarSenha)
        {
            return Results.BadRequest(new { mensagem = "As senhas não conferem." });
        }

        if (!string.IsNullOrWhiteSpace(dados.NovaSenha) && dados.NovaSenha.Length < 8)
        {
            return Results.BadRequest(new
            {
                mensagem = "A nova senha deve ter pelo menos 8 caracteres."
            });
        }

        var emailRecuperacao = string.IsNullOrWhiteSpace(dados.EmailRecuperacao)
            ? ""
            : EscolaConectaRepository.NormalizarEmail(dados.EmailRecuperacao);

        var novoHash = string.IsNullOrWhiteSpace(dados.NovaSenha)
            ? null
            : _passwordHasher.HashPassword(PasswordHashContext, dados.NovaSenha);

        var atualizado = await _repositorio.AtualizarSegurancaAsync(
            alunoId,
            emailRecuperacao,
            dados.TelefoneRecuperacao ?? "",
            novoHash);

        if (!atualizado)
            return Results.NotFound(new { mensagem = "Usuário não encontrado." });

        return Results.Ok(new { mensagem = "Segurança alterada com sucesso!" });
    }

    private static bool TentarObterId(ClaimsPrincipal usuario, out int alunoId)
    {
        var idClaim = usuario.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(idClaim, out alunoId);
    }
}
