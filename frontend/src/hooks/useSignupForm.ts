import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getMe, uploadProfilePicture } from "@/api/users.api";

export function useSignupForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, error: authError } = useAuth();

  const [fields, setFields] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);

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
      if (profilePicture) {
        try {
          const me = await getMe();
          await uploadProfilePicture(me.id, profilePicture);
        } catch {
          // Upload failed — account is valid, user can retry from profile
        }
      }
      navigate("/dashboard");
    } catch {
      // register() failed — authError is set by AuthContext
    } finally {
      setLoading(false);
    }
  };

  return {
    fields,
    setField,
    profilePicture,
    setProfilePicture,
    loading,
    displayError: localError || authError,
    handleSubmit,
  };
}
