-- Enable pgvector extension (must exist before vector columns)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "clinics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Bogota',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinic_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinic_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    "is_booked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinic_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "patient_phone" TEXT NOT NULL,
    "patient_name" TEXT,
    "status" "appointment_status" NOT NULL DEFAULT 'CONFIRMED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinic_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "embedding" vector(768),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doctors_clinic_id_idx" ON "doctors"("clinic_id");

-- CreateIndex
CREATE INDEX "doctors_specialty_idx" ON "doctors"("specialty");

-- CreateIndex
CREATE INDEX "doctors_clinic_id_specialty_idx" ON "doctors"("clinic_id", "specialty");

-- CreateIndex
CREATE INDEX "slots_clinic_id_start_time_idx" ON "slots"("clinic_id", "start_time");

-- CreateIndex
CREATE INDEX "slots_is_booked_idx" ON "slots"("is_booked");

-- CreateIndex
CREATE INDEX "slots_clinic_id_is_booked_start_time_idx" ON "slots"("clinic_id", "is_booked", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "slots_doctor_id_start_time_key" ON "slots"("doctor_id", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_slot_id_key" ON "appointments"("slot_id");

-- CreateIndex
CREATE INDEX "appointments_patient_phone_idx" ON "appointments"("patient_phone");

-- CreateIndex
CREATE INDEX "appointments_clinic_id_status_idx" ON "appointments"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_created_at_idx" ON "appointments"("doctor_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_documents_clinic_id_idx" ON "knowledge_documents"("clinic_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_category_idx" ON "knowledge_documents"("category");

-- CreateIndex (pgvector IVFFlat cosine similarity for RAG)
CREATE INDEX "idx_knowledge_docs_embedding" ON "knowledge_documents" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
