import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Generate an invoice for a stay.
 * Line items are auto-generated from the stay's room rate and duration.
 * Additional line items can be added separately after generation.
 */
export class GenerateInvoiceDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
