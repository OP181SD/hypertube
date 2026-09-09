import { useReducer } from "react";
import { AuthPage, reducer, type Action } from "./types";

import { AuthIdentify } from "./AuthIdentify";
import { AuthSignup } from "./AuthSignup";
import { AuthLogin } from "./AuthLogin";
import { AuthForgotPassword } from "./ForgotPassword";

export const AuthStep = () => {
  const [state, dispatch] = useReducer(reducer, AuthPage.IDENTIFY);

  const pass = (action: Action) => dispatch(action);

  if (state === AuthPage.SIGNUP) {
    return <AuthSignup dispatch={pass} />;
  }

  if (state === AuthPage.LOGIN) {
    return <AuthLogin dispatch={pass} />;
  }

  if (state === AuthPage.FORGOT_PASSWORD) {
    return <AuthForgotPassword dispatch={pass} />;
  }

  return <AuthIdentify dispatch={pass} />;
};
