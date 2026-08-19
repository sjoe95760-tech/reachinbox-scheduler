import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma";

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * body: { credential: string }  <- the ID token the Google Sign-In button
 *                                   gives the frontend
 *
 * Flow:
 *  1. Verify the Google ID token is genuine (asks Google's servers).
 *  2. Find or create a User row for this Google account.
 *  3. Issue OUR OWN short-lived JWT so the frontend doesn't need to keep
 *     re-verifying with Google on every request.
 */
router.post("/google", async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: "Missing Google credential" });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      return res.status(401).json({ error: "Invalid Google token" });
    }

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: {
        name: payload.name || "",
        avatarUrl: payload.picture || null,
      },
      create: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        avatarUrl: payload.picture || null,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err: any) {
    console.error("[auth] Google verification failed:", err.message);
    res.status(401).json({ error: "Google authentication failed" });
  }
});

export default router;
