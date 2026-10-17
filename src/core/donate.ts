export const DONATE_QR_ADD_INFO_MESSAGES: readonly string[] = Object.freeze([
  "Game hay toi donate cho ban ne",
  "Tien cafe de phat trien game tiep",
  "Ung ho team lam game vui hon",
  "Cam on ban da choi game nay",
  "Moi ban ly tra sua nha dev",
  "Donate tinh nguyen cho team nhe",
  "Game vui qua ung ho them nhe",
  "Mua ca phe dong vien team dev",
  "Thanks for playing donate nhe",
  "Tien nuoc ung ho lam game tiep",
  "Game ngon ung ho mot ly cafe",
  "Thich game thi moi ban mua tra sua",
  "Ho tro dev lam them mode moi",
  "Cam on ban da ung ho tinh nguyen",
  "Mot ly cafe cho team phat trien",
]);

export const DONATE_ACCOUNT_NAME = "LUONG QUOC THAI";
export const DONATE_BANK = "TPBank";
export const DONATE_ACCOUNT_NUMBER = "6039352614";

export function pickRandomDonateQrAddInfo(
  randomFn: () => number = Math.random,
): string {
  const safeRandom = typeof randomFn === "function" ? randomFn : Math.random;
  const index = Math.floor(safeRandom() * DONATE_QR_ADD_INFO_MESSAGES.length);
  return DONATE_QR_ADD_INFO_MESSAGES[
    Math.max(0, Math.min(DONATE_QR_ADD_INFO_MESSAGES.length - 1, index))
  ]!;
}

export function buildDonateQrUrl(
  amount: number,
  addInfo: string = pickRandomDonateQrAddInfo(),
): string {
  const params = new URLSearchParams({
    accountName: DONATE_ACCOUNT_NAME,
    addInfo,
  });
  if (amount > 0) {
    params.set("amount", String(Math.round(Number(amount) || 0)));
  }
  return `https://img.vietqr.io/image/tpbank-${DONATE_ACCOUNT_NUMBER}-compact2.png?${params.toString()}`;
}
