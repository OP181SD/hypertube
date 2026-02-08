export enum AuthPage {
  IDENTIFY = "IDENTIFY",
  LOGIN = "LOGIN",
  SIGNUP = "SIGNUP",
  PROFILE_PICTURE = "PROFILE_PICTURE",
  FORGOT_PASSWORD = "FORGOT_PASSWORD",
}

export type AuthState = AuthPage;

export type Action =
  | { type: AuthPage.IDENTIFY }
  | { type: AuthPage.LOGIN }
  | { type: AuthPage.SIGNUP }
  | { type: AuthPage.PROFILE_PICTURE }
  | { type: AuthPage.FORGOT_PASSWORD };

export const goToIdentify = (): Action => ({ type: AuthPage.IDENTIFY });
export const goToLogin = (): Action => ({ type: AuthPage.LOGIN });
export const goToSignup = (): Action => ({ type: AuthPage.SIGNUP });
export const goToProfilePicture = (): Action => ({ type: AuthPage.PROFILE_PICTURE });
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
    AuthPage.PROFILE_PICTURE,
    AuthPage.IDENTIFY,
  ],

  [AuthPage.PROFILE_PICTURE]: [
    AuthPage.LOGIN,
  ],
};



export function reducer(state: AuthState, action: Action): AuthState {
  return transitions[state].includes(action.type)
    ? action.type
    : state;
}