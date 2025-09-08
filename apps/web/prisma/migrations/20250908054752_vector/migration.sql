-- CreateTable
CREATE TABLE `ProcessorSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `result` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProcessorSession_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Questions` (
    `id` VARCHAR(191) NOT NULL,
    `questionNumber` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `parentQuestionNumber` VARCHAR(191) NULL,
    `isMultipleChoice` BOOLEAN NOT NULL DEFAULT false,
    `imageDescription` TEXT NULL,
    `answer` JSON NULL,
    `pageNumber` INTEGER NOT NULL,
    `semanticSummary` TEXT NOT NULL,
    `vectorEmbedding` VARCHAR(50000) NULL,
    `fileId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Questions_questionNumber_idx`(`questionNumber`),
    INDEX `Questions_type_idx`(`type`),
    INDEX `Questions_fileId_idx`(`fileId`),
    INDEX `Questions_isMultipleChoice_idx`(`isMultipleChoice`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `File` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `content` LONGBLOB NULL,
    `type` VARCHAR(191) NOT NULL,
    `mimetype` VARCHAR(191) NOT NULL,
    `textContent` TEXT NULL,
    `vectorEmbedding` VARCHAR(50000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `processorSessionId` VARCHAR(191) NULL,

    INDEX `File_userId_idx`(`userId`),
    INDEX `File_mimetype_idx`(`mimetype`),
    INDEX `File_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProcessorSession` ADD CONSTRAINT `ProcessorSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Questions` ADD CONSTRAINT `Questions_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_processorSessionId_fkey` FOREIGN KEY (`processorSessionId`) REFERENCES `ProcessorSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
