import { IsUUID, IsString, IsNumber, IsPositive, IsDefined } from 'class-validator';

export class DecideDto {
  @IsDefined() @IsUUID()
  customerId!: string;

  @IsDefined() @IsString()
  payeeId!: string;

  @IsDefined() @IsPositive() @IsNumber()
  amount!: number;

  @IsDefined() @IsString()  // or: @Matches(/^[A-Z]{3}$/) for ISO-4217 code
  currency!: string;

  @IsDefined() @IsString()
  idempotencyKey!: string;
}
