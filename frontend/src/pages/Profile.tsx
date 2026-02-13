import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { uploadProfilePicture } from "@/api/users.api";

export function Profile() {
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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username ?? "",
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        email: user.email ?? "",
      });
    }
  }, [user]);

  if (!user) return null;

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      setMessage({ 
        type: "error", 
        text: backendMessage || t("profile_update_error") 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="min-h-screen bg-black text-white px-6 sm:px-10 md:px-20 pt-16 flex flex-col items-center">
      <div className="flex flex-col items-center mb-10">
        <div className="relative inline-block">
          <button
            onClick={handleAvatarClick}
            disabled={uploading}
            className="relative rounded-full p-1 bg-linear-to-tr from-[#795EF0] via-[#C270ED] to-[#38BDF8] cursor-pointer"
          >
            {user.profilePictureUrl ? (
              <img
                src={`http://localhost:3000${user.profilePictureUrl}`}
                alt={user.username}
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover ring-2 ring-black/20 transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold text-white/60 ring-2 ring-black/20">
                {initials}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        <h1 className="mt-5 text-3xl sm:text-4xl font-semibold tracking-wide text-white">
          {user.firstName} {user.lastName}
        </h1>
        <p className="text-white/50 text-sm mt-1">@{user.username}</p>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm w-full max-w-md text-center ${
          message.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-400/10 border border-red-400/20 text-red-400"
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-white/50 text-xs mb-1 block">{t("first_name")}</label>
            <input
              type="text"
              value={form.firstName}
              onChange={handleChange("firstName")}
              className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-white/50 text-xs mb-1 block">{t("last_name")}</label>
            <input
              type="text"
              value={form.lastName}
              onChange={handleChange("lastName")}
              className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-white/50 text-xs mb-1 block">{t("username")}</label>
          <input
            type="text"
            value={form.username}
            onChange={handleChange("username")}
            className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-white/50 text-xs mb-1 block">{t("email")}</label>
          <input
            type="email"
            value={form.email}
            onChange={handleChange("email")}
            className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </form>
    </div>
  );
}

export default Profile;