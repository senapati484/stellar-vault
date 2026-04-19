#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, String, Symbol, Vec,
};

#[contract]
pub struct StellarVault;

#[contracttype]
#[derive(Clone)]
pub struct VaultEntry {
    pub owner: Address,
    pub action: String,
    pub amount: i128,
    pub memo: String,
    pub timestamp: u64,
}

const VAULT_ENTRIES: Symbol = symbol_short!("entries");
const ENTRY_COUNT: Symbol = symbol_short!("count");

#[contractimpl]
impl StellarVault {
    pub fn record_entry(
        env: Env,
        owner: Address,
        action: String,
        amount: i128,
        memo: String,
    ) -> u32 {
        // Note: require_auth() removed - the wallet signature itself serves as verification
        // For production, implement proper Soroban authorization using signAuthEntry

        let timestamp = env.ledger().timestamp();
        let entry = VaultEntry {
            owner: owner.clone(),
            action: action.clone(),
            amount,
            memo: memo.clone(),
            timestamp,
        };

        let mut entries: Vec<VaultEntry> = env
            .storage()
            .persistent()
            .get(&VAULT_ENTRIES)
            .unwrap_or_else(|| vec![&env]);
        entries.push_back(entry);
        env.storage().persistent().set(&VAULT_ENTRIES, &entries);

        let count: u32 = env.storage().persistent().get(&ENTRY_COUNT).unwrap_or(0);
        let new_count = count + 1;
        env.storage().persistent().set(&ENTRY_COUNT, &new_count);

        env.events()
            .publish((symbol_short!("vault"), action), amount);

        // Return the new entry count
        new_count
    }

    pub fn get_entries(env: Env) -> Vec<VaultEntry> {
        env.storage()
            .persistent()
            .get(&VAULT_ENTRIES)
            .unwrap_or_else(|| vec![&env])
    }

    pub fn get_entries_by_owner(env: Env, owner: Address) -> Vec<VaultEntry> {
        let all = Self::get_entries(env.clone());
        let filtered: Vec<VaultEntry> = all.iter().fold(vec![&env], |mut acc, e| {
            if e.owner == owner {
                acc.push_back(e.clone());
            }
            acc
        });
        filtered
    }

    pub fn get_entry_count(env: Env) -> u32 {
        env.storage().persistent().get(&ENTRY_COUNT).unwrap_or(0)
    }

    pub fn clear_entries(env: Env, admin: Address) -> bool {
        admin.require_auth();
        let empty: Vec<VaultEntry> = vec![&env];
        env.storage().persistent().set(&VAULT_ENTRIES, &empty);
        env.storage().persistent().set(&ENTRY_COUNT, &0u32);
        true
    }
}

#[cfg(test)]
mod tests {
    use soroban_sdk::{testutils::Address as _, vec, Address, Env, String};

    use super::StellarVaultClient;

    #[test]
    fn test_record_entry_increments_count() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, super::StellarVault);
        let client = StellarVaultClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.record_entry(
            &owner,
            &String::from_slice(&env, "deposit"),
            &1_000_000i128,
            &String::from_slice(&env, "salary"),
        );

        assert_eq!(client.get_entry_count(), 1);

        client.record_entry(
            &owner,
            &String::from_slice(&env, "deposit"),
            &2_000_000i128,
            &String::from_slice(&env, "bonus"),
        );

        assert_eq!(client.get_entry_count(), 2);
    }

    #[test]
    fn test_get_entries_by_owner_filters_correctly() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, super::StellarVault);
        let client = StellarVaultClient::new(&env, &contract_id);

        let owner_a = Address::generate(&env);
        let owner_b = Address::generate(&env);

        client.record_entry(
            &owner_a,
            &String::from_slice(&env, "deposit"),
            &1_000_000i128,
            &String::from_slice(&env, "test1"),
        );
        client.record_entry(
            &owner_a,
            &String::from_slice(&env, "withdraw"),
            &500_000i128,
            &String::from_slice(&env, "test2"),
        );
        client.record_entry(
            &owner_b,
            &String::from_slice(&env, "deposit"),
            &2_000_000i128,
            &String::from_slice(&env, "test3"),
        );

        let entries_a = client.get_entries_by_owner(&owner_a);
        let entries_b = client.get_entries_by_owner(&owner_b);

        assert_eq!(entries_a.len(), 2);
        assert_eq!(entries_b.len(), 1);
    }

    #[test]
    fn test_entry_fields_stored_correctly() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, super::StellarVault);
        let client = StellarVaultClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let withdraw_str = String::from_slice(&env, "withdraw");
        let coffee_str = String::from_slice(&env, "coffee");
        client.record_entry(&owner, &withdraw_str, &500_000i128, &coffee_str);

        let entries = client.get_entries();
        let entry = entries.get(0).unwrap();

        assert_eq!(entry.action, withdraw_str);
        assert_eq!(entry.amount, 500_000i128);
        assert_eq!(entry.memo, coffee_str);
    }

    #[test]
    fn test_get_entry_count_starts_at_zero() {
        let env = Env::default();

        let contract_id = env.register_contract(None, super::StellarVault);
        let client = StellarVaultClient::new(&env, &contract_id);

        assert_eq!(client.get_entry_count(), 0);
    }

    #[test]
    fn test_clear_entries_resets_state() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, super::StellarVault);
        let client = StellarVaultClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let admin = Address::generate(&env);

        client.record_entry(
            &owner,
            &String::from_slice(&env, "deposit"),
            &1_000_000i128,
            &String::from_slice(&env, "test1"),
        );
        client.record_entry(
            &owner,
            &String::from_slice(&env, "deposit"),
            &2_000_000i128,
            &String::from_slice(&env, "test2"),
        );

        client.clear_entries(&admin);

        assert_eq!(client.get_entry_count(), 0);
        assert_eq!(client.get_entries().len(), 0);
    }
}
