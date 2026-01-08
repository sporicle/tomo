# Solana Mobile Development Guide

A concise reference guide for Solana Mobile functionality and patterns using `@wallet-ui/react-native-web3js`.

## Core Architecture

**Provider Setup** - Layered provider architecture for theme, query client, cluster management, Solana wallet, and authentication.

- `components/app-providers.tsx` - Main provider setup with `MobileWalletProvider`, `ClusterProvider`, `AuthProvider`, and `QueryClientProvider`
- `components/cluster/cluster-provider.tsx` - Network/cluster management
- `components/auth/auth-provider.tsx` - Authentication state and sign-in/sign-out
- `constants/app-config.ts` - App configuration including cluster definitions

## Wallet Connection

**Core Hook** - `useMobileWallet` from `@wallet-ui/react-native-web3js` provides account, connection, connect/disconnect, sign-in, transaction signing, and message signing.

- `components/solana/wallet-ui-button-connect.tsx` - Connect wallet button component
- `components/solana/wallet-ui-button-disconnect.tsx` - Disconnect wallet button component
- `components/solana/wallet-ui-dropdown.tsx` - Wallet dropdown with connect, copy address, view explorer, and disconnect options
- `components/solana/base-button.tsx` - Reusable button component with wallet UI theme
- `components/solana/use-wallet-ui-theme.tsx` - Theme hook for wallet UI components

## Account Management

**Balance Queries** - Fetch and display SOL balance for accounts with React Query caching and invalidation.

- `components/account/use-get-balance.tsx` - Hook to get account balance with query key and invalidation helpers
- `components/account/account-ui-balance.tsx` - UI component to display account balance
- `components/account/account-feature.tsx` - Complete account view with balance, buttons, and token accounts

## Transactions

**Transaction Creation & Sending** - Create, sign, and send SOL transfers with proper blockhash handling and confirmation.

- `components/account/create-transaction.tsx` - Transaction builder that fetches latest blockhash and creates VersionedTransaction
- `components/account/use-transfer-sol.tsx` - Mutation hook for sending SOL transfers with balance invalidation
- `components/account/account-feature-send.tsx` - UI component for sending SOL with form inputs
- `components/account/use-request-airdrop.tsx` - Mutation hook for requesting airdrops (devnet/testnet only)
- `components/account/account-feature-airdrop.tsx` - UI component for requesting airdrops

## Token Operations

**Token Account Queries** - Fetch token accounts (both Token Program and Token-2022) and display balances.

- `components/account/use-get-token-accounts.tsx` - Hook to get all token accounts for an address
- `components/account/use-get-token-account-balance.tsx` - Hook to get balance for a specific token account
- `components/account/account-ui-token-accounts.tsx` - UI component to display list of token accounts
- `components/account/account-ui-token-balance.tsx` - UI component to display token account balance

## Network/Cluster Management

**Cluster Switching** - Manage network selection (devnet/testnet/mainnet) and generate explorer URLs.

- `components/cluster/cluster-provider.tsx` - Provider for cluster selection and explorer URL generation
- `components/cluster/cluster.ts` - Cluster type definition
- `components/cluster/cluster-network.ts` - Cluster network enum
- `components/cluster/cluster-ui-version.tsx` - Display Solana cluster version info
- `components/cluster/cluster-ui-genesis-hash.tsx` - Display cluster genesis hash
- `components/settings/settings-ui-cluster.tsx` - Settings UI for cluster selection

## Message Signing

**Sign Messages** - Sign arbitrary messages with the connected wallet.

- `components/demo/demo-feature-sign-message.tsx` - Hook and UI component for signing messages

## UI Components

**Reusable Components** - Base components and patterns for wallet UI.

- `components/solana/base-button.tsx` - Base button with wallet theme
- `components/solana/use-wallet-ui-theme.tsx` - Theme hook for consistent styling
- `components/account/account-ui-buttons.tsx` - Navigation buttons for account actions
- `components/account/account-feature-receive.tsx` - Receive screen with QR code and address display

## Data Fetching Patterns

**React Query Integration** - Patterns for querying Solana data with proper cache management.

- All hooks in `components/account/` - Examples of query hooks with endpoint-aware query keys
- Query keys always include `endpoint` to prevent cache collisions when switching networks
- Invalidation helpers follow pattern: `use[Resource]Invalidate` for cache invalidation after mutations

## Utility Functions

**Helper Functions** - Common utilities for address formatting and value conversion.

- `utils/ellipsify.ts` - Ellipsify addresses for display (e.g., "AbCd...XyZz")
- `utils/lamports-to-sol.ts` - Convert lamports to SOL with 5 decimal precision

## Settings

**Settings UI** - Account and cluster settings management.

- `components/settings/settings-ui-account.tsx` - Account connection status and disconnect
- `components/settings/settings-ui-cluster.tsx` - Cluster selection and info display

## Key Patterns

1. **Provider Hierarchy:** Theme → QueryClient → Cluster → Solana → Auth
2. **Query Keys:** Always include `endpoint` to prevent cache collisions when switching networks
3. **Transaction Flow:** Create → Sign & Send → Confirm → Invalidate queries
4. **Account Checks:** Always verify `account` exists before accessing `account.publicKey`

## Common Gotchas

1. Network switching re-initializes `MobileWalletProvider` and may disconnect wallet
2. Always fetch fresh blockhash before creating transactions
3. Use `uiAmount` from token balance queries instead of manual decimal division
4. Invalidate queries after mutations to keep UI in sync
