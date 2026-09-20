-- CreateTable
CREATE TABLE `StickyNote` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `colour` VARCHAR(20) NOT NULL DEFAULT 'yellow',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StickyNote_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StickyNote` ADD CONSTRAINT `StickyNote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
