import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateContextDto } from './dto/update-context.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Req() req: Request, @Body() body: RegisterDto) {
    return this.authService.register(
      body.companyName,
      body.email,
      body.password,
      req.ip ?? 'unknown',
    );
  }

  @Post('login')
  login(@Req() req: Request, @Body() body: LoginDto) {
    return this.authService.login(
      body.email,
      body.password,
      req.ip ?? 'unknown',
    );
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@Req() req: AuthenticatedRequest) {
    return this.authService.logout(req.sessionToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return this.authService.me(req.session);
  }

  @Patch('context')
  @UseGuards(AuthGuard)
  updateContext(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateContextDto,
  ) {
    return this.authService.updateContext(
      req.sessionToken,
      req.session,
      body.companyId,
    );
  }

  @Patch('locale')
  @UseGuards(AuthGuard)
  updateLocale(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateLocaleDto,
  ) {
    return this.authService.updateLocale(
      req.sessionToken,
      req.session,
      body.locale,
    );
  }
}
