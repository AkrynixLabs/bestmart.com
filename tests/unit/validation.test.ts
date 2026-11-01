import { describe, expect, it } from "vitest"

import { addressSchema } from "@/lib/validation/address"
import { signUpSchema } from "@/lib/validation/auth"
import { ghanaCardNumber, ghanaPostGps, normaliseGhanaPhone } from "@/lib/validation/common"
import { sellerApplicationSchema, sniffKycType } from "@/lib/validation/seller"

describe("normaliseGhanaPhone", () => {
  it.each([
    ["024 123 4567", "+233241234567"],
    ["0241234567", "+233241234567"],
    ["+233 24 123 4567", "+233241234567"],
    ["233-50-123-4567", "+233501234567"],
    ["(030) 212 3456", "+233302123456"],
  ])("normalises %s", (input, expected) => {
    expect(normaliseGhanaPhone(input)).toBe(expected)
  })

  it.each(["12345", "0141234567", "+234 803 123 4567", "024123456", "02412345678"])("rejects %s", (input) => {
    expect(normaliseGhanaPhone(input)).toBeNull()
  })
})

describe("Ghana identifiers", () => {
  it("accepts and upper-cases Ghana Card numbers", () => {
    expect(ghanaCardNumber.parse(" gha-123456789-0 ")).toBe("GHA-123456789-0")
    expect(ghanaCardNumber.safeParse("GHA-12345-0").success).toBe(false)
  })

  it("accepts GhanaPost GPS addresses", () => {
    expect(ghanaPostGps.parse("ga-183-8164")).toBe("GA-183-8164")
    expect(ghanaPostGps.parse("AK-0395-0283")).toBe("AK-0395-0283")
    expect(ghanaPostGps.safeParse("GA1838164").success).toBe(false)
  })
})

const validSignUp = {
  name: "  Ama   Mensah ",
  email: " Ama@Example.COM ",
  phone: "",
  password: "goodpass123",
  confirmPassword: "goodpass123",
  acceptTerms: "on",
}

describe("signUpSchema", () => {
  it("normalises name and email, treats empty phone as absent", () => {
    const result = signUpSchema.parse(validSignUp)
    expect(result.name).toBe("Ama Mensah")
    expect(result.email).toBe("ama@example.com")
    expect(result.phone).toBeUndefined()
  })

  it("requires matching passwords with a letter and a number", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, confirmPassword: "different1" }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...validSignUp, password: "onlyletters", confirmPassword: "onlyletters" }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...validSignUp, password: "short1", confirmPassword: "short1" }).success).toBe(false)
  })

  it("requires accepting the terms", () => {
    const { acceptTerms: _omit, ...rest } = validSignUp
    expect(signUpSchema.safeParse(rest).success).toBe(false)
  })
})

describe("addressSchema", () => {
  it("parses a complete address and the default checkbox", () => {
    const result = addressSchema.parse({
      recipientName: "Kofi Boateng",
      phone: "0201234567",
      region: "greater_accra",
      city: "Accra",
      area: "East Legon",
      gpsAddress: "ga-123-4567",
      landmark: "",
      isDefault: "on",
    })
    expect(result).toMatchObject({ phone: "+233201234567", gpsAddress: "GA-123-4567", isDefault: true, landmark: undefined })
  })

  it("rejects an unknown region", () => {
    expect(addressSchema.safeParse({ recipientName: "A", phone: "0201234567", region: "lagos", city: "x", area: "y" }).success).toBe(false)
  })
})

const validApplication = {
  storeName: "Ama's Fabrics",
  businessType: "individual",
  ghanaCardNumber: "GHA-123456789-0",
  phone: "0241234567",
  region: "greater_accra",
  city: "Accra",
  payoutMethod: "mobile_money",
  payoutProvider: "MTN",
  payoutAccountName: "Ama Mensah",
  payoutAccountNumber: "024 123 4567",
  agreeToSellerTerms: "on",
}

describe("sellerApplicationSchema", () => {
  it("accepts a valid Mobile Money application", () => {
    expect(sellerApplicationSchema.parse(validApplication).payoutAccountNumber).toBe("0241234567")
  })

  it("requires a registration number for registered businesses", () => {
    const result = sellerApplicationSchema.safeParse({ ...validApplication, businessType: "registered_business" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["businessRegistrationNumber"])
  })

  it("checks the MoMo network and number format", () => {
    expect(sellerApplicationSchema.safeParse({ ...validApplication, payoutProvider: "GCB" }).success).toBe(false)
    expect(sellerApplicationSchema.safeParse({ ...validApplication, payoutAccountNumber: "1234567890123" }).success).toBe(false)
  })

  it("allows any bank and account number for bank payouts", () => {
    expect(sellerApplicationSchema.safeParse({ ...validApplication, payoutMethod: "bank_account", payoutProvider: "GCB Bank", payoutAccountNumber: "1234567890123" }).success).toBe(true)
  })
})

describe("sniffKycType", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)])
  it("recognises files by their content, not their name", () => {
    expect(sniffKycType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg")
    expect(sniffKycType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png")
    expect(sniffKycType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe("application/pdf")
    expect(sniffKycType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull()
  })
})
