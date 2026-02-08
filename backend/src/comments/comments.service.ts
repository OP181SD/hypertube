import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const authorSelect = { id: true, username: true };

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(movieId?: string) {
    return this.prisma.comment.findMany({
      where: movieId ? { movieId } : undefined,
      include: { author: { select: authorSelect } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: { author: { select: authorSelect } },
    });

    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    return comment;
  }

  async create(userId: string, movieId: string, content: string) {
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
    });

    if (!movie) {
      throw new NotFoundException("Movie not found");
    }

    return this.prisma.comment.create({
      data: { content, authorId: userId, movieId },
      include: { author: { select: authorSelect } },
    });
  }

  async update(id: string, userId: string, content: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException("You can only edit your own comments");
    }

    return this.prisma.comment.update({
      where: { id },
      data: { content },
      include: { author: { select: authorSelect } },
    });
  }

  async remove(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException("You can only delete your own comments");
    }

    await this.prisma.comment.delete({ where: { id } });
  }
}
