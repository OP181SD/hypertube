import { useTranslation } from "react-i18next";
import { useProfileForm } from "@/hooks/useProfileForm";
import { AvatarImage } from "@/components/ui/AvatarImage";
import { PasswordInput } from "@/components/ui/PasswordInput";

export function Profile() {
  const { t } = useTranslation();
  const {
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
  } = useProfileForm();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-white px-6 sm:px-10 md:px-20 pt-16 flex flex-col items-center">
      <div className="flex flex-col items-center mb-10">
        <div className="relative inline-block">
          <button
            type="button"
            onClick={triggerAvatarUpload}
            disabled={uploading || deleting}
            className="relative rounded-full p-1 bg-gradient-to-tr from-[#795EF0] via-[#C270ED] to-[#38BDF8] cursor-pointer"
          >
            <AvatarImage
              profilePictureUrl={user.profilePictureUrl}
              username={user.username}
              className="w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover ring-2 ring-black/20 transition-transform duration-300 hover:scale-105"
            />

            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
              </div>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            name="avatar"
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
        <div
          className={`mb-6 px-4 py-3 rounded-xl text-sm w-full max-w-md text-center ${
            message.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-400/10 border border-red-400/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="profile-first-name" className="text-white/50 text-xs mb-1 block">{t("first_name")}</label>
            <input
              id="profile-first-name"
              type="text"
              name="firstName"
              autoComplete="given-name"
              value={form.firstName}
              onChange={handleChange("firstName")}
              disabled={deleting}
              className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="profile-last-name" className="text-white/50 text-xs mb-1 block">{t("last_name")}</label>
            <input
              id="profile-last-name"
              type="text"
              name="lastName"
              autoComplete="family-name"
              value={form.lastName}
              onChange={handleChange("lastName")}
              disabled={deleting}
              className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="profile-username" className="text-white/50 text-xs mb-1 block">{t("username")}</label>
          <input
            id="profile-username"
            type="text"
            name="username"
            autoComplete="username"
            value={form.username}
            onChange={handleChange("username")}
            disabled={deleting}
            className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="text-white/50 text-xs mb-1 block">{t("email")}</label>
          <input
            id="profile-email"
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange("email")}
            disabled={deleting}
            className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {user.authProvider === "LOCAL" && (
          <>
            <div>
              <label htmlFor="profile-new-password" className="text-white/50 text-xs mb-1 block">{t("new_password")}</label>
              <PasswordInput
                id="profile-new-password"
                name="new-password"
                value={form.password}
                onChange={handleChange("password")}
                placeholder={t("create_password_placeholder")}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="profile-confirm-password" className="text-white/50 text-xs mb-1 block">{t("confirm_password")}</label>
              <PasswordInput
                id="profile-confirm-password"
                name="confirm-password"
                value={form.confirmPassword}
                onChange={handleChange("confirmPassword")}
                placeholder={t("confirm_password_placeholder")}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={saving || deleting}
          className="mt-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </form>

      <div className="w-full max-w-md mt-12 mb-16 pt-8 border-t border-white/10">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="w-full px-6 py-3 rounded-xl border border-red-500/40 text-red-400 font-medium hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("delete_account")}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-white/60 text-center">
              {t("delete_account_warning")}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? t("deleting_account") : t("delete_account_confirm")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
