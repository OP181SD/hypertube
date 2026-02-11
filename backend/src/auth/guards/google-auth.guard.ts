import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const response = http.getResponse();

    // 💡 PATCH POUR FASTIFY : Passport attend des méthodes Express
    // On lie les méthodes attendues par Passport aux méthodes de Fastify
    if (!response.setHeader) {
      response.setHeader = (key: string, value: any) => response.header(key, value);
    }
    if (!response.end) {
      response.end = (chunk: any) => response.send(chunk);
    }

    console.log("--- 🛡️ [GoogleAuthGuard] --- Tentative d'activation (Patch appliqué)");
    
    try {
      const result = (await super.canActivate(context)) as boolean;
      return result;
    } catch (err) {
      console.error("--- 🛡️ [GoogleAuthGuard] --- Erreur lors de la redirection:", err);
      throw err;
    }
  }
}