import { Controller, Get } from '@nestjs/common';

// Deliberately outside of `AuthGuard` coverage: /version is the end-to-end
// deploy probe (poll after release), so it must answer without a session.
@Controller('version')
export class VersionController {
  @Get()
  version() {
    return {
      gitsha: process.env.GIT_SHA ?? 'unknown',
      service: 'promptdesk-api',
    };
  }
}
