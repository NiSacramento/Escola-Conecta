using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using EscolaConecta.Models;
using EscolaConecta.Services;

namespace EscolaConecta.Endpoints;

/// <summary>Camada HTTP: declara as rotas e encaminha as requisições aos serviços.</summary>
public static class ApiEndpoints
{
    public static IEndpointRouteBuilder MapEscolaConectaEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/cadastro",
            (Aluno aluno, AutenticacaoService servico) => servico.CadastrarAsync(aluno));

        endpoints.MapPost("/login",
            (Login login, AutenticacaoService servico) => servico.EntrarAsync(login));

        // Recuperação direta para demonstração local: e-mail + nova senha, sem envio de e-mail.
        // O serviço limita esse fluxo ao ambiente Development.
        endpoints.MapPost("/recuperar-senha",
            (RecuperarSenha solicitacao, RecuperarSenhaService servico) =>
                servico.RedefinirAsync(solicitacao));

        endpoints.MapPut("/configuracoes/dados",
            (AtualizarDados dados, ClaimsPrincipal usuario, ContaService servico) =>
                servico.AtualizarDadosAsync(dados, usuario))
            .RequireAuthorization();

        endpoints.MapPut("/configuracoes/seguranca",
            (AtualizarSeguranca dados, ClaimsPrincipal usuario, ContaService servico) =>
                servico.AtualizarSegurancaAsync(dados, usuario))
            .RequireAuthorization();

        endpoints.MapPost("/progresso",
            (Progresso progresso, ClaimsPrincipal usuario, ProgressoService servico) =>
                servico.SalvarAsync(progresso, usuario))
            .RequireAuthorization();

        // Mantém a URL já utilizada pelo frontend. O serviço ignora o e-mail da rota
        // e sempre consulta o progresso associado à identidade do token autenticado.
        endpoints.MapGet("/progresso/{email}",
            (string email, ClaimsPrincipal usuario, ProgressoService servico) =>
                servico.ConsultarAsync(email, usuario))
            .RequireAuthorization();

        endpoints.MapGet("/admin/alunos",
            (AdministracaoService servico) => servico.ListarAlunosAsync())
            .RequireAuthorization("SomenteAdministrador");

        return endpoints;
    }
}
