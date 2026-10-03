-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AlbumRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ULTRA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "coverUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumMember" (
    "albumId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AlbumRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumMember_pkey" PRIMARY KEY ("albumId","userId")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumInvite" (
    "token" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AlbumInvite_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AlbumMember_userId_idx" ON "AlbumMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_storageKey_key" ON "Photo"("storageKey");

-- CreateIndex
CREATE INDEX "Photo_albumId_takenAt_idx" ON "Photo"("albumId", "takenAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Photo_albumId_contentHash_key" ON "Photo"("albumId", "contentHash");

-- CreateIndex
CREATE INDEX "AlbumInvite_albumId_idx" ON "AlbumInvite"("albumId");

-- AddForeignKey
ALTER TABLE "AlbumMember" ADD CONSTRAINT "AlbumMember_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumMember" ADD CONSTRAINT "AlbumMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumInvite" ADD CONSTRAINT "AlbumInvite_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

