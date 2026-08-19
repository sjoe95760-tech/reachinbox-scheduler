import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthedRequest extends Request {
  user?: { id: string; email: string; name: string };
}

/**
 * Reads the "Authorization: Bearer <token>" header, verifies it was signed
 * by us (issued during Google login - see routes/auth.ts), and attaches the
 * user to the request. Rejects the request otherwise.
 */
export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
      email: string;
      name: string;
    };
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
