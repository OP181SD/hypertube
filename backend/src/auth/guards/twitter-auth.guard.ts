import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class TwitterAuthGuard extends AuthGuard("twitter") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const response = http.getResponse();

    // Passport a besoin de ces méthodes Express-like sur l'objet de réponse Fastify
    if (!response.setHeader) {
      response.setHeader = (key: string, value: any) => response.header(key, value);
    }
    if (!response.end) {
      response.end = (chunk: any) => response.send(chunk);
    }
    if (!response.redirect) {
      response.redirect = (url: string) => response.status(302).redirect(url);
    }

    try {
      return (await super.canActivate(context)) as boolean;
    } catch (err) {
      console.error("--- 🛡️ [TwitterAuthGuard] --- Erreur:", err);
      throw err;
    }
  }
}