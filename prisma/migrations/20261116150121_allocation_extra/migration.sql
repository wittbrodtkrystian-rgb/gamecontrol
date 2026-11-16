-- AlterTable
ALTER TABLE "Allocation" ADD COLUMN     "extraForServerId" TEXT;

-- CreateIndex
CREATE INDEX "Allocation_extraForServerId_idx" ON "Allocation"("extraForServerId");

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_extraForServerId_fkey" FOREIGN KEY ("extraForServerId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;
