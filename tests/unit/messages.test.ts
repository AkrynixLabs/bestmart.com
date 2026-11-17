import { describe, expect, it } from "vitest"

import { HIDDEN, maskContacts } from "@/lib/messages/mask"

describe("contact masking", () => {
  it("hides phone numbers in the ways people write them", () => {
    for (const phone of ["0241234567", "024 123 4567", "+233 24 123 4567", "(024) 123-4567", "024.123.4567", "233241234567"]) {
      expect(maskContacts(`call me on ${phone} please`).text, phone).toBe(`call me on ${HIDDEN} please`)
    }
  })

  it("hides emails, links and messaging handles", () => {
    expect(maskContacts("mail ama@gmail.com").text).toBe(`mail ${HIDDEN}`)
    expect(maskContacts("ama at gmail dot com").text).toBe(HIDDEN)
    expect(maskContacts("see https://example.com/shop and www.ama.shop").text).toBe(`see ${HIDDEN} and ${HIDDEN}`)
    expect(maskContacts("wa.me/233241234567").masked).toBe(true)
    expect(maskContacts("visit amasstore.com").text).toBe(`visit ${HIDDEN}`)
  })

  it("leaves ordinary messages alone", () => {
    const text = "Is size 42 available? I need 2 pairs by Friday, about GH₵ 150 each."
    expect(maskContacts(text)).toEqual({ text, masked: false })
  })
})
