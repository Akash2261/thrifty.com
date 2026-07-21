import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  CountryCode,
  Products,
} from "plaid";
import { AppError } from "../../lib/errors";
import type { BankDataProvider } from "./bankProvider";

let client: PlaidApi | null = null;
function getClient(): PlaidApi {
  if (!client) {
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;
    if (!clientId || !secret) {
      throw new AppError("Bank linking isn't set up yet on the server (missing Plaid credentials).", 503);
    }
    const configuration = new Configuration({
      basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    });
    client = new PlaidApi(configuration);
  }
  return client;
}

export const plaidProvider: BankDataProvider = {
  async createLinkSession(userId) {
    const plaid = getClient();
    try {
      const response = await plaid.linkTokenCreate({
        client_name: "Thrifty",
        language: "en",
        country_codes: [CountryCode.Us],
        user: { client_user_id: userId },
        products: [Products.Transactions],
        hosted_link: { is_mobile_app: true },
        webhook: process.env.PLAID_WEBHOOK_URL || undefined,
      });
      if (!response.data.hosted_link_url) {
        throw new AppError("Plaid did not return a hosted Link URL", 502);
      }
      return { linkToken: response.data.link_token, hostedLinkUrl: response.data.hosted_link_url };
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("Plaid linkTokenCreate failed", err);
      throw new AppError("Couldn't start the bank-linking flow. Try again.", 502);
    }
  },

  async pollLinkSession(linkToken) {
    const plaid = getClient();
    try {
      const response = await plaid.linkTokenGet({ link_token: linkToken });
      const session = response.data.link_sessions?.[0];
      const result = session?.results?.item_add_results?.[0];
      if (!session || !result) {
        return { finished: false };
      }
      return {
        finished: true,
        publicToken: result.public_token,
        institutionName: result.institution?.name,
      };
    } catch (err) {
      console.error("Plaid linkTokenGet failed", err);
      throw new AppError("Couldn't check the bank-linking status. Try again.", 502);
    }
  },

  async exchangePublicToken(publicToken) {
    const plaid = getClient();
    try {
      const response = await plaid.itemPublicTokenExchange({ public_token: publicToken });
      return {
        accessToken: response.data.access_token,
        providerItemId: response.data.item_id,
        institutionName: null,
      };
    } catch (err) {
      console.error("Plaid itemPublicTokenExchange failed", err);
      throw new AppError("Couldn't finish linking that account. Try again.", 502);
    }
  },

  async fetchTransactions(accessToken, sinceDate) {
    const plaid = getClient();
    try {
      const response = await plaid.transactionsGet({
        access_token: accessToken,
        start_date: sinceDate.toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        options: { count: 500 },
      });
      return response.data.transactions.map((txn) => ({
        providerTransactionId: txn.transaction_id,
        merchantRaw: txn.merchant_name ?? txn.name,
        amount: txn.amount,
        currency: txn.iso_currency_code ?? "USD",
        date: txn.date,
      }));
    } catch (err) {
      console.error("Plaid transactionsGet failed", err);
      throw new AppError("Couldn't fetch transactions from your bank. Try again.", 502);
    }
  },
};
