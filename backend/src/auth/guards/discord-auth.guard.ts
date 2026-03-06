import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class DiscordAuthGuard extends AuthGuard("discord") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const response = http.getResponse();

    if (!response.setHeader) {
      response.setHeader = (key: string, value: any) => response.header(key, value);
    }
    if (!response.end) {
      response.end = (chunk: any) => response.send(chunk);
    }

    try {
      return (await super.canActivate(context)) as boolean;
    } catch (err) {
      throw err;
    }
  }
}