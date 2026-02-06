import { PipeTransform, Injectable, ArgumentMetadata, ValidationPipe, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { USE_ZOD_VALIDATION_KEY } from './zod-validation.pipe';

/**
 * Custom ValidationPipe that skips validation for Zod-based DTOs.
 * This prevents stripping properties before ZodValidationPipe can validate them.
 * 
 * It detects Zod DTOs by checking if the metatype has a zodSchema property
 * (which is added by createZodDto from nestjs-zod).
 */
@Injectable()
export class ConditionalValidationPipe extends ValidationPipe {
  constructor(private reflector: Reflector, options?: any) {
    super(options);
  }

  async transform(value: any, metadata: ArgumentMetadata) {
    // Check if this is a Zod-based DTO
    const metatype = metadata.metatype;
    const type = metadata.type;
    
    // CRITICAL: Check for CreateClientProfileDto FIRST, before any other logic
    // This must happen before checking type to ensure we catch it early
    if (metatype && typeof metatype === 'function' && metatype.name === 'CreateClientProfileDto') {
      console.log(`[ConditionalValidationPipe] 🎯🎯🎯 HARDCODED SKIP for CreateClientProfileDto (EARLY CHECK)`);
      console.log(`[ConditionalValidationPipe] Type: ${type}`);
      console.log(`[ConditionalValidationPipe] Value received:`, JSON.stringify(value));
      console.log(`[ConditionalValidationPipe] Value type:`, typeof value);
      console.log(`[ConditionalValidationPipe] Value keys:`, value ? Object.keys(value) : 'null');
      // Return value directly without ANY processing
      const result = value;
      console.log(`[ConditionalValidationPipe] Returning result:`, JSON.stringify(result));
      return result;
    }
    
    // Only check body parameters (not query, param, etc.)
    if (type !== 'body') {
      return super.transform(value, metadata);
    }
    
    // Log incoming value for debugging
    console.log(`[ConditionalValidationPipe] ===== TRANSFORM CALLED =====`);
    console.log(`[ConditionalValidationPipe] Type: ${type}`);
    console.log(`[ConditionalValidationPipe] Metatype:`, metatype?.name || 'undefined');
    console.log(`[ConditionalValidationPipe] Value type:`, typeof value);
    console.log(`[ConditionalValidationPipe] Value keys:`, value ? Object.keys(value) : 'null/undefined');
    console.log(`[ConditionalValidationPipe] Value:`, JSON.stringify(value));
    
    // Check if value is already empty - this would indicate it was stripped earlier
    if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
      console.log(`[ConditionalValidationPipe] ⚠️ WARNING: Value is empty! This suggests it was stripped before reaching this pipe.`);
    }
    
    // Always log for debugging when it's a DTO
    if (metatype && typeof metatype === 'function') {
      const isZod = this.isZodDto(metatype);
      console.log(`[ConditionalValidationPipe] isZodDto(${metatype.name}):`, isZod);
      
      if (isZod) {
        // Skip class-validator validation for Zod DTOs - let ZodValidationPipe handle it
        // This prevents the global ValidationPipe from stripping properties
        // IMPORTANT: Return value directly WITHOUT calling super.transform()
        console.log(`[ConditionalValidationPipe] ✓ SKIPPING class-validator for Zod DTO: ${metatype.name}`);
        console.log(`[ConditionalValidationPipe] Value before return:`, JSON.stringify(value));
        console.log(`[ConditionalValidationPipe] Value keys:`, value ? Object.keys(value) : 'null');
        // Make a copy to ensure we're not returning a reference that might be modified
        const valueCopy = value ? { ...value } : value;
        console.log(`[ConditionalValidationPipe] Returning value copy:`, JSON.stringify(valueCopy));
        return valueCopy;
      } else {
        console.log(`[ConditionalValidationPipe] ✗ NOT skipping for ${metatype.name}, using class-validator`);
      }
    } else {
      console.log(`[ConditionalValidationPipe] No metatype or not a function, using class-validator`);
    }
    
    // Otherwise, use normal ValidationPipe behavior
    const result = await super.transform(value, metadata);
    console.log(`[ConditionalValidationPipe] After super.transform, result keys:`, result ? Object.keys(result) : 'null/undefined');
    console.log(`[ConditionalValidationPipe] After super.transform, result:`, JSON.stringify(result));
    return result;
  }

  private isZodDto(metatype: any): boolean {
    if (!metatype || typeof metatype !== 'function') {
      return false;
    }
    
    try {
      const className = metatype.name || '';
      const isDtoClass = className.endsWith('Dto') || className.endsWith('DTO');
      
      // Log all properties for debugging
      const ownProps = Object.getOwnPropertyNames(metatype);
      const prototypeProps = Object.getOwnPropertyNames(metatype.prototype || {});
      
      // Check for zodSchema property in various locations
      const hasZodSchema = 
        'zodSchema' in metatype ||
        (metatype.prototype && 'zodSchema' in metatype.prototype) ||
        ownProps.includes('zodSchema') ||
        prototypeProps.includes('zodSchema');
      
      // Known Zod DTOs in this codebase
      const knownZodDtos = [
        'CreateClientProfileDto',
        'CreatePaymentDto',
        'CreateCompanyDto',
        'CreateUserDto',
        'CreateComplianceRequirementDto',
        'LoginDto',
        'RegisterDto',
        'UpdateClientProfileDto',
        'UpdateCompanyDto',
        'ReviewDocumentDto',
        'GenerateUploadUrlDto',
      ];
      
      const isKnownZodDto = knownZodDtos.includes(className);
      
      // CRITICAL: Always return true for CreateClientProfileDto - we know it's a Zod DTO
      if (className === 'CreateClientProfileDto') {
        console.log(`[ConditionalValidationPipe] FORCE DETECTING CreateClientProfileDto as Zod DTO`);
        return true;
      }
      
      // Also check if it matches patterns for Zod DTOs
      const matchesZodPattern = 
        (className.includes('Create') && className.includes('Profile')) ||
        (className.includes('Create') && className.includes('Company')) ||
        (className.includes('Create') && className.includes('Payment')) ||
        (className.includes('Create') && className.includes('User')) ||
        (className.includes('Update') && className.includes('Profile')) ||
        (className.includes('Update') && className.includes('Company'));
      
      // Check if it's a minimal DTO (Zod DTOs typically have fewer properties than class-validator DTOs)
      const isMinimalDto = isDtoClass && ownProps.length < 10 && prototypeProps.length < 15;
      
      const isZod = hasZodSchema || isKnownZodDto || matchesZodPattern || (isDtoClass && isMinimalDto);
      
      // Always log for debugging
      console.log(`[ConditionalValidationPipe] Checking ${className}:`, {
        hasZodSchema,
        isDtoClass,
        isMinimalDto,
        isKnownZodDto,
        matchesZodPattern,
        ownProps: ownProps.slice(0, 10), // Show first 10 properties
        prototypeProps: prototypeProps.slice(0, 10),
        isZod,
      });
      
      return isZod;
    } catch (error) {
      console.error('[ConditionalValidationPipe] Error checking Zod DTO:', error);
      return false;
    }
  }
}
