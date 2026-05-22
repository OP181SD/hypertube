import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

export function useSignupForm() {
  const { t } = useTranslation();
  const { register, resendVerification, error: authError } = useAuth();

  const [fields, setFields] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const setField = (field: keyof typeof fields) => (value: string) => {
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    const { username, firstName, lastName, email, password, confirmPassword } = fields;

    if (!username || !firstName || !lastName || !email || !password || !confirmPassword) {
      return t("please_fill_all_fields");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return t("error_invalid_email");
    }
    if (username.length < 3 || username.length > 30) {
      return t("error_username_length");
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return t("error_username_format");
    }
    if (password.length < 8) {
      return t("error_password_too_short");
    }
    if (password !== confirmPassword) {
      return t("error_passwords_not_match");
    }
    return null;
  };

  const handleSubmit = async () => {
    setLocalError("");
    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLoading(true);
    try {
      const { username, firstName, lastName, email, password } = fields;
      await register({ email, username, firstName, lastName, password });
      // Account created — the user must now verify their email.
      setRegistered(true);
    } catch {
      // register() failed — authError is set by AuthContext
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMessage("");
    try {
      await resendVerification(fields.email);
    } catch {
      // Response is intentionally generic regardless of outcome.
    }
    setResendMessage(t("resend_verification_done"));
  };

  return {
    fields,
    setField,
    loading,
    displayError: localError || authError,
    handleSubmit,
    registered,
    handleResend,
    resendMessage,
  };
}
