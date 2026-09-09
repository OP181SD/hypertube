import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import {
  PERSON_NAME_MAX,
  PERSON_NAME_MIN,
  PERSON_NAME_PATTERN,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_PATTERN,
  isValidEmail,
  passwordPolicyErrorKey,
} from "@/constants/userFields";

type Step = "fields" | "avatar" | "registered";

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
  const [step, setStep] = useState<Step>("fields");
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const setField = (field: keyof typeof fields) => (value: string) => {
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    const { username, firstName, lastName, email, password, confirmPassword } = fields;

    if (!username || !firstName || !lastName || !email || !password || !confirmPassword) {
      return t("please_fill_all_fields");
    }
    if (!isValidEmail(email)) {
      return t("error_invalid_email");
    }
    if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
      return t("error_username_length");
    }
    if (!USERNAME_PATTERN.test(username)) {
      return t("error_username_format");
    }
    if (
      firstName.length < PERSON_NAME_MIN ||
      firstName.length > PERSON_NAME_MAX ||
      !PERSON_NAME_PATTERN.test(firstName)
    ) {
      return t("error_first_name_format");
    }
    if (
      lastName.length < PERSON_NAME_MIN ||
      lastName.length > PERSON_NAME_MAX ||
      !PERSON_NAME_PATTERN.test(lastName)
    ) {
      return t("error_last_name_format");
    }
    const passwordError = passwordPolicyErrorKey(password);
    if (passwordError) {
      return t(passwordError);
    }
    if (password !== confirmPassword) {
      return t("error_passwords_not_match");
    }
    return null;
  };

  const handleContinueToAvatar = () => {
    setLocalError("");
    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setStep("avatar");
  };

  const handleConfirmAvatar = async (file: File | null) => {
    setLocalError("");
    setLoading(true);
    try {
      const { username, firstName, lastName, email, password } = fields;
      await register(
        { email, username, firstName, lastName, password },
        file ?? undefined,
      );
      setStep("registered");
    } catch {
      // authError from context
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMessage("");
    try {
      await resendVerification(fields.email);
    } catch {
      // ignore — message still shown as "done" for enumeration safety
    }
    setResendMessage(t("resend_verification_done"));
  };

  return {
    fields,
    setField,
    step,
    setStep,
    loading,
    displayError: localError || authError,
    handleContinueToAvatar,
    handleConfirmAvatar,
    handleResend,
    resendMessage,
  };
}
