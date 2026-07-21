-- CreateEnum
CREATE TYPE "CancellationMethod" AS ENUM ('self_service_url', 'email');

-- CreateEnum
CREATE TYPE "CancellationRequestStatus" AS ENUM ('draft', 'sent', 'failed');

-- CreateTable
CREATE TABLE "KnownService" (
    "id" TEXT NOT NULL,
    "merchantPattern" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "method" "CancellationMethod" NOT NULL,
    "selfServiceUrl" TEXT,
    "cancellationEmail" TEXT,
    "instructions" TEXT NOT NULL,

    CONSTRAINT "KnownService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "detectedSubscriptionId" TEXT NOT NULL,
    "method" "CancellationMethod" NOT NULL,
    "recipientEmail" TEXT,
    "draftSubject" TEXT,
    "draftBody" TEXT,
    "status" "CancellationRequestStatus" NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnownService_merchantPattern_key" ON "KnownService"("merchantPattern");

-- CreateIndex
CREATE INDEX "CancellationRequest_userId_idx" ON "CancellationRequest"("userId");

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_detectedSubscriptionId_fkey" FOREIGN KEY ("detectedSubscriptionId") REFERENCES "DetectedSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
