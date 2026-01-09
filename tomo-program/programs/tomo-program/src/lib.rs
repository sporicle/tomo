use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;

declare_id!("GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM");

pub const TOMO_SEED: &[u8] = b"tomo";

#[ephemeral]
#[program]
pub mod tomo_program {
    use super::*;

    pub fn init(ctx: Context<Init>, uid: String) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;
        tomo.owner = ctx.accounts.payer.key();
        tomo.uid = uid;
        tomo.hunger = 100;
        tomo.last_fed = Clock::get()?.unix_timestamp;
        tomo.coins = 0;
        tomo.item_drop = false;
        tomo.inventory = [0u8; 8];
        Ok(())
    }

    pub fn get_coin(ctx: Context<GetCoin>) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;
        tomo.coins += 1;
        Ok(())
    }

    pub fn feed(ctx: Context<Feed>) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;
        require!(tomo.coins >= 10, TomoError::NotEnoughCoins);
        tomo.coins -= 10;
        tomo.hunger = tomo.hunger.saturating_sub(30);
        tomo.last_fed = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Delegate the Tomo account to the ephemeral rollup
    pub fn delegate(ctx: Context<DelegateInput>, uid: String) -> Result<()> {
        ctx.accounts.delegate_tomo(
            &ctx.accounts.payer,
            &[TOMO_SEED, uid.as_bytes()],
            DelegateConfig::default(),
        )?;
        Ok(())
    }

    /// Undelegate the Tomo account from the ephemeral rollup
    pub fn undelegate(ctx: Context<Undelegate>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.tomo.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }

    /// Delete the Tomo account, returning rent to the owner
    pub fn delete(_ctx: Context<Delete>) -> Result<()> {
        Ok(())
    }

    /// Trigger an item drop - sets item_drop to true if false
    pub fn trigger_item_drop(ctx: Context<TriggerItemDrop>) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;
        if !tomo.item_drop {
            tomo.item_drop = true;
        }
        Ok(())
    }

    /// Open an item drop - uses VRF to add a random item (1-5) to inventory
    /// Does nothing if inventory is full or no item drop is available
    pub fn open_item_drop(ctx: Context<OpenItemDrop>, client_seed: u8) -> Result<()> {
        let tomo = &ctx.accounts.tomo;

        // Check if there's an item drop available
        if !tomo.item_drop {
            msg!("No item drop available");
            return Ok(());
        }

        // Check if inventory has space (look for a 0 slot)
        let has_space = tomo.inventory.iter().any(|&item| item == 0);
        if !has_space {
            msg!("Inventory is full");
            return Ok(());
        }

        msg!("Requesting randomness for item drop...");
        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::ConsumeRandomness::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: ctx.accounts.tomo.key(),
                is_signer: false,
                is_writable: true,
            }]),
            ..Default::default()
        });

        ctx.accounts.invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    /// VRF callback - receives randomness and adds item to inventory
    pub fn consume_randomness(ctx: Context<ConsumeRandomness>, randomness: [u8; 32]) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;

        // Set item_drop to false
        tomo.item_drop = false;

        // Find first empty slot (0) in inventory
        if let Some(slot) = tomo.inventory.iter().position(|&item| item == 0) {
            // Generate random item 1-5 using VRF SDK helper
            let random_item = ephemeral_vrf_sdk::rnd::random_u8_with_range(&randomness, 1, 9);
            tomo.inventory[slot] = random_item;
            msg!("Added item {} to inventory slot {}", random_item, slot);
        } else {
            msg!("Inventory was full, no item added");
        }

        Ok(())
    }

    /// Use an item at a specific index - removes it from inventory
    /// Does nothing if the slot is empty (contains 0)
    pub fn use_item(ctx: Context<UseItem>, index: u8) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;

        // Validate index is within bounds
        if index >= 8 {
            msg!("Invalid inventory index");
            return Ok(());
        }

        let slot = index as usize;

        // Check if the slot has an item (not 0)
        if tomo.inventory[slot] == 0 {
            msg!("Slot {} is empty, nothing to use", slot);
            return Ok(());
        }

        // Use the item (set to 0)
        let used_item = tomo.inventory[slot];
        tomo.inventory[slot] = 0;
        msg!("Used item {} from slot {}", used_item, slot);

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(uid: String)]
pub struct Init<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Tomo::INIT_SPACE,
        seeds = [TOMO_SEED, uid.as_bytes()],
        bump
    )]
    pub tomo: Account<'info, Tomo>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetCoin<'info> {
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[derive(Accounts)]
pub struct Feed<'info> {
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(uid: String)]
pub struct DelegateInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The Tomo PDA to delegate
    #[account(mut, del, seeds = [TOMO_SEED, uid.as_bytes()], bump)]
    pub tomo: AccountInfo<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct Undelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[derive(Accounts)]
pub struct Delete<'info> {
    #[account(
        mut,
        close = owner,
        has_one = owner,
    )]
    pub tomo: Account<'info, Tomo>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct TriggerItemDrop<'info> {
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[vrf]
#[derive(Accounts)]
pub struct OpenItemDrop<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
    /// CHECK: Oracle queue for VRF
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_EPHEMERAL_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    /// SECURITY: Validates callback is from VRF program
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[derive(Accounts)]
pub struct UseItem<'info> {
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[account]
#[derive(InitSpace)]
pub struct Tomo {
    pub owner: Pubkey,
    #[max_len(32)]
    pub uid: String,
    pub hunger: u8,
    pub last_fed: i64,
    pub coins: u64,
    pub item_drop: bool,
    pub inventory: [u8; 8],
}

#[error_code]
pub enum TomoError {
    #[msg("Not enough coins to feed")]
    NotEnoughCoins,
}
