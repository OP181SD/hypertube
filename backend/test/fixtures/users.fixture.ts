import { AuthProvider, Language } from "@prisma/client";

export const validUser = {
  email: "test@example.com",
  username: "testuser",
  firstName: "Test",
  lastName: "User",
  password: "SecurePass123!",
};

export const oauthProfile42 = {
  id: "12345",
  username: "ftuser",
  email: "ftuser@student.42.fr",
  firstName: "Forty",
  lastName: "Two",
  profilePictureUrl: "https://cdn.42.fr/photo.jpg",
};

export const mockDbUser = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "test@example.com",
  username: "testuser",
  firstName: "Test",
  lastName: "User",
  passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$mockhash",
  profilePictureUrl: null,
  language: Language.EN,
  authProvider: AuthProvider.LOCAL,
  providerId: null,
  emailVerified: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockDbUser2 = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  email: "test2@example.com",
  username: "testuser2",
  firstName: "Test2",
  lastName: "User2",
  passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$mockhash2",
  profilePictureUrl: null,
  language: Language.EN,
  authProvider: AuthProvider.LOCAL,
  providerId: null,
  emailVerified: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};
