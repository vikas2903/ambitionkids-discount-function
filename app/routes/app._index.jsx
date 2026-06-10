import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

const FUNCTION_HANDLE = "ambitionkids-dicountapp";
const DEFAULT_TITLE = "Ambition Kids Steal Deal";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const title = String(formData.get("title") || DEFAULT_TITLE).trim();
  const startsAt = String(formData.get("startsAt") || "").trim();
  const endsAt = String(formData.get("endsAt") || "").trim();

  const response = await admin.graphql(
    `#graphql
      mutation CreateStealDeal($automaticAppDiscount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
          automaticAppDiscount {
            discountId
            title
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        automaticAppDiscount: {
          title: title || DEFAULT_TITLE,
          functionHandle: FUNCTION_HANDLE,
          discountClasses: ["PRODUCT"],
          startsAt: startsAt || new Date().toISOString(),
          ...(endsAt ? { endsAt } : {}),
        },
      },
    },
  );

  const responseJson = await response.json();
  const createResult = responseJson.data?.discountAutomaticAppCreate;
  const userErrors = createResult?.userErrors ?? [];

  if (responseJson.errors?.length) {
    return {
      ok: false,
      error: responseJson.errors.map((item) => item.message).join(", "),
    };
  }

  if (userErrors.length > 0) {
    return {
      ok: false,
      error: userErrors.map((item) => item.message).join(", "),
    };
  }

  return {
    ok: true,
    discount: createResult?.automaticAppDiscount ?? null,
  };
};

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [startsAt, setStartsAt] = useState(getLocalDateTimeInputValue());
  const [endsAt, setEndsAt] = useState("");

  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Discount created");
    }

    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, {
        duration: 5000,
        isError: true,
      });
    }
  }, [fetcher.data, shopify]);

  const createDiscount = () =>
    fetcher.submit(
      {
        title,
        startsAt: toIsoUtc(startsAt),
        endsAt: endsAt ? toIsoUtc(endsAt) : "",
      },
      { method: "POST" },
    );

  return (
    <s-page heading="Ambition Kids Discount App">
      <s-button
        slot="primary-action"
        onClick={createDiscount}
        {...(isLoading ? { loading: true } : {})}
      >
        Create discount
      </s-button>

      <s-section heading="Create automatic product discount">
        <s-paragraph>
          This app creates the Shopify automatic discount record for your
          function handle <s-text weight="bold">{FUNCTION_HANDLE}</s-text>.
        </s-paragraph>
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Discount title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <s-text-field
            label="Starts at"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
          <s-text-field
            label="Ends at (optional)"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
          <s-button
            onClick={createDiscount}
            {...(isLoading ? { loading: true } : {})}
          >
            Create discount
          </s-button>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Function setup">
        <s-paragraph>
          <s-text weight="bold">Discount type:</s-text> Automatic product
          discount
        </s-paragraph>
        <s-paragraph>
          <s-text weight="bold">Function handle:</s-text> {FUNCTION_HANDLE}
        </s-paragraph>
        <s-paragraph>
          <s-text weight="bold">Behavior:</s-text> Collection A unlocks fixed
          price Rs.599 for Collection B products already in the cart.
        </s-paragraph>
      </s-section>

      {fetcher.data?.error && (
        <s-section heading="Error">
          <s-banner tone="critical">
            <s-text>{fetcher.data.error}</s-text>
          </s-banner>
        </s-section>
      )}

      {fetcher.data?.discount && (
        <s-section heading="Created discount">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <pre style={{ margin: 0 }}>
              <code>{JSON.stringify(fetcher.data.discount, null, 2)}</code>
            </pre>
          </s-box>
        </s-section>
      )}
    </s-page>
  );
}

function getLocalDateTimeInputValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoUtc(value) {
  return new Date(value).toISOString();
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
