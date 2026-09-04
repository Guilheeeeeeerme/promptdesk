import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';

const guidelineUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

@Controller('companies')
@UseGuards(AuthGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.companies.list(req.session);
  }

  @Get(':id')
  getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.companies.getOne(req.session, id);
  }

  @Post()
  @UseInterceptors(guidelineUpload)
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateCompanyDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.companies.create(req.session, body.name, file);
  }

  @Put(':id/guidelines')
  @UseInterceptors(guidelineUpload)
  uploadGuidelines(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Guidelines file is required');
    }
    return this.companies.uploadGuidelines(req.session, id, file);
  }

  @Delete(':id/guidelines')
  deleteGuidelines(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.companies.deleteGuidelines(req.session, id);
  }
}
