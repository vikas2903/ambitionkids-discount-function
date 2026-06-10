// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

const STEAL_DEAL_FIXED_PRICE = 599;
const DISCOUNT_MESSAGE = "Steal Deal unlocked";
// The discount line must carry this cart line attribute value to qualify.
const REQUIRED_ATTRIBUTE_VALUE = "STEAL DEAL @ RS. 599";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 * @typedef {RunInput["cart"]["lines"][number]} RunInputCartLine
 */

/**
 * @type {FunctionRunResult}
 */
const NO_DISCOUNT = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

/**
 * @param {RunInputCartLine["merchandise"]} merchandise
 */
function isProductVariant(merchandise) {
  return merchandise.__typename === "ProductVariant";
}

/**
 * @param {RunInputCartLine} line
 */
function isStealDealLine(line) {
  return (
    isProductVariant(line.merchandise) &&
    // Only discount products from the target collection, and only when the
    // line item property `bundle_type` matches the expected offer label.
    line.merchandise.product.inStealDealCollection === true &&
    line.attribute?.value?.trim() === REQUIRED_ATTRIBUTE_VALUE
  );
}

/**
 * @param {RunInputCartLine} line
 */
function isMainProductLine(line) {
  return (
    isProductVariant(line.merchandise) &&
    line.merchandise.product.inMainCollection === true
  );
}

/**
 * Applies a fixed-price discount to collection-B products when at least one
 * collection-A product exists in the cart.
 *
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const lines = input.cart?.lines ?? [];
  // The offer unlocks only when at least one trigger-collection product exists.
  const hasMainProduct = lines.some(isMainProductLine);

  if (!hasMainProduct) {
    return NO_DISCOUNT;
  }

  const discounts = lines
    .filter(isStealDealLine)
    .map((line) => {
      const currentPricePerUnit = Number.parseFloat(
        line.cost.amountPerQuantity.amount
      );

      if (!Number.isFinite(currentPricePerUnit)) {
        return null;
      }

      // We discount only the difference so the final per-item price becomes 599.
      const discountPerUnit = currentPricePerUnit - STEAL_DEAL_FIXED_PRICE;

      if (discountPerUnit <= 0) {
        return null;
      }

      return {
        message: DISCOUNT_MESSAGE,
        targets: [
          {
            cartLine: {
              id: line.id,
            },
          },
        ],
        value: {
          fixedAmount: {
            amount: discountPerUnit.toFixed(2),
            appliesToEachItem: true,
          },
        },
      };
    })
    .filter((discount) => discount !== null);

  if (discounts.length === 0) {
    return NO_DISCOUNT;
  }

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.First,
    discounts,
  };
}

