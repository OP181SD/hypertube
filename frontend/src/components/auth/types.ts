export enum AuthPage {
  IDENTIFY = "IDENTIFY",
  LOGIN = "LOGIN",
  SIGNUP = "SIGNUP",
  FORGOT_PASSWORD = "FORGOT_PASSWORD",
}

export type AuthState = AuthPage;

export type Action =
  | { type: AuthPage.IDENTIFY }
  | { type: AuthPage.LOGIN }
  | { type: AuthPage.SIGNUP }
  | { type: AuthPage.FORGOT_PASSWORD };

export const goToIdentify = (): Action => ({ type: AuthPage.IDENTIFY });
export const goToLogin = (): Action => ({ type: AuthPage.LOGIN });
export const goToSignup = (): Action => ({ type: AuthPage.SIGNUP });
export const goToForgotPassword = (): Action => ({ type: AuthPage.FORGOT_PASSWORD });

const transitions: Record<AuthPage, AuthPage[]> = {
  [AuthPage.IDENTIFY]: [
    AuthPage.LOGIN,
    AuthPage.SIGNUP,
  ],

  [AuthPage.LOGIN]: [
    AuthPage.IDENTIFY,
    AuthPage.FORGOT_PASSWORD,
  ],

  [AuthPage.FORGOT_PASSWORD]: [
    AuthPage.LOGIN,
    AuthPage.IDENTIFY,
  ],

  [AuthPage.SIGNUP]: [
    AuthPage.IDENTIFY,
  ],
};



export function reducer(state: AuthState, action: Action): AuthState {
  return transitions[state].includes(action.type)
    ? action.type
    : state;
}