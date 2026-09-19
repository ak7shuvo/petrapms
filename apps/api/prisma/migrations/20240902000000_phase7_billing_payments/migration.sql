-- Migration: 20240902000000_phase7_billing_payments
-- Adds: InvoiceStatus enum, PaymentMethod enum, invoices table,
--       invoice_line_items table, payments table.
-- All tables are tenant-scoped (tenantId column on every row).

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'VOID');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- invoices
CREATE TABLE "invoices" (
    "id"         TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL,
    "hotelId"    TEXT NOT NULL,
    "stayId"     TEXT NOT NULL,
    "status"     "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt"   TIMESTAMP(3),
    "dueDate"    DATE,
    "notes"      TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount"  DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invoices_stayId_key" ON "invoices"("stayId");
CREATE INDEX "invoices_tenantId_idx" ON "invoices"("tenantId");
CREATE INDEX "invoices_hotelId_idx" ON "invoices"("hotelId");
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- invoice_line_items
CREATE TABLE "invoice_line_items" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "invoiceId"   TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity"    DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice"   DECIMAL(10,2) NOT NULL,
    "amount"      DECIMAL(12,2) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");
CREATE INDEX "invoice_line_items_tenantId_idx" ON "invoice_line_items"("tenantId");

-- payments
CREATE TABLE "payments" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "hotelId"       TEXT NOT NULL,
    "invoiceId"     TEXT NOT NULL,
    "amount"        DECIMAL(12,2) NOT NULL,
    "method"        "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference"     TEXT,
    "notes"         TEXT,
    "paidAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt"      TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");
CREATE INDEX "payments_hotelId_idx" ON "payments"("hotelId");

-- Foreign keys
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "stays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
