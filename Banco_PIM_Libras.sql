/*
  Escola Conecta - esquema SQL Server para PIM IV
  Baseado na estrutura verificada em dbo.Alunos e dbo.Progresso.

  Seguro para reexecução: não exclui tabelas nem dados.
  Ajusta a procedure de progresso para atualizar o registro existente
  do mesmo aluno/exercício; caso não exista, insere um novo registro.
*/
USE [PIM_Libras];
GO

SET NOCOUNT ON;
GO

/* 1. Tabela de alunos: criada apenas se ainda não existir. */
IF OBJECT_ID(N'dbo.Alunos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Alunos
    (
        Id INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Alunos PRIMARY KEY,
        Nome VARCHAR(100) NOT NULL,
        Sobrenome VARCHAR(100) NULL,
        Apelido VARCHAR(100) NULL,
        DataNascimento DATE NOT NULL,
        Email VARCHAR(150) NOT NULL,
        Senha VARCHAR(255) NOT NULL,
        Telefone VARCHAR(20) NULL,
        EmailRecuperacao VARCHAR(150) NULL,
        TelefoneRecuperacao VARCHAR(20) NULL,
        Perfil VARCHAR(20) NOT NULL
            CONSTRAINT DF_Alunos_Perfil DEFAULT ('Aluno'),
        CONSTRAINT UQ_Alunos_Email UNIQUE (Email)
    );
END;
GO

/* Compatibilidade com bancos existentes que ainda não tenham Perfil. */
IF COL_LENGTH(N'dbo.Alunos', N'Perfil') IS NULL
BEGIN
    ALTER TABLE dbo.Alunos
        ADD Perfil VARCHAR(20) NOT NULL
            CONSTRAINT DF_Alunos_Perfil DEFAULT ('Aluno');
END;
GO

/* Garantir e-mail único, sem duplicar um índice único já existente. */
IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID(N'dbo.Alunos')
      AND i.is_unique = 1
      AND (SELECT COUNT(*)
           FROM sys.index_columns ic
           WHERE ic.object_id = i.object_id
             AND ic.index_id = i.index_id
             AND ic.key_ordinal > 0) = 1
      AND EXISTS
      (
          SELECT 1
          FROM sys.index_columns ic
          INNER JOIN sys.columns c
              ON c.object_id = ic.object_id
             AND c.column_id = ic.column_id
          WHERE ic.object_id = i.object_id
            AND ic.index_id = i.index_id
            AND ic.key_ordinal = 1
            AND c.name = N'Email'
      )
)
BEGIN
    CREATE UNIQUE INDEX UX_Alunos_Email ON dbo.Alunos(Email);
END;
GO

/* 2. Tabela de progresso: criada apenas se ainda não existir. */
IF OBJECT_ID(N'dbo.Progresso', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Progresso
    (
        Id INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Progresso PRIMARY KEY,
        AlunoEmail VARCHAR(150) NOT NULL,
        Exercicio VARCHAR(100) NOT NULL,
        Porcentagem INT NOT NULL,
        Acertos INT NOT NULL,
        Erros INT NOT NULL,
        DataRegistro DATETIME NULL
            CONSTRAINT DF_Progresso_DataRegistro DEFAULT (GETDATE())
    );
END;
GO

/* 3. Procedure: atualiza o progresso do mesmo aluno/exercício; insere se novo. */
CREATE OR ALTER PROCEDURE dbo.usp_SalvarProgresso
    @AlunoEmail VARCHAR(150),
    @Exercicio VARCHAR(100),
    @Porcentagem INT,
    @Acertos INT,
    @Erros INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Exercicio)), '') IS NULL
    BEGIN
        ;THROW 51001, 'O nome do exercício é obrigatório.', 1;
    END;

    IF @Porcentagem < 0 OR @Porcentagem > 100 OR @Acertos < 0 OR @Erros < 0
    BEGIN
        ;THROW 51002, 'Os valores de progresso são inválidos.', 1;
    END;

    DECLARE @EmailCadastrado VARCHAR(150);

    SELECT TOP (1) @EmailCadastrado = Email
    FROM dbo.Alunos
    WHERE LOWER(LTRIM(RTRIM(Email))) = LOWER(LTRIM(RTRIM(@AlunoEmail)));

    IF @EmailCadastrado IS NULL
    BEGIN
        ;THROW 51003, 'O e-mail não corresponde a um aluno cadastrado.', 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        UPDATE dbo.Progresso
        SET Porcentagem = @Porcentagem,
            Acertos = @Acertos,
            Erros = @Erros,
            DataRegistro = GETDATE()
        WHERE LOWER(LTRIM(RTRIM(AlunoEmail))) = LOWER(LTRIM(RTRIM(@EmailCadastrado)))
          AND LTRIM(RTRIM(Exercicio)) = LTRIM(RTRIM(@Exercicio));

        IF @@ROWCOUNT = 0
        BEGIN
            INSERT INTO dbo.Progresso
                (AlunoEmail, Exercicio, Porcentagem, Acertos, Erros)
            VALUES
                (@EmailCadastrado, LTRIM(RTRIM(@Exercicio)), @Porcentagem, @Acertos, @Erros);
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* 4. Trigger de validação: mantém as regras atuais de integridade. */
CREATE OR ALTER TRIGGER dbo.trg_Progresso_ValidarDados
ON dbo.Progresso
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM inserted
        WHERE NULLIF(LTRIM(RTRIM(AlunoEmail)), '') IS NULL
           OR NULLIF(LTRIM(RTRIM(Exercicio)), '') IS NULL
           OR Porcentagem < 0 OR Porcentagem > 100
           OR Acertos < 0 OR Erros < 0
    )
    BEGIN
        ;THROW 51010, 'Registro de progresso inválido: confira e-mail, exercício, porcentagem, acertos e erros.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM inserted i
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM dbo.Alunos a
            WHERE LOWER(LTRIM(RTRIM(a.Email))) = LOWER(LTRIM(RTRIM(i.AlunoEmail)))
        )
    )
    BEGIN
        ;THROW 51011, 'O progresso precisa estar associado a um aluno cadastrado.', 1;
    END;
END;
GO

/* 5. Conferência dos objetos principais após a execução. */
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_NAME IN ('Alunos', 'Progresso')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO

SELECT type_desc, name
FROM sys.objects
WHERE name IN ('usp_SalvarProgresso', 'trg_Progresso_ValidarDados')
ORDER BY name;
GO
