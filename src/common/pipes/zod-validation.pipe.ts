import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException, SetMetadata } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

// Metadata key to skip global validation
export const SKIP_VALIDATION_KEY = 'skipValidation';
export const USE_ZOD_VALIDATION_KEY = 'useZodValidation';

// Decorator to skip global validation pipe
export const SkipGlobalValidation = () => SetMetadata(SKIP_VALIDATION_KEY, true);

// Decorator to mark routes that use Zod validation (so global pipe can skip)
export const UseZodValidation = () => SetMetadata(USE_ZOD_VALIDATION_KEY, true);

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    console.log(`[ZodValidationPipe] ===== ZOD VALIDATION PIPE CALLED =====`);
    console.log(`[ZodValidationPipe] Received value:`, JSON.stringify(value));
    console.log(`[ZodValidationPipe] Value type:`, typeof value);
    console.log(`[ZodValidationPipe] Value keys:`, value ? Object.keys(value) : 'null/undefined');
    console.log(`[ZodValidationPipe] Metadata type:`, metadata.type);
    console.log(`[ZodValidationPipe] Metadata metatype:`, metadata.metatype?.name);
    
    // Check if value is empty
    if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
      console.error(`[ZodValidationPipe] ⚠️ ERROR: Value is EMPTY! This means it was stripped before reaching ZodValidationPipe`);
      console.error(`[ZodValidationPipe] This is the root cause of the validation error`);
    }
    
    try {
      const parsedValue = this.schema.parse(value);
      console.log(`[ZodValidationPipe] ✓ Validation passed, parsed value:`, JSON.stringify(parsedValue));
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          path: err.path.join('.') || 'root',
          message: err.message,
        }));
        
        // Create a detailed error message string
        const detailedMessage = errorMessages
          .map((e) => `${e.path}: ${e.message}`)
          .join('; ');
        
        throw new BadRequestException({
          message: `Validation failed: ${detailedMessage}`,
          errors: errorMessages,
        });
      }
      throw new BadRequestException({
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
        errors: [{ path: 'unknown', message: error instanceof Error ? error.message : 'Unknown validation error' }],
      });
    }
  }
}
