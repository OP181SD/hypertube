import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import {
  uploadProfilePicture,
  deleteUser,
  type UpdateUserPayload,
} from "@/api/users.api";
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

interface ProfileMessage {
  type: "success" | "error";
  text: string;
}

export function useProfileForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUser, refreshUser, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<ProfileMessage | null>(null);

  const [seededUser, setSeededUser] = useState<typeof user>(null);
  if (user && user !== seededUser) {
    setSeededUser(user);
    setForm({
      username: user.username ?? "",
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email ?? "",
      password: "",
      confirmPassword: "",
    });
  }

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    try {
      if (form.password || form.confirmPassword) {
        const passwordError = passwordPolicyErrorKey(form.password);
        if (passwordError) {
          setMessage({ type: "error", text: t(passwordError) });
          return;
        }
        if (form.password !== form.confirmPassword) {
          setMessage({ type: "error", text: t("error_passwords_not_match") });
          return;
        }
      }

      const updatedFields: UpdateUserPayload = {};

      if (form.username !== user.username) {
        if (
          form.username.length < USERNAME_MIN ||
          form.username.length > USERNAME_MAX ||
          !USERNAME_PATTERN.test(form.username)
        ) {
          setMessage({ type: "error", text: t("error_username_format") });
          return;
        }
        updatedFields.username = form.username;
      }
      if (form.firstName !== user.firstName) {
        if (
          form.firstName.length < PERSON_NAME_MIN ||
          form.firstName.length > PERSON_NAME_MAX ||
          !PERSON_NAME_PATTERN.test(form.firstName)
        ) {
          setMessage({ type: "error", text: t("error_first_name_format") });
          return;
        }
        updatedFields.firstName = form.firstName;
      }
      if (form.lastName !== user.lastName) {
        if (
          form.lastName.length < PERSON_NAME_MIN ||
          form.lastName.length > PERSON_NAME_MAX ||
          !PERSON_NAME_PATTERN.test(form.lastName)
        ) {
          setMessage({ type: "error", text: t("error_last_name_format") });
          return;
        }
        updatedFields.lastName = form.lastName;
      }
      if (form.email !== user.email) {
        if (!isValidEmail(form.email)) {
          setMessage({ type: "error", text: t("error_invalid_email") });
          return;
        }
        updatedFields.email = form.email;
      }
      if (form.password) updatedFields.password = form.password;

      if (Object.keys(updatedFields).length === 0) {
        return;
      }

      await updateUser(updatedFields);
      setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
      setMessage({ type: "success", text: t("profile_updated") });
      await refreshUser();
    } catch (err: unknown) {
      const errorData = err as { response?: { data?: { message?: string | string[] } } };
      const backendMessage = Array.isArray(errorData.response?.data?.message)
        ? errorData.response?.data?.message[0]
        : errorData.response?.data?.message;

      setMessage({ type: "error", text: backendMessage || t("profile_update_error") });
    } finally {
      setSaving(false);
    }
  };

  const triggerAvatarUpload = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      await uploadProfilePicture(user.id, file);
      await refreshUser();
      setMessage({ type: "success", text: t("avatar_updated") });
    } catch {
      setMessage({ type: "error", text: t("avatar_update_error") });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    setMessage(null);
    try {
      await deleteUser(user.id);
      await logout();
      navigate("/", { replace: true });
    } catch {
      setMessage({ type: "error", text: t("delete_account_error") });
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return {
    user,
    form,
    saving,
    uploading,
    deleting,
    confirmDelete,
    setConfirmDelete,
    message,
    fileInputRef,
    handleChange,
    handleSubmit,
    triggerAvatarUpload,
    handleAvatarChange,
    handleDeleteAccount,
  };
}
