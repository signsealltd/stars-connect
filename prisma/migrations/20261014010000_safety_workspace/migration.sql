-- Additive only: preserve all historical records and public tokens.
ALTER TABLE PremisesAsset ADD COLUMN publishedAt DATETIME(3) NULL, ADD COLUMN publicChoiceAt DATETIME(3) NULL;
-- Only an existing enabled public record is evidence of previous publication.
UPDATE PremisesAsset SET publishedAt = createdAt WHERE publicEnabled = true;
-- Preserve every previous explicit visibility decision, including hidden records.
UPDATE PremisesAsset a SET publicChoiceAt = (SELECT MAX(l.createdAt) FROM AuditLog l WHERE l.entityId = a.id AND l.action = 'ASSET_PUBLICATION_CHANGED') WHERE EXISTS (SELECT 1 FROM AuditLog l WHERE l.entityId = a.id AND l.action = 'ASSET_PUBLICATION_CHANGED');
CREATE TABLE PrintableDocument (
 id CHAR(36) NOT NULL, organisationId CHAR(36) NOT NULL, title VARCHAR(191) NOT NULL, description TEXT NULL, category VARCHAR(100) NOT NULL,
 staffVisible BOOLEAN NOT NULL DEFAULT false, archivedAt DATETIME(3) NULL, currentVersion INTEGER NOT NULL DEFAULT 1,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updatedAt DATETIME(3) NOT NULL,
 PRIMARY KEY(id), INDEX PrintableDocument_organisationId_archivedAt_staffVisible_idx(organisationId,archivedAt,staffVisible)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE PrintableDocumentVersion (
 id CHAR(36) NOT NULL, documentId CHAR(36) NOT NULL, version INTEGER NOT NULL, storagePath TEXT NOT NULL, originalName VARCHAR(191) NOT NULL,
 sha256Hash VARCHAR(64) NOT NULL, fileSize INTEGER NOT NULL, createdById CHAR(36) NOT NULL, createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(id), UNIQUE INDEX PrintableDocumentVersion_documentId_version_key(documentId,version),
 CONSTRAINT PrintableDocumentVersion_documentId_fkey FOREIGN KEY(documentId) REFERENCES PrintableDocument(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
