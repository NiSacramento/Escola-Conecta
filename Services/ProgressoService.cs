using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using EscolaConecta.Data;
using EscolaConecta.Models;

namespace EscolaConecta.Services;

/// <summary>Regras para salvar e consultar o progresso do aluno autenticado.</summary>
public sealed class ProgressoService
{
    private readonly EscolaConectaRepository _repositorio;

    public ProgressoService(EscolaConectaRepository repositorio)
    {
        _repositorio = repositorio;
    }

    public async Task<IResult> SalvarAsync(Progresso progresso, ClaimsPrincipal usuario)
    {
        if (!TentarObterId(usuario, out var alunoId))
            return Results.Unauthorized();

        if (string.IsNullOrWhiteSpace(progresso.Exercicio))
            return Results.BadRequest(new { mensagem = "O nome do exercício é obrigatório." });

        if (progresso.Porcentagem < 0 || progresso.Porcentagem > 100 ||
            progresso.Acertos < 0 || progresso.Erros < 0)
        {
            return Results.BadRequest(new { mensagem = "Os valores do progresso são inválidos." });
        }

        var emailAluno = await _repositorio.ObterEmailPorIdAsync(alunoId);
        if (emailAluno is null)
            return Results.NotFound(new { mensagem = "Aluno não encontrado." });

        await _repositorio.SalvarProgressoAsync(emailAluno, progresso);
        return Results.Ok(new { mensagem = "Progresso salvo com sucesso!" });
    }

    public async Task<IResult> ConsultarAsync(string emailDaRota, ClaimsPrincipal usuario)
    {
        // O e-mail recebido na URL é intencionalmente ignorado. A identidade do
        // aluno vem do token, para impedir consulta ao progresso de outras contas.
        _ = emailDaRota;

        if (!TentarObterId(usuario, out var alunoId))
            return Results.Unauthorized();

        var emailAluno = await _repositorio.ObterEmailPorIdAsync(alunoId);
        if (emailAluno is null)
            return Results.NotFound(new { mensagem = "Aluno não encontrado." });

        var historico = await _repositorio.ListarProgressoAsync(
            EscolaConectaRepository.NormalizarEmail(emailAluno));

        return Results.Ok(historico);
    }

    private static bool TentarObterId(ClaimsPrincipal usuario, out int alunoId)
    {
        var idClaim = usuario.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(idClaim, out alunoId);
    }
}
