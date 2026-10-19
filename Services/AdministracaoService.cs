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
}
