ALTER TYPE "GuidelineValidationStatus" ADD VALUE IF NOT EXISTS 'processing' AFTER 'pending';
ALTER TYPE "GuidelineValidationStatus" ADD VALUE IF NOT EXISTS 'cancelled';
