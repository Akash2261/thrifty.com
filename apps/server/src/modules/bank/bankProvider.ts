export interface RawTransaction {
  providerTransactionId: string;
  merchantRaw: string;
  amount: number;
  currency: string;
  date: string;
}

export interface LinkSessionResult {
  linkToken: string;
  hostedLinkUrl: string;
}

export interface LinkPollResult {
  finished: boolean;
  publicToken?: string;
  institutionName?: string;
}

export interface ExchangeResult {
  accessToken: string;
  providerItemId: string;
  institutionName: string | null;
  aaSessionId?: string;
  bankConsentId?: string;
}

export interface BankDataProvider {
  createLinkSession(userId: string): Promise<LinkSessionResult>;
  pollLinkSession(linkToken: string): Promise<LinkPollResult>;
  exchangePublicToken(publicToken: string): Promise<ExchangeResult>;
  fetchTransactions(accessToken: string, sinceDate: Date): Promise<RawTransaction[]>;
}
