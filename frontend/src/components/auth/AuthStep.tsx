import { useReducer, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  AuthPage,
  reducer,
  goToLogin,
  goToSignup,
  goToProfilePicture,
} from "./types";

import { AuthIdentify } from "./AuthIdentify";
import { AuthSignup } from "./AuthSignup";
import { AuthLogin } from "./AuthLogin";
import { AuthProfilPicture } from "./AuthProfilPicture";
import { AuthForgotPassword } from "./ForgotPassword";

const MOCK_CREDENTIALS = {
  email: "yassine@gmail.com",
  password: "password123",
};

export const AuthStep = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, AuthPage.IDENTIFY);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signupError, setSignupError] = useState("");

  const existingEmail = ["yassine@gmail.com"];

  useEffect(() => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setPassword("");
    setConfirmPassword("");
    setLoginError("");
    setSignupError("");
  }, [state]);

  const handleContinue = () => {
    if (!email) return;

    if (existingEmail.includes(email)) {
      dispatch(goToLogin());
    } else {
      dispatch(goToSignup());
    }
  };

  const handleSignup = () => {
    setSignupError("");

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setSignupError(t("please_fill_all_fields"));
      return;
    }

    if (password.length < 8) {
      setSignupError(t("error_password_too_short"));
      return;
    }

    if (password !== confirmPassword) {
      setSignupError(t("error_passwords_not_match"));
      return;
    }

    dispatch(goToProfilePicture());
  };

  const handleLogin = () => {
    setLoginError("");

    if (!email || !password) {
      setLoginError(t("please_fill_all_fields"));
      return;
    }

    if (email === MOCK_CREDENTIALS.email && password === MOCK_CREDENTIALS.password) {
      navigate("/dashboard");
    } else {
      setLoginError(t("error_invalid_credentials"));
    }
  };

  if (state === AuthPage.SIGNUP) {
    return (
      <AuthSignup
        firstName={firstName}
        setFirstName={setFirstName}
        lastName={lastName}
        setLastName={setLastName}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        handleSignup={handleSignup}
        dispatch={dispatch}
        error={signupError}
      />
    );
  }

  if (state === AuthPage.PROFILE_PICTURE) {
    return (
      <AuthProfilPicture
        onContinue={() => dispatch(goToLogin())}
      />
    );
  }

  if (state === AuthPage.LOGIN) {
    return (
      <AuthLogin
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        handleLogin={handleLogin}
        dispatch={dispatch}
        error={loginError}
      />
    );
  }

  if (state === AuthPage.FORGOT_PASSWORD) {
    return (
      <AuthForgotPassword
        email={email}
        setEmail={setEmail}
        dispatch={dispatch}
      />
    );
  }

  return (
    <AuthIdentify
      state={state}
      email={email}
      setEmail={setEmail}
      handleContinue={handleContinue}
    />
  );
};
