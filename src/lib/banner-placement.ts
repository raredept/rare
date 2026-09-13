export const bannerPlacements = {
  home: "Home — banner principal",
  customer_login: "Conta do cliente — /entrar e /cadastro",
  admin_login: "Acesso Admin — /admin/login",
} as const;
export type BannerPlacement = keyof typeof bannerPlacements;
export type BannerFraming = {
  placement?: BannerPlacement;
  imageFit?: "cover" | "contain";
  imagePositionX?: number;
  imagePositionY?: number;
  mobileImagePositionX?: number;
  mobileImagePositionY?: number;
};
