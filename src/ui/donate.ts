export const DONATE_BANK_NAME = "TPBank";
export const DONATE_BANK_ID = "TPB";
export const DONATE_ACCOUNT = "60394352614";
export const DONATE_ACCOUNT_NAME = "LUONG QUOC THAI";

export const DONATE_AMOUNT_PRESETS = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000] as const;

export const DONATE_QR_ADD_INFO_MESSAGES = [
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
] as const;

const VIETQR_BASE = `https://img.vietqr.io/image/${DONATE_BANK_ID}-${DONATE_ACCOUNT}-compact2.png`;

export function buildDonateVietQrUrl(amount: number, addInfo: string): string {
  const query = new URLSearchParams({
    amount: String(Math.trunc(amount)),
    addInfo,
    accountName: DONATE_ACCOUNT_NAME,
  });
  return `${VIETQR_BASE}?${query.toString()}`;
}

export function randomDonateMemo(random: () => number = Math.random): string {
  const value = random();
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.9999999999999999) : 0;
  return DONATE_QR_ADD_INFO_MESSAGES[Math.floor(normalized * DONATE_QR_ADD_INFO_MESSAGES.length)]!;
}
