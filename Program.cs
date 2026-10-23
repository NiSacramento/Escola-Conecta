using System.Text;
using EscolaConecta.Data;
using EscolaConecta.Endpoints;
using EscolaConecta.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

const string JwtIssuer = "EscolaConecta";
const string JwtAudience = "EscolaConecta";

var builder = WebApplication.CreateBuilder(args);

// A chave JWT deve ficar em User Secrets durante o desenvolvimento e em
// App Service > Configuration no Azure com o nome Jwt__Key.
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException(
        "A configuração Jwt:Key precisa existir e ter pelo menos 32 bytes.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = JwtIssuer,
            ValidateAudience = true,
            ValidAudience = JwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SomenteAdministrador", policy =>
        policy.RequireRole("Administrador"));
});

if (builder.Environment.IsDevelopment())
{
    builder.WebHost.ConfigureKestrel(opcoes =>
    {
        opcoes.ListenAnyIP(5161);
        opcoes.ListenAnyIP(5162, listen =>
        {
            listen.UseHttps("escola-conecta.pfx", "changeit");
        });
    });
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirFrontend", policy =>
    {
        policy
            .WithOrigins(
                "https://escola-conecta-api-ayawbtb5gyhjcqdf.brazilsouth-01.azurewebsites.net",
                "http://localhost:8080",
                "http://localhost:5500",
                "http://127.0.0.1:5500",
                "http://localhost:5501",
                "http://127.0.0.1:5501")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// Registra as camadas de dados e de regras de negócio.
builder.Services.AddSingleton<IPasswordHasher<string>, PasswordHasher<string>>();
builder.Services.AddScoped<EscolaConectaRepository>();
builder.Services.AddScoped<AutenticacaoService>();
builder.Services.AddScoped<RecuperarSenhaService>();
builder.Services.AddScoped<ContaService>();
builder.Services.AddScoped<ProgressoService>();
builder.Services.AddScoped<AdministracaoService>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("A conexão DefaultConnection não foi configurada.");
}

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors("PermitirFrontend");
app.UseAuthentication();
app.UseAuthorization();

// As rotas HTTP ficam organizadas na camada Endpoints.
app.MapEscolaConectaEndpoints();

app.Run();
