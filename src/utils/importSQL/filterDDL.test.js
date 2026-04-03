import { describe, it, expect } from "vitest";
import { filterDDL } from "./filterDDL";

describe("filterDDL", () => {
  it("keeps CREATE TABLE statements", () => {
    const sql = "CREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("keeps ALTER TABLE statements", () => {
    const sql = "ALTER TABLE `Album` ADD CONSTRAINT `FK_AlbumArtistId` FOREIGN KEY (`ArtistId`) REFERENCES `Artist` (`ArtistId`);";
    expect(filterDDL(sql)).toContain("ALTER TABLE");
  });

  it("strips DROP DATABASE statements", () => {
    const sql = "DROP DATABASE IF EXISTS `Chinook`;\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("DROP DATABASE");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("strips CREATE DATABASE statements", () => {
    const sql = "CREATE DATABASE `Chinook`;\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("CREATE DATABASE");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("strips USE statements", () => {
    const sql = "USE `Chinook`;\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("USE `Chinook`");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("strips INSERT INTO statements", () => {
    const sql = "INSERT INTO `Album` VALUES (1, 'For Those', 1);\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("INSERT INTO");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("strips block comments", () => {
    const sql = "/* this is a comment */\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("this is a comment");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("strips line comments", () => {
    const sql = "-- drop the table\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("drop the table");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("returns empty string when no DDL statements exist", () => {
    const sql = "USE `Chinook`;\nINSERT INTO `Album` VALUES (1, 'For Those', 1);";
    expect(filterDDL(sql)).toBe("");
  });

  it("handles a realistic MySQL dump excerpt", () => {
    const sql = `
      /* Chinook Database */
      DROP DATABASE IF EXISTS \`Chinook\`;
      CREATE DATABASE \`Chinook\`;
      USE \`Chinook\`;
      CREATE TABLE \`Album\` (
        \`AlbumId\` INT NOT NULL,
        \`Title\` NVARCHAR(160) NOT NULL
      );
      INSERT INTO \`Album\` VALUES (1, 'For Those About To Rock We Salute You', 1);
      ALTER TABLE \`Album\` ADD CONSTRAINT \`FK_AlbumArtistId\`
        FOREIGN KEY (\`ArtistId\`) REFERENCES \`Artist\` (\`ArtistId\`);
    `;
    const result = filterDDL(sql);
    expect(result).toContain("CREATE TABLE");
    expect(result).toContain("ALTER TABLE");
    expect(result).not.toContain("DROP DATABASE");
    expect(result).not.toContain("INSERT INTO");
    expect(result).not.toContain("USE `Chinook`");
  });

  it("normalizes NVARCHAR to VARCHAR", () => {
    const sql = "CREATE TABLE `Album` (`Title` NVARCHAR(160) NOT NULL);";
    const result = filterDDL(sql);
    expect(result).toContain("VARCHAR(160)");
    expect(result).not.toContain("NVARCHAR");
  });

  it("normalizes NCHAR to CHAR", () => {
    const sql = "CREATE TABLE `t` (`code` NCHAR(10));";
    const result = filterDDL(sql);
    expect(result).toContain("CHAR(10)");
    expect(result).not.toContain("NCHAR");
  });

  it("handles MSSQL GO batch separators", () => {
    const sql = `USE [mydb]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Album] (
  [AlbumId] [int] NOT NULL,
  [Title] [nvarchar](160) NOT NULL
)
GO`;
    const result = filterDDL(sql);
    expect(result).toContain("CREATE TABLE");
    expect(result).not.toContain("USE [mydb]");
    expect(result).not.toContain("SET ANSI_NULLS");
    expect(result).not.toContain("GO");
  });

  it("strips MSSQL ON [PRIMARY] filegroup clauses", () => {
    const sql = `CREATE TABLE [dbo].[Album] (
  [AlbumId] [int] NOT NULL
) ON [PRIMARY]
GO`;
    const result = filterDDL(sql);
    expect(result).toContain("CREATE TABLE");
    expect(result).not.toContain("ON [PRIMARY]");
  });

  it("strips MSSQL ON [PRIMARY] TEXTIMAGE_ON [PRIMARY] filegroup clauses", () => {
    const sql = `CREATE TABLE [dbo].[Album] (
  [Body] [ntext] NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO`;
    const result = filterDDL(sql);
    expect(result).toContain("CREATE TABLE");
    expect(result).not.toContain("ON [PRIMARY]");
    expect(result).not.toContain("TEXTIMAGE_ON");
  });

  it("strips MSSQL inline WITH (...) index options on PRIMARY KEY CLUSTERED", () => {
    const sql = `CREATE TABLE [dbo].[AccountHourlyRate](
  [ProjectID] [int] NOT NULL,
  [AccountTypeID] [int] NOT NULL,
  [WorkTypeID] [int] NOT NULL,
PRIMARY KEY CLUSTERED
(
  [ProjectID] ASC,
  [AccountTypeID] ASC,
  [WorkTypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO`;
    const result = filterDDL(sql);
    expect(result).toContain("CREATE TABLE");
    expect(result).not.toContain("WITH (PAD_INDEX");
    expect(result).not.toContain("ON [PRIMARY]");
  });
});
