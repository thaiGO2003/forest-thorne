import { describe, expect, it } from "vitest";
import { capitalizeKeyword } from "../src/ui/richText";

describe("rich description keywords", () => {
  it("uppercases only the first letter of a matched keyword", () => {
    expect(capitalizeKeyword("tự hồi 10% HP tối đa")).toBe("Tự hồi 10% HP tối đa");
    expect(capitalizeKeyword("nhận 16 khiên")).toBe("Nhận 16 khiên");
    expect(capitalizeKeyword("giảm 12% sát thương nhận vào trong 1 lượt"))
      .toBe("Giảm 12% sát thương nhận vào trong 1 lượt");
    expect(capitalizeKeyword("thanh tẩy 1 hiệu ứng bất lợi ngẫu nhiên trên bản thân"))
      .toBe("Thanh tẩy 1 hiệu ứng bất lợi ngẫu nhiên trên bản thân");
  });

  it("keeps already-capitalized and non-letter starts untouched", () => {
    expect(capitalizeKeyword("Tự hồi 8% HP")).toBe("Tự hồi 8% HP");
    expect(capitalizeKeyword("(40 + 1.5 x ATK)")).toBe("(40 + 1.5 x ATK)");
    expect(capitalizeKeyword("")).toBe("");
  });

  it("uses Vietnamese-aware casing for accented initial letters", () => {
    expect(capitalizeKeyword("đóng băng 1 lượt")).toBe("Đóng băng 1 lượt");
  });
});
