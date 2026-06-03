import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { uploadProfilePicture } from "@/api/users.api";

interface ProfileMessage {
  type: "success" | "error";
  text: string;
}

export function useProfileForm() {
  const { t } = useTranslation();
  const { user, updateUser, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<ProfileMessage | null>(null);

  // Re-seed the form whenever the authenticated user changes, without an
  // effect (https://react.dev/learn/you-might-not-need-an-effect).
  const [seededUser, setSeededUser] = useState<typeof user>(null);
  if (user && user !== seededUser) {
    setSeededUser(user);
    setForm({
      username: user.username ?? "",
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email ?? "",
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
      const updatedFields: Partial<typeof form> = {};
      if (form.username !== user.username) updatedFields.username = form.username;
      if (form.firstName !== user.firstName) updatedFields.firstName = form.firstName;
      if (form.lastName !== user.lastName) updatedFields.lastName = form.lastName;
      if (form.email !== user.email) updatedFields.email = form.email;

      if (Object.keys(updatedFields).length === 0) {
        setSaving(false);
        return;
      }

      await updateUser(updatedFields);
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

  return {
    user,
    form,
    saving,
    uploading,
    message,
    fileInputRef,
    handleChange,
    handleSubmit,
    triggerAvatarUpload,
    handleAvatarChange,
  };
}
