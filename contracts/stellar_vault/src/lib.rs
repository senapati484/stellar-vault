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
        let timestamp = env.ledger().timestamp();
        
        let entry = VaultEntry {
            owner: owner.clone(),
            action: action.clone(),
            amount,
            memo: memo.clone(),
            timestamp,
        };

        let entries: Vec<VaultEntry> = match env.storage().persistent().get(&VAULT_ENTRIES) {
            Some(v) => v,
            None => vec![&env],
        };
        
        let mut new_entries = entries;
        new_entries.push_back(entry);
        env.storage().persistent().set(&VAULT_ENTRIES, &new_entries);

        let count: u32 = match env.storage().persistent().get(&ENTRY_COUNT) {
            Some(v) => v,
            None => 0,
        };
        let new_count = count + 1;
        env.storage().persistent().set(&ENTRY_COUNT, &new_count);

        env.events()
            .publish((symbol_short!("vault"), action), amount);

        new_count
    }

    pub fn get_entries(env: Env) -> Vec<VaultEntry> {
        match env.storage().persistent().get(&VAULT_ENTRIES) {
            Some(v) => v,
            None => vec![&env],
        }
    }

    pub fn get_entries_by_owner(env: Env, owner: Address) -> Vec<VaultEntry> {
        let all = Self::get_entries(env.clone());
        let filtered: Vec<VaultEntry> = all.iter().fold(vec![&env], |mut acc, e| {
            if e.owner == owner {
                let _ = acc.push_back(e.clone());
            }
            acc
        });
        filtered
    }

    pub fn get_entry_count(env: Env) -> u32 {
        match env.storage().persistent().get(&ENTRY_COUNT) {
            Some(v) => v,
            None => 0,
        }
    }

    pub fn clear_entries(env: Env, admin: Address) -> bool {
        admin.require_auth();
        let empty: Vec<VaultEntry> = vec![&env];
        env.storage().persistent().set(&VAULT_ENTRIES, &empty);
        env.storage().persistent().set(&ENTRY_COUNT, &0u32);
        true
    }
}