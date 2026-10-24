using Microsoft.AspNetCore.Http;
using EscolaConecta.Data;

namespace EscolaConecta.Services;

/// <summary>Regras da área administrativa.</summary>
public sealed class AdministracaoService
{
    private readonly EscolaConectaRepository _repositorio;

    public AdministracaoService(EscolaConectaRepository repositorio)
    {
        _repositorio = repositorio;
    }

    public async Task<IResult> ListarAlunosAsync()
    {
        var alunos = await _repositorio.ListarAlunosAdministracaoAsync();
        return Results.Ok(alunos);
    }

    public async Task<IResult> DetalhesProgressoAlunoAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return Results.BadRequest(new { mensagem = "E-mail do aluno não informado." });

        var historico = await _repositorio.ListarProgressoAdministracaoAsync(email.Trim());
        return Results.Ok(new
        {
            email = email.Trim(),
            totalExercicios = historico.Count,
            historico
        });
    }
}
